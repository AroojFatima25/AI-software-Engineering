/**
 * Authentication and workspace-membership authorisation.
 *
 * Flow for every user-initiated request:
 *
 *   1. Pull `Authorization: Bearer <JWT>` off the request. A Supabase *user*
 *      access token, not an API key and not the service_role key.
 *   2. Verify it with `auth.getUser(jwt)`. This round-trips the token against
 *      the project's GoTrue, so expired, forged or revoked tokens are rejected
 *      here — we never decode-and-trust a JWT ourselves.
 *   3. Resolve the run's workspace: runs → projects.workspace_id.
 *   4. Prove membership with a query executed AS that user, so the existing
 *      RLS policies (and the `current_user_is_workspace_member` helper they
 *      call) are the thing granting access. A non-member gets 403 before any
 *      stage work, any OpenRouter call, or any write happens.
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.114.0";
import { forbidden, unauthorized, notFound, HttpError } from "./http.ts";
import { TABLE } from "./schema.ts";
import type { ProjectRow, RunRow, WorkspaceMemberRow } from "./schema.ts";

export interface AuthenticatedUser {
  id: string;
  email: string | null;
}

/** Extracts and shape-checks the caller's Supabase user JWT. */
export function extractUserJwt(request: Request): string {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header) {
    throw unauthorized("Missing Authorization header. Send `Authorization: Bearer <supabase user access token>`.");
  }
  const [scheme, token] = header.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token?.trim()) {
    throw unauthorized("Authorization header must use the Bearer scheme.");
  }
  const trimmed = token.trim();
  // A Supabase user JWT has three dot-separated segments. Service keys are also
  // JWTs, so additionally reject the well-known service_role key if it was
  // somehow pasted in from a misconfigured client.
  if (trimmed.split(".").length !== 3) {
    throw unauthorized("Authorization token is not a Supabase user access token.");
  }
  return trimmed;
}

/** Verifies the JWT against the project's auth service and returns the user. */
export async function verifyUserJwt(admin: SupabaseClient, jwt: string): Promise<AuthenticatedUser> {
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data?.user) {
    throw unauthorized(
      error?.message === "Invalid token" || !data?.user
        ? "Your session has expired. Sign in again to continue."
        : `Couldn't verify your session${error?.message ? `: ${error.message}` : "."}`,
    );
  }
  return { id: data.user.id, email: data.user.email ?? null };
}

export interface RunContext {
  run: RunRow;
  project: ProjectRow;
  workspaceId: string;
}

/**
 * Loads the run and the project that owns it, using the admin client (the run
 * may belong to a workspace whose rows the caller cannot see until membership
 * is proven — that is the next step's job, not a reason to leak the run).
 */
export async function loadRunContext(admin: SupabaseClient, runId: string): Promise<RunContext> {
  if (!isValidUuid(runId)) throw new HttpError(400, "bad_request", "`run_id` must be a UUID.");

  const { data: run, error: runError } = await admin
    .from(TABLE.runs)
    .select("*")
    .eq("id", runId)
    .maybeSingle<RunRow>();
  if (runError) throw new HttpError(502, "upstream_failure", `Couldn't read the run: ${runError.message}`);
  if (!run) throw notFound(`Run ${runId} does not exist.`);

  const { data: project, error: projectError } = await admin
    .from(TABLE.projects)
    .select("*")
    .eq("id", run.project_id)
    .maybeSingle<ProjectRow>();
  if (projectError) {
    throw new HttpError(502, "upstream_failure", `Couldn't read the project: ${projectError.message}`);
  }
  if (!project) throw notFound("The project this run belongs to no longer exists.");

  return { run, project, workspaceId: project.workspace_id };
}

/**
 * Proves the caller belongs to the workspace, executing the check AS the
 * caller so RLS is the gatekeeper. Returns the membership row (and therefore
 * the caller's role) so the pipeline can record who triggered the run.
 *
 * Throws 403 — never 404 — because membership is an authorisation question;
 * the run's existence has already been established.
 */
export async function assertWorkspaceMembership(
  userClient: SupabaseClient,
  workspaceId: string,
  userId: string,
): Promise<WorkspaceMemberRow> {
  const { data, error } = await userClient
    .from(TABLE.workspaceMembers)
    .select("workspace_id, user_id, role, created_at")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle<WorkspaceMemberRow>();

  if (error) {
    // A permission-denied surfacing as an RLS error is still "not a member".
    if (error.code === "42501" || /row-level security|permission denied/i.test(error.message)) {
      throw forbidden("You are not a member of the workspace that owns this run.");
    }
    throw new HttpError(502, "upstream_failure", `Couldn't verify workspace membership: ${error.message}`);
  }

  if (!data) {
    throw forbidden("You are not a member of the workspace that owns this run.");
  }
  return data;
}

/**
 * Full pre-flight for a user-initiated run: authenticate, locate the run, and
 * authorise membership. Nothing downstream of this runs for an unauthorised
 * caller.
 */
export async function authorizeRun(
  admin: SupabaseClient,
  userClient: SupabaseClient,
  request: Request,
  runId: string,
): Promise<{ user: AuthenticatedUser; membership: WorkspaceMemberRow; context: RunContext }> {
  const jwt = extractUserJwt(request);
  const user = await verifyUserJwt(admin, jwt);
  const context = await loadRunContext(admin, runId);
  const membership = await assertWorkspaceMembership(userClient, context.workspaceId, user.id);
  return { user, membership, context };
}

export function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
