/**
 * Canonical view of the PRODUCTION Supabase schema this runner writes to.
 *
 * This file is the single source of truth for table and column names on the
 * agent side. It mirrors — 1:1, snake_case included — the tables already used
 * by the dashboard in `ai-software-engineering-website (1)/src/lib/workspace.ts`
 * and typed in `src/types/workspace.ts`:
 *
 *   profiles · workspaces · workspace_members · projects · runs ·
 *   run_stages · agents · run_agent_activity · tasks · proposed_changes ·
 *   changed_files · approvals · activity_events
 *
 * plus the SQL helpers the RLS policies rely on:
 *
 *   current_user_is_workspace_member(uuid)
 *   current_user_is_workspace_owner_or_admin(uuid)
 *   submit_approval(uuid, text, text)
 *
 * HARD RULE: the runner introduces NO new tables, NO new columns and NO
 * migrations. Anything the pipeline needs to remember across retries is stored
 * in existing columns (see `claim.ts`, which keeps the attempt counter in
 * `activity_events`). If a field is not declared below, do not write it.
 */

/* ------------------------------------------------------------------ */
/* Table names                                                         */
/* ------------------------------------------------------------------ */

export const TABLE = {
  profiles: "profiles",
  workspaces: "workspaces",
  workspaceMembers: "workspace_members",
  projects: "projects",
  runs: "runs",
  runStages: "run_stages",
  agents: "agents",
  runAgentActivity: "run_agent_activity",
  tasks: "tasks",
  proposedChanges: "proposed_changes",
  changedFiles: "changed_files",
  /**
   * NOTE: declared for completeness only. The agent runner NEVER writes to
   * `approvals` — human review decisions arrive exclusively through the
   * `submit_approval` RPC from an authenticated user. See GUARD in `repo.ts`.
   */
  approvals: "approvals",
  activityEvents: "activity_events",
} as const;

/* ------------------------------------------------------------------ */
/* CHECK-constraint value sets (must match the frontend unions)        */
/* ------------------------------------------------------------------ */

export type RunStatus =
  | "queued"
  | "running"
  | "ready_for_review"
  | "approved"
  | "rejected"
  | "revision_requested"
  | "merged"
  | "failed"
  | "cancelled";

export type StageStatus = "queued" | "running" | "completed" | "failed" | "skipped";

export type AgentActivityStatus = "queued" | "working" | "completed" | "failed";

export type TaskStatus = "pending" | "in_progress" | "completed" | "failed" | "blocked";

export type ChangeStatus = "pending" | "approved" | "rejected" | "revision_requested" | "merged";

/**
 * The ONLY proposed-change status the agent side is ever allowed to write.
 * Every other value is a human decision produced by `submit_approval`.
 */
export const CHANGE_STATUS_AGENT_WRITES: ChangeStatus = "pending";

/**
 * The ONLY terminal run status the agent pipeline may reach on its own.
 * `approved` / `rejected` / `merged` / `revision_requested` are set by the
 * `submit_approval` RPC; `cancelled` is a human action.
 */
export const RUN_STATUS_AGENT_TERMINAL: RunStatus = "ready_for_review";

/* ------------------------------------------------------------------ */
/* Row shapes                                                          */
/* ------------------------------------------------------------------ */

export interface WorkspaceMemberRow {
  workspace_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  created_at: string;
}

export interface ProjectRow {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  description: string | null;
  repository_url: string | null;
  default_branch: string;
  status: "active" | "archived";
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RunRow {
  id: string;
  project_id: string;
  requested_by: string | null;
  request_text: string;
  status: RunStatus;
  branch_name: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RunStageRow {
  id: string;
  run_id: string;
  stage_key: string;
  stage_number: number;
  status: StageStatus;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentRow {
  id: string;
  agent_key: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at?: string;
}

export interface AgentActivityRow {
  id: string;
  run_id: string;
  stage_id: string | null;
  /** NOT NULL in the schema — every activity row must resolve to an agent. */
  agent_id: string;
  status: AgentActivityStatus;
  task_description: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface TaskRow {
  id: string;
  project_id: string;
  run_id: string | null;
  assigned_agent_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ProposedChangeRow {
  id: string;
  run_id: string;
  title: string;
  summary: string | null;
  source_branch: string | null;
  target_branch: string | null;
  status: ChangeStatus;
  tests_passed: number;
  tests_total: number;
  security_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChangedFileRow {
  id: string;
  proposed_change_id: string;
  file_path: string;
  additions: number;
  deletions: number;
  diff_text: string | null;
  created_at: string;
}

export interface ActivityEventRow {
  id: string;
  workspace_id: string;
  project_id: string | null;
  run_id: string | null;
  user_id: string | null;
  agent_id: string | null;
  event_type: string;
  message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/* Column lists (kept in sync with the dashboard's select strings)     */
/* ------------------------------------------------------------------ */

export const RUN_COLUMNS =
  "id, project_id, requested_by, request_text, status, branch_name, started_at, completed_at, created_at, updated_at";

export const STAGE_COLUMNS =
  "id, run_id, stage_key, stage_number, status, error_message, started_at, completed_at, created_at, updated_at";

export const AGENT_COLUMNS = "id, agent_key, name, description, is_active";

export const ACTIVITY_COLUMNS =
  "id, workspace_id, project_id, run_id, user_id, agent_id, event_type, message, metadata, created_at";

/**
 * `activity_events.event_type` values written by the runner. The dashboard
 * renders these verbatim (`ActivityRail.tsx` humanises the snake_case), so the
 * vocabulary is part of the contract — keep it stable.
 */
export const EVENT = {
  runClaimed: "run_claimed",
  runStarted: "run_started",
  stageStarted: "stage_started",
  stageCompleted: "stage_completed",
  stageFailed: "stage_failed",
  stageRetried: "stage_retried",
  tasksPlanned: "tasks_planned",
  taskUpdated: "task_updated",
  agentWorking: "agent_working",
  agentCompleted: "agent_completed",
  agentFailed: "agent_failed",
  changeProposed: "change_proposed",
  filesChanged: "files_changed",
  testsReported: "tests_reported",
  securityReviewed: "security_reviewed",
  runReadyForReview: "run_ready_for_review",
  runFailed: "run_failed",
  runRecovered: "run_recovered",
  runRequeued: "run_requeued",
  /** Emitted by the stale sweeper when it gives up on a run. */
  runAbandoned: "run_abandoned",
} as const;

export type EventType = (typeof EVENT)[keyof typeof EVENT];
