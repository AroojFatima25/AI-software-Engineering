# Supabase backend — `agent-runner`

The server-side half of AI Software Engineering. A single Supabase Edge Function
(`supabase/functions/agent-runner`) turns a queued run into a reviewed,
ready-to-approve change set, and it is the **only** component that talks to
OpenRouter and the only one allowed to write the agent-owned tables.

```
supabase/
├── README.md                     ← this file
├── secrets.example               ← every server-side secret, documented
├── .gitignore                    ← keeps real secret values out of git
├── functions/
│   └── agent-runner/
│       ├── index.ts              ← HTTP entry point: routing, auth, dispatch
│       ├── deno.json             ← strict TS settings + dev tasks
│       └── lib/
│           ├── config.ts         ← reads & validates every secret
│           ├── http.ts           ← CORS, JSON envelopes, error taxonomy
│           ├── retry.ts          ← backoff, timeout, retry primitives
│           ├── json.ts           ← defensive parsing of model output
│           ├── exec.ts           ← PostgREST wrapper (throws, never silently nulls)
│           ├── clients.ts        ← user-scoped client + service_role client
│           ├── auth.ts           ← JWT verification + workspace membership
│           ├── schema.ts         ← the production schema, as used
│           ├── stages.ts         ← the 7 stages and their owning agents
│           ├── prompts.ts        ← per-stage prompts and JSON contracts
│           ├── openrouter.ts     ← the ONLY OpenRouter caller
│           ├── claim.ts          ← atomic claim + stale-run recovery
│           ├── repo.ts           ← every database write
│           └── pipeline.ts       ← stage orchestration
└── tests/
    ├── _assert.ts                ← assertion helpers (node:assert wrapper)
    └── agent-runner_test.ts      ← 14 end-to-end tests of the real modules
```

---

## 1. Secrets

### 1.1 Required

Every value below is read from the **Edge Function's own environment**
(`Deno.env`). Nothing is hardcoded and nothing is read from a request body.
`supabase/secrets.example` is the canonical, commented template.

| Secret | Required | Source | Purpose |
| --- | --- | --- | --- |
| `SUPABASE_URL` | **Yes** (auto-injected) | Dashboard → Project Settings → API → Project URL | Project URL. Injected into every Edge Function by the runtime; set manually only for local `deno serve`. |
| `SUPABASE_ANON_KEY` | **Yes** (auto-injected) | Dashboard → API → Project API keys (publishable) | Publishable key. Used **only** to build the caller-scoped client that verifies the user's JWT and proves workspace membership under RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** — secret | Dashboard → API → Project API keys (secret) | The `service_role` key. Bypasses RLS. The only way to write the agent-owned tables, which the schema deliberately denies to the browser. **Server-side only.** |
| `OPENROUTER_API_KEY` | **Yes** — secret | https://openrouter.ai/settings/keys | The only credential used to reach OpenRouter. Referenced in exactly one module, `lib/openrouter.ts`. **Server-side only.** |

If a required secret is missing, the function does **not** crash on cold start
and it does **not** silently misbehave: it returns HTTP 500 with
`{ "error": { "code": "misconfigured", "message": "Missing required secret \"X\". Set it with: supabase secrets set X=..." } }`,
naming the exact variable.

### 1.2 Optional

