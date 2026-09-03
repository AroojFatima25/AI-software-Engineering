import { createContext, useContext } from "react";
import type {
  ApprovalDecision,
  MembershipView,
  ProfileRow,
  WorkspaceRole,
  WorkspaceRow,
  WorkspaceSnapshot,
} from "@/types/workspace";
import type { MutationResult } from "@/lib/workspace";

export interface WorkspaceNotice {
  id: number;
  tone: "success" | "error" | "info";
  text: string;
}

export interface ReviewInput {
  proposedChangeId: string;
  decision: ApprovalDecision;
  comment: string;
}

export interface WorkspaceContextValue {
  /** First load attempt finished (success or not). */
  ready: boolean;
  /** The first snapshot is still loading. */
  loading: boolean;
  /** A background refresh is in flight (shows the tiny spinner). */
  refreshing: boolean;
  /** Every workspace the signed-in user belongs to. */
  memberships: MembershipView[];
  /** Currently selected workspace. */
  workspaceId: string | null;
  workspace: WorkspaceRow | null;
  role: WorkspaceRole | null;
  profile: ProfileRow | null;
  snapshot: WorkspaceSnapshot | null;
  /** Last hard error (load/refresh/mutation that failed outside the dialogs). */
  error: string | null;
  notices: WorkspaceNotice[];
  pushNotice: (tone: WorkspaceNotice["tone"], text: string) => void;
  dismissNotice: (id: number) => void;
  selectWorkspace: (workspaceId: string) => void;
  /** Re-fetch the current workspace. Returns a promise for the action layer. */
  refresh: () => Promise<void>;
  actions: {
    createProject: (input: { name: string; description?: string; repositoryUrl?: string }) => Promise<MutationResult>;
    createRun: (input: { projectId: string; requestText: string }) => Promise<MutationResult>;
    review: (input: ReviewInput) => Promise<MutationResult>;
  };
  ui: {
    newProjectOpen: boolean;
    openNewProject: () => void;
    closeNewProject: () => void;
    requestOpen: boolean;
    /** Project preselected when the request dialog was opened. */
    requestProjectId: string | null;
    openNewRequest: (projectId?: string | null) => void;
    closeNewRequest: () => void;
  };
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within <WorkspaceProvider>");
  return ctx;
}
