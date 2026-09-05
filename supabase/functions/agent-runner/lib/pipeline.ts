/**
 * The autonomous stage pipeline.
 *
 * Executes planning → requirements → architecture → implementation → testing →
 * security → review, writing into the existing schema as it goes, and then
 * parks the run at `ready_for_review`.
 *
 * Design notes worth reading before changing anything here:
 *
 *  • RESUME, DON'T RESTART. A run that was recovered from a stale state may
 *    already have completed stages. Those are skipped and their conclusions
 *    are rebuilt from `activity_events`, so recovery costs one stage rather
 *    than the whole run.
 *  • DEADLINE. A single wall-clock budget covers the entire run; it is checked
 *    between stages AND enforced by aborting the in-flight model call.
 *  • HEARTBEAT. `runs.updated_at` is touched on an interval while the pipeline
 *    is alive. That is the signal `recoverStaleRuns` uses to tell a busy run
 *    from a dead one.
 *  • TERMINATION. The only statuses this module writes to `runs` are
 *    `ready_for_review` (success) and `failed`. It never writes `approved`,
 *    `rejected`, `merged` or `revision_requested`, and it never inserts an
 *    approval.
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.114.0";
import type { RunnerConfig } from "./config.ts";
import { completeJson, OpenRouterError } from "./openrouter.ts";
import { HttpError } from "./http.ts";
import { describe, TimeoutError } from "./retry.ts";
import {
  AGENT_NAMES,
  STAGES,
  type AgentKey,
  type PlannedFile,
  type StageDefinition,
  type StageOutput,
} from "./stages.ts";
import { systemPrompt, userPrompt, type StageContext } from "./prompts.ts";
import {
  asNonNegativeInt,
  asNullableString,
  asRecordArray,
  asString,
  clampText,
} from "./json.ts";
import {
  EVENT,
  STAGE_COLUMNS,
  TABLE,
  type AgentRow,
  type RunRow,
  type ProjectRow,
  type TaskRow,
} from "./schema.ts";
import {
  beginAgentActivity,
  completeRunForReview,
  ensureProposedChange,
  ensureStage,
  failStage,
  finishAgentActivity,
  heartbeat,
  listTasksForRun,
  logActivity,
  replaceChangedFiles,
  requireAgent,
  resolveAgents,
  setTaskStatus,
  startStage,
  succeedStage,
  updateChangeSecuritySummary,
  updateChangeTests,
  upsertPlannedTasks,
} from "./repo.ts";
import { exec } from "./exec.ts";

/** A stage exhausted its retries. */
export class StageFailure extends Error {
  constructor(
    readonly stageKey: string,
    message: string,
    /** Coarse classification, used to pick an honest HTTP status. */
    readonly reason: "upstream" | "timeout" | "internal" = "internal",
  ) {
    super(message);
    this.name = "StageFailure";
  }
}

/** The run exceeded its overall wall-clock budget. */
export class RunTimeout extends Error {
  constructor(readonly runId: string, readonly ms: number) {
    super(`Run ${runId} exceeded its ${ms}ms budget and was stopped.`);
    this.name = "RunTimeout";
  }
}

export interface PipelineInput {
  run: RunRow;
  project: ProjectRow;
  workspaceId: string;
  /** User id that triggered this attempt, when it was a user request. */
  triggeredBy: string | null;
  /** 1-based attempt number for this run. */
  attempt: number;
  /** Error recorded by the previous failed attempt, if any. */
  previousError: string | null;
}

export interface StageResult {
  stageKey: string;
  status: "completed" | "skipped";
  summary: string;
  model: string | null;
  totalTokens: number;
}

export interface PipelineResult {
  runId: string;
  status: "ready_for_review" | "failed";
  stages: StageResult[];
  proposedChangeId: string | null;
  attempt: number;
  durationMs: number;
  error: { stage: string; message: string; reason: string } | null;
}