| Secret | Default | Purpose |
| --- | --- | --- |
| `OPENROUTER_MODEL` | `anthropic/claude-3.5-sonnet` | Model used for every stage. |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | Override for a proxy or compatible gateway. |
| `OPENROUTER_MAX_TOKENS` | `4000` | Max completion tokens per stage call. Raise if implementation diffs truncate. |
| `OPENROUTER_TEMPERATURE` | `0.2` | Low by design — these stages want deterministic structured output. |
| `OPENROUTER_SITE_URL` | *(blank)* | `HTTP-Referer` attribution header. Omitted when blank. |
| `OPENROUTER_APP_NAME` | `AI Software Engineering` | `X-Title` attribution header. |
| `AGENT_RUNNER_MAX_STAGE_ATTEMPTS` | `3` | Attempts per stage. `1` disables stage retries. |
| `AGENT_RUNNER_STAGE_TIMEOUT_MS` | `120000` | Budget for one OpenRouter call. |
| `AGENT_RUNNER_RUN_TIMEOUT_MS` | `900000` | Budget for a whole run (all 7 stages). |
| `AGENT_RUNNER_RETRY_BASE_DELAY_MS` | `500` | Base for exponential backoff with full jitter. |
| `AGENT_RUNNER_MAX_WRITE_ATTEMPTS` | `4` | Attempts for transient Postgres/PostgREST failures. |
| `AGENT_RUNNER_STALE_AFTER_MINUTES` | `15` | How long a `running` run may go without a heartbeat before it is requeued. |
| `AGENT_RUNNER_MAX_RUN_ATTEMPTS` | `3` | Total attempts per run (original + recoveries). Then the run is failed, not requeued forever. |
| `AGENT_RUNNER_DRAIN_BATCH_SIZE` | `5` | Queued runs claimed per `drain` call. |
| `AGENT_RUNNER_ALLOWED_ORIGINS` | *(blank)* | Comma-separated CORS origins. Blank denies cross-origin **browser** calls; curl/cron are unaffected. |
| `AGENT_RUNNER_WORKER_TOKEN` | *(blank)* | Shared bearer token for the server-to-server `drain` / `recover_stale` actions. **If blank, those actions are disabled outright** rather than left open. |
| `AGENT_RUNNER_AUTOCREATE_AGENTS` | `true` | Create missing `agents` rows for known agent keys on first use. Set `false` to seed them yourself. |

### 1.3 Setting them

```bash
# All at once from the template
cp supabase/secrets.example ./secrets.local   # then fill in real values
supabase secrets set --env-file ./secrets.local

# Or individually
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
supabase secrets set OPENROUTER_API_KEY=sk-or-v1-...

# Verify (names only — values are masked)
supabase secrets list

# Check what the deployed function sees (presence booleans only, never values)
curl https://YOUR-PROJECT-REF.supabase.co/functions/v1/agent-runner/health
```

`secrets.local` is git-ignored by `supabase/.gitignore`. Only
`secrets.example` is tracked.

---

## 2. Secret hygiene — what never leaves the server

The security model rests on one rule: **the browser only ever talks to
Supabase.** Enforced as follows.

* `SUPABASE_SERVICE_ROLE_KEY` and `OPENROUTER_API_KEY` appear in exactly two
  places — `lib/config.ts` (which reads them) and `lib/openrouter.ts` (which
  uses the OpenRouter one). Grep proves it:

  ```bash
  grep -rn "OPENROUTER_API_KEY\|SUPABASE_SERVICE_ROLE_KEY" --include="*.ts" --include="*.tsx" .
  ```

* **No `VITE_*` variable carries a secret.** Vite inlines every `VITE_`-prefixed
  variable into the public JavaScript bundle at build time, so any secret placed
  there is public. The frontend's `src/vite-env.d.ts` declares exactly two
  `VITE_` variables, both non-secret:

  | Variable | Secret? | Why it is safe |
  | --- | --- | --- |
  | `VITE_SUPABASE_URL` | No | The project URL is public by design. |
  | `VITE_SUPABASE_PUBLISHABLE_KEY` | No | The anon/publishable key is designed to ship in the browser; RLS is the boundary. |

  The Edge Function URL is *derived* from `VITE_SUPABASE_URL`
  (`${url}/functions/v1/agent-runner`), so wiring the frontend up requires **no
  new variable at all**.

* Secrets are never returned in a response body. `GET /health` reports only
  **presence booleans** per secret name.

* Secrets are never logged and never written to the database. Error responses
  carry a `correlation_id` and a short message; stack traces, SQL text and
  upstream bodies stay in the function logs.

---

## 3. Authentication and authorisation

Every user-initiated request goes through four ordered checks in
`lib/auth.ts`. A caller who fails any of them never reaches a model call or a
write.

1. **Extract the user JWT** from `Authorization: Bearer <token>`. This must be a
   Supabase **user access token** — not an API key, not the service_role key.
   The shape is validated before use.
