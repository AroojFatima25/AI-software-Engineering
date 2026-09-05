/**
 * End-to-end tests for the agent-runner pipeline.
 *
 * These run the REAL `executeRun` / `claimRun` code against a fake PostgREST
 * client (an in-memory table store that records every operation) and a stubbed
 * OpenRouter endpoint. Nothing is re-implemented here: the assertions inspect
 * the operations the production modules actually issued.
 *
 *   deno test --allow-net --allow-env --allow-read supabase/tests/
 */
import { assert, assertEquals, assertExists, assertNotEquals } from "./_assert.ts";
import type { RunnerConfig } from "../functions/agent-runner/lib/config.ts";
import { executeRun, StageFailure } from "../functions/agent-runner/lib/pipeline.ts";
import { claimRun, countPriorAttempts, recoverStaleRuns } from "../functions/agent-runner/lib/claim.ts";
import { STAGE_KEYS } from "../functions/agent-runner/lib/stages.ts";
import { CHANGE_STATUS_AGENT_WRITES, EVENT, TABLE } from "../functions/agent-runner/lib/schema.ts";

/* ================================================================== */
/* Fake Supabase client                                                */
/* ================================================================== */

type Row = Record<string, unknown>;

interface Op {
  table: string;
  method: "select" | "insert" | "update" | "delete";
  filters: Array<{ column: string; operator: string; value: unknown }>;
  payload?: unknown;
}

class FakeClient {
  readonly tables = new Map<string, Row[]>();
  readonly ops: Op[] = [];
  private sequence = 0;

  constructor(seed: Record<string, Row[]> = {}) {
    for (const [name, rows] of Object.entries(seed)) this.tables.set(name, rows.map((r) => ({ ...r })));
  }

  table(name: string): Row[] {
    if (!this.tables.has(name)) this.tables.set(name, []);
    return this.tables.get(name)!;
  }

  from(name: string): Builder {
    return new Builder(this, name);
  }

  /** Operations recorded against a table, in order. */
  opsFor(name: string): Op[] {
    return this.ops.filter((op) => op.table === name);
  }

  /** Every distinct table the code touched. */
  touchedTables(): string[] {
    return [...new Set(this.ops.map((op) => op.table))].sort();
  }

  nextId(): string {
    this.sequence += 1;
    return `00000000-0000-4000-8000-${String(this.sequence).padStart(12, "0")}`;
  }
}

type Filter = { column: string; operator: string; value: unknown };

function matches(row: Row, filters: Filter[]): boolean {
  return filters.every((filter) => {
    const actual = row[filter.column];
    switch (filter.operator) {
      case "eq":
        return actual === filter.value;
      case "neq":
        return actual !== filter.value;
      case "in":
        return Array.isArray(filter.value) && (filter.value as unknown[]).includes(actual);
      case "lt":
        return String(actual) < String(filter.value);
      case "gt":
        return String(actual) > String(filter.value);
      case "is":
        return filter.value === null ? actual === null || actual === undefined : actual === filter.value;
      case "not.is":
        return filter.value === null ? actual !== null && actual !== undefined : actual !== filter.value;
      default:
        throw new Error(`FakeClient: unsupported operator "${filter.operator}"`);
    }
  });
}

function project(row: Row, columns: string | null): Row {
  if (!columns || columns.trim() === "*") return { ...row };
  const names = columns.split(",").map((c) => c.trim()).filter(Boolean);
  const out: Row = {};
  for (const name of names) out[name] = row[name];
  return out;
}

class Builder implements PromiseLike<{ data: unknown; error: null }> {
  private method: Op["method"] = "select";
  private columns: string | null = null;
  private filters: Filter[] = [];
  private payload: Row[] | null = null;
  private orderColumn: string | null = null;
  private ascending = true;
  private limitValue: number | null = null;
  private wantSingle = false;

  constructor(private client: FakeClient, private tableName: string) {}

  select(columns = "*"): this {
    // After .insert()/.update() this only sets the RETURNING columns.
    if (!this.payload) this.method = "select";
    this.columns = columns;
    return this;
  }

  insert(rows: Row | Row[]): this {
    this.method = "insert";
    this.payload = (Array.isArray(rows) ? rows : [rows]).map((r) => ({ ...r }));
    return this;
  }

