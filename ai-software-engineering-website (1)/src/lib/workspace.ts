/**
 * Data access for the authenticated workspace dashboard.
 *
 * Every query here runs as the signed-in user with the Supabase **anon**
 * (publishable) key, so Row Level Security is the permission boundary: the
 * client can only ever see rows the workspace-membership policies allow and
 * can only write rows the insert/update policies allow. No service_role key
 * is used anywhere in the frontend.
 *
 * Writes are intentionally narrow — the schema grants the client only:
 *   - INSERT on projects and runs (a run = "software engineering request",
 *     which the autonomous agent pipeline then picks up)
 *   - UPDATE on profiles / workspaces / projects
 * Everything downstream of a run (stages, tasks, agent activity, proposed
 * changes, changed files, activity events) is written by the agent backend,
 * never by this client. Human review decisions go through the
 * `submit_approval` RPC so the run + proposed change statuses stay in sync.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ActivityEventRow,
  AgentActivityRow,
  AgentRow,
  ApprovalDecision,
  ApprovalRow,
  ChangeDetail,
  ChangedFileRow,
  MembershipView,
  ProfileRow,
  ProjectRow,
  ProjectSummary,
  ProposedChangeRow,
  RunDetail,
  RunRow,
  RunStageRow,
  TaskRow,
  TaskStatus,
  WorkspaceMemberRow,
  WorkspaceRow,
  WorkspaceSnapshot,
} from "@/types/workspace";
import { slugify } from "@/lib/format";

export interface MutationResult {
  ok: boolean;
  message: string;
  /** Set by `createRun` so the caller can hand the new run to the agent runner. */
  runId?: string;
}

type AnyClient = SupabaseClient;

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

const RUN_COLUMNS =
  "id, project_id, requested_by, request_text, status, branch_name, started_at, completed_at, created_at, updated_at";

const STAGE_COLUMNS =
  "id, run_id, stage_key, stage_number, status, error_message, started_at, completed_at, created_at, updated_at";

const AGENT_EMBED = "agents(id, agent_key, name)";

const TASK_COLUMNS =
  "id, project_id, run_id, assigned_agent_id, title, description, status, position, created_at, updated_at";

const CHANGE_COLUMNS =
  "id, run_id, title, summary, source_branch, target_branch, status, tests_passed, tests_total, security_summary, created_at, updated_at";

/** Lists every workspace membership for the signed-in user. */
export async function listWorkspaceMemberships(supabase: AnyClient, userId: string): Promise<MembershipView[]> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, user_id, role, created_at, workspaces(id, name, slug, created_by, created_at, updated_at)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message || "Couldn't load your workspace memberships.");
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    workspace_id: row.workspace_id as string,
    user_id: row.user_id as string,
    role: row.role as MembershipView["role"],
    created_at: row.created_at as string,
    workspace: (row.workspaces as WorkspaceRow | null) ?? null,
  }));
}

/**
 * Fetches one full, assembled snapshot of a workspace the user belongs to.
 * All queries run in parallel and are assembled client-side. Throws on a
 * hard failure so callers can surface "refresh failed" state.
 *
 * `knownMemberships` lets the poll path skip re-listing memberships on every
 * tick; when omitted the snapshot derives them itself.
 */