2. **Verify it** with `supabase.auth.getUser(jwt)`. The token is round-tripped
   against the project's GoTrue, so expired, forged and revoked tokens are
   rejected. The runner never decodes-and-trusts a JWT itself.
3. **Resolve the run's workspace**: `runs.project_id → projects.workspace_id`.
   `runs` has no `workspace_id` column, so this join is the only correct path.
4. **Prove membership** with a query executed *as that user* against
   `workspace_members`, so Row Level Security — and the
   `current_user_is_workspace_member(uuid)` helper the policies call — is the
   thing granting access. A non-member gets **403**, and gets it before any
   OpenRouter spend and before any write.

Two clients are used, deliberately (`lib/clients.ts`):

| Client | Key | Used for |
| --- | --- | --- |
| Caller-scoped | anon + the caller's JWT | Verifying the JWT, proving workspace membership under RLS |
| Admin | `service_role` | The pipeline's own writes, which the schema forbids the browser from making |

This mirrors the frontend's own contract: `src/lib/workspace.ts` documents that
the browser may insert only `projects` and `runs`, and that everything
downstream of a run is written by the agent backend.

---

## 4. The pipeline

Seven stages, in this order. `stage_key` values are written to
`run_stages.stage_key` and rendered verbatim by the dashboard, so they are part
of the contract with the frontend.

| # | `stage_key` | Agent (`agents.agent_key`) | Produces |
| --- | --- | --- | --- |
| 1 | `planning` | `manager` | Tasks |
| 2 | `requirements` | `product` | Acceptance-criteria tasks |
| 3 | `architecture` | `architect` | Technical design |
| 4 | `implementation` | `coding` | Proposed change + changed files |
| 5 | `testing` | `testing` | `tests_passed` / `tests_total` |
| 6 | `security` | `security` | `security_summary` |
| 7 | `review` | `reviewer` | Review summary + suggestions |

### What gets written, using the existing schema only

| Table | When | Notes |
| --- | --- | --- |
| `run_stages` | Each stage | One row per stage, `stage_number` 1–7, `status` `queued → running → completed \| failed \| skipped`, `error_message` on failure. Idempotent on `(run_id, stage_key)`. |
| `run_agent_activity` | Each stage | `status` `working → completed \| failed`, with `started_at` / `completed_at` and `task_description`. `agent_id` is NOT NULL in the schema, so the agent row is resolved (or created) first. |
| `tasks` | Planning, requirements | Matched on `(run_id, lowercased title)` so a requeued run updates its own tasks instead of duplicating them. `position` continues from the project maximum. Status flows `pending → in_progress → completed \| failed`. |
| `proposed_changes` | Implementation | **Always `status = 'pending'`.** `source_branch` = the run branch, `target_branch` = `projects.default_branch`. `tests_passed` / `tests_total` set by testing; `security_summary` set by security. Idempotent per run. |
| `changed_files` | Implementation | `file_path`, `additions`, `deletions`, `diff_text`. Replaced wholesale on a retry so the dashboard never shows stale paths. |
| `activity_events` | Throughout | Workspace feed. `event_type` values are a stable vocabulary the dashboard renders: `run_claimed`, `run_started`, `stage_started`, `stage_completed`, `stage_retried`, `stage_failed`, `tasks_planned`, `agent_completed`, `change_proposed`, `tests_reported`, `security_reviewed`, `run_ready_for_review`, `run_failed`, `run_requeued`, `run_recovered`, `run_abandoned`. |

**No new tables. No new columns. No migrations.** Anything the pipeline needs to
remember across retries lives in existing columns — the attempt counter is
derived by counting `activity_events` rows of type `run_requeued` for the run
(see `lib/claim.ts`).

### Stopping at `ready_for_review`

The pipeline's only terminal outcomes for `runs.status` are
`ready_for_review` (success) and `failed`. It never writes `approved`,
`rejected`, `merged` or `revision_requested`, and the response says so
explicitly:

