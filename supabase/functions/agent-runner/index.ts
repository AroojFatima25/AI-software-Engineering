/**
 * agent-runner — Supabase Edge Function
 *
 * The server-side half of the product. The browser only ever talks to
 * Supabase; this function is the only component that talks to OpenRouter and
 * the only one allowed to write the agent-owned tables.
 *
 * ── Endpoints ────────────────────────────────────────────────────────────
 *   GET  /health            Liveness + which secrets are present (never values).
 *                           No auth required, so uptime probes work.
 *
 *   POST /  { action: "run", run_id, wait? }
 *                           User-facing. Requires the caller's Supabase JWT in
 *                           `Authorization: Bearer <access token>`. Verifies
 *                           the JWT, resolves the run's workspace, proves
 *                           membership under RLS, claims the run atomically,
 *                           then runs the pipeline.
 *
 *   POST /  { action: "drain", limit? }
 *                           Server-to-server worker. Requires
 *                           `X-Agent-Runner-Worker: <token>`. Sweeps stale
 *                           runs, then claims and processes queued runs.
 *
 *   POST /  { action: "recover_stale" }
 *                           Server-to-server. Resets stalled `running` runs
 *                           back to `queued` (or fails them once the attempt
 *                           budget is exhausted).
 *
 * ── Long runs ────────────────────────────────────────────────────────────
 * Seven model calls can outlast an Edge Function's wall-clock limit. So `run`
 * defaults to `wait: false`: it claims the run, hands the pipeline to
 * `EdgeRuntime.waitUntil`, and answers `202` immediately. Pass `wait: true`
 * for a synchronous result (useful in tests and small runs).
 *
 * ── Secrets ──────────────────────────────────────────────────────────────
 * All credentials are read from this function's environment. See
 * `supabase/README.md` and `supabase/secrets.example`. None of them are
 * echoed in a response, and none belong in a `VITE_*` variable.
 */
import { loadConfig, ConfigError, secretPresence, type RunnerConfig } from "./lib/config.ts";
import {
  accepted,
  badRequest,
  conflict,
  corsHeaders,
  errorResponse,
  forbidden,
  internal,
  json,
  ok,
  preflightResponse,
  unauthorized,
  HttpError,
} from "./lib/http.ts";
import { createAdminClient, createUserClient } from "./lib/clients.ts";
import { authorizeRun, isValidUuid } from "./lib/auth.ts";
import { claimRun, recoverStaleRuns, selectQueuedRuns, lastStageError } from "./lib/claim.ts";
import { executeRun, RunTimeout, StageFailure, type PipelineResult } from "./lib/pipeline.ts";
import { logActivity, markRunFailed } from "./lib/repo.ts";
import { EVENT, TABLE } from "./lib/schema.ts";
import { STAGE_KEYS } from "./lib/stages.ts";

/** Present only inside the Supabase Edge Runtime. */
function edgeRuntime(): { waitUntil(promise: Promise<unknown>): void } | undefined {
  return (globalThis as { EdgeRuntime?: { waitUntil(promise: Promise<unknown>): void } }).EdgeRuntime;
}

interface ActionBody {
  action?: string;
  run_id?: string;
  runId?: string;
  wait?: boolean;
  limit?: number;
  recover?: boolean;
}

async function readBody(request: Request): Promise<ActionBody> {
  try {
    const text = await request.text();
    if (!text.trim()) return {};
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw badRequest("Request body must be a JSON object.");
    }
    return parsed as ActionBody;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw badRequest("Request body must be valid JSON.");
  }
}

