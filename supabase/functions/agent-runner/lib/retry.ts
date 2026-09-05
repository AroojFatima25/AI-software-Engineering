/**
 * Retry, backoff and timeout primitives shared by the OpenRouter client and
 * every Supabase write.
 *
 * Two distinct failure classes are handled:
 *   1. Transient upstream failures (429 / 5xx / network reset) → retry with
 *      exponential backoff + full jitter.
 *   2. Deterministic failures (4xx, bad JSON, validation) → do NOT retry; fail
 *      fast so the stage can record a useful `error_message`.
 */

export class TimeoutError extends Error {
  constructor(readonly ms: number, label: string) {
    super(`${label} timed out after ${ms}ms.`);
    this.name = "TimeoutError";
  }
}

export class AbortedError extends Error {
  constructor(message = "Operation aborted.") {
    super(message);
    this.name = "AbortedError";
  }
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AbortedError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new AbortedError());
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Runs `fn` under a wall-clock budget. */
export async function withTimeout<T>(ms: number, label: string, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fn(controller.signal);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError" && controller.signal.aborted) {
      throw new TimeoutError(ms, label);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** Exponential backoff with full jitter, capped. */
export function backoffDelay(attempt: number, baseMs: number, capMs = 15_000): number {
  const exponential = Math.min(capMs, baseMs * 2 ** Math.max(0, attempt - 1));
  return Math.floor(exponential / 2 + Math.random() * (exponential / 2));
}

/** True when an HTTP status is worth retrying. */
export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

/** True when an error looks transient (network blip, timeout, reset). */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof TimeoutError) return true;
  if (error instanceof TypeError) return true; // fetch network failure in Deno
  const message = error instanceof Error ? error.message : String(error);
  return /timeout|network|reset|ECONN|socket hang up|temporarily|unavailable/i.test(message);
}

export interface RetryOptions {
  attempts: number;
  baseDelayMs: number;
  label: string;
  /** Decide per-attempt whether another try is allowed. */
  isRetryable?: (error: unknown) => boolean;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
  signal?: AbortSignal;
}

/**
 * Runs `fn` up to `attempts` times. The final error is rethrown untouched so
 * callers can inspect it. `onRetry` is used to surface progress into the
 * run's activity feed.
 */
export async function retry<T>(fn: (attempt: number) => Promise<T>, options: RetryOptions): Promise<T> {
  const { attempts, baseDelayMs, label } = options;
  const isRetryable = options.isRetryable ?? isRetryableError;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (options.signal?.aborted) throw new AbortedError();
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      const canRetry = attempt < attempts && isRetryable(error);
      if (!canRetry) break;
      const delayMs = backoffDelay(attempt, baseDelayMs);
      options.onRetry?.(error, attempt, delayMs);
      console.warn(
        `[agent-runner] ${label} attempt ${attempt}/${attempts} failed (${describe(error)}), retrying in ${delayMs}ms`,
      );
      await sleep(delayMs, options.signal);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`${label} failed: ${String(lastError)}`);
}

export function describe(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}