```json
{ "ok": true, "outcome": "ready_for_review", "awaiting_human_decision": true, "approvals_written": 0 }
```

### Approvals are never written automatically

This is enforced structurally, not by convention. Every read and write in
`lib/repo.ts` funnels through a `table()` guard that **throws** if handed the
`approvals` table:

```
policy_violation: The agent runner is not permitted to read or write the
`approvals` table. Approvals are created only by the submit_approval RPC on
behalf of a signed-in user.
```

Human review decisions arrive only through the existing
`submit_approval(uuid, text, text)` RPC, called by the dashboard with the
user's own JWT. The test suite asserts that a full pipeline run issues **zero**
operations against `approvals` and writes no human-only run status.

The dashboard treats a change as reviewable when
`run.status === 'ready_for_review'` **and** `change.status === 'pending'`
(`ReviewsSection.tsx`) — which is exactly the pair this pipeline leaves behind.

---

## 5. Concurrency: claiming runs atomically

A run is claimed by **one** conditional statement:

```sql
update runs
   set status = 'running', started_at = now(), branch_name = $branch
 where id = $run_id
   and status = 'queued'      -- ← the guard
returning *;
```

Under Postgres' default READ COMMITTED isolation this is atomic. Two workers
racing on the same row: the first takes the row lock and commits
`status='running'`; the second blocks on that lock, then **re-evaluates its
WHERE clause against the newly committed row**, finds `status <> 'queued'`,
matches zero rows and receives an empty result. Exactly one worker ever learns
it owns the run.

This needs no advisory locks, no new tables and no schema changes.
`selectQueuedRuns` is only a *candidate* list, so candidate lists may safely
overlap between workers — the claim is the synchronisation point. A caller that
loses the race gets HTTP 409 with the run's current status.

`branch_name` is set at claim time to `ai/<project-slug>/<first 8 chars of run id>`.

---

## 6. Retry, timeouts and recovery

| Failure | Handling |
| --- | --- |
| OpenRouter 429 / 5xx / network / timeout | Retried per stage with exponential backoff + full jitter, up to `AGENT_RUNNER_MAX_STAGE_ATTEMPTS`. Each retry emits a `stage_retried` activity event. |
| OpenRouter 4xx / empty completion | Not retried — fails fast with a useful `error_message` rather than burning the whole budget. |
| Model returns prose instead of JSON | Fences are stripped and the outermost balanced object is extracted; parsed twice at most, then the stage fails with a clear message. |
| Postgres `40001` / `40P01` / `53300` / connection errors | Retried up to `AGENT_RUNNER_MAX_WRITE_ATTEMPTS`. |
| Single model call too slow | Aborted at `AGENT_RUNNER_STAGE_TIMEOUT_MS` via `AbortSignal`. |
| Whole run too slow | `AGENT_RUNNER_RUN_TIMEOUT_MS` deadline, checked between stages **and** enforced by aborting the in-flight call. |
| Worker dies mid-run | The pipeline heartbeats `runs.updated_at` roughly every third of the stale window. `recover_stale` finds `running` runs whose `updated_at` is older than `AGENT_RUNNER_STALE_AFTER_MINUTES` and requeues them. |
| Run keeps stalling | After `AGENT_RUNNER_MAX_RUN_ATTEMPTS` the run is marked `failed` and a `run_abandoned` event is written. It is never requeued forever. |
| Requeued run | In-flight stages and agent activity are marked `failed` so the dashboard stops showing a spinner for work that no longer exists. |
| Recovered run | **Resumes, it does not restart.** Stages already marked `completed` are skipped and their conclusions are rebuilt from `activity_events`, so recovery costs one stage instead of the whole run. |

The stale reset is itself an atomic conditional update
(`set status='queued' where id=$1 and status='running' and updated_at < cutoff`),
so two concurrent sweepers cannot double-count or double-requeue a run.

Every error path produces a real message: `run_stages.error_message` for the
stage, a `run_failed` activity event for the feed, and a structured JSON error
with a `correlation_id` for the caller.

---

## 7. API

Base URL: `https://YOUR-PROJECT-REF.supabase.co/functions/v1/agent-runner`