/** How often to touch `runs.updated_at` while alive. */
function heartbeatIntervalMs(config: RunnerConfig): number {
  const thirdOfStaleWindow = (config.staleAfterMinutes * 60_000) / 3;
  return Math.max(10_000, Math.min(60_000, Math.floor(thirdOfStaleWindow)));
}

export async function executeRun(
  admin: SupabaseClient,
  config: RunnerConfig,
  input: PipelineInput,
): Promise<PipelineResult> {
  const startedAt = Date.now();
  const deadline = startedAt + config.runTimeoutMs;
  const { run, project, workspaceId } = input;

  const agents = await resolveAgents(admin, config);

  /* -- liveness heartbeat --------------------------------------------- */
  // Cleared in the `finally` below, so the isolate is never held open.
  const timer = setInterval(() => {
    heartbeat(admin, config, run.id).catch((error) =>
      console.warn(`[agent-runner] heartbeat failed for ${run.id}:`, describe(error)),
    );
  }, heartbeatIntervalMs(config));

  const controller = new AbortController();
  // Enforces the run-level budget by aborting the in-flight model call.
  const deadlineTimer = setTimeout(() => controller.abort(), config.runTimeoutMs);

  /* -- rebuild resumable state ---------------------------------------- */
  const state = await loadResumableState(admin, config, run);
  const stageResults: StageResult[] = [];

  await logActivity(admin, config, {
    workspaceId,
    projectId: project.id,
    runId: run.id,
    userId: input.triggeredBy,
    agentId: agents.get("manager")?.id ?? null,
    eventType: EVENT.runStarted,
    message: `${AGENT_NAMES.manager ?? "Manager Agent"} started run ${shortId(run.id)} (attempt ${input.attempt}/${config.maxRunAttempts}).`,
    metadata: { attempt: input.attempt, max_attempts: config.maxRunAttempts, stage_count: STAGES.length },
  });

  try {
    for (const stage of STAGES) {
      if (Date.now() > deadline || controller.signal.aborted) throw new RunTimeout(run.id, config.runTimeoutMs);

      const alreadyDone = state.completedStages.get(stage.key);
      if (alreadyDone) {
        // Resuming after a recovery: keep the earlier conclusion and move on.
        state.prior.push({ stage: stage.key, title: stage.title, summary: alreadyDone });
        stageResults.push({
          stageKey: stage.key,
          status: "skipped",
          summary: alreadyDone,
          model: null,
          totalTokens: 0,
        });
        continue;
      }

      const result = await runStage(admin, config, {
        stage,
        agents,
        state,
        input,
        controller,
        deadline,
      });

      stageResults.push(result);
      await heartbeat(admin, config, run.id);
    }

    /* -- park the run for a human ------------------------------------ */
    if (!state.proposedChangeId) {
      throw new StageFailure(
        "implementation",
        "The implementation stage did not produce a proposed change, so there is nothing to review.",
      );
    }

    await completeRunForReview(admin, config, run.id);

    await logActivity(admin, config, {
      workspaceId,
      projectId: project.id,
      runId: run.id,
      userId: input.triggeredBy,
      agentId: agents.get("reviewer")?.id ?? null,
      eventType: EVENT.runReadyForReview,
      message: `Run ${shortId(run.id)} is ready for review. Awaiting a human decision — no approval has been recorded.`,
      metadata: {
        stages_completed: stageResults.filter((s) => s.status === "completed").length,
        stages_total: STAGES.length,
        proposed_change_id: state.proposedChangeId,
        files_changed: state.files.length,
        tests_passed: state.testsPassed,
        tests_total: state.testsTotal,
        attempt: input.attempt,
      },
    });

    return {
      runId: run.id,
      status: "ready_for_review",
      stages: stageResults,
      proposedChangeId: state.proposedChangeId,
      attempt: input.attempt,
      durationMs: Date.now() - startedAt,
      error: null,
    };
  } catch (error) {
    const stageKey = error instanceof StageFailure ? error.stageKey : "pipeline";
    const message = error instanceof Error ? error.message : String(error);

    await logActivity(admin, config, {
      workspaceId,
      projectId: project.id,
      runId: run.id,
      userId: input.triggeredBy,
      agentId: agents.get("manager")?.id ?? null,
      eventType: EVENT.runFailed,
      message: `Run ${shortId(run.id)} failed in ${stageKey}: ${message.slice(0, 300)}`,
      metadata: { stage: stageKey, attempt: input.attempt, error: message.slice(0, 1000) },
    });

    return {
      runId: run.id,
      status: "failed",
      stages: stageResults,
      proposedChangeId: state.proposedChangeId,
      attempt: input.attempt,
      durationMs: Date.now() - startedAt,
      error: {
        stage: stageKey,
        message,
        reason: error instanceof StageFailure ? error.reason : "internal",
      },
    };
  } finally {
    clearInterval(timer);
    clearTimeout(deadlineTimer);
  }
}

