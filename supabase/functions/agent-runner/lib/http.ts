/**
 * HTTP plumbing: CORS, JSON envelopes, and the error taxonomy.
 *
 * Error responses never leak internals. Every `Error` thrown inside the runner
 * is mapped to a stable `code` + human `message`; stack traces, SQL text and
 * upstream bodies are logged server-side only.
 */
import { ConfigError } from "./config.ts";

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: Record<string, unknown>) =>
  new HttpError(400, "bad_request", message, details);

export const unauthorized = (message = "Missing or invalid authentication.") =>
  new HttpError(401, "unauthorized", message);

export const forbidden = (message: string) => new HttpError(403, "forbidden", message);

export const notFound = (message: string) => new HttpError(404, "not_found", message);

export const conflict = (message: string, details?: Record<string, unknown>) =>
  new HttpError(409, "conflict", message, details);

export const tooManyRequests = (message: string) => new HttpError(429, "rate_limited", message);

export const upstreamFailure = (message: string, details?: Record<string, unknown>) =>
  new HttpError(502, "upstream_failure", message, details);

export const internal = (message = "Unexpected runner failure.") =>
  new HttpError(500, "internal_error", message);

/* ------------------------------------------------------------------ */
/* CORS                                                                */
/* ------------------------------------------------------------------ */

/**
 * Builds the CORS headers for a request.
 *
 * The origin is echoed only when it is explicitly allow-listed; otherwise the
 * browser blocks the response while non-browser callers (cron, curl, CI) are
 * unaffected because they do not enforce CORS. Credentials are never enabled —
 * the caller passes the user JWT in an `Authorization` header, not a cookie.
 */
export function corsHeaders(request: Request, allowedOrigins: string[]): HeadersInit {
  const base: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers":
      "Authorization, Content-Type, X-Agent-Runner-Worker, X-Client-Info",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };

  const origin = request.headers.get("origin");
  if (!origin) return base;

  const allowed = allowedOrigins.includes("*") || allowedOrigins.includes(origin);
  if (allowed) {
    base["Access-Control-Allow-Origin"] = origin;
  }
  return base;
}

export function preflightResponse(headers: HeadersInit): Response {
  return new Response("ok", { status: 204, headers });
}

/* ------------------------------------------------------------------ */
/* JSON envelopes                                                      */
/* ------------------------------------------------------------------ */

export function json(body: unknown, init: { status?: number; headers?: HeadersInit } = {}): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(init.headers ?? {}),
    },
  });
}

export function ok(body: Record<string, unknown>, headers?: HeadersInit): Response {
  return json({ ok: true, ...body }, { status: 200, headers });
}

export function accepted(body: Record<string, unknown>, headers?: HeadersInit): Response {
  return json({ ok: true, ...body }, { status: 202, headers });
}

/**
 * Converts any thrown value into a response. Unknown errors become a generic
 * 500 with a correlation id so the operator can grep the function logs.
 */
export function errorResponse(error: unknown, headers?: HeadersInit): Response {
  const correlationId = crypto.randomUUID();

  if (error instanceof HttpError) {
    return json(
      {
        ok: false,
        error: { code: error.code, message: error.message, details: error.details ?? null },
        correlation_id: correlationId,
      },
      { status: error.status, headers },
    );
  }

  if (error instanceof ConfigError) {
    console.error(`[agent-runner] configuration error (${correlationId}):`, error.message);
    return json(
      {
        ok: false,
        error: {
          code: "misconfigured",
          message: error.message,
          details: null,
        },
        correlation_id: correlationId,
      },
      { status: 500, headers },
    );
  }

  const message = error instanceof Error ? error.message : String(error);
  console.error(`[agent-runner] unhandled error (${correlationId}):`, error);
  return json(
    {
      ok: false,
      error: {
        code: "internal_error",
        message: "The agent runner hit an unexpected error.",
        details: { logged: message.slice(0, 200) },
      },
      correlation_id: correlationId,
    },
    { status: 500, headers },
  );
}