### `GET /health`

No auth, so uptime probes work. Returns stage keys, configured limits, and
**presence booleans** for every secret — never values.

```bash
curl https://YOUR-PROJECT-REF.supabase.co/functions/v1/agent-runner/health
```

### `POST /` — `{ "action": "run", "run_id": "<uuid>", "wait": false }`

User-facing. Requires the caller's Supabase user access token:

```bash
curl -X POST https://YOUR-PROJECT-REF.supabase.co/functions/v1/agent-runner \
  -H "Authorization: Bearer $SUPABASE_USER_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"run","run_id":"33333333-3333-4333-8333-333333333333"}'
```

Because seven model calls can outlast an Edge Function's wall-clock limit, the
default is **asynchronous**: the run is claimed, the pipeline is handed to
`EdgeRuntime.waitUntil`, and the function answers `202` immediately.

```json
{
  "ok": true, "outcome": "started", "run_id": "…", "run_status": "running",
  "attempt": 1, "branch_name": "ai/collab-app/33333333",
  "stages": ["planning","requirements","architecture","implementation","testing","security","review"],
  "terminal_status": "ready_for_review"
}
```

Pass `"wait": true` for a synchronous result (useful for tests and small runs):

```json
{ "ok": true, "outcome": "ready_for_review", "proposed_change_id": "…",
  "awaiting_human_decision": true, "approvals_written": 0, "stages": [ … ] }
```

| Status | Meaning |
| --- | --- |
| `200` | Run reached `ready_for_review` (`wait: true`). |
| `202` | Run claimed and processing in the background (`wait: false`). |
| `400` | Missing/invalid `run_id`, malformed JSON, unknown action. |
| `401` | Missing, malformed, expired or invalid user JWT. |
| `403` | Not a member of the workspace that owns the run. |
| `404` | Run or its project does not exist. |
| `409` | Already being processed, or not in a claimable status. |
| `500` | Misconfigured secret, or an internal fault. |
| `502` | A stage failed on an upstream (OpenRouter) error. |
| `504` | The run exceeded its wall-clock budget. |

### `POST /` — `{ "action": "drain", "limit": 5 }`

Server-to-server worker. Requires `X-Agent-Runner-Worker: <token>`; disabled
entirely when `AGENT_RUNNER_WORKER_TOKEN` is unset. Recovers stale runs first,
then claims and processes up to `limit` queued runs. Intended to be driven by
Supabase cron (`pg_cron` + `net.http_post`) on a schedule.

### `POST /` — `{ "action": "recover_stale" }`

Server-to-server. Stale-run recovery only, no processing.

---

## 8. Deploying

Production project ref: **`dvspibrxsqyfdtryqogc`**
Function URL: `https://dvspibrxsqyfdtryqogc.supabase.co/functions/v1/agent-runner`

### 8.1 From GitHub Actions (recommended)

`.github/workflows/deploy-agent-runner.yml` deploys **only** this function —
it never runs `db push` and never touches the frontend. It:

1. typechecks, lints, tests and smoke-tests the function (`checks` job);
2. runs `supabase functions deploy agent-runner --project-ref … --use-api`
   (server-side bundling, no Docker);
3. lists the configured secret **names** (never values);
4. verifies `GET /health` with `supabase/scripts/verify-health.sh`, which fails
   the run if any of the four required secrets is reported absent;
5. prints the function URL.