/* ------------------------------------------------------------------ */
/* One stage                                                           */
/* ------------------------------------------------------------------ */

interface RunStageArgs {
  stage: StageDefinition;
  agents: Map<string, AgentRow>;
  state: ResumableState;
  input: PipelineInput;
  controller: AbortController;
  deadline: number;
}

async function runStage(
  admin: SupabaseClient,
  config: RunnerConfig,
  args: RunStageArgs,
): Promise<StageResult> {
  const { stage, agents, state, input, controller } = args;
  const { run, project, workspaceId } = input;
  const agent = requireAgent(agents, stage.agentKey);
  const agentLabel = AGENT_NAMES[stage.agentKey] ?? stage.agentKey;

  const stageRow = await ensureStage(admin, config, run.id, stage);
  await startStage(admin, config, stageRow);

  const activity = await beginAgentActivity(admin, config, {
    runId: run.id,
    stageId: stageRow.id,
    agentId: agent.id,
    taskDescription: `${stage.title}: ${stage.purpose}`,
  });

  await logActivity(admin, config, {
    workspaceId,
    projectId: project.id,
    runId: run.id,
    userId: input.triggeredBy,
    agentId: agent.id,
    eventType: EVENT.stageStarted,
    message: `${agentLabel} started ${stage.title.toLowerCase()}.`,
    metadata: { stage: stage.key, stage_number: stage.number, attempt: input.attempt },
  });

  // Show the stage's own tasks as in progress in the dashboard.
  const ownedTaskIds = state.tasks
    .filter((task) => task.assigned_agent_id === agent.id && task.status !== "completed")
    .map((task) => task.id);
  for (const taskId of ownedTaskIds) {
    await setTaskStatus(admin, config, taskId, "in_progress").catch(() => undefined);
  }

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= config.maxStageAttempts; attempt += 1) {
    if (Date.now() > args.deadline || controller.signal.aborted) {
      throw new RunTimeout(run.id, config.runTimeoutMs);
    }

    try {
      await heartbeat(admin, config, run.id);

      const context: StageContext = {
        project,
        run,
        stage,
        prior: state.prior,
        files: state.files,
        tasks: state.tasks.map((task) => ({
          title: task.title,
          description: task.description,
          agent_key: agentKeyForId(agents, task.assigned_agent_id) ?? stage.agentKey,
        })),
        existingTasks: state.tasks.map((task) => ({ title: task.title, status: task.status })),
        attempt,
        previousError: attempt === 1 ? input.previousError : describe(lastError),
      };

      const { json, result } = await completeJson(config, {
        system: systemPrompt(context),
        user: userPrompt(context),
        label: `stage:${stage.key}`,
        signal: controller.signal,
        attempts: 1,
      });

      const output = normaliseStageOutput(stage, json, stage.agentKey);
      await applyStageOutput(admin, config, stage, state, output, agent, input);

      await succeedStage(admin, config, stageRow);
      await finishAgentActivity(admin, config, activity.id, "completed");

      for (const taskId of ownedTaskIds) {
        await setTaskStatus(admin, config, taskId, "completed").catch(() => undefined);
      }

      state.prior.push({ stage: stage.key, title: stage.title, summary: output.summary });
      state.completedStages.set(stage.key, output.summary);

      await logActivity(admin, config, {
        workspaceId,
        projectId: project.id,
        runId: run.id,
        userId: input.triggeredBy,
        agentId: agent.id,
        eventType: EVENT.stageCompleted,
        message: `${agentLabel} finished ${stage.title.toLowerCase()}: ${output.summary.slice(0, 300)}`,
        metadata: {
          stage: stage.key,
          stage_number: stage.number,
          attempt,
          model: result.model,
          tokens: result.usage?.total_tokens ?? null,
          detail: clampText(output.detail ?? null, 4000),
        },
      });

      return {
        stageKey: stage.key,
        status: "completed",
        summary: output.summary,
        model: result.model,
        totalTokens: result.usage?.total_tokens ?? 0,
      };
    } catch (error) {
      lastError = error;

      if (error instanceof RunTimeout) throw error;

      // A cancellation or budget overrun is not something another attempt fixes.
      if (controller.signal.aborted) throw new RunTimeout(run.id, config.runTimeoutMs);

      const message = error instanceof OpenRouterError ? error.message : describe(error);
      const canRetry = attempt < config.maxStageAttempts;

      console.error(
        `[agent-runner] stage ${stage.key} attempt ${attempt}/${config.maxStageAttempts} failed: ${message}`,
      );

      await logActivity(admin, config, {
        workspaceId,
        projectId: project.id,
        runId: run.id,
        userId: input.triggeredBy,
        agentId: agent.id,
        eventType: canRetry ? EVENT.stageRetried : EVENT.stageFailed,
        message: canRetry
          ? `${agentLabel} hit an error during ${stage.title.toLowerCase()} and is retrying (${attempt}/${config.maxStageAttempts}): ${message.slice(0, 200)}`
          : `${agentLabel} failed ${stage.title.toLowerCase()} after ${attempt} attempts: ${message.slice(0, 200)}`,
        metadata: { stage: stage.key, attempt, error: message.slice(0, 1000), will_retry: canRetry },
      });

      if (!canRetry) break;
      await heartbeat(admin, config, run.id);
    }
  }

  const finalMessage =
    lastError instanceof OpenRouterError
      ? lastError.message
      : describe(lastError ?? new Error("Unknown stage failure"));

  await failStage(admin, config, stageRow, finalMessage);
  await finishAgentActivity(admin, config, activity.id, "failed");
  for (const taskId of ownedTaskIds) {
    await setTaskStatus(admin, config, taskId, "failed").catch(() => undefined);
  }

  // Always a StageFailure, so the caller keeps the identity of the stage that
  // died; `reason` carries the upstream/timeout/internal distinction.
  if (lastError instanceof OpenRouterError) throw new StageFailure(stage.key, finalMessage, "upstream");
  if (lastError instanceof TimeoutError) throw new StageFailure(stage.key, finalMessage, "timeout");
  if (lastError instanceof HttpError) throw new StageFailure(stage.key, lastError.message, "internal");
  throw new StageFailure(stage.key, finalMessage, "internal");
}

