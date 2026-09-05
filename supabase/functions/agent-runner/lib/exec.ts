/**
 * Shared PostgREST execution wrapper.
 *
 * supabase-js does not throw on database errors — it resolves with
 * `{ data, error }`. That makes it very easy to silently ignore a failure, so
 * every query in the runner goes through `exec`, which turns `error` into a
 * thrown `DbError` and retries the genuinely transient ones.
 *
 * `build` is a FACTORY, not a promise: PostgREST query builders are
 * single-use, so a retry has to construct a fresh one.
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.114.0";
import type { RunnerConfig } from "./config.ts";
import { describe, retry } from "./retry.ts";

/** Postgres SQLSTATEs that indicate a transient condition. */
const RETRYABLE_SQLSTATES = new Set([
  "40001", // serialization_failure
  "40P01", // deadlock_detected
  "53300", // too_many_connections
  "55P03", // lock_not_available
  "57014", // query_canceled
  "08000",
  "08001",
  "08006",
  "XX000",
]);

export class DbError extends Error {
  constructor(
    message: string,
    readonly code: string | undefined,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "DbError";
  }
}

export function isRetryableDbError(error: unknown): boolean {
  if (error instanceof DbError) return error.retryable;
  if (error instanceof TypeError) return true; // fetch network failure
  return /timeout|connection|temporarily|unavailable|socket hang up/i.test(
    error instanceof Error ? error.message : String(error),
  );
}

interface QueryResult<T> {
  data: T | null;
  error: { code?: string; message: string; details?: string; hint?: string } | null;
}

/**
 * Runs one query, retrying transient failures. Resolves with `data` (which may
 * legitimately be `null` for `.maybeSingle()`), or throws `DbError`.
 */
export async function exec<T>(
  config: RunnerConfig,
  label: string,
  build: () => PromiseLike<QueryResult<T>>,
  attempts?: number,
): Promise<T | null> {
  return await retry(
    async () => {
      const { data, error } = await build();
      if (error) {
        const retryable =
          Boolean(error.code && RETRYABLE_SQLSTATES.has(error.code)) ||
          /timeout|connection|temporarily|unavailable|502|503|504/i.test(error.message);
        throw new DbError(
          `${label}: ${error.message}${error.details ? ` (${error.details})` : ""}`,
          error.code,
          retryable,
        );
      }
      return data;
    },
    {
      attempts: attempts ?? config.maxWriteAttempts,
      baseDelayMs: config.retryBaseDelayMs,
      label: `db:${label}`,
      isRetryable: isRetryableDbError,
      onRetry: (error, attempt, delayMs) => {
        console.warn(
          `[agent-runner] db:${label} attempt ${attempt} failed (${describe(error)}), retry in ${delayMs}ms`,
        );
      },
    },
  );
}

/** Convenience: `exec` for a client created outside `repo.ts`. */
export type AdminClient = SupabaseClient;
