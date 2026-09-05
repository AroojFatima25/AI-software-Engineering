/**
 * Client for the `agent-runner` Supabase Edge Function.
 *
 * This module holds NO secrets. It needs two things, both already public or
 * already in the user's hands:
 *
 *   1. The function URL, **derived** from the existing public
 *      `VITE_SUPABASE_URL` as `${url}/functions/v1/agent-runner`. No new
 *      environment variable is introduced, and certainly no secret one.
 *   2. The signed-in user's Supabase **access token**, fetched at call time
 *      from the existing auth session and sent as `Authorization: Bearer …`.
 *
 * The Edge Function verifies that token against GoTrue, proves the caller is a
 * member of the workspace that owns the run, and only then processes anything.
 * `SUPABASE_SERVICE_ROLE_KEY` and `OPENROUTER_API_KEY` stay entirely inside the
 * function — see `supabase/README.md` §2.
 */
import { getSupabase, supabaseConfig } from "@/lib/supabase";

/** Name of the deployed Edge Function. */
const FUNCTION_NAME = "agent-runner";

/** Keys of the pipeline, in order — mirrors `supabase/functions/agent-runner/lib/stages.ts`. */
export const AGENT_RUN_STAGES = [
  "planning",
  "requirements",
  "architecture",
  "implementation",
  "testing",
  "security",
  "review",
] as const;

export type AgentRunStage = (typeof AGENT_RUN_STAGES)[number];

export interface StartRunResult {
  ok: boolean;
  message: string;
  /** `"started"` when the run was claimed and is processing in the background. */
  outcome?: "started" | "ready_for_review" | "failed";
  runId?: string;
  runStatus?: string;
}

/** The Edge Function URL, derived from the public project URL. */
export function agentRunnerUrl(): string | null {
  const config = supabaseConfig();
  if (!config) return null;
  return `${config.url.replace(/\/+$/, "")}/functions/v1/${FUNCTION_NAME}`;
}

export function isAgentRunnerConfigured(): boolean {
  return agentRunnerUrl() !== null;
}

interface RunnerEnvelope {
  ok?: boolean;
  outcome?: string;
  run_id?: string;
  run_status?: string;
  attempt?: number;
  branch_name?: string | null;
  error?: { code?: string; message?: string } | null;
  message?: string;
}

/**
 * Asks the Edge Function to process a queued run.
 *
 * Fires the request and returns as soon as the run is claimed — the pipeline
 * itself runs in the background on the server (`wait: false` is the function's
 * default, because seven model calls can outlast a single invocation). The
 * dashboard's existing poll then surfaces stage progress from the database.
 *
 * Never throws: a failed trigger returns `{ ok: false }` so the caller can show
 * a notice without breaking the "request submitted" flow — the run is already
 * queued, and the scheduled worker will pick it up regardless.
 */
export async function startAgentRun(runId: string): Promise<StartRunResult> {
  const url = agentRunnerUrl();
  if (!url) {
    return { ok: false, message: "The workspace isn't connected to Supabase yet." };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, message: "You need to be signed in." };
  }

  let accessToken: string | null = null;
  try {
    const { data } = await supabase.auth.getSession();
    accessToken = data.session?.access_token ?? null;
  } catch {
    accessToken = null;
  }

  if (!accessToken) {
    return { ok: false, message: "Your session expired — sign in again to start the agents." };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        // The user's own Supabase JWT — NOT an API key, NOT the service_role key.
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "run", run_id: runId, wait: false }),
    });

    const body = (await response.json().catch(() => null)) as RunnerEnvelope | null;

    if (response.status === 409) {
      return {
        ok: true,
        outcome: "started",
        runId,
        message: "Your agents are already working on this request.",
      };
    }

    if (!response.ok) {
      const detail = body?.error?.message;
      if (response.status === 401) {
        return { ok: false, message: "Your session expired — sign in again to start the agents." };
      }
      if (response.status === 403) {
        return { ok: false, message: "You don't have access to run requests in this workspace." };
      }
      if (response.status === 500 && body?.error?.code === "misconfigured") {
        return { ok: false, message: "The agent runner isn't configured yet. See supabase/README.md." };
      }
      return {
        ok: false,
        message: detail ?? "Couldn't start the agents — the request is queued and will run shortly.",
      };
    }

    return {
      ok: true,
      outcome: body?.outcome === "ready_for_review" ? "ready_for_review" : "started",
      runId: body?.run_id ?? runId,
      runStatus: body?.run_status,
      message: "Your agents are on it.",
    };
  } catch {
    // Network failure is not fatal: the run row is already `queued`, so the
    // scheduled worker will claim it.
    return {
      ok: false,
      message: "Couldn't reach the agent runner — the request is queued and will run shortly.",
    };
  }
}