/* ------------------------------------------------------------------ */
/* Stage output → schema writes                                        */
/* ------------------------------------------------------------------ */

async function applyStageOutput(
  admin: SupabaseClient,
  config: RunnerConfig,
  stage: StageDefinition,
  state: ResumableState,
  output: StageOutput,
  agent: AgentRow,
  input: PipelineInput,
): Promise<void> {
  const { project, workspaceId } = input;

  switch (stage.key) {
    case "planning":
    case "requirements": {
      const planned = output.tasks ?? [];
      if (planned.length === 0) break;
      const created = await upsertPlannedTasks(admin, config, {
        projectId: project.id,
        runId: input.run.id,
        tasks: planned,
        agents: state.agents,
        fallbackAgentKey: stage.agentKey as AgentKey,
      });
      state.tasks = created.length ? created : state.tasks;
      await logActivity(admin, config, {
        workspaceId,
        projectId: project.id,
        runId: input.run.id,
        agentId: agent.id,
        eventType: EVENT.tasksPlanned,
        message: `${AGENT_NAMES[agent.agent_key] ?? agent.name} added ${planned.length} task(s) during ${stage.title.toLowerCase()}.`,
        metadata: {
          stage: stage.key,
          planned: planned.length,
          titles: planned.slice(0, 12).map((task) => task.title),
        },
      });
      break;
    }

    case "implementation": {
      const files = output.files ?? [];
      if (files.length === 0) {
        throw new StageFailure(
          stage.key,
          "The implementation stage returned no file changes, so there is nothing to propose.",
        );
      }

      const change = await ensureProposedChange(admin, config, {
        runId: input.run.id,
        title: buildChangeTitle(input.run, output.summary),
        summary: output.detail ?? output.summary,
        sourceBranch: input.run.branch_name,
        targetBranch: project.default_branch,
      });
      state.proposedChangeId = change.id;

      const written = await replaceChangedFiles(admin, config, change.id, files);
      state.files = files;

      await logActivity(admin, config, {
        workspaceId,
        projectId: project.id,
        runId: input.run.id,
        agentId: agent.id,
        eventType: EVENT.changeProposed,
        message: `${AGENT_NAMES[agent.agent_key] ?? agent.name} proposed a change touching ${written} file(s) on ${input.run.branch_name ?? "the run branch"}.`,
        metadata: {
          stage: stage.key,
          proposed_change_id: change.id,
          files: files.map((file) => file.file_path),
          additions: files.reduce((sum, file) => sum + file.additions, 0),
          deletions: files.reduce((sum, file) => sum + file.deletions, 0),
        },
      });
      break;
    }

    case "testing": {
      const tests = output.tests;
      if (tests && state.proposedChangeId) {
        const total = Math.max(tests.total, tests.passed + tests.failed);
        await updateChangeTests(admin, config, state.proposedChangeId, tests.passed, total);
        state.testsPassed = tests.passed;
        state.testsTotal = total;
        await logActivity(admin, config, {
          workspaceId,
          projectId: project.id,
          runId: input.run.id,
          agentId: agent.id,
          eventType: EVENT.testsReported,
          message: `${AGENT_NAMES[agent.agent_key] ?? agent.name} reported ${tests.passed}/${total} tests passing.`,
          metadata: { stage: stage.key, passed: tests.passed, total, notes: clampText(tests.notes, 1000) },
        });
      }
      break;
    }

    case "security": {
      const security = output.security;
      if (security && state.proposedChangeId) {
        const summary = buildSecuritySummary(security.summary, security.risk_level, security.findings.length);
        await updateChangeSecuritySummary(admin, config, state.proposedChangeId, summary);
        await logActivity(admin, config, {
          workspaceId,
          projectId: project.id,
          runId: input.run.id,
          agentId: agent.id,
          eventType: EVENT.securityReviewed,
          message: `${AGENT_NAMES[agent.agent_key] ?? agent.name} assessed risk as ${security.risk_level}: ${security.summary.slice(0, 220)}`,
          metadata: {
            stage: stage.key,
            risk_level: security.risk_level,
            findings: security.findings.slice(0, 20),
          },
        });
      }
      break;
    }

    case "review": {
      const review = output.review;
      if (review && state.proposedChangeId) {
        await logActivity(admin, config, {
          workspaceId,
          projectId: project.id,
          runId: input.run.id,
          agentId: agent.id,
          eventType: EVENT.agentCompleted,
          message: `${AGENT_NAMES[agent.agent_key] ?? agent.name} reviewed the change set: ${review.summary.slice(0, 260)}`,
          metadata: { stage: stage.key, suggestions: review.suggestions.slice(0, 20) },
        });
      }
      break;
    }

    default:
      break;
  }
}