export async function fetchWorkspaceSnapshot(
  supabase: AnyClient,
  userId: string,
  workspaceId: string,
  knownMemberships?: MembershipView[],
): Promise<WorkspaceSnapshot> {
  /* ---- 1. Identity: profile + the workspaces the user belongs to ------ */
  const [profileRes, membershipRes] = knownMemberships
    ? await Promise.all([
        supabase.from("profiles").select("id, display_name, avatar_url, created_at, updated_at").eq("id", userId).maybeSingle(),
      ]).then(([p]) => [p, { data: knownMemberships, error: null }] as const)
    : await Promise.all([
        supabase.from("profiles").select("id, display_name, avatar_url, created_at, updated_at").eq("id", userId).maybeSingle(),
        supabase
          .from("workspace_members")
          .select("workspace_id, user_id, role, created_at, workspaces(id, name, slug, created_by, created_at, updated_at)")
          .eq("user_id", userId)
          .order("created_at", { ascending: true }),
      ]);

  assertOk(profileRes, "Couldn't load your profile.");
  assertOk(membershipRes, "Couldn't load your workspace memberships.");

  const memberships: MembershipView[] =
    knownMemberships ??
    ((membershipRes.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      workspace_id: row.workspace_id as string,
      user_id: row.user_id as string,
      role: row.role as MembershipView["role"],
      created_at: row.created_at as string,
      workspace: (row.workspaces as WorkspaceRow | null) ?? null,
    }));

  const membership = memberships.find((m) => m.workspace_id === workspaceId) ?? null;
  if (!membership) {
    throw new Error("You don't have access to this workspace.");
  }

  /* ---- 2. Static workspace data -------------------------------------- */
  const [workspaceRes, membersRes, projectsRes, agentsRes] = await Promise.all([
    supabase.from("workspaces").select("id, name, slug, created_by, created_at, updated_at").eq("id", workspaceId).maybeSingle(),
    supabase.from("workspace_members").select("workspace_id, user_id, role, created_at").eq("workspace_id", workspaceId).order("created_at", { ascending: true }),
    supabase
      .from("projects")
      .select("id, workspace_id, name, slug, description, repository_url, default_branch, status, created_by, created_at, updated_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("agents").select("id, agent_key, name, description").eq("is_active", true).order("agent_key", { ascending: true }),
  ]);

  assertOk(workspaceRes, "Couldn't load the workspace.");
  assertOk(membersRes, "Couldn't load workspace members.");
  assertOk(projectsRes, "Couldn't load projects.");
  assertOk(agentsRes, "Couldn't load agents.");

  const workspace = (workspaceRes.data ?? null) as WorkspaceRow | null;
  if (!workspace) throw new Error("Workspace not found.");
  const members = (membersRes.data ?? []) as WorkspaceMemberRow[];
  const projects = (projectsRes.data ?? []) as ProjectRow[];
  const agents = (agentsRes.data ?? []) as AgentRow[];
  const role = membership.role;
  const profile = (profileRes.data ?? null) as ProfileRow | null;

  const projectIds = projects.map((p) => p.id);
  const projectsById = new Map(projects.map((p) => [p.id, p]));

  /* ---- 3. Runs for the workspace's projects --------------------------- */
  const runs: RunRow[] = [];
  if (projectIds.length) {
    const { data, error } = await supabase
      .from("runs")
      .select(RUN_COLUMNS)
      .in("project_id", projectIds)
      .order("created_at", { ascending: false })
      .limit(60);
    assertOk({ data, error }, "Couldn't load runs.");
    runs.push(...((data ?? []) as RunRow[]));
  }
  const runIds = runs.map((r) => r.id);
  const runsById = new Map(runs.map((r) => [r.id, r]));

  /* ---- 4. Everything hanging off those runs --------------------------- */
  const stages: RunStageRow[] = [];
  const agentActivity: AgentActivityRow[] = [];
  const taskRows: TaskRow[] = [];
  const changeRows: ProposedChangeRow[] = [];
  const filesByChange = new Map<string, ChangedFileRow[]>();
  const approvalsByChange = new Map<string, ApprovalRow[]>();

  if (runIds.length) {
    const [stagesRes, activityRes, tasksRes, changesRes] = await Promise.all([
      supabase.from("run_stages").select(STAGE_COLUMNS).in("run_id", runIds).order("stage_number", { ascending: true }),
      supabase
        .from("run_agent_activity")
        .select(`id, run_id, stage_id, agent_id, status, task_description, started_at, completed_at, created_at, ${AGENT_EMBED}`)
        .in("run_id", runIds)
        .order("created_at", { ascending: true }),
      supabase
        .from("tasks")
        .select(`${TASK_COLUMNS}, ${AGENT_EMBED}`)
        .in("project_id", projectIds)
        .order("position", { ascending: true })
        .limit(400),
      supabase
        .from("proposed_changes")
        .select(
          `${CHANGE_COLUMNS}, changed_files(id, proposed_change_id, file_path, additions, deletions, diff_text, created_at), approvals(id, proposed_change_id, user_id, decision, comment, created_at)`,
        )
        .in("run_id", runIds)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    assertOk(stagesRes, "Couldn't load run stages.");
    assertOk(activityRes, "Couldn't load agent activity.");
    assertOk(tasksRes, "Couldn't load tasks.");
    assertOk(changesRes, "Couldn't load proposed changes.");

    stages.push(...asRows<RunStageRow>(stagesRes.data));
    for (const row of asRows<Record<string, unknown>>(activityRes.data)) {
      const { agents, ...rest } = row;
      agentActivity.push({ ...(rest as unknown as AgentActivityRow), agent: firstOrNull<AgentActivityRow["agent"]>(agents) });
    }
    for (const row of asRows<Record<string, unknown>>(tasksRes.data)) {
      const { agents, ...rest } = row;
      taskRows.push({ ...(rest as unknown as TaskRow), agent: firstOrNull<TaskRow["agent"]>(agents) });
    }
    for (const row of asRows<Record<string, unknown>>(changesRes.data)) {
      const { changed_files, approvals, ...rest } = row;
      const change = rest as unknown as ProposedChangeRow;
      changeRows.push(change);
      filesByChange.set(change.id, (changed_files as ChangedFileRow[] | null | undefined) ?? []);
      approvalsByChange.set(change.id, (approvals as ApprovalRow[] | null | undefined) ?? []);
    }
  }

  /* ---- 5. Workspace activity feed ------------------------------------- */
  const activity: ActivityEventRow[] = [];
  if (projectIds.length) {
    const { data, error } = await supabase
      .from("activity_events")
      .select(`id, workspace_id, project_id, run_id, user_id, agent_id, event_type, message, metadata, created_at, ${AGENT_EMBED}, projects(id, name)`)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(150);
    assertOk({ data, error }, "Couldn't load the activity feed.");
    for (const row of asRows<Record<string, unknown>>(data)) {
      const { agents, projects, ...rest } = row;
      activity.push({
        ...(rest as unknown as ActivityEventRow),
        agent: firstOrNull<ActivityEventRow["agent"]>(agents),
        project: firstOrNull<ActivityEventRow["project"]>(projects),
      });
    }
  }

  /* ---- 6. Assemble ---------------------------------------------------- */
  const allChanges: ChangeDetail[] = changeRows.map((change) => {
    const run = runsById.get(change.run_id);
    const project = run ? (projectsById.get(run.project_id) ?? null) : null;
    return {
      change,
      files: filesByChange.get(change.id) ?? [],
      approvals: approvalsByChange.get(change.id) ?? [],
      runId: change.run_id,
      runStatus: run?.status ?? null,
      requestedBy: run?.requested_by ?? null,
      projectId: project?.id ?? null,
      projectName: project?.name ?? null,
      projectSlug: project?.slug ?? null,
    };
  });

  const taskStatusesByProject = new Map<string, Partial<Record<TaskStatus, number>>>();
  for (const task of taskRows) {
    const bucket = taskStatusesByProject.get(task.project_id) ?? {};
    bucket[task.status] = (bucket[task.status] ?? 0) + 1;
    taskStatusesByProject.set(task.project_id, bucket);
  }

  const runCountByProject = new Map<string, number>();
  const activeRunCountByProject = new Map<string, number>();
  const reviewCountByProject = new Map<string, number>();
  const latestRunByProject = new Map<string, RunRow>();
  for (const run of runs) {
    runCountByProject.set(run.project_id, (runCountByProject.get(run.project_id) ?? 0) + 1);
    if (run.status === "queued" || run.status === "running") {
      activeRunCountByProject.set(run.project_id, (activeRunCountByProject.get(run.project_id) ?? 0) + 1);
    }
    if (run.status === "ready_for_review") {
      reviewCountByProject.set(run.project_id, (reviewCountByProject.get(run.project_id) ?? 0) + 1);
    }
    if (!latestRunByProject.has(run.project_id)) latestRunByProject.set(run.project_id, run);
  }

  const projectSummaries: ProjectSummary[] = projects.map((project) => ({
    ...project,
    tasksByStatus: taskStatusesByProject.get(project.id) ?? {},
    runCount: runCountByProject.get(project.id) ?? 0,
    activeRunCount: activeRunCountByProject.get(project.id) ?? 0,
    reviewCount: reviewCountByProject.get(project.id) ?? 0,
    latestRun: latestRunByProject.get(project.id) ?? null,
  }));

  const runDetails: RunDetail[] = runs.map((run) => ({
    run,
    project: projectsById.get(run.project_id) ?? null,
    stages: stages.filter((s) => s.run_id === run.id),
    agentActivity: agentActivity.filter((a) => a.run_id === run.id),
    tasks: taskRows.filter((t) => t.run_id === run.id),
    changes: allChanges.filter((c) => c.runId === run.id),
  }));

  return {
    profile,
    role,
    members,
    projects: projectSummaries,
    runs: runDetails,
    changes: allChanges,
    agents,
    activity,
    fetchedAt: Date.now(),
  };
}

function assertOk(result: { data: unknown; error: { message: string } | null }, fallback: string): void {
  if (result.error) {
    const err = new Error(result.error.message || fallback);
    err.name = "WorkspaceQueryError";
    throw err;
  }
}

/**
 * PostgREST embedded relations come back under the relation's own name
 * (`agents`, `projects`, …). Supabase's untyped client types those rows
 * loosely, so normalize them into the view shapes used by the UI.
 */
function asRows<T>(data: unknown): T[] {
  return (Array.isArray(data) ? data : []) as unknown as T[];
}

/** Supabase returns to-one embeds as an object; be tolerant of both shapes. */
function firstOrNull<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T | null) ?? null;
  return (value as T | null) ?? null;
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

export interface CreateProjectInput {
  workspaceId: string;
  name: string;
  description?: string;
  repositoryUrl?: string;
  defaultBranch?: string;
}

/**
 * Creates a project. The schema keeps a unique (workspace_id, slug)
 * constraint, so if the human-readable slug is taken we retry with a short
 * suffix before surfacing the error.
 */
export async function createProject(
  supabase: AnyClient,
  userId: string,
  input: CreateProjectInput,
): Promise<MutationResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, message: "Give the project a name." };

  const description = input.description?.trim() || null;
  const repositoryUrl = input.repositoryUrl?.trim() || null;
  const defaultBranch = input.defaultBranch?.trim() || "main";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const base = slugify(name);
    const suffix = attempt === 0 ? "" : `-${Math.random().toString(36).slice(2, 6)}`;
    const slug = `${base}${suffix}`;
    const { error } = await supabase.from("projects").insert({
      workspace_id: input.workspaceId,
      name,
      slug,
      description,
      repository_url: repositoryUrl,
      default_branch: defaultBranch,
      status: "active",
      created_by: userId,
    });
    if (!error) return { ok: true, message: `Project “${name}” created.` };
    if (error.code === "23505" && attempt < 2) continue; // slug collision → retry
    return { ok: false, message: friendly(error, `Couldn't create “${name}”.`) };
  }
  return { ok: false, message: `Couldn't create “${name}”.` };
}

