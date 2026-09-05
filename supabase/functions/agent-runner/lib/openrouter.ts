/**
 * The single place that talks to OpenRouter.
 *
 * `OPENROUTER_API_KEY` is read from the Edge Function environment and used
 * only inside this module. It is never returned to a caller, never written to
 * the database, never logged, and never referenced by any frontend code — the
 * browser only ever speaks to Supabase, and only this function speaks to
 * OpenRouter.
 */
import type { RunnerConfig } from "./config.ts";
import { upstreamFailure, tooManyRequests } from "./http.ts";
import { parseJsonObject, type JsonParseError } from "./json.ts";
import { retry, TimeoutError, withTimeout, type RetryOptions } from "./retry.ts";

export class OpenRouterError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "OpenRouterError";
  }
}

export interface CompletionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface CompletionResult {
  /** Raw assistant text. */
  text: string;
  model: string;
  usage: CompletionUsage | null;
}

export interface CompleteOptions {
  system: string;
  user: string;
  /** Label used in logs and activity messages, e.g. "stage:testing". */
  label: string;
  signal?: AbortSignal;
  onRetry?: RetryOptions["onRetry"];
  attempts?: number;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
  model?: string;
  usage?: Partial<CompletionUsage>;
  error?: { message?: string; code?: string };
}

/**
 * Sends one chat completion and returns the raw assistant text.
 *
 * Retries transient failures (429 / 5xx / network / timeout) with exponential
 * backoff; deterministic 4xx errors fail immediately so the stage can record a
 * meaningful `error_message` rather than burning its whole budget.
 */
export async function complete(config: RunnerConfig, options: CompleteOptions): Promise<CompletionResult> {
  const url = `${config.openRouterBaseUrl.replace(/\/$/, "")}/chat/completions`;
  const attempts = options.attempts ?? config.maxStageAttempts;

  const result = await retry(
    async () => {
      return await withTimeout(config.stageTimeoutMs, options.label, async (signal) => {
        const response = await fetch(url, {
          method: "POST",
          signal: combineSignals(signal, options.signal),
          headers: {
            Authorization: `Bearer ${config.openRouterApiKey}`,
            "Content-Type": "application/json",
            // Optional attribution — OpenRouter records these in its dashboard
            // and ranks the app in its public leaderboard. Harmless if blank.
            ...(config.openRouterSiteUrl ? { "HTTP-Referer": config.openRouterSiteUrl } : {}),
            ...(config.openRouterAppName ? { "X-Title": config.openRouterAppName } : {}),
          },
          body: JSON.stringify({
            model: config.openRouterModel,
            messages: [
              { role: "system", content: options.system },
              { role: "user", content: options.user },
            ],
            temperature: config.openRouterTemperature,
            max_tokens: config.openRouterMaxTokens,
            // Every stage is asked for JSON, so request it at the API level too.
            response_format: { type: "json_object" },
          }),
        });

        if (!response.ok) {
          const body = await safeReadBody(response);
          const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
          const detail = body ? ` ${body.slice(0, 300)}` : "";
          if (response.status === 429) {
            throw new OpenRouterError(
              `OpenRouter rate limit reached for ${options.label}.${detail}`,
              response.status,
              true,
            );
          }
          throw new OpenRouterError(
            `OpenRouter request for ${options.label} failed with HTTP ${response.status}.${detail}`,
            response.status,
            retryable,
          );
        }

        const payload = (await response.json()) as ChatCompletionResponse;
        if (payload.error?.message) {
          throw new OpenRouterError(
            `OpenRouter returned an error for ${options.label}: ${payload.error.message}`,
            200,
            false,
          );
        }

        const text = payload.choices?.[0]?.message?.content;
        if (!text || !text.trim()) {
          throw new OpenRouterError(
            `OpenRouter returned an empty completion for ${options.label}.`,
            200,
            true,
          );
        }

        return {
          text,
          model: payload.model ?? config.openRouterModel,
          usage: payload.usage
            ? {
                prompt_tokens: payload.usage.prompt_tokens ?? 0,
                completion_tokens: payload.usage.completion_tokens ?? 0,
                total_tokens: payload.usage.total_tokens ?? 0,
              }
            : null,
        } satisfies CompletionResult;
      });
    },
    {
      attempts,
      baseDelayMs: config.retryBaseDelayMs,
      label: `openrouter:${options.label}`,
      isRetryable: (error) => {
        if (error instanceof OpenRouterError) return error.retryable;
        if (error instanceof TimeoutError) return true;
        // fetch() rejects with a TypeError on network failure.
        if (error instanceof TypeError) return true;
        return /timeout|network|reset|ECONN|socket hang up/i.test(
          error instanceof Error ? error.message : String(error),
        );
      },
      onRetry: options.onRetry,
      signal: options.signal,
    },
  );

  return result;
}

/**
 * Completes and parses the response as a JSON object. A parse failure is
 * treated as retryable once — models occasionally emit prose around the JSON —
 * and then surfaces as a clear stage error.
 */
export async function completeJson(
  config: RunnerConfig,
  options: CompleteOptions,
): Promise<{ json: Record<string, unknown>; result: CompletionResult }> {
  let lastParseError: unknown = null;
  const parseAttempts = Math.min(2, options.attempts ?? config.maxStageAttempts);

  for (let attempt = 1; attempt <= parseAttempts; attempt += 1) {
    const result = await complete(config, { ...options, attempts: 1 });
    try {
      return { json: parseJsonObject(result.text), result };
    } catch (error) {
      lastParseError = error;
      console.warn(
        `[agent-runner] ${options.label} returned unparseable JSON (attempt ${attempt}/${parseAttempts})`,
      );
      if (attempt >= parseAttempts) break;
    }
  }

  const message =
    lastParseError instanceof Error ? lastParseError.message : "Model output was not valid JSON.";
  throw upstreamFailure(`${options.label} could not be parsed: ${message}`, {
    stage: options.label,
  });
}

async function safeReadBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

/** Aborts when either signal fires. */
function combineSignals(a: AbortSignal, b?: AbortSignal): AbortSignal {
  if (!b) return a;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (a.aborted || b.aborted) controller.abort();
  else {
    a.addEventListener("abort", abort, { once: true });
    b.addEventListener("abort", abort, { once: true });
  }
  return controller.signal;
}

/** Maps an OpenRouter failure onto an HTTP response code for the caller. */
export function openRouterErrorToHttp(error: OpenRouterError): Error {
  if (error.status === 429) return tooManyRequests(error.message);
  return upstreamFailure(error.message, { status: error.status });
}

export type { JsonParseError };