function buildChangeTitle(run: RunRow, summary: string): string {
  const request = run.request_text.replace(/\s+/g, " ").trim();
  const base = request.length > 70 ? `${request.slice(0, 70)}…` : request;
  return base || summary.slice(0, 70) || "Agent-proposed change";
}

function buildSecuritySummary(summary: string, risk: string, findingCount: number): string {
  return `Risk: ${risk}. ${findingCount} finding(s). ${summary}`.slice(0, 4000);
}

/* ------------------------------------------------------------------ */
/* Output normalisation                                                */
/* ------------------------------------------------------------------ */

const VALID_AGENT_KEYS = new Set<string>([
  "manager",
  "product",
  "architect",
  "coding",
  "testing",
  "security",
  "reviewer",
  "documentation",
]);

function normaliseStageOutput(stage: StageDefinition, json: Record<string, unknown>, fallbackAgent: string): StageOutput {
  const summary = clampText(asString(json.summary, "").trim(), 1000) ||
    `${stage.title} completed with no summary from the model.`;

  const output: StageOutput = { summary, detail: asNullableString(json.detail) };

  if (stage.key === "planning" || stage.key === "requirements") {
    output.tasks = asRecordArray(json.tasks)
      .map((task) => {
        const agentKey = asString(task.agent_key, "").trim().toLowerCase();
        return {
          title: asString(task.title, "").trim().slice(0, 180),
          description: asNullableString(task.description),
          agent_key: VALID_AGENT_KEYS.has(agentKey) ? agentKey : fallbackAgent,
        };
      })
      .filter((task) => task.title.length > 0)
      .slice(0, 20);
  }

  if (stage.key === "implementation") {
    output.files = asRecordArray(json.files)
      .map((file) => ({
        file_path: asString(file.file_path, "").trim().slice(0, 500),
        additions: asNonNegativeInt(file.additions, 0),
        deletions: asNonNegativeInt(file.deletions, 0),
        diff_text: asNullableString(file.diff_text),
        summary: asNullableString(file.summary),
      }))
      .filter((file) => file.file_path.length > 0)
      .slice(0, 40);
  }

  if (stage.key === "testing") {
    const raw = (json.tests ?? {}) as Record<string, unknown>;
    const total = asNonNegativeInt(raw.total, 0);
    const passed = Math.min(asNonNegativeInt(raw.passed, 0), total);
    const failed = Math.min(asNonNegativeInt(raw.failed, Math.max(0, total - passed)), Math.max(0, total - passed));
    if (total > 0) {
      output.tests = { total, passed, failed, notes: asNullableString(raw.notes) };
    }
  }

  if (stage.key === "security") {
    const raw = (json.security ?? {}) as Record<string, unknown>;
    const risk = asString(raw.risk_level, "low").toLowerCase();
    const riskLevel = ["low", "medium", "high", "critical"].includes(risk)
      ? (risk as "low" | "medium" | "high" | "critical")
      : "low";
    const findings = asRecordArray(raw.findings)
      .map((finding) => {
        const severity = asString(finding.severity, "info").toLowerCase();
        return {
          title: asString(finding.title, "").trim().slice(0, 200),
          severity: (["info", "low", "medium", "high", "critical"].includes(severity)
            ? severity
            : "info") as "info" | "low" | "medium" | "high" | "critical",
          detail: asString(finding.detail, "").slice(0, 2000),
        };
      })
      .filter((finding) => finding.title.length > 0)
      .slice(0, 30);
    output.security = {
      summary: clampText(asString(raw.summary, summary), 3000) ?? summary,
      risk_level: riskLevel,
      findings,
    };
  }

  if (stage.key === "review") {
    const raw = (json.review ?? {}) as Record<string, unknown>;
    output.review = {
      summary: clampText(asString(raw.summary, summary), 3000) ?? summary,
      suggestions: asRecordArray(raw.suggestions)
        .map((suggestion) => ({
          title: asString(suggestion.title, "").trim().slice(0, 200),
          detail: asString(suggestion.detail, "").slice(0, 2000),
        }))
        .filter((suggestion) => suggestion.title.length > 0)
        .slice(0, 20),
    };
  }

  return output;
}

