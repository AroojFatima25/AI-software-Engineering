import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { NewProjectDialog } from "@/components/workspace/NewProjectDialog";
import { NewRequestDialog } from "@/components/workspace/NewRequestDialog";
import { WorkspaceContext, type ReviewInput, type WorkspaceNotice } from "@/hooks/useWorkspace";
import { getSupabase } from "@/lib/supabase";
import {
  createProject as apiCreateProject,
  createRun as apiCreateRun,
  fetchWorkspaceSnapshot,
  listWorkspaceMemberships,
  submitApproval as apiSubmitApproval,
  type MutationResult,
} from "@/lib/workspace";
import { isActiveRun, type MembershipView, type WorkspaceSnapshot } from "@/types/workspace";

const WORKSPACE_STORAGE_KEY = "ai-os:workspace";

function readStoredWorkspace(): string | null {
  try {
    return window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeWorkspace(id: string): void {
  try {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, id);
  } catch {
    /* private mode etc. — ignoring is fine */
  }
}

function defaultWorkspaceId(memberships: MembershipView[]): string | null {
  if (!memberships.length) return null;
  const owned = memberships.find((m) => m.role === "owner");
  return (owned ?? memberships[0]).workspace_id;
}

function describeError(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong while loading the workspace.";
}

let noticeSeq = 1;

/**
 * Owns all workspace state for the signed-in user: their memberships, the
 * selected workspace, the assembled snapshot, polling while agents are
 * active, and every mutation (project, run/request, review).
 *
 * Polling is deliberately used instead of Supabase Realtime subscriptions:
 * the agent tables are not guaranteed to be added to the `supabase_realtime`
 * publication (that is a production toggle, not something the client can
 * force), so a quiet RLS-safe poll while a run is in flight keeps the
 * dashboard live without any server-side configuration. Polling stops the
 * moment every run reaches a terminal state.
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [memberships, setMemberships] = useState<MembershipView[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notices, setNotices] = useState<WorkspaceNotice[]>([]);

  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestProjectId, setRequestProjectId] = useState<string | null>(null);

  const workspaceIdRef = useRef<string | null>(null);

  const pushNotice = useCallback((tone: WorkspaceNotice["tone"], text: string) => {
    const id = noticeSeq++;
    setNotices((prev) => [...prev.slice(-3), { id, tone, text }]);
    window.setTimeout(() => setNotices((prev) => prev.filter((n) => n.id !== id)), 6000);
  }, []);

  const dismissNotice = useCallback((id: number) => {
    setNotices((prev) => prev.filter((n) => n.id !== id));
  }, []);

  /* ---------------- loading ------------------------------------------------- */

  /**
   * Serialized loader: an explicit (non-silent) action always runs after any
   * in-flight poll finishes instead of being silently swallowed, while poll
   * ticks simply skip when a fetch is already in flight.
   */
  const inflightRef = useRef<Promise<void> | null>(null);

  const perform = useCallback(
    async (wsId: string, opts: { silent: boolean }, knownMemberships?: MembershipView[]) => {
      const supabase = getSupabase();
      if (!supabase || !userId) return;
      if (opts.silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const snap = await fetchWorkspaceSnapshot(supabase, userId, wsId, knownMemberships);
        if (workspaceIdRef.current === wsId) setSnapshot(snap);
      } catch (e) {
        if (workspaceIdRef.current === wsId) {
          setError(describeError(e));
          // Keep showing the previous snapshot if we have one (stale-while-refresh).
          if (opts.silent) setRefreshing(false);
        }
      } finally {
        if (opts.silent) setRefreshing(false);
        else setLoading(false);
      }
    },
    [userId],
  );

  const load = useCallback(
    async (wsId: string, opts: { silent: boolean }, knownMemberships?: MembershipView[]) => {
      if (inflightRef.current) {
        if (opts.silent) return; // poll tick during a fetch → skip
        try {
          await inflightRef.current; // explicit action → wait, then run
        } catch {
          /* previous fetch already surfaced its error */
        }
      }
      const promise = perform(wsId, opts, knownMemberships);
      inflightRef.current = promise;
      try {
        await promise;
      } finally {
        if (inflightRef.current === promise) inflightRef.current = null;
      }
    },
    [perform],
  );

  /* Bootstrap for the signed-in user (idempotent under StrictMode: the
     cleanup flag makes the first dev-run's results inert, not the second). */
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      const supabase = getSupabase();
      if (!supabase) return;
      setLoading(true);
      try {
        const ms = await listWorkspaceMemberships(supabase, userId);
        if (cancelled) return;
        setMemberships(ms);

        const stored = readStoredWorkspace();
        const initialId = stored && ms.some((m) => m.workspace_id === stored) ? stored : defaultWorkspaceId(ms);
        if (!initialId) {
          if (!cancelled) {
            setLoading(false);
            setReady(true);
          }
          return;
        }
        workspaceIdRef.current = initialId;
        setWorkspaceId(initialId);

        const snap = await fetchWorkspaceSnapshot(supabase, userId, initialId, ms);
        if (cancelled) return;
        if (workspaceIdRef.current === initialId) setSnapshot(snap);
      } catch (e) {
        if (!cancelled) setError(describeError(e));
      } finally {
        if (!cancelled) {
          setLoading(false);
          setReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const selectWorkspace = useCallback(
    (id: string) => {
      if (!memberships.some((m) => m.workspace_id === id) || id === workspaceIdRef.current) return;
      workspaceIdRef.current = id;
      setWorkspaceId(id);
      setSnapshot(null);
      storeWorkspace(id);
      void load(id, { silent: false });
    },
    [memberships, load],
  );

  const hasSnapshotRef = useRef(false);
  hasSnapshotRef.current = snapshot !== null;

  const refresh = useCallback(() => {
    const id = workspaceIdRef.current;
    if (!id) return Promise.resolve();
    void load(id, { silent: hasSnapshotRef.current });
    return Promise.resolve();
  }, [load]);

  /* Poll quietly while any run is still queued or running. */
  const loadRef = useRef(load);
  loadRef.current = load;
  const membershipsRef = useRef(memberships);
  membershipsRef.current = memberships;
  const hasActive = useMemo(() => Boolean(snapshot?.runs.some((r) => isActiveRun(r.run.status))), [snapshot]);

  useEffect(() => {
    if (!workspaceId || !hasActive) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void loadRef.current(workspaceId, { silent: true }, membershipsRef.current);
    }, 10_000);
    return () => window.clearInterval(id);
  }, [workspaceId, hasActive]);

  /* ---------------- actions ------------------------------------------------- */

  const actions = useMemo(() => {
    const createProject = async (input: { name: string; description?: string; repositoryUrl?: string }): Promise<MutationResult> => {
      const supabase = getSupabase();
      const wsId = workspaceIdRef.current;
      if (!supabase || !userId) return { ok: false, message: "You need to be signed in." };
      if (!wsId) return { ok: false, message: "No workspace selected yet — refresh and try again." };
      const result = await apiCreateProject(supabase, userId, { workspaceId: wsId, ...input });
      if (result.ok) {
        pushNotice("success", result.message);
        void loadRef.current(wsId, { silent: hasSnapshotRef.current }, membershipsRef.current);
      }
      return result;
    };

    const createRun = async (input: { projectId: string; requestText: string }): Promise<MutationResult> => {
      const supabase = getSupabase();
      if (!supabase || !userId) return { ok: false, message: "You need to be signed in." };
      const result = await apiCreateRun(supabase, userId, input);
      if (result.ok) {
        pushNotice("success", result.message);
        if (workspaceIdRef.current) {
          void loadRef.current(workspaceIdRef.current, { silent: hasSnapshotRef.current }, membershipsRef.current);
        }
      }
      return result;
    };

    const review = async (input: ReviewInput): Promise<MutationResult> => {
      const supabase = getSupabase();
      if (!supabase) return { ok: false, message: "You need to be signed in." };
      const result = await apiSubmitApproval(supabase, input.proposedChangeId, input.decision, input.comment);
      if (result.ok) {
        pushNotice("success", result.message);
        if (workspaceIdRef.current) {
          void loadRef.current(workspaceIdRef.current, { silent: hasSnapshotRef.current }, membershipsRef.current);
        }
      }
      return result;
    };

    return { createProject, createRun, review };
  }, [userId, pushNotice]);

  const ui = useMemo(
    () => ({
      newProjectOpen,
      openNewProject: () => {
        setError(null);
        setNewProjectOpen(true);
      },
      closeNewProject: () => setNewProjectOpen(false),
      requestOpen,
      requestProjectId,
      openNewRequest: (projectId: string | null = null) => {
        setError(null);
        setRequestProjectId(projectId);
        setRequestOpen(true);
      },
      closeNewRequest: () => setRequestOpen(false),
    }),
    [newProjectOpen, requestOpen, requestProjectId],
  );

  const workspace = useMemo(() => memberships.find((m) => m.workspace_id === workspaceId)?.workspace ?? null, [memberships, workspaceId]);
  const role = snapshot?.role ?? memberships.find((m) => m.workspace_id === workspaceId)?.role ?? null;

  const value = useMemo(
    () => ({
      ready,
      loading,
      refreshing,
      memberships,
      workspaceId,
      workspace,
      role,
      profile: snapshot?.profile ?? null,
      snapshot,
      error,
      notices,
      pushNotice,
      dismissNotice,
      selectWorkspace,
      refresh,
      actions,
      ui,
    }),
    [ready, loading, refreshing, memberships, workspaceId, workspace, role, snapshot, error, notices, pushNotice, dismissNotice, selectWorkspace, refresh, actions, ui],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
      <NewProjectDialog />
      <NewRequestDialog />
    </WorkspaceContext.Provider>
  );
}
