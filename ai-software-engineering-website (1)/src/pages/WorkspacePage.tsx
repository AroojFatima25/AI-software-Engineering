import { AlertTriangle, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthProvider";
import { LogoMark } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { ActivityRail } from "@/components/workspace/ActivityRail";
import { ErrorState, NoticeList, SkeletonRows } from "@/components/workspace/bits";
import { ProjectsSection } from "@/components/workspace/ProjectsSection";
import { ReviewsSection } from "@/components/workspace/ReviewsSection";
import { RunsSection } from "@/components/workspace/RunsSection";
import { WorkspaceHeader } from "@/components/workspace/WorkspaceHeader";
import { WorkspaceOverview } from "@/components/workspace/WorkspaceOverview";
import { WorkspaceProvider } from "@/components/workspace/WorkspaceProvider";
import { useWorkspace } from "@/hooks/useWorkspace";

/**
 * Protected dashboard route (`/workspace`).
 *
 * Signed-out visitors are sent straight back to the public landing page —
 * everything here (header, data, actions) only mounts for users with an
 * active Supabase session. Access to rows is enforced server-side by the
 * schema's RLS policies through the anon key; this page only chooses which
 * workspace of the user's to render.
 */
export function WorkspacePage() {
  const { ready, isSignedIn } = useAuth();

  if (!ready) return <SessionSplash />;
  if (!isSignedIn) return <Navigate to="/" replace />;

  return (
    <WorkspaceProvider>
      <WorkspaceDashboard />
    </WorkspaceProvider>
  );
}

function WorkspaceDashboard() {
  const { ready, loading, error, snapshot, memberships, workspace, refresh, role } = useWorkspace();

  useEffect(() => {
    document.title = "Workspace — AI-OS";
    return () => {
      document.title = "AI-OS";
    };
  }, []);

  return (
    <div className="min-h-screen bg-ink text-snow">
      <NoticeList />
      <WorkspaceHeader />

      <main className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6">
        {error ? (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-danger/25 bg-danger/[0.06] px-4 py-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-danger" />
            <p className="min-w-0 flex-1 text-[13px] leading-snug text-fog">{error}</p>
            <Button variant="secondary" size="sm" onClick={() => void refresh()}>
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        ) : null}

        {/* No workspace yet (legacy account created before the trigger existed) */}
        {ready && !loading && memberships.length === 0 ? (
          <NoWorkspaceState />
        ) : loading && !snapshot ? (
          <div className="space-y-8">
            <SkeletonRows rows={2} />
            <SkeletonRows rows={4} />
          </div>
        ) : !snapshot ? (
          <ErrorState message={error ?? "The workspace data didn't load."} onRetry={() => void refresh()} />
        ) : (
          <>
            <WorkspaceOverview />
            <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0 space-y-12">
                <ProjectsSection />
                <RunsSection />
                <ReviewsSection />
              </div>
              <div className="lg:sticky lg:top-24">
                <ActivityRail />
              </div>
            </div>
          </>
        )}

        {workspace && role ? (
          <p className="mt-12 border-t border-white/[0.06] pt-6 text-center font-mono text-[10.5px] uppercase tracking-[0.18em] text-fog-2">
            {workspace.slug} · RLS-protected workspace · agents run autonomously
          </p>
        ) : null}
      </main>
    </div>
  );
}

function NoWorkspaceState() {
  const { signOut } = useAuth();
  return (
    <div className="panel hairline-top mx-auto mt-6 flex max-w-lg flex-col items-center rounded-xl px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-electric/25 bg-electric/10 text-electric-light">
        <Sparkles className="h-5 w-5" />
      </div>
      <h1 className="mt-4 text-xl font-semibold tracking-tight text-snow">Your workspace is being provisioned</h1>
      <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-fog">
        Every account gets a personal AI-OS workspace automatically on sign-up. If you just created this account, give it a second —
        otherwise reload to pick it up.
      </p>
      <div className="mt-6 flex gap-2.5">
        <Button variant="secondary" onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4" /> Reload
        </Button>
        <Button variant="ghost" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </div>
  );
}

function SessionSplash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink text-snow">
      <div className="flex flex-col items-center gap-4">
        <LogoMark className="h-10 w-10 rounded-xl" />
        <Loader2 className="h-4 w-4 animate-spin text-electric-light" />
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-fog-2">Restoring session…</p>
      </div>
    </div>
  );
}
