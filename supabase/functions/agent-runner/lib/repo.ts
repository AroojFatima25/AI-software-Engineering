/**
 * All database writes for the agent pipeline.
 *
 * Two invariants are enforced structurally, not by convention:
 *
 * 1. `approvals` is UNWRITABLE from this module. Every write funnels through
 *    `table()`, which throws if handed the approvals table. Human review
 *    decisions arrive only via the `submit_approval` RPC from an authenticated
 *    user, so the agent side cannot manufacture an approval by accident or by
 *    prompt injection.
 *
 * 2. Every stage / proposed-change write is IDEMPOTENT (select-then-update on
 *    a natural key), so a requeued run resumes instead of duplicating rows.
 *
 * Writes run on the service_role client because the schema deliberately denies
 * the browser client INSERT on these tables; see the header comment in
 * `src/lib/workspace.ts`.
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.114.0";
import type { RunnerConfig } from "./config.ts";
import { HttpError } from "./http.ts";
import { describe } from "./retry.ts";
import { DbError, exec } from "./exec.ts";
import {
  AGENT_COLUMNS,
  CHANGE_STATUS_AGENT_WRITES,
  RUN_STATUS_AGENT_TERMINAL,
  STAGE_COLUMNS,
  TABLE,
  type AgentActivityRow,
  type AgentRow,
  type ChangeStatus,
  type ProposedChangeRow,
  type RunRow,
  type RunStageRow,
  type RunStatus,
  type StageStatus,
  type TaskRow,
  type TaskStatus,
} from "./schema.ts";
import { AGENTS, type AgentKey, type PlannedFile, type PlannedTask, type StageDefinition } from "./stages.ts";
import { clampText } from "./json.ts";

/**
 * The guard: rejects the approvals table and returns a safe table handle.
 * Called for EVERY read and write in this module.
 */
function table(client: SupabaseClient, name: string) {
  if (name === TABLE.approvals) {
    // Not a soft warning — a hard stop. Nothing in the agent pipeline has any
    // business writing a human approval decision.
    throw new HttpError(
      500,
      "policy_violation",
      "The agent runner is not permitted to read or write the `approvals` table. Approvals are created only by the submit_approval RPC on behalf of a signed-in user.",
    );
  }
  return client.from(name);
}

/* ------------------------------------------------------------------ */
/* Agents                                                              */
/* ------------------------------------------------------------------ */

/**
 * Resolves agent_key → agents.id.
 *
 * `run_agent_activity.agent_id` is NOT NULL, so a missing agent row would fail
 * every stage. When `AGENT_RUNNER_AUTOCREATE_AGENTS` is on (default) the runner
 * inserts the canonical agent definition and re-reads on a unique violation,
 * which makes a fresh project self-healing without a manual seed step.
 */
export async function resolveAgents(
  admin: SupabaseClient,
  config: RunnerConfig,
): Promise<Map<string, AgentRow>> {
  const rows = await exec<AgentRow[]>(config, "select agents", () =>
    table(admin, TABLE.agents).select(AGENT_COLUMNS).in("agent_key", AGENTS.map((a) => a.agent_key)),
  );

  const resolved = new Map<string, AgentRow>();
  for (const row of rows ?? []) resolved.set(row.agent_key, row);

  for (const definition of AGENTS) {
    if (resolved.has(definition.agent_key)) continue;
    if (!config.autocreateAgents) continue;

    await exec(config, `insert agent ${definition.agent_key}`, () =>
      table(admin, TABLE.agents).insert({
        agent_key: definition.agent_key,
        name: definition.name,
        description: definition.description,
        is_active: true,
      }),
    ).catch((error) => {
      // A concurrent worker may have inserted it first — that is fine.
      if (error instanceof DbError && error.code === "23505") return null;
      throw error;
    });

    const inserted = await exec<AgentRow>(config, `reselect agent ${definition.agent_key}`, () =>
      table(admin, TABLE.agents).select(AGENT_COLUMNS).eq("agent_key", definition.agent_key).maybeSingle(),
    );
    if (inserted) resolved.set(definition.agent_key, inserted);
  }

  return resolved;
}

