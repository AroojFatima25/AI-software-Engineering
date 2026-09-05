/**
 * Minimal assertion helpers for the agent-runner tests.
 *
 * The sandbox has no access to jsr.io and `@std/assert` is not published to
 * npm, so these wrap Node's built-in `node:assert`, which Deno supports
 * natively with no download. Signatures intentionally match the subset of
 * @std/assert the tests use, so the tests read the same either way.
 */
import nodeAssert from "node:assert";

export function assert(condition: unknown, message?: string): asserts condition {
  nodeAssert.ok(condition, message ?? "Expected condition to be truthy");
}

export function assertEquals<T>(actual: T, expected: T, message?: string): void {
  nodeAssert.deepStrictEqual(actual, expected, message);
}

export function assertNotEquals<T>(actual: T, expected: T, message?: string): void {
  nodeAssert.notDeepStrictEqual(actual, expected, message);
}

export function assertExists<T>(value: T | null | undefined, message?: string): asserts value is T {
  nodeAssert.ok(value !== null && value !== undefined, message ?? "Expected value to exist");
}