One-time setup: add the repository secret `SUPABASE_ACCESS_TOKEN` (a personal
access token from https://supabase.com/dashboard/account/tokens) under
*Settings → Secrets and variables → Actions*. Then run the workflow from the
*Actions* tab (**Deploy agent-runner → Run workflow**), or push a change under
`supabase/functions/agent-runner/` to `main`.

### 8.2 From a workstation

```bash
supabase login

# 1. Secrets BEFORE the first deploy, so the function never starts misconfigured
supabase secrets set --env-file ./secrets.local --project-ref dvspibrxsqyfdtryqogc

# 2. Deploy (verify_jwt / entrypoint come from supabase/config.toml)
supabase functions deploy agent-runner --project-ref dvspibrxsqyfdtryqogc --use-api

# 3. Verify — presence booleans only, never values
./supabase/scripts/verify-health.sh dvspibrxsqyfdtryqogc
```

`supabase/config.toml` sets `verify_jwt = false` for this function on purpose:
`GET /health` and the token-authenticated worker actions carry no Supabase JWT,
and the function performs its own — stricter — verification of user JWTs
(`lib/auth.ts`) before doing anything.

Add the browser origins that will call the function to
`AGENT_RUNNER_ALLOWED_ORIGINS`, and add the function URL to Supabase → Edge
Functions → CORS if you manage it there instead.

### Wall-clock limits

Supabase Edge Functions enforce a wall-clock cap per invocation. The default
`AGENT_RUNNER_RUN_TIMEOUT_MS` (15 min) can exceed it. If your runs are long:

1. Keep `wait: false` (the default) so the *caller* is never blocked.
2. Drive long work through `action: "drain"` on a schedule, and
3. Lower `AGENT_RUNNER_RUN_TIMEOUT_MS` to sit inside the platform cap — a run
   that exceeds it is stopped cleanly and picked up again by `recover_stale`.

### Scheduling the worker

```sql
-- Database → SQL editor. Runs the worker every 5 minutes.
select cron.schedule(
  'agent-runner-drain', '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/agent-runner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Agent-Runner-Worker', current_setting('app.settings.agent_runner_worker_token')
    ),
    body := jsonb_build_object('action', 'drain', 'limit', 5)
  );
  $$
);
```

The worker token belongs in a database secret, never in the schedule text.

---

## 9. Local development and tests

```bash
# Typecheck the Edge Function (strict: noUnusedLocals, noUnusedParameters,
# noImplicitOverride, noFallthroughCasesInSwitch)
cd supabase/functions/agent-runner && deno check index.ts

# Lint + format
deno lint
deno fmt --check

# Run the test suite
deno test --allow-net --allow-env --allow-read supabase/tests/
```

The tests run the **real** `executeRun` / `claimRun` / `recoverStaleRuns`
against a fake PostgREST client (an in-memory table store that records every
operation) and a stubbed OpenRouter endpoint. Nothing is re-implemented: the
assertions inspect the operations the production modules actually issued.

14 tests cover:

* all seven stages execute in order and the run stops at `ready_for_review`;
* **zero** operations touch `approvals`, and the proposed change is left
  `pending` — no human-only run status is ever written;
* stages, tasks, agent activity, proposed change, changed files and activity
  events are all written with correct shapes and counts;
* a stage retries on transient OpenRouter 503s and still completes;
* a stage that exhausts its retries fails the run, records `error_message`,
  closes out its agent activity, and reports the **stage** that died;
* implementation returning no files fails with a clear message;
* `claimRun` is atomic — a second caller is refused;
* `claimRun` refuses runs that are not `queued`;
* stale runs are requeued, exhausted runs are abandoned, fresh runs are left
  alone, and in-flight work is quarantined on requeue;
* a recovered run resumes without re-running completed stages.

---

## 10. Security summary

| Control | Where |
| --- | --- |
| User JWT verified against GoTrue, never decoded-and-trusted | `lib/auth.ts` |
| Workspace membership proven under RLS, before any spend or write | `lib/auth.ts` |
| Atomic run claim; duplicate workers cannot double-process | `lib/claim.ts` |
| `service_role` and OpenRouter keys server-side only | `lib/config.ts`, `lib/openrouter.ts` |
| No secret in any `VITE_*` variable or frontend file | see §2 |
| `approvals` table unwritable from the agent side — throws | `lib/repo.ts` |
| Proposed changes only ever written as `pending` | `lib/repo.ts` |
| Run terminates at `ready_for_review`; human decides | `lib/pipeline.ts` |
| Secrets never echoed — `/health` reports presence only | `lib/config.ts`, `index.ts` |
| Worker actions disabled unless a token is configured | `index.ts` |
| CORS allow-list; credentials never enabled | `lib/http.ts` |