export function requireAgent(agents: Map<string, AgentRow>, agentKey: string): AgentRow {
  const agent = agents.get(agentKey);
  if (!agent) {
    throw new HttpError(
      500,
      "agent_unavailable",
      `Agent "${agentKey}" is not present in the agents table. Insert it or enable AGENT_RUNNER_AUTOCREATE_AGENTS.`,
    );
  }
  return agent;
}

/* ------------------------------------------------------------------ */
/* Activity feed                                                       */
/* ------------------------------------------------------------------ */

export interface ActivityInput {
  workspaceId: string;
  projectId: string | null;
  runId: string | null;
  userId?: string | null;
  agentId?: string | null;
  eventType: string;
  message: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Appends to the workspace activity feed. A failure here must never abort a
 * run — the feed is observability, not state — so it is swallowed after
 * logging, while still being retried for transient faults.
 */
export async function logActivity(
  admin: SupabaseClient,
  config: RunnerConfig,
  input: ActivityInput,
): Promise<void> {
  try {
    await exec(config, `activity ${input.eventType}`, () =>
      table(admin, TABLE.activityEvents).insert({
        workspace_id: input.workspaceId,
        project_id: input.projectId,
        run_id: input.runId,
        user_id: input.userId ?? null,
        agent_id: input.agentId ?? null,
        event_type: input.eventType,
        message: clampText(input.message, 500),
        metadata: input.metadata ?? {},
      }),
    );
  } catch (error) {
    console.error(`[agent-runner] failed to write activity "${input.eventType}":`, describe(error));
  }
}

/* ------------------------------------------------------------------ */
/* Runs                                                                */
/* ------------------------------------------------------------------ */

/** Touches `runs.updated_at` — the stale-run sweeper's liveness signal. */
export async function heartbeat(
  admin: SupabaseClient,
  config: RunnerConfig,
  runId: string,
  extra: Partial<RunRow> = {},
): Promise<void> {
  await exec(config, "heartbeat run", () =>
    table(admin, TABLE.runs)
      .update({ ...extra, updated_at: new Date().toISOString() })
      .eq("id", runId),
  );
}

/**
 * Terminal success: parks the run at `ready_for_review` and records when the
 * agent side finished. This is the ONLY terminal status the pipeline reaches.
 */
export async function completeRunForReview(
  admin: SupabaseClient,
  config: RunnerConfig,
  runId: string,
): Promise<void> {
  await exec(config, "complete run", () =>
    table(admin, TABLE.runs)
      .update({
        status: RUN_STATUS_AGENT_TERMINAL satisfies RunStatus,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", runId),
  );
}

export async function markRunFailed(
  admin: SupabaseClient,
  config: RunnerConfig,
  runId: string,
): Promise<void> {
  await exec(config, "fail run", () =>
    table(admin, TABLE.runs)
      .update({
        status: "failed" satisfies RunStatus,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", runId),
  );
}

/* ------------------------------------------------------------------ */
/* Stages                                                              */
/* ------------------------------------------------------------------ */

/**
 * Idempotently fetches (or creates) the `run_stages` row for a stage. Requeued
 * runs reuse the same row rather than accumulating duplicates.
 */
export async function ensureStage(
  admin: SupabaseClient,
  config: RunnerConfig,
  runId: string,
  stage: StageDefinition,
): Promise<RunStageRow> {
  const existing = await exec<RunStageRow>(config, `select stage ${stage.key}`, () =>
    table(admin, TABLE.runStages)
      .select(STAGE_COLUMNS)
      .eq("run_id", runId)
      .eq("stage_key", stage.key)
      .maybeSingle(),
  );
  if (existing) return existing;

  const created = await exec<RunStageRow>(config, `insert stage ${stage.key}`, () =>
    table(admin, TABLE.runStages)
      .insert({
        run_id: runId,
        stage_key: stage.key,
        stage_number: stage.number,
        status: "queued" satisfies StageStatus,
      })
      .select(STAGE_COLUMNS)
      .maybeSingle(),
  );

  if (created) return created;

  // Lost a race with a concurrent insert; re-read.
  const reread = await exec<RunStageRow>(config, `reread stage ${stage.key}`, () =>
    table(admin, TABLE.runStages)
      .select(STAGE_COLUMNS)
      .eq("run_id", runId)
      .eq("stage_key", stage.key)
      .maybeSingle(),
  );
  if (!reread) {
    throw new HttpError(502, "upstream_failure", `Could not create the "${stage.key}" stage row for run ${runId}.`);
  }
  return reread;
}

async function updateStage(
  admin: SupabaseClient,
  config: RunnerConfig,
  stageId: string,
  patch: Partial<RunStageRow>,
): Promise<void> {
  await exec(config, "update stage", () =>
    table(admin, TABLE.runStages)
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", stageId),
  );
}

export function startStage(
  admin: SupabaseClient,
  config: RunnerConfig,
  stage: RunStageRow,
): Promise<void> {
  return updateStage(admin, config, stage.id, {
    status: "running",
    error_message: null,
    started_at: stage.started_at ?? new Date().toISOString(),
    completed_at: null,
  });
}

export function succeedStage(
  admin: SupabaseClient,
  config: RunnerConfig,
  stage: RunStageRow,
): Promise<void> {
  return updateStage(admin, config, stage.id, {
    status: "completed",
    error_message: null,
    completed_at: new Date().toISOString(),
  });
}

export function failStage(
  admin: SupabaseClient,
  config: RunnerConfig,
  stage: RunStageRow,
  errorMessage: string,
): Promise<void> {
  return updateStage(admin, config, stage.id, {
    status: "failed",
    error_message: clampText(errorMessage, 1000),
    completed_at: new Date().toISOString(),
  });
}

export function skipStage(
  admin: SupabaseClient,
  config: RunnerConfig,
  stage: RunStageRow,
  reason: string,
): Promise<void> {
  return updateStage(admin, config, stage.id, {
    status: "skipped",
    error_message: clampText(reason, 1000),
  });
}

/* ------------------------------------------------------------------ */
/* Agent activity                                                      */
/* ------------------------------------------------------------------ */

export interface AgentActivityHandle {
  row: AgentActivityRow;
}

export async function beginAgentActivity(
  admin: SupabaseClient,
  config: RunnerConfig,
  input: {
    runId: string;
    stageId: string;
    agentId: string;
    taskDescription: string;
  },
): Promise<AgentActivityRow> {
  const created = await exec<AgentActivityRow>(config, "insert agent activity", () =>
    table(admin, TABLE.runAgentActivity)
      .insert({
        run_id: input.runId,
        stage_id: input.stageId,
        agent_id: input.agentId,
        status: "working",
        task_description: clampText(input.taskDescription, 1000),
        started_at: new Date().toISOString(),
      })
      .select("id, run_id, stage_id, agent_id, status, task_description, started_at, completed_at, created_at")
      .maybeSingle(),
  );
  if (!created) {
    throw new HttpError(502, "upstream_failure", "Could not record agent activity.");
  }
  return created;
}

export async function finishAgentActivity(
  admin: SupabaseClient,
  config: RunnerConfig,
  activityId: string,
  status: "completed" | "failed",
): Promise<void> {
  await exec(config, "update agent activity", () =>
    table(admin, TABLE.runAgentActivity)
      .update({ status, completed_at: new Date().toISOString() })
      .eq("id", activityId),
  );
}

/* ------------------------------------------------------------------ */
/* Tasks                                                               */
/* ------------------------------------------------------------------ */

export async function listTasksForRun(
  admin: SupabaseClient,
  config: RunnerConfig,
  runId: string,
): Promise<TaskRow[]> {
  const rows = await exec<TaskRow[]>(config, "select run tasks", () =>
    table(admin, TABLE.tasks)
      .select("id, project_id, run_id, assigned_agent_id, title, description, status, position, created_at, updated_at")
      .eq("run_id", runId)
      .order("position", { ascending: true }),
  );
  return rows ?? [];
}

export async function listTasksForProject(
  admin: SupabaseClient,
  config: RunnerConfig,
  projectId: string,
): Promise<TaskRow[]> {
  const rows = await exec<TaskRow[]>(config, "select project tasks", () =>
    table(admin, TABLE.tasks)
      .select("id, project_id, run_id, assigned_agent_id, title, description, status, position, created_at, updated_at")
      .eq("project_id", projectId)
      .order("position", { ascending: true })
      .limit(400),
  );
  return rows ?? [];
}

/**
 * Reconciles a planned task list into the `tasks` table.
 *
 * Matching is by (run_id, lowercased title) so a requeued run updates its own
 * tasks instead of appending near-duplicates. `position` continues from the
 * project's current maximum, keeping the dashboard's ordering stable.
 */
export async function upsertPlannedTasks(
  admin: SupabaseClient,
  config: RunnerConfig,
  input: {
    projectId: string;
    runId: string;
    tasks: PlannedTask[];
    agents: Map<string, AgentRow>;
    fallbackAgentKey: AgentKey;
  },
): Promise<TaskRow[]> {
  if (input.tasks.length === 0) return [];

  const existingForRun = await listTasksForRun(admin, config, input.runId);
  const projectTasks = await listTasksForProject(admin, config, input.projectId);
  const nextPosition = projectTasks.reduce((max, task) => Math.max(max, task.position ?? 0), 0) + 1;

  const byTitle = new Map(existingForRun.map((task) => [task.title.trim().toLowerCase(), task]));
  const results: TaskRow[] = [];
  let position = nextPosition;

  for (const planned of input.tasks) {
    const title = clampText(planned.title.trim().slice(0, 180), 180) ?? "Untitled task";
    if (!title || title === "Untitled task") continue;

    const agentKey = input.agents.has(planned.agent_key) ? planned.agent_key : input.fallbackAgentKey;
    const agentId = input.agents.get(agentKey)?.id ?? null;
    const key = title.toLowerCase();
    const existing = byTitle.get(key);

    if (existing) {
      await exec(config, "update task", () =>
        table(admin, TABLE.tasks)
          .update({
            description: clampText(planned.description, 2000),
            assigned_agent_id: agentId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id),
      );
      results.push({ ...existing, description: clampText(planned.description, 2000), assigned_agent_id: agentId });
      continue;
    }

    const created = await exec<TaskRow>(config, "insert task", () =>
      table(admin, TABLE.tasks)
        .insert({
          project_id: input.projectId,
          run_id: input.runId,
          assigned_agent_id: agentId,
          title,
          description: clampText(planned.description, 2000),
          status: "pending" satisfies TaskStatus,
          position: position,
        })
        .select("id, project_id, run_id, assigned_agent_id, title, description, status, position, created_at, updated_at")
        .maybeSingle(),
    );
    if (created) {
      results.push(created);
      byTitle.set(key, created);
    }
    position += 1;
  }

  return results;
}

export async function setTaskStatus(
  admin: SupabaseClient,
  config: RunnerConfig,
  taskId: string,
  status: TaskStatus,
): Promise<void> {
  await exec(config, "set task status", () =>
    table(admin, TABLE.tasks)
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", taskId),
  );
}

/* ------------------------------------------------------------------ */
/* Proposed change + changed files                                     */
/* ------------------------------------------------------------------ */

export async function ensureProposedChange(
  admin: SupabaseClient,
  config: RunnerConfig,
  input: {
    runId: string;
    title: string;
    summary: string | null;
    sourceBranch: string | null;
    targetBranch: string | null;
  },
): Promise<ProposedChangeRow> {
  const existing = await exec<ProposedChangeRow>(config, "select proposed change", () =>
    table(admin, TABLE.proposedChanges).select("*").eq("run_id", input.runId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  );

  if (existing) {
    const updated = await exec<ProposedChangeRow>(config, "update proposed change", () =>
      table(admin, TABLE.proposedChanges)
        .update({
          title: clampText(input.title, 200) ?? existing.title,
          summary: clampText(input.summary, 4000),
          source_branch: input.sourceBranch ?? existing.source_branch,
          target_branch: input.targetBranch ?? existing.target_branch,
          updated_at: new Date().toISOString(),
        })
        .select("*")
        .eq("id", existing.id)
        .maybeSingle(),
    );
    return updated ?? existing;
  }

  const created = await exec<ProposedChangeRow>(config, "insert proposed change", () =>
    table(admin, TABLE.proposedChanges)
      .insert({
        run_id: input.runId,
        title: clampText(input.title, 200) ?? "Agent-proposed change",
        summary: clampText(input.summary, 4000),
        source_branch: input.sourceBranch,
        target_branch: input.targetBranch,
        // The agent only ever proposes. Status transitions from here are human.
        status: CHANGE_STATUS_AGENT_WRITES satisfies ChangeStatus,
        tests_passed: 0,
        tests_total: 0,
        security_summary: null,
      })
      .select("*")
      .maybeSingle(),
  );

  if (!created) {
    throw new HttpError(502, "upstream_failure", `Could not create the proposed change for run ${input.runId}.`);
  }
  return created;
}

/** Records test results reported by the testing stage. */
export async function updateChangeTests(
  admin: SupabaseClient,
  config: RunnerConfig,
  changeId: string,
  testsPassed: number,
  testsTotal: number,
): Promise<void> {
  await exec(config, "update change tests", () =>
    table(admin, TABLE.proposedChanges)
      .update({
        tests_passed: testsPassed,
        tests_total: testsTotal,
        updated_at: new Date().toISOString(),
      })
      .eq("id", changeId),
  );
}

/** Records the security stage's verdict. */
export async function updateChangeSecuritySummary(
  admin: SupabaseClient,
  config: RunnerConfig,
  changeId: string,
  securitySummary: string,
): Promise<void> {
  await exec(config, "update change security", () =>
    table(admin, TABLE.proposedChanges)
      .update({ security_summary: clampText(securitySummary, 4000), updated_at: new Date().toISOString() })
      .eq("id", changeId),
  );
}

/**
 * Replaces the changed-file set for a proposed change. A requeued run
 * regenerates the diff, so the previous file rows are cleared first — the
 * dashboard would otherwise show stale paths from the failed attempt.
 */
export async function replaceChangedFiles(
  admin: SupabaseClient,
  config: RunnerConfig,
  changeId: string,
  files: PlannedFile[],
): Promise<number> {
  await exec(config, "delete changed files", () =>
    table(admin, TABLE.changedFiles).delete().eq("proposed_change_id", changeId),
  );

  if (files.length === 0) return 0;

  const rows = files.map((file) => ({
    proposed_change_id: changeId,
    file_path: clampText(file.file_path.trim().slice(0, 500), 500) ?? "unknown",
    additions: Math.max(0, Math.trunc(Number.isFinite(file.additions) ? file.additions : 0)),
    deletions: Math.max(0, Math.trunc(Number.isFinite(file.deletions) ? file.deletions : 0)),
    diff_text: clampText(file.diff_text, 200_000),
  }));

  const inserted = await exec<unknown[]>(config, "insert changed files", () =>
    table(admin, TABLE.changedFiles).insert(rows).select("id"),
  );
  return Array.isArray(inserted) ? inserted.length : rows.length;
}