export interface CreateRunInput {
  projectId: string;
  requestText: string;
}

/**
 * Submits a software-engineering request by inserting a run in `queued`
 * state. From there the agent pipeline owns the run: stages, tasks, agent
 * activity, proposed changes and the workspace activity feed are produced by
 * the backend agents — this client never writes them. Mirrors the
 * `runs_insert_member` RLS policy (workspace member + requested_by = uid).
 */
export async function createRun(
  supabase: AnyClient,
  userId: string,
  input: CreateRunInput,
): Promise<MutationResult> {
  const requestText = input.requestText.trim();
  if (!requestText) return { ok: false, message: "Describe the software-engineering request first." };
  if (!input.projectId) return { ok: false, message: "Pick a project to run this request against." };

  const { data, error } = await supabase
    .from("runs")
    .insert({
      project_id: input.projectId,
      requested_by: userId,
      request_text: requestText,
      status: "queued",
    })
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, message: friendly(error, "Couldn't submit the request.") };
  if (!data?.id) return { ok: true, message: "Request submitted." };
  return { ok: true, runId: data.id, message: "Request submitted — your agents are on it." };
}

/** Human review decision; goes through the `submit_approval` RPC. */
export async function submitApproval(
  supabase: AnyClient,
  proposedChangeId: string,
  decision: ApprovalDecision,
  comment: string | null,
): Promise<MutationResult> {
  const { data, error } = await supabase.rpc("submit_approval", {
    _proposed_change_id: proposedChangeId,
    _decision: decision,
    _comment: comment?.trim() || null,
  });

  if (error) return { ok: false, message: friendly(error, "Couldn't submit your review.") };

  const result = Array.isArray(data) ? (data[0] as { success?: boolean; error?: string | null } | undefined) : undefined;
  if (result && result.success === false) {
    return { ok: false, message: result.error || "Couldn't submit your review." };
  }
  const verb = decision === "approved" ? "approved" : decision === "rejected" ? "rejected" : "sent back for revision";
  return { ok: true, message: `Change ${verb}.` };
}

function friendly(error: { message?: string; code?: string }, fallback: string): string {
  if (error?.code === "23505") return "That name is already taken in this workspace — try another one.";
  return error?.message || fallback;
}
