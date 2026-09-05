/**
 * Run claiming, attempt tracking and stale-run recovery.
 *
 * ── Why this is safe against duplicate workers ─────────────────────────────
 * A run is claimed with ONE conditional statement:
 *
 *     update runs
 *        set status = 'running', started_at = ..., branch_name = ...
 *      where id = $run_id
 *        and status = 'queued'          ← the guard
 *     returning *;
 *
 * Under Postgres' default READ COMMITTED isolation this is atomic. Two workers
 * racing on the same row: the first takes the row lock and commits
 * status='running'; the second blocks on that lock, then re-evaluates its
 * WHERE clause against the *new* committed row, finds status <> 'queued',
 * matches zero rows and receives an empty result. Exactly one worker ever
 * learns it owns the run. No advisory locks, no new tables and no schema
 * changes are needed — this uses `runs` exactly as shipped.
 *
 * `selectQueuedRuns` is only a *candidate* list; the claim above is the
 * synchronisation point, so a candidate list can safely overlap between
 * workers.
 *
 * ── Attempt tracking without new columns ───────────────────────────────────
 * The schema has no `attempt_count`, and this runner adds no columns. The
 * attempt number is derived by counting `activity_events` rows of type
 * `run_requeued` for the run — an append-only counter that already fits the
 * existing table.
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.114.0";
import type { RunnerConfig } from "./config.ts";
import { HttpError } from "./http.ts";
import { describe } from "./retry.ts";
import { ACTIVITY_COLUMNS, EVENT, RUN_COLUMNS, TABLE, type RunRow } from "./schema.ts";
import { branchNameFor } from "./stages.ts";
import type { ProjectRow } from "./schema.ts";
import { exec } from "./exec.ts";
import { logActivity } from "./repo.ts";

/** Result of an attempted claim. */
export type ClaimOutcome =
  | { status: "claimed"; run: RunRow; attempt: number }
  | { status: "already_processing"; run: RunRow }
  | { status: "not_claimable"; run: RunRow };

/**
 * Atomically claims a specific run.
 *
 * Returns `already_processing` when another worker won the race, and
 * `not_claimable` when the run is in a state the agent must not touch (e.g. a
 * human already approved it, or it is sitting in review).
 */
export async function claimRun(
  admin: SupabaseClient,
  config: RunnerConfig,
  runId: string,
  project: ProjectRow,
): Promise<ClaimOutcome> {
  const now = new Date().toISOString();
  const branchName = branchNameFor(project.slug, runId);

  const claimed = await exec<RunRow>(config, "claim run", () =>
    admin
      .from(TABLE.runs)
      .update({
        status: "running",
        started_at: now,
        branch_name: branchName,
        updated_at: now,
      })
      .eq("id", runId)
      // THE GUARD. Remove this and two workers can both process one run.
      .eq("status", "queued")
      .select(RUN_COLUMNS)
      .maybeSingle(),
  );

  if (claimed) {
    const attempt = (await countPriorAttempts(admin, config, runId)) + 1;
    return { status: "claimed", run: claimed, attempt };
  }

  // Nobody claimed it — find out why, so the caller gets an honest answer.
  const current = await exec<RunRow>(config, "reread run", () =>
    admin.from(TABLE.runs).select(RUN_COLUMNS).eq("id", runId).maybeSingle(),
  );
  if (!current) {
    throw new HttpError(404, "not_found", `Run ${runId} disappeared while it was being claimed.`);
  }

  if (current.status === "running" || current.status === "queued") {
    // 'queued' here means we lost the claim to a worker that has since
    // requeued it — treat it as someone else's job rather than re-racing.
    return { status: "already_processing", run: current };
  }
  return { status: "not_claimable", run: current };
}

/** Queued runs, oldest first — candidates only, never a lock. */
export async function selectQueuedRuns(
  admin: SupabaseClient,
  config: RunnerConfig,
  limit: number,
): Promise<RunRow[]> {
  const rows = await exec<RunRow[]>(config, "select queued runs", () =>
    admin
      .from(TABLE.runs)
      .select(RUN_COLUMNS)
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(Math.max(1, Math.min(limit, 50))),
  );
  return rows ?? [];
}

/**
 * Number of times this run has already been requeued. The first execution is
 * attempt 1, so a `maxRunAttempts` of 3 allows the original try plus two
 * recoveries.
 */
export async function countPriorAttempts(
  admin: SupabaseClient,
  config: RunnerConfig,
  runId: string,
): Promise<number> {
  const rows = await exec<Array<{ id: string }>>(config, "count run attempts", () =>
    admin
      .from(TABLE.activityEvents)
      .select(ACTIVITY_COLUMNS)
      .eq("run_id", runId)
      .eq("event_type", EVENT.runRequeued),
  );
  return rows?.length ?? 0;
}

/** The error recorded on the previous attempt, if this run is a retry. */
export async function lastStageError(
  admin: SupabaseClient,
  config: RunnerConfig,
  runId: string,
): Promise<string | null> {
  const rows = await exec<Array<{ error_message: string | null; stage_number: number }>>(
    config,
    "last stage error",
    () =>
      admin
        .from(TABLE.runStages)
        .select("stage_number, error_message")
        .eq("run_id", runId)
        .not("error_message", "is", null)
        .order("stage_number", { ascending: false })
        .limit(1),
  );
  return rows?.[0]?.error_message ?? null;
}

