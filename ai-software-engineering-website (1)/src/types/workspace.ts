/**
 * Workspace domain types.
 *
 * These mirror — 1:1, snake_case included — the production Supabase schema
 * that was applied for the personal-workspace milestone:
 *
 *   profiles · workspaces · workspace_members · projects · runs ·
 *   run_stages · agents · run_agent_activity · tasks · proposed_changes ·
 *   changed_files · approvals · activity_events
 *
 * Plus the `submit_approval(uuid, text, text)` RPC and the
 * `current_user_is_workspace_member(uuid)` /
 * `current_user_is_workspace_owner_or_admin(uuid)` helper functions used by
 * the RLS policies. Field names intentionally keep the database snake_case
 * so `.select("*")` rows can be assigned straight onto these shapes.
 *
 * Row Level Security is the only permission boundary the dashboard relies on:
 * the anon/publishable key is used end-to-end and the service_role key is
 * never referenced in frontend code.
 */

/* ------------------------------------------------------------------ */
/* Enum-ish string unions (must match the SQL CHECK constraints)       */
/* ------------------------------------------------------------------ */

export type WorkspaceRole = "owner" | "admin" | "member";

export type ProjectStatus = "active" | "archived";

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

export type ChangeStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "revision_requested"
  | "merged";

export type ApprovalDecision = "approved" | "rejected" | "revision_requested";

/* ------------------------------------------------------------------ */
/* Table rows                                                          */
/* ------------------------------------------------------------------ */

export interface ProfileRow {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMemberRow {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
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
  status: ProjectStatus;
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
  agent_id: string;
  status: AgentActivityStatus;
  task_description: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  /** Embedded relation (agents). Null when the agent was purged. */
  agent: { id: string; agent_key: string; name: string } | null;
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
  /** Embedded relation (agents). */
  agent: { id: string; agent_key: string; name: string } | null;
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

export interface ApprovalRow {
  id: string;
  proposed_change_id: string;
  user_id: string | null;
  decision: ApprovalDecision;
  comment: string | null;
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
  /** Embedded relations. */
  agent: { id: string; agent_key: string; name: string } | null;
  project: { id: string; name: string } | null;
}

/* ------------------------------------------------------------------ */
/* Assembled workspace model (what the dashboard renders)              */
/* ------------------------------------------------------------------ */

export interface MembershipView extends WorkspaceMemberRow {
  workspace: WorkspaceRow | null;
}

/** Proposed change with its children, plus the run/project it hangs off. */
export interface ChangeDetail {
  change: ProposedChangeRow;
  files: ChangedFileRow[];
  approvals: ApprovalRow[];
  runId: string;
  runStatus: RunStatus | null;
  requestedBy: string | null;
  projectId: string | null;
  projectName: string | null;
  projectSlug: string | null;
}

/** Run with everything the UI can show about it. */
export interface RunDetail {
  run: RunRow;
  project: ProjectRow | null;
  stages: RunStageRow[];
  agentActivity: AgentActivityRow[];
  tasks: TaskRow[];
  changes: ChangeDetail[];
}

/** Project plus the aggregate counters derived from its children. */
export interface ProjectSummary extends ProjectRow {
  tasksByStatus: Partial<Record<TaskStatus, number>>;
  runCount: number;
  activeRunCount: number;
  reviewCount: number;
  latestRun: RunRow | null;
}

/** Everything the workspace page shows at a given moment. */
export interface WorkspaceSnapshot {
  profile: ProfileRow | null;
  /** The signed-in user's role in the currently selected workspace. */
  role: WorkspaceRole | null;
  /** Everyone in the selected workspace (user_id + role only; other users'
   *  profiles are protected by RLS, so they are labelled generically). */
  members: WorkspaceMemberRow[];
  projects: ProjectSummary[];
  runs: RunDetail[];
  /** Flat list of every proposed change visible in the workspace. */
  changes: ChangeDetail[];
  agents: AgentRow[];
  activity: ActivityEventRow[];
  fetchedAt: number;
}

/** Terminal states the agent side reaches on its own; nothing to poll for. */
export const TERMINAL_RUN_STATUSES: ReadonlySet<RunStatus> = new Set<RunStatus>([
  "ready_for_review",
  "approved",
  "rejected",
  "merged",
  "failed",
  "cancelled",
]);

/** States in which agents are still (or about to be) working. */
export const ACTIVE_RUN_STATUSES: ReadonlySet<RunStatus> = new Set<RunStatus>([
  "queued",
  "running",
]);

export function isActiveRun(status: RunStatus | undefined | null): boolean {
  return status !== undefined && status !== null && ACTIVE_RUN_STATUSES.has(status);
}

/** A run is only reviewable once the agent side has finished it. */
export function isRunReviewable(status: RunStatus | undefined | null): boolean {
  return status === "ready_for_review";
}