/** Constant-time-ish comparison for the worker token. */
function tokenMatches(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < provided.length; i += 1) {
    mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

function assertWorker(request: Request, config: RunnerConfig): void {
  if (!config.workerToken) {
    throw forbidden(
      "Worker actions are disabled because AGENT_RUNNER_WORKER_TOKEN is not set.",
    );
  }
  const provided =
    request.headers.get("x-agent-runner-worker") ??
    request.headers.get("X-Agent-Runner-Worker") ??
    "";
  if (!provided || !tokenMatches(provided, config.workerToken)) {
    throw unauthorized("Invalid worker token. Send `X-Agent-Runner-Worker: <token>`.");
  }
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

/**
 * User-initiated processing of a single run.
 * Order matters: authenticate → locate → authorise membership → claim → run.
 * A caller who is not a member of the run's workspace never reaches the claim,
 * so no OpenRouter spend and no writes happen on their behalf.
 */
async function handleRun(request: Request, config: RunnerConfig, body: ActionBody): Promise<Response> {
  const runId = (body.run_id ?? body.runId ?? "").trim();
  if (!runId) throw badRequest("`run_id` is required.");
  if (!isValidUuid(runId)) throw badRequest("`run_id` must be a UUID.");

  const admin = createAdminClient(config);
  const userClient = createUserClient(config, bearerToken(request));
  const { user, membership, context } = await authorizeRun(admin, userClient, request, runId);

  const claim = await claimRun(admin, config, runId, context.project);

  if (claim.status === "already_processing") {
    throw conflict("That run is already being processed by another worker.", {
      run_id: runId,
      run_status: claim.run.status,
    });
  }
  if (claim.status === "not_claimable") {
    throw conflict(`That run cannot be started from its current status.`, {
      run_id: runId,
      run_status: claim.run.status,
      hint:
        claim.run.status === "ready_for_review"
          ? "This run is already waiting for review."
          : "Only queued runs can be processed.",
    });
  }

  await logActivity(admin, config, {
    workspaceId: context.workspaceId,
    projectId: context.project.id,
    runId,
    userId: user.id,
    eventType: EVENT.runClaimed,
    message: `Run ${runId.slice(0, 8)} claimed for processing (attempt ${claim.attempt} of ${config.maxRunAttempts}).`,
    metadata: {
      attempt: claim.attempt,
      triggered_by: user.id,
      role: membership.role,
      branch_name: claim.run.branch_name,
    },
  });

  const previousError = await lastStageError(admin, config, runId);

  const pipelineInput = {
    run: claim.run,
    project: context.project,
    workspaceId: context.workspaceId,
    triggeredBy: user.id,
    attempt: claim.attempt,
    previousError,
  };

  const wait = body.wait === true;

  if (!wait) {
    const runtime = edgeRuntime();
    if (runtime) {
      runtime.waitUntil(
        executeRun(admin, config, pipelineInput).catch((error) => {
          console.error(`[agent-runner] background run ${runId} failed:`, error);
        }),
      );
      return accepted(
        {
          outcome: "started",
          run_id: runId,
          run_status: "running",
          attempt: claim.attempt,
          branch_name: claim.run.branch_name,
          stages: STAGE_KEYS,
          terminal_status: "ready_for_review",
        },
        corsHeaders(request, config.allowedOrigins),
      );
    }
    // No waitUntil available (local `deno serve`, for instance) — fall back to
    // running inline rather than silently dropping the work.
    console.warn("[agent-runner] EdgeRuntime.waitUntil unavailable; running inline.");
  }

  const result = await executeRun(admin, config, pipelineInput);
  return finishResponse(request, config, result);
}

/** Worker sweep: recover stalled runs, then process queued ones. */
async function handleDrain(request: Request, config: RunnerConfig, body: ActionBody): Promise<Response> {
  assertWorker(request, config);
  const admin = createAdminClient(config);

  const recovery = body.recover === false ? null : await recoverStaleRuns(admin, config);

  const configuredBatch = Number.parseInt(config.drainBatchSize, 10);
  const limit = Math.max(1, Math.min(body.limit ?? (Number.isFinite(configuredBatch) ? configuredBatch : 5), 20));
  const candidates = await selectQueuedRuns(admin, config, limit);

  const processed: Array<{ run_id: string; outcome: string; error?: string }> = [];
  let skipped = 0;

  for (const candidate of candidates) {
    const { data: project } = await admin
      .from(TABLE.projects)
      .select("id, workspace_id, name, slug, description, repository_url, default_branch, status, created_by, created_at, updated_at")
      .eq("id", candidate.project_id)
      .maybeSingle();
    if (!project) {
      skipped += 1;
      continue;
    }

    // The atomic claim is what prevents two workers from double-processing.
    const claim = await claimRun(admin, config, candidate.id, project);
    if (claim.status !== "claimed") {
      skipped += 1;
      continue;
    }

    try {
      const result = await executeRun(admin, config, {
        run: claim.run,
        project,
        workspaceId: project.workspace_id,
        triggeredBy: claim.run.requested_by,
        attempt: claim.attempt,
        previousError: await lastStageError(admin, config, candidate.id),
      });
      processed.push({
        run_id: candidate.id,
        outcome: result.status,
        ...(result.error ? { error: result.error.message } : {}),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await markRunFailed(admin, config, candidate.id).catch(() => undefined);
      processed.push({ run_id: candidate.id, outcome: "failed", error: message });
    }
  }

  return ok(
    {
      outcome: "drained",
      candidates: candidates.length,
      processed,
      skipped,
      recovery,
    },
    corsHeaders(request, config.allowedOrigins),
  );
}

/** Worker sweep: stale-run recovery only. */
async function handleRecoverStale(request: Request, config: RunnerConfig): Promise<Response> {
  assertWorker(request, config);
  const admin = createAdminClient(config);
  const report = await recoverStaleRuns(admin, config);
  return ok({ outcome: "recovered", ...report }, corsHeaders(request, config.allowedOrigins));
}

/* ------------------------------------------------------------------ */
/* Response helpers                                                    */
/* ------------------------------------------------------------------ */

function finishResponse(request: Request, config: RunnerConfig, result: PipelineResult): Response {
  const headers = corsHeaders(request, config.allowedOrigins);

  if (result.status === "ready_for_review") {
    return ok(
      {
        outcome: "ready_for_review",
        run_id: result.runId,
        run_status: "ready_for_review",
        proposed_change_id: result.proposedChangeId,
        attempt: result.attempt,
        duration_ms: result.durationMs,
        stages: result.stages,
        // Explicit in the payload: the agent side stops here and records no
        // approval. A human must call submit_approval.
        awaiting_human_decision: true,
        approvals_written: 0,
      },
      headers,
    );
  }

  // Pick a status that reflects WHY it failed rather than blanket-500ing.
  const reason = result.error?.reason ?? "internal";
  const status = reason === "upstream" ? 502 : reason === "timeout" ? 504 : 500;
  return json(
    {
      ok: false,
      outcome: "failed",
      run_id: result.runId,
      run_status: "failed",
      attempt: result.attempt,
      duration_ms: result.durationMs,
      stages: result.stages,
      error: result.error,
    },
    { status, headers },
  );
}

function bearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  const [, token] = header.split(" ");
  if (!token?.trim()) {
    throw unauthorized("Missing Authorization header. Send `Authorization: Bearer <supabase user access token>`.");
  }
  return token.trim();
}

/* ------------------------------------------------------------------ */
/* Server                                                              */
/* ------------------------------------------------------------------ */

async function handle(request: Request, config: RunnerConfig): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") {
    return preflightResponse(corsHeaders(request, config.allowedOrigins));
  }

  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (method === "GET" && (path === "/health" || path === "/agent-runner/health")) {
    return json(
      {
        ok: true,
        service: "agent-runner",
        stages: STAGE_KEYS,
        terminal_status: "ready_for_review",
        writes_approvals: false,
        model: config.openRouterModel,
        limits: {
          max_stage_attempts: config.maxStageAttempts,
          stage_timeout_ms: config.stageTimeoutMs,
          run_timeout_ms: config.runTimeoutMs,
          stale_after_minutes: config.staleAfterMinutes,
          max_run_attempts: config.maxRunAttempts,
        },
        // Presence only — values are never disclosed.
        secrets: secretPresence(),
        checked_at: new Date().toISOString(),
      },
      { headers: corsHeaders(request, config.allowedOrigins) },
    );
  }

  if (method !== "POST") {
    return json(
      { ok: false, error: { code: "method_not_allowed", message: "Use POST with a JSON body, or GET /health." } },
      { status: 405, headers: corsHeaders(request, config.allowedOrigins) },
    );
  }

  const body = await readBody(request);
  const action = (body.action ?? url.searchParams.get("action") ?? "run").trim().toLowerCase();

  switch (action) {
    case "run":
      return await handleRun(request, config, body);
    case "drain":
      return await handleDrain(request, config, body);
    case "recover_stale":
    case "recover":
      return await handleRecoverStale(request, config);
    default:
      throw badRequest(`Unknown action "${action}". Expected one of: run, drain, recover_stale.`);
  }
}

Deno.serve(async (request: Request): Promise<Response> => {
  // Load config inside the handler so a missing secret produces a structured
  // 500 naming the variable, rather than a cold-start crash.
  let config: RunnerConfig;
  try {
    config = loadConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      return json(
        { ok: false, error: { code: "misconfigured", message: error.message } },
        { status: 500 },
      );
    }
    return errorResponse(error);
  }

  try {
    return await handle(request, config);
  } catch (error) {
    // Pipeline-level faults that escaped a handler.
    if (error instanceof RunTimeout || error instanceof StageFailure) {
      return json(
        {
          ok: false,
          outcome: "failed",
          error: { code: error.name, message: error.message },
        },
        { status: 504, headers: corsHeaders(request, config.allowedOrigins) },
      );
    }
    if (error instanceof HttpError) return errorResponse(error, corsHeaders(request, config.allowedOrigins));
    if (error instanceof Error && /not permitted to read or write the `approvals` table/.test(error.message)) {
      return errorResponse(internal(error.message), corsHeaders(request, config.allowedOrigins));
    }
    return errorResponse(error, corsHeaders(request, config.allowedOrigins));
  }
});