  update(patch: Row): this {
    this.method = "update";
    this.payload = [{ ...patch }];
    return this;
  }

  delete(): this {
    this.method = "delete";
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ column, operator: "eq", value });
    return this;
  }

  neq(column: string, value: unknown): this {
    this.filters.push({ column, operator: "neq", value });
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.filters.push({ column, operator: "in", value: values });
    return this;
  }

  lt(column: string, value: unknown): this {
    this.filters.push({ column, operator: "lt", value });
    return this;
  }

  not(column: string, operator: string, value: unknown): this {
    this.filters.push({ column, operator: `not.${operator}`, value });
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}): this {
    this.orderColumn = column;
    this.ascending = options.ascending !== false;
    return this;
  }

  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  maybeSingle(): Promise<{ data: unknown; error: null }> {
    this.wantSingle = true;
    return this.execute();
  }

  single(): Promise<{ data: unknown; error: null }> {
    this.wantSingle = true;
    return this.execute();
  }

  then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<{ data: unknown; error: null }> {
    this.client.ops.push({
      table: this.tableName,
      method: this.method,
      filters: [...this.filters],
      payload: this.payload ?? undefined,
    });

    const store = this.client.table(this.tableName);

    if (this.method === "insert") {
      const created = (this.payload ?? []).map((row) => ({
        ...row,
        id: row.id ?? this.client.nextId(),
        created_at: row.created_at ?? new Date().toISOString(),
      }));
      store.push(...created);
      if (this.columns) {
        const projected = created.map((row) => project(row, this.columns));
        return { data: this.wantSingle ? (projected[0] ?? null) : projected, error: null };
      }
      return { data: null, error: null };
    }

    const matching = store.filter((row) => matches(row, this.filters));

    if (this.method === "update") {
      const patch = (this.payload ?? [{}])[0];
      for (const row of matching) Object.assign(row, patch);
      if (this.columns) {
        const projected = matching.map((row) => project(row, this.columns));
        return { data: this.wantSingle ? (projected[0] ?? null) : projected, error: null };
      }
      return { data: null, error: null };
    }

    if (this.method === "delete") {
      for (const row of matching) {
        const index = store.indexOf(row);
        if (index >= 0) store.splice(index, 1);
      }
      return { data: null, error: null };
    }

    let result = [...matching];
    if (this.orderColumn) {
      const column = this.orderColumn;
      const direction = this.ascending ? 1 : -1;
      result.sort((a, b) => (String(a[column]) < String(b[column]) ? -direction : direction));
    }
    if (this.limitValue !== null) result = result.slice(0, this.limitValue);

    const projected = result.map((row) => project(row, this.columns));
    return { data: this.wantSingle ? (projected[0] ?? null) : projected, error: null };
  }
}

/* ================================================================== */
/* Stubbed OpenRouter                                                  */
/* ================================================================== */

interface StageFixture {
  summary: string;
  [key: string]: unknown;
}

const FIXTURES: Record<string, StageFixture> = {
  planning: {
    summary: "Split the request into four ordered engineering tasks.",
    tasks: [
      { title: "Define the sync protocol", description: "Specify message shapes.", agent_key: "architect" },
      { title: "Implement the CRDT provider", description: "Write the provider.", agent_key: "coding" },
      { title: "Add conflict tests", description: "Cover offline merges.", agent_key: "testing" },
      { title: "Audit tenant isolation", description: "Check authz.", agent_key: "security" },
    ],
  },
  requirements: {
    summary: "Captured acceptance criteria for live cursors and offline recovery.",
    tasks: [{ title: "Document acceptance criteria", description: "List given/when/then.", agent_key: "product" }],
  },
  architecture: {
    summary: "Chose a WebSocket gateway with a CRDT document store.",
    detail: "Gateway fans out ops; CRDT resolves conflicts; persistence via Postgres.",
  },
  implementation: {
    summary: "Implemented the sync provider and gateway.",
    files: [
      {
        file_path: "src/sync/provider.ts",
        additions: 120,
        deletions: 4,
        summary: "New CRDT provider",
        diff_text: "--- a/src/sync/provider.ts\n+++ b/src/sync/provider.ts\n@@\n+export class Provider {}",
      },
      {
        file_path: "src/sync/gateway.ts",
        additions: 64,
        deletions: 0,
        summary: "WebSocket gateway",
        diff_text: "--- a/src/sync/gateway.ts\n+++ b/src/sync/gateway.ts\n@@\n+export function gateway() {}",
      },
    ],
  },
  testing: {
    summary: "Defined 12 tests covering offline merges and reconnects.",
    tests: { total: 12, passed: 12, failed: 0, notes: "All green." },
  },
  security: {
    summary: "No critical issues; tenant isolation verified.",
    security: {
      summary: "Tenant isolation and token validation verified.",
      risk_level: "low",
      findings: [{ title: "Token rotation", severity: "info", detail: "Rotate reconnect tokens." }],
    },
  },
  review: {
    summary: "Change set is coherent and ready for a human decision.",
    review: {
      summary: "Implementation matches the architecture; two readability suggestions.",
      suggestions: [{ title: "Extract helper", detail: "Move retry loop into a helper." }],
    },
  },
};