/* ------------------------------------------------------------------ */
/* Resume support                                                      */
/* ------------------------------------------------------------------ */

interface ResumableState {
  agents: Map<string, AgentRow>;
  prior: Array<{ stage: string; title: string; summary: string }>;
  completedStages: Map<string, string>;
  files: PlannedFile[];
  tasks: TaskRow[];
  proposedChangeId: string | null;
  testsPassed: number;
  testsTotal: number;
}

/**
 * Reconstructs what a previous (interrupted) attempt already accomplished so
 * the current attempt resumes instead of repeating finished work.
 */
async function loadResumableState(
  admin: SupabaseClient,
  config: RunnerConfig,
  run: RunRow,
): Promise<ResumableState> {
  const agents = await resolveAgents(admin, config);

  const [stageRows, taskRows, changeRow, completedEvents] = await Promise.all([
    exec<Array<{ stage_key: string; status: string }>>(config, "select run stages", () =>
      admin.from(TABLE.runStages).select(STAGE_COLUMNS).eq("run_id", run.id),
    ),
    listTasksForRun(admin, config, run.id),
    exec<{ id: string; tests_passed: number; tests_total: number }>(config, "select run change", () =>
      admin
        .from(TABLE.proposedChanges)
        .select("id, tests_passed, tests_total")
        .eq("run_id", run.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ),
    exec<Array<{ message: string | null; metadata: Record<string, unknown> | null }>>(
      config,
      "select stage summaries",
      () =>
        admin
          .from(TABLE.activityEvents)
          .select("message, metadata")
          .eq("run_id", run.id)
          .eq("event_type", EVENT.stageCompleted),
    ),
  ]);

  const completedStages = new Map<string, string>();
  const prior: ResumableState["prior"] = [];

  for (const event of completedEvents ?? []) {
    const stageKey = typeof event.metadata?.stage === "string" ? event.metadata.stage : null;
    if (!stageKey || completedStages.has(stageKey)) continue;
    const definition = STAGES.find((stage) => stage.key === stageKey);
    const summary = (event.message ?? "").replace(/^[^:]*:\s*/, "") || `${definition?.title ?? stageKey} completed.`;
    completedStages.set(stageKey, summary);
    prior.push({ stage: stageKey, title: definition?.title ?? stageKey, summary });
  }

  // Only trust stages the database also marks completed.
  const dbCompleted = new Set(
    (stageRows ?? []).filter((row) => row.status === "completed").map((row) => row.stage_key),
  );
  for (const key of [...completedStages.keys()]) {
    if (!dbCompleted.has(key)) completedStages.delete(key);
  }

  const files: PlannedFile[] = [];
  let proposedChangeId: string | null = null;
  let testsPassed = 0;
  let testsTotal = 0;

  if (changeRow) {
    proposedChangeId = changeRow.id;
    testsPassed = changeRow.tests_passed ?? 0;
    testsTotal = changeRow.tests_total ?? 0;
    const fileRows = await exec<Array<PlannedFile>>(config, "select changed files", () =>
      admin
        .from(TABLE.changedFiles)
        .select("file_path, additions, deletions, diff_text")
        .eq("proposed_change_id", changeRow.id),
    );
    for (const row of fileRows ?? []) files.push({ ...row, summary: null });
  }

  return {
    agents,
    prior,
    completedStages,
    files,
    tasks: taskRows,
    proposedChangeId,
    testsPassed,
    testsTotal,
  };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function agentKeyForId(agents: Map<string, AgentRow>, agentId: string | null): string | null {
  if (!agentId) return null;
  for (const [key, agent] of agents) {
    if (agent.id === agentId) return key;
  }
  return null;
}

function shortId(id: string): string {
  return id.slice(0, 8);
}
