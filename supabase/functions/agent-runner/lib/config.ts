/**
 * Configuration & secrets for the agent-runner Edge Function.
 *
 * EVERY value here is read from the Edge Function's own environment (Deno.env).
 * Nothing is hardcoded, nothing is read from the request body, and nothing here
 * is ever sent back to a browser.
 *
 * Supabase injects two variables into every Edge Function automatically:
 *   SUPABASE_URL, SUPABASE_ANON_KEY
 *
 * Everything else must be supplied with `supabase secrets set` and is listed in
 * `supabase/secrets.example` and documented in `supabase/README.md`.
 */

export interface RunnerConfig {
  /* --- Supabase ------------------------------------------------------ */
  /** Project URL. Injected by the Edge runtime. */
  supabaseUrl: string;
  /** Publishable/anon key. Injected by the Edge runtime. */
  supabaseAnonKey: string;
  /** SECRET — bypasses RLS. Server-side only, never leaves this function. */
  supabaseServiceRoleKey: string;

  /* --- OpenRouter ---------------------------------------------------- */
  /** SECRET — the only credential used to talk to OpenRouter. */
  openRouterApiKey: string;
  openRouterBaseUrl: string;
  openRouterModel: string;
  openRouterMaxTokens: number;
  openRouterTemperature: number;
  /** Optional attribution headers OpenRouter records in its dashboard. */
  openRouterSiteUrl: string;
  openRouterAppName: string;

  /* --- Reliability knobs -------------------------------------------- */
  /** Attempts per stage (1 = no retry). */
  maxStageAttempts: number;
  /** Wall-clock budget for a single OpenRouter call, ms. */
  stageTimeoutMs: number;
  /** Wall-clock budget for a whole run, ms. */
  runTimeoutMs: number;
  /** Base backoff for retries, ms (doubled per attempt + jitter). */
  retryBaseDelayMs: number;
  /** Attempts for transient Supabase/HTTP write failures. */
  maxWriteAttempts: number;

  /* --- Run recovery -------------------------------------------------- */
  /** A `running` run untouched for this long is considered stale (minutes). */
  staleAfterMinutes: number;
  /** How many times a run may be requeued before it is abandoned. */
  maxRunAttempts: number;
  /** Runs claimed per `drain` invocation. */
  drainBatchSize: string;

  /* --- Access control ------------------------------------------------ */
  /**
   * Comma-separated list of browser origins allowed to call this function.
   * `*` allows any origin (requests are still authenticated). Empty = deny all
   * cross-origin browser calls; non-browser/curl callers are unaffected.
   */
  allowedOrigins: string[];
  /**
   * SECRET — bearer token required for the server-to-server actions
   * (`drain`, `recover_stale`) that carry no user JWT. If unset, those actions
   * are disabled entirely rather than left open.
   */
  workerToken: string;
  /** Create missing `agents` rows for known agent keys on demand. */
  autocreateAgents: boolean;
}

class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

function required(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new ConfigError(
      `Missing required secret "${name}". Set it with: supabase secrets set ${name}=...`,
    );
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = Deno.env.get(name)?.trim();
  return value && value.length > 0 ? value : fallback;
}

function optionalInt(name: string, fallback: number): number {
  const raw = Deno.env.get(name)?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ConfigError(`Secret "${name}" must be a positive integer, received "${raw}".`);
  }
  return parsed;
}

function optionalBool(name: string, fallback: boolean): boolean {
  const raw = Deno.env.get(name)?.trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === "1" || raw === "true" || raw === "yes" || raw === "on") return true;
  if (raw === "0" || raw === "false" || raw === "no" || raw === "off") return false;
  throw new ConfigError(`Secret "${name}" must be a boolean, received "${raw}".`);
}

/**
 * Reads and validates configuration. Throws a `ConfigError` naming the exact
 * missing secret so a misconfigured deploy fails loudly instead of silently
 * misbehaving.
 */