let openRouterCalls: Array<{ model: string; stage: string | null }> = [];

function installOpenRouterStub(failStages: Record<string, number> = {}) {
  openRouterCalls = [];
  const remaining = { ...failStages };

  globalThis.fetch = (async (input: URL | Request | string, init?: RequestInit) => {
    const url = String(input);
    if (!url.includes("/chat/completions")) {
      throw new Error(`Unexpected fetch to ${url}`);
    }
    const body = JSON.parse(String(init?.body)) as {
      model: string;
      messages: Array<{ role: string; content: string }>;
    };
    const userMessage = body.messages.find((m) => m.role === "user")?.content ?? "";
    const stageMatch = userMessage.match(/stage_key: ([a-z_]+)/);
    const stage = stageMatch?.[1] ?? null;
    openRouterCalls.push({ model: body.model, stage });

    if (stage && remaining[stage] && remaining[stage] > 0) {
      remaining[stage] -= 1;
      return new Response(JSON.stringify({ error: { message: "transient upstream failure" } }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }

    const fixture = stage ? FIXTURES[stage] : undefined;
    if (!fixture) {
      return new Response(JSON.stringify({ choices: [{ message: { content: "not json at all" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        model: body.model,
        choices: [{ message: { content: "```json\n" + JSON.stringify(fixture) + "\n```" } }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
}

/* ================================================================== */
/* Fixtures                                                            */
/* ================================================================== */

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const RUN_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "44444444-4444-4444-8444-444444444444";

function makeConfig(overrides: Partial<RunnerConfig> = {}): RunnerConfig {
  return {
    supabaseUrl: "https://example.supabase.co",
    supabaseAnonKey: "anon-key",
    supabaseServiceRoleKey: "service-role-key",
    openRouterApiKey: "or-test-key",
    openRouterBaseUrl: "https://openrouter.test/api/v1",
    openRouterModel: "test/model",
    openRouterMaxTokens: 1000,
    openRouterTemperature: 0.1,
    openRouterSiteUrl: "",
    openRouterAppName: "test",
    maxStageAttempts: 3,
    stageTimeoutMs: 5_000,
    runTimeoutMs: 60_000,
    retryBaseDelayMs: 1,
    maxWriteAttempts: 2,
    staleAfterMinutes: 15,
    maxRunAttempts: 3,
    drainBatchSize: "5",
    allowedOrigins: ["*"],
    workerToken: "",
    autocreateAgents: true,
    ...overrides,
  };
}

function makeClient(runStatus = "queued", updatedAgoMs = 0): FakeClient {
  return new FakeClient({
    projects: [
      {
        id: PROJECT_ID,
        workspace_id: WORKSPACE_ID,
        name: "Collab App",
        slug: "collab-app",
        description: "Real-time collaboration",
        repository_url: "https://github.com/example/collab",
        default_branch: "main",
        status: "active",
        created_by: USER_ID,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    runs: [
      {
        id: RUN_ID,
        project_id: PROJECT_ID,
        requested_by: USER_ID,
        request_text: "Add real-time collaborative editing to my application.",
        status: runStatus,
        branch_name: null,
        started_at: null,
        completed_at: null,
        created_at: "2026-01-02T00:00:00.000Z",
        updated_at: new Date(Date.now() - updatedAgoMs).toISOString(),
      },
    ],
  });
}

/**
 * Builds pipeline input from a client's own rows, and pre-sets `branch_name`
 * the way `claimRun` would have — the pipeline is tested post-claim.
 */
function makeInput(client: FakeClient, overrides: Record<string, unknown> = {}) {
  const project = client.table(TABLE.projects)[0];
  const run = client.table(TABLE.runs)[0];
  run.branch_name = "ai/collab-app/33333333";
  return {
    run,
    project,
    workspaceId: WORKSPACE_ID,
    triggeredBy: USER_ID,
    attempt: 1,
    previousError: null,
    ...overrides,
  };
}

/* ================================================================== */
/* Tests                                                               */
/* ================================================================== */

Deno.test("pipeline runs all seven stages in order and stops at ready_for_review", async () => {
  installOpenRouterStub();
  const config = makeConfig();
  const client = makeClient();
  const input = makeInput(client);

  const result = await executeRun(client as never, config, input as never);

  assertEquals(result.status, "ready_for_review");
  assertEquals(result.error, null);
  assertEquals(
    result.stages.map((s) => s.stageKey),
    [...STAGE_KEYS],
  );
  assertEquals(result.stages.every((s) => s.status === "completed"), true);

  // The run itself must be parked at ready_for_review, with a completion time.
  const run = client.table(TABLE.runs).find((r) => r.id === RUN_ID);
  assertExists(run);
  assertEquals(run.status, "ready_for_review");
  assertNotEquals(run.completed_at, null);

  // Exactly one call per stage reached OpenRouter.
  assertEquals(openRouterCalls.length, 7);
  assertEquals(
    openRouterCalls.map((c) => c.stage),
    [...STAGE_KEYS],
  );
  assertEquals(openRouterCalls.every((c) => c.model === "test/model"), true);
});

Deno.test("pipeline never touches the approvals table and only writes pending changes", async () => {
  installOpenRouterStub();
  const config = makeConfig();
  const client = makeClient();

  await executeRun(client as never, config, makeInput(client) as never);

  // Hard requirement: no read and no write of `approvals`, ever.
  assertEquals(
    client.opsFor(TABLE.approvals),
    [],
    "the runner must never read or write the approvals table",
  );
  assertEquals(client.table(TABLE.approvals).length, 0);

  // The proposed change stays in the agent's only allowed status.
  const changes = client.table(TABLE.proposedChanges);
  assertEquals(changes.length, 1);
  assertEquals(changes[0].status, CHANGE_STATUS_AGENT_WRITES);
  assertEquals(changes[0].status, "pending");

  // No run update may set a human-only status.
  const humanOnly = ["approved", "rejected", "merged", "revision_requested"];
  const runStatusesWritten = client
    .opsFor(TABLE.runs)
    .filter((op) => op.method === "update")
    .map((op) => (op.payload as Array<Row>)[0].status)
    .filter((status): status is string => typeof status === "string");
  for (const status of runStatusesWritten) {
    assertEquals(humanOnly.includes(status), false, `runner wrote human-only status ${status}`);
  }
  assertEquals(runStatusesWritten.at(-1), "ready_for_review");
});

Deno.test("pipeline writes stages, tasks, agent activity, change, files and events", async () => {
  installOpenRouterStub();
  const config = makeConfig();
  const client = makeClient();

  await executeRun(client as never, config, makeInput(client) as never);

  // --- run_stages: one row per stage, numbered 1..7 ---
  const stages = client.table(TABLE.runStages);
  assertEquals(stages.length, 7);
  assertEquals(
    stages.map((s) => s.stage_key),
    [...STAGE_KEYS],
  );
  assertEquals(
    stages.map((s) => s.stage_number),
    [1, 2, 3, 4, 5, 6, 7],
  );
  assertEquals(stages.every((s) => s.status === "completed"), true);
  assertEquals(stages.every((s) => s.started_at !== null && s.completed_at !== null), true);

  // --- agents autocreated for every key the pipeline needs ---
  const agentKeys = client.table(TABLE.agents).map((a) => a.agent_key).sort();
  for (const key of ["manager", "product", "architect", "coding", "testing", "security", "reviewer"]) {
    assert(agentKeys.includes(key), `expected agent "${key}" to exist`);
  }

  // --- run_agent_activity: one per stage, all completed ---
  const activity = client.table(TABLE.runAgentActivity);
  assertEquals(activity.length, 7);
  assertEquals(activity.every((a) => a.status === "completed"), true);
  assertEquals(activity.every((a) => typeof a.agent_id === "string" && a.agent_id !== null), true);
  assertEquals(activity.every((a) => a.started_at !== null && a.completed_at !== null), true);

  // --- tasks: 4 from planning + 1 from requirements ---
  const tasks = client.table(TABLE.tasks);
  assertEquals(tasks.length, 5);
  assertEquals(tasks.every((t) => t.project_id === PROJECT_ID), true);
  assertEquals(tasks.every((t) => t.run_id === RUN_ID), true);
  assertEquals(new Set(tasks.map((t) => t.position)).size, 5, "positions must be unique");

  // --- changed_files from the implementation stage ---
  const files = client.table(TABLE.changedFiles);
  assertEquals(files.length, 2);
  assertEquals(files.map((f) => f.file_path).sort(), ["src/sync/gateway.ts", "src/sync/provider.ts"]);
  const additions = files.reduce((sum, f) => sum + (f.additions as number), 0);
  assertEquals(additions, 184);

  // --- test + security results propagated onto the change ---
  const change = client.table(TABLE.proposedChanges)[0];
  assertEquals(change.tests_passed, 12);
  assertEquals(change.tests_total, 12);
  assert(String(change.security_summary).includes("Risk: low"));
  assertEquals(change.source_branch, "ai/collab-app/33333333");
  assertEquals(change.target_branch, "main");

  // --- activity feed ---
  const events = client.table(TABLE.activityEvents);
  const types = new Set(events.map((e) => e.event_type));
  for (const expected of [
    EVENT.runStarted,
    EVENT.stageStarted,
    EVENT.stageCompleted,
    EVENT.tasksPlanned,
    EVENT.changeProposed,
    EVENT.testsReported,
    EVENT.securityReviewed,
    EVENT.runReadyForReview,
  ]) {
    assert(types.has(expected), `missing activity event ${expected}`);
  }
  assertEquals(events.every((e) => e.workspace_id === WORKSPACE_ID), true);
  assertEquals(events.every((e) => e.metadata && typeof e.metadata === "object"), true);
  assert(events.some((e) => e.event_type === EVENT.stageCompleted && (e.metadata as Row).stage === "review"));
});

Deno.test("a stage retries on a transient OpenRouter failure and still completes", async () => {
  installOpenRouterStub({ implementation: 2 }); // fail twice, succeed on the third
  const config = makeConfig({ maxStageAttempts: 3 });
  const client = makeClient();

  const result = await executeRun(client as never, config, makeInput(client) as never);

  assertEquals(result.status, "ready_for_review");
  const implementationCalls = openRouterCalls.filter((c) => c.stage === "implementation").length;
  assertEquals(implementationCalls, 3);

  // The retry is visible in the activity feed.
  const retries = client.table(TABLE.activityEvents).filter((e) => e.event_type === EVENT.stageRetried);
  assertEquals(retries.length, 2);

  // Only one stage row exists for implementation — the retry reused it.
  const implementationStages = client
    .table(TABLE.runStages)
    .filter((s) => s.stage_key === "implementation");
  assertEquals(implementationStages.length, 1);
  assertEquals(implementationStages[0].status, "completed");
});

Deno.test("a stage that exhausts its retries fails the run with a recorded error", async () => {
  installOpenRouterStub({ security: 99 }); // always fails
  const config = makeConfig({ maxStageAttempts: 2 });
  const client = makeClient();

  const result = await executeRun(client as never, config, makeInput(client) as never);

  assertEquals(result.status, "failed");
  assertExists(result.error);
  assertEquals(result.error.stage, "security");

  const run = client.table(TABLE.runs).find((r) => r.id === RUN_ID);
  // The run is NOT left in ready_for_review and NOT marked failed by executeRun
  // itself; the caller decides. What matters is it never reached review.
  assertNotEquals(run?.status, "ready_for_review");

  const failedStage = client
    .table(TABLE.runStages)
    .find((s) => s.stage_key === "security");
  assertEquals(failedStage?.status, "failed");
  assert(String(failedStage?.error_message).length > 0);

  // Earlier stages that did succeed are still recorded as completed.
  const planning = client.table(TABLE.runStages).find((s) => s.stage_key === "planning");
  assertEquals(planning?.status, "completed");

  // The failed agent activity is closed out, not left "working".
  const securityAgent = client.table(TABLE.agents).find((a) => a.agent_key === "security");
  const securityActivity = client
    .table(TABLE.runAgentActivity)
    .filter((a) => a.agent_id === securityAgent?.id);
  assertEquals(securityActivity.length, 1);
  assertEquals(securityActivity[0].status, "failed");

  const failedEvents = client.table(TABLE.activityEvents).filter((e) => e.event_type === EVENT.runFailed);
  assertEquals(failedEvents.length, 1);
});

Deno.test("implementation returning no files fails the stage with a clear message", async () => {
  installOpenRouterStub();
  // Override the implementation fixture with an empty file list.
  FIXTURES.implementation.files = [];
  const config = makeConfig({ maxStageAttempts: 1 });
  const client = makeClient();

  try {
    const result = await executeRun(client as never, config, makeInput(client) as never);
    assertEquals(result.status, "failed");
    assertEquals(result.error?.stage, "implementation");
    assert(String(result.error?.message).includes("no file changes"));
  } finally {
    // Restore for the other tests.
    FIXTURES.implementation.files = [
      {
        file_path: "src/sync/provider.ts",
        additions: 120,
        deletions: 4,
        summary: "New CRDT provider",
        diff_text: "+export class Provider {}",
      },
      {
        file_path: "src/sync/gateway.ts",
        additions: 64,
        deletions: 0,
        summary: "WebSocket gateway",
        diff_text: "+export function gateway() {}",
      },
    ];
  }
});

/* ------------------------------------------------------------------ */
/* Claiming                                                            */
/* ------------------------------------------------------------------ */

Deno.test("claimRun is atomic: only the first caller wins a queued run", async () => {
  const config = makeConfig();
  const client = makeClient("queued");
  const project = client.table(TABLE.projects)[0];

  const first = await claimRun(client as never, config, RUN_ID, project as never);
  assertEquals(first.status, "claimed");
  if (first.status === "claimed") {
    assertEquals(first.run.status, "running");
    assertEquals(first.run.branch_name, "ai/collab-app/33333333");
    assertEquals(first.attempt, 1);
  }

  // Second caller sees the guard reject it — no double processing.
  const second = await claimRun(client as never, config, RUN_ID, project as never);
  assertEquals(second.status, "already_processing");

  // Only one update actually flipped the status.
  const claimOps = client
    .opsFor(TABLE.runs)
    .filter((op) => op.method === "update" && op.filters.some((f) => f.column === "status" && f.value === "queued"));
  assertEquals(claimOps.length, 2, "both attempts issue the guarded update");
  assertEquals(client.table(TABLE.runs).find((r) => r.id === RUN_ID)?.status, "running");
});

Deno.test("claimRun refuses runs that are not queued", async () => {
  const config = makeConfig();
  const client = makeClient("ready_for_review");
  const project = client.table(TABLE.projects)[0];

  const outcome = await claimRun(client as never, config, RUN_ID, project as never);
  assertEquals(outcome.status, "not_claimable");
  assertEquals(client.table(TABLE.runs).find((r) => r.id === RUN_ID)?.status, "ready_for_review");
});

/* ------------------------------------------------------------------ */
/* Stale-run recovery                                                  */
/* ------------------------------------------------------------------ */

Deno.test("recoverStaleRuns requeues a stalled run and records the attempt", async () => {
  const config = makeConfig({ staleAfterMinutes: 15 });
  const client = makeClient("running", 60 * 60 * 1000); // last touched an hour ago

  const report = await recoverStaleRuns(client as never, config);

  assertEquals(report.scanned, 1);
  assertEquals(report.requeued, [RUN_ID]);
  assertEquals(report.abandoned, []);
  assertEquals(client.table(TABLE.runs).find((r) => r.id === RUN_ID)?.status, "queued");
  assertEquals(await countPriorAttempts(client as never, config, RUN_ID), 1);
});

Deno.test("recoverStaleRuns abandons a run that exhausted its attempts", async () => {
  const config = makeConfig({ staleAfterMinutes: 15, maxRunAttempts: 2 });
  const client = makeClient("running", 60 * 60 * 1000);
  // Two prior requeues already recorded.
  client.table(TABLE.activityEvents).push(
    { id: "e1", run_id: RUN_ID, workspace_id: WORKSPACE_ID, project_id: PROJECT_ID, event_type: EVENT.runRequeued, message: null, metadata: {}, created_at: "2026-01-02T00:01:00.000Z" },
    { id: "e2", run_id: RUN_ID, workspace_id: WORKSPACE_ID, project_id: PROJECT_ID, event_type: EVENT.runRequeued, message: null, metadata: {}, created_at: "2026-01-02T00:02:00.000Z" },
  );

  const report = await recoverStaleRuns(client as never, config);

  assertEquals(report.abandoned, [RUN_ID]);
  assertEquals(report.requeued, []);
  assertEquals(client.table(TABLE.runs).find((r) => r.id === RUN_ID)?.status, "failed");
  const abandoned = client.table(TABLE.activityEvents).filter((e) => e.event_type === EVENT.runAbandoned);
  assertEquals(abandoned.length, 1);
});

Deno.test("recoverStaleRuns leaves a recently-heartbeated run alone", async () => {
  const config = makeConfig({ staleAfterMinutes: 15 });
  const client = makeClient("running", 10_000); // touched 10s ago

  const report = await recoverStaleRuns(client as never, config);

  assertEquals(report.scanned, 0);
  assertEquals(report.requeued, []);
  assertEquals(client.table(TABLE.runs).find((r) => r.id === RUN_ID)?.status, "running");
});

Deno.test("recovery quarantines in-flight stages and agent activity", async () => {
  const config = makeConfig({ staleAfterMinutes: 15 });
  const client = makeClient("running", 60 * 60 * 1000);
  client.table(TABLE.runStages).push({
    id: "s1",
    run_id: RUN_ID,
    stage_key: "planning",
    stage_number: 1,
    status: "running",
    error_message: null,
    started_at: "2026-01-02T00:00:00.000Z",
    completed_at: null,
  });
  client.table(TABLE.runAgentActivity).push({
    id: "a1",
    run_id: RUN_ID,
    stage_id: "s1",
    agent_id: "agent-1",
    status: "working",
    task_description: "Planning",
    started_at: "2026-01-02T00:00:00.000Z",
    completed_at: null,
  });

  await recoverStaleRuns(client as never, config);

  assertEquals(client.table(TABLE.runStages)[0].status, "failed");
  assertEquals(client.table(TABLE.runAgentActivity)[0].status, "failed");
});

Deno.test("a recovered run resumes: completed stages are not repeated", async () => {
  installOpenRouterStub();
  const config = makeConfig();
  const client = makeClient("queued");

  // Simulate a previous attempt that finished planning before dying.
  const managerId = client.nextId();
  client.table(TABLE.agents).push({
    id: managerId,
    agent_key: "manager",
    name: "Manager Agent",
    description: null,
    is_active: true,
  });
  client.table(TABLE.runStages).push({
    id: "s-planning",
    run_id: RUN_ID,
    stage_key: "planning",
    stage_number: 1,
    status: "completed",
    error_message: null,
    started_at: "2026-01-02T00:00:00.000Z",
    completed_at: "2026-01-02T00:01:00.000Z",
  });
  client.table(TABLE.activityEvents).push({
    id: "ev-planning",
    run_id: RUN_ID,
    workspace_id: WORKSPACE_ID,
    project_id: PROJECT_ID,
    event_type: EVENT.stageCompleted,
    message: "Manager Agent finished planning: Planned four tasks.",
    metadata: { stage: "planning" },
    created_at: "2026-01-02T00:01:00.000Z",
  });

  const result = await executeRun(client as never, config, makeInput(client, { attempt: 2 }) as never);

  assertEquals(result.status, "ready_for_review");
  const planning = result.stages.find((s) => s.stageKey === "planning");
  assertEquals(planning?.status, "skipped", "a completed stage must not be re-run");

  // Planning was never sent to OpenRouter on this attempt.
  assertEquals(
    openRouterCalls.filter((c) => c.stage === "planning").length,
    0,
  );
  // The remaining six stages did run.
  assertEquals(openRouterCalls.length, 6);
});

Deno.test("StageFailure is exported for the entry point to classify", () => {
  const failure = new StageFailure("testing", "boom");
  assertEquals(failure.name, "StageFailure");
  assertEquals(failure.stageKey, "testing");
});
