import { ArrowUpRight, Loader2, LogOut, Plus, RefreshCw, Send } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { LogoMark, StatusDot } from "@/components/ui/primitives";
import { Badge } from "@/components/workspace/bits";
import { useWorkspace } from "@/hooks/useWorkspace";
import { displayName, initials } from "@/lib/format";
import { cn } from "@/utils/cn";

export function WorkspaceHeader() {
  const { user, signOut } = useAuth();
  const { workspace, workspaceId, memberships, selectWorkspace, profile, role, refreshing, refresh, ui, ready } = useWorkspace();

  const name = displayName(profile?.display_name, user?.email);
  const avatar = initials(profile?.display_name, user?.email);
  const roleLabel = role === "owner" ? "Owner" : role === "admin" ? "Admin" : role === "member" ? "Member" : null;
  const showSwitcher = memberships.length > 1;

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-ink/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-2 px-4 sm:px-6">
        {/* Brand → public landing */}
        <a href="/" className="group inline-flex items-center gap-2.5 rounded-lg" aria-label="AI-OS home">
          <LogoMark className="h-8 w-8 rounded-[9px]" />
          <span className="hidden text-[15px] font-semibold tracking-[-0.02em] text-snow sm:inline">
            AI-OS <span className="text-fog-2">/</span> <span className="text-fog">Workspace</span>
          </span>
        </a>

        <span className="mx-1 hidden h-5 w-px bg-white/10 sm:block" aria-hidden />

        {/* Workspace switcher / name */}
        <div className="flex min-w-0 items-center gap-2">
          {showSwitcher ? (
            <select
              aria-label="Switch workspace"
              value={workspaceId ?? ""}
              onChange={(e) => selectWorkspace(e.target.value)}
              className="h-9 max-w-[220px] cursor-pointer truncate rounded-full border border-white/10 bg-white/[0.04] px-3 text-[13px] font-medium text-snow outline-none transition hover:border-white/20 focus:border-electric/60 sm:max-w-[300px]"
            >
              {(memberships ?? []).map((m) => (
                <option key={m.workspace_id} value={m.workspace_id} className="bg-surface text-snow">
                  {m.workspace?.name ?? "Workspace"}
                </option>
              ))}
            </select>
          ) : (
            <span className="truncate text-[13.5px] font-medium text-snow" title={workspace?.name}>
              {workspace?.name ?? "Loading…"}
            </span>
          )}
          {roleLabel ? (
            <Badge tone={role === "member" ? "fog" : "electric"} className="hidden md:inline-flex">
              {roleLabel}
            </Badge>
          ) : null}
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => void refresh()}
            disabled={refreshing || !ready}
            title="Refresh workspace"
            aria-label="Refresh workspace"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-fog transition hover:border-white/20 hover:text-snow disabled:opacity-50"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>

          <Button variant="secondary" size="sm" className="hidden md:inline-flex" onClick={() => ui.openNewProject()}>
            <Plus className="h-3.5 w-3.5" />
            New Project
          </Button>
          <Button variant="electric" size="sm" onClick={() => ui.openNewRequest()}>
            <Send className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New Request</span>
            <span className="sm:hidden">Request</span>
          </Button>

          {/* Account chip + sign out */}
          <div className="ml-1 flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-1">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-b from-electric/80 to-electric-deep text-[11px] font-bold text-white" title={user?.email ?? undefined}>
              {avatar}
            </span>
            <span className="hidden max-w-[140px] truncate text-[12.5px] font-medium text-snow lg:inline" title={user?.email ?? undefined}>
              {name}
            </span>
            <button
              onClick={() => void signOut()}
              title="Sign out"
              aria-label="Sign out"
              className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded-full text-fog-2 transition hover:bg-white/[0.06] hover:text-snow",
              )}
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>

          <a
            href="/"
            title="Back to the AI-OS site"
            className="hidden h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-fog transition hover:border-white/20 hover:text-snow xl:inline-flex"
          >
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Mobile-only secondary row */}
      <div className="flex items-center gap-2 border-t border-white/[0.05] px-4 py-2 md:hidden">
        <Button variant="secondary" size="sm" className="flex-1 justify-center" onClick={() => ui.openNewProject()}>
          <Plus className="h-3.5 w-3.5" /> New Project
        </Button>
        {!showSwitcher && workspace ? (
          <span className="inline-flex items-center gap-2 truncate text-xs text-fog-2">
            <StatusDot tone="success" />
            {workspace.name}
          </span>
        ) : null}
      </div>
    </header>
  );
}