export function loadConfig(): RunnerConfig {
  const allowedOriginsRaw = optional("AGENT_RUNNER_ALLOWED_ORIGINS", "");

  return {
    supabaseUrl: required("SUPABASE_URL"),
    supabaseAnonKey: required("SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),

    openRouterApiKey: required("OPENROUTER_API_KEY"),
    openRouterBaseUrl: optional("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
    openRouterModel: optional("OPENROUTER_MODEL", "anthropic/claude-3.5-sonnet"),
    openRouterMaxTokens: optionalInt("OPENROUTER_MAX_TOKENS", 4000),
    openRouterTemperature: Number.parseFloat(optional("OPENROUTER_TEMPERATURE", "0.2")),
    openRouterSiteUrl: optional("OPENROUTER_SITE_URL", ""),
    openRouterAppName: optional("OPENROUTER_APP_NAME", "AI Software Engineering"),

    maxStageAttempts: optionalInt("AGENT_RUNNER_MAX_STAGE_ATTEMPTS", 3),
    stageTimeoutMs: optionalInt("AGENT_RUNNER_STAGE_TIMEOUT_MS", 120_000),
    runTimeoutMs: optionalInt("AGENT_RUNNER_RUN_TIMEOUT_MS", 900_000),
    retryBaseDelayMs: optionalInt("AGENT_RUNNER_RETRY_BASE_DELAY_MS", 500),
    maxWriteAttempts: optionalInt("AGENT_RUNNER_MAX_WRITE_ATTEMPTS", 4),

    staleAfterMinutes: optionalInt("AGENT_RUNNER_STALE_AFTER_MINUTES", 15),
    maxRunAttempts: optionalInt("AGENT_RUNNER_MAX_RUN_ATTEMPTS", 3),
    drainBatchSize: optional("AGENT_RUNNER_DRAIN_BATCH_SIZE", "5"),

    allowedOrigins: allowedOriginsRaw
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
    workerToken: optional("AGENT_RUNNER_WORKER_TOKEN", ""),
    autocreateAgents: optionalBool("AGENT_RUNNER_AUTOCREATE_AGENTS", true),
  };
}

export { ConfigError };

/**
 * Names of the secrets this function needs, in the order they should appear in
 * `supabase secrets set`. Used by the `GET /health` response so an operator can
 * tell what is misconfigured WITHOUT the values being disclosed — only
 * present/absent is reported.
 */
export const SECRET_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL",
  "OPENROUTER_BASE_URL",
  "OPENROUTER_MAX_TOKENS",
  "OPENROUTER_TEMPERATURE",
  "OPENROUTER_SITE_URL",
  "OPENROUTER_APP_NAME",
  "AGENT_RUNNER_MAX_STAGE_ATTEMPTS",
  "AGENT_RUNNER_STAGE_TIMEOUT_MS",
  "AGENT_RUNNER_RUN_TIMEOUT_MS",
  "AGENT_RUNNER_RETRY_BASE_DELAY_MS",
  "AGENT_RUNNER_MAX_WRITE_ATTEMPTS",
  "AGENT_RUNNER_STALE_AFTER_MINUTES",
  "AGENT_RUNNER_MAX_RUN_ATTEMPTS",
  "AGENT_RUNNER_DRAIN_BATCH_SIZE",
  "AGENT_RUNNER_ALLOWED_ORIGINS",
  "AGENT_RUNNER_WORKER_TOKEN",
  "AGENT_RUNNER_AUTOCREATE_AGENTS",
] as const;

/** Presence map only — never values. Safe to return to a caller. */
export function secretPresence(): Record<string, boolean> {
  const presence: Record<string, boolean> = {};
  for (const name of ["SUPABASE_URL", "SUPABASE_ANON_KEY", ...SECRET_NAMES]) {
    presence[name] = Boolean(Deno.env.get(name)?.trim());
  }
  return presence;
}
