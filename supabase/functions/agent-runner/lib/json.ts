/**
 * Defensive parsing of model output.
 *
 * Models wrap JSON in prose or ```json fences more often than they should, so
 * every stage result goes through `parseJsonObject`: strip fences, find the
 * outermost balanced object, parse. If that fails the stage records a clear
 * error instead of crashing the run.
 */

export class JsonParseError extends Error {
  constructor(message: string, readonly raw: string) {
    super(message);
    this.name = "JsonParseError";
  }
}

/** Strips ```json … ``` fences and trims surrounding prose. */
function stripFences(input: string): string {
  const fenced = input.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  return input.trim();
}

/** Finds the first balanced `{ … }` region, ignoring braces inside strings. */
function extractBalancedObject(input: string): string | null {
  const start = input.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < input.length; i += 1) {
    const char = input[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) return input.slice(start, i + 1);
    }
  }
  return null;
}

/** Parses a JSON object out of arbitrary model output. */
export function parseJsonObject(input: string): Record<string, unknown> {
  const candidate = stripFences(input);
  const attempts = [candidate, extractBalancedObject(candidate)].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );

  for (const attempt of attempts) {
    try {
      const parsed: unknown = JSON.parse(attempt);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // fall through to the next candidate
    }
  }

  throw new JsonParseError(
    "The model did not return a valid JSON object for this stage.",
    input.slice(0, 500),
  );
}

/* ------------------------------------------------------------------ */
/* Field coercion helpers                                              */
/* ------------------------------------------------------------------ */

export function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
}

export function asNullableString(value: unknown): string | null {
  if (typeof value === "string") return value.trim().length ? value : null;
  if (value === null || value === undefined) return null;
  return String(value);
}

export function asNonNegativeInt(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(asString(value, ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.trunc(parsed));
}

export function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item),
  );
}

/** Caps a string so oversized model output cannot blow past column limits. */
export function clampText(value: string | null, max: number): string | null {
  if (value === null) return null;
  return value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1))}…`;
}