/* ------------------------------------------------------------------ */
/* Stale-run recovery                                                  */
/* ------------------------------------------------------------------ */

export interface RecoveryReport {
  scanned: number;
  requeued: string[];
  abandoned: string[];
  cutoff: string;
}

/**
 * Finds runs stuck in `running` and hands them back to the queue.
 *
 * A run is stale when nothing has touched `runs.updated_at` for
 * `AGENT_RUNNER_STALE_AFTER_MINUTES`. The pipeline heartbeats that column
 * between model calls, so a live run never looks stale; a worker killed
 * mid-run does.
 *
 * The reset is itself an atomic conditional update
 * (`set status='queued' where id=$1 and status='running' and updated_at<cutoff`),
 * so two concurrent sweepers cannot double-count or double-requeue a run.
 */
export async function recoverStaleRuns(
  admin: SupabaseClient,
  config: RunnerConfig,
  workspaceFilter?: string,
): Promise<RecoveryReport> {
  const cutoff = new Date(Date.now() - config.staleAfterMinutes * 60_000).toISOString();

  // Built fresh inside the factory: PostgREST builders are single-use.
  const selectStale = () =>
    admin
      .from(TABLE.runs)
      .select(RUN_COLUMNS)
      .eq("status", "running")
      .lt("updated_at", cutoff)
      .order("updated_at", { ascending: true })
      .limit(25);

  const stale = (await exec<RunRow[]>(config, "select stale runs", selectStale)) ?? [];
  const report: RecoveryReport = { scanned: stale.length, requeued: [], abandoned: [], cutoff };

  for (const run of stale) {
    if (workspaceFilter) {
      const project = await exec<ProjectRow>(config, "select project for stale run", () =>
        admin.from(TABLE.projects).select("id, workspace_id").eq("id", run.project_id).maybeSingle(),
      );
      if (project?.workspace_id !== workspaceFilter) continue;
    }

    const reset = await exec<RunRow>(config, "requeue stale run", () =>
      admin
        .from(TABLE.runs)
        .update({ status: "queued", completed_at: null, updated_at: new Date().toISOString() })
        .eq("id", run.id)
        // Guards against a worker that came back to life mid-sweep.
        .eq("status", "running")
        .lt("updated_at", cutoff)
        .select(RUN_COLUMNS)
        .maybeSingle(),
    );
    if (!reset) continue;

    const attempts = await countPriorAttempts(admin, config, run.id);
    const exhausted = attempts + 1 >= config.maxRunAttempts;

    // Clear in-flight child rows so the dashboard stops showing a spinner for
    // work that no longer exists.
    await quarantineInProgressWork(admin, config, run.id);

    if (exhausted) {
      await exec(config, "abandon run", () =>
        admin
          .from(TABLE.runs)
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", run.id),
      );
      await logActivity(admin, config, {
        workspaceId: await workspaceIdForRun(admin, config, run),
        projectId: run.project_id,
        runId: run.id,
        eventType: EVENT.runAbandoned,
        message: `Run abandoned after ${attempts + 1} attempts — it kept becoming unresponsive.`,
        metadata: { attempts: attempts + 1, max_attempts: config.maxRunAttempts },
      });
      report.abandoned.push(run.id);
      continue;
    }

    await logActivity(admin, config, {
      workspaceId: await workspaceIdForRun(admin, config, run),
      projectId: run.project_id,
      runId: run.id,
      eventType: EVENT.runRequeued,
      message: `Run stalled for over ${config.staleAfterMinutes} minutes and was returned to the queue (attempt ${attempts + 1} of ${config.maxRunAttempts}).`,
      metadata: {
        attempt: attempts + 1,
        max_attempts: config.maxRunAttempts,
        stale_after_minutes: config.staleAfterMinutes,
        last_updated_at: run.updated_at,
      },
    });
    report.requeued.push(run.id);
  }

  return report;
}

/**
 * Marks in-flight stages and agent activity as failed when a run is requeued,
 * so the UI reflects reality instead of showing work that was interrupted.
 */
async function quarantineInProgressWork(
  admin: SupabaseClient,
  config: RunnerConfig,
  runId: string,
): Promise<void> {
  const reason = "Interrupted: the worker stopped responding and the run was returned to the queue.";
  const now = new Date().toISOString();
  try {
    await exec(config, "quarantine in-flight stages", () =>
      admin
        .from(TABLE.runStages)
        .update({
          status: "failed",
          error_message: reason,
          completed_at: now,
          updated_at: now,
        })
        .eq("run_id", runId)
        .in("status", ["running", "queued"]),
    );
    await exec(config, "quarantine in-flight activity", () =>
      admin
        .from(TABLE.runAgentActivity)
        .update({ status: "failed", completed_at: now })
        .eq("run_id", runId)
        .in("status", ["queued", "working"]),
    );
  } catch (error) {
    // Observational cleanup only — never block the requeue on it.
    console.warn(`[agent-runner] could not quarantine in-flight work for ${runId}:`, describe(error));
  }
}

async function workspaceIdForRun(
  admin: SupabaseClient,
  config: RunnerConfig,
  run: RunRow,
): Promise<string> {
  const project = await exec<{ workspace_id: string }>(config, "select project workspace", () =>
    admin.from(TABLE.projects).select("workspace_id").eq("id", run.project_id).maybeSingle(),
  );
  if (!project?.workspace_id) {
    throw new HttpError(404, "not_found", `Project for run ${run.id} no longer exists.`);
  }
  return project.workspace_id;
}
