import { Bot, CheckCircle2, FolderKanban, GitPullRequest, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Badge } from "@/components/workspace/bits";
import { useWorkspace } from "@/hooks/useWorkspace";
import { displayName, formatDateTime, truncate } from "@/lib/format";
import type { WorkspaceSnapshot } from "@/types/workspace";
import { cn } from "@/utils/cn";

export function WorkspaceOverview() {
  const { user } = useAuth();
  const { workspace, profile, snapshot, role } = useWorkspace();
  if (!snapshot || !workspace) return null;

  const activeRuns = snapshot.runs.filter((r) => r.run.status === "queued" || r.run.status === "running");
  const awaitingReview = snapshot.changes.filter((c) => c.runStatus === "ready_for_review" && c.change.status === "pending");
  const pendingCount = awaitingReview.filter((c) => role === "owner" || role === "admin" || c.requestedBy === user?.id).length;

  const stats = [
    {
      label: "Projects",
      value: snapshot.projects.length,
      icon: <FolderKanban className="h-4 w-4" />,
      href: "#workspace-projects",
      accent: "text-electric-light",
    },
    {
      label: "Agents at work",
      value: activeRuns.length,
      icon: <Bot className="h-4 w-4" />,
      href: "#workspace-runs",
      accent: "text-ember-soft",
      pulse: activeRuns.length > 0,
    },
    {
      label: "Ready for your review",
      value: pendingCount,
      icon: <GitPullRequest className="h-4 w-4" />,
      href: "#workspace-reviews",
      accent: pendingCount > 0 ? "text-success" : "text-fog-2",
    },
    {
      label: "Tasks completed",
      value: `${completedTasks(snapshot)}/${totalTasks(snapshot)}`,
      icon: <CheckCircle2 className="h-4 w-4" />,
      href: "#workspace-runs",
      accent: "text-success",
    },
  ];

  return (
    <section aria-label="Overview">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-fog-2">
            {workspace.slug} · since {formatDateTime(workspace.created_at)}
          </p>
          <h1 className="text-gradient mt-2 text-balance text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
            Welcome back, {displayName(profile?.display_name, user?.email)}.
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-fog">
            {role === "owner" ? "You own" : role === "admin" ? "You administer" : "You're a member of"} {workspace.name} —{" "}
            {memberSummary(snapshot.members.length, snapshot.members.map((m) => m.role))}.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5" aria-label="Workspace sections">
          <AnchorChip href="#workspace-projects" label="Projects" count={stats[0].value} />
          <AnchorChip href="#workspace-runs" label="Runs" count={snapshot.runs.length} />
          <AnchorChip href="#workspace-reviews" label="Reviews" count={snapshot.changes.length} />
          <AnchorChip href="#workspace-activity" label="Activity" />
        </div>
      </div>

      {/* Live banner while agents are working */}
      {activeRuns.length > 0 ? (
        <div className="glow-border glow-border-on mt-6 rounded-xl bg-gradient-to-r from-electric/[0.08] via-transparent to-transparent px-4 py-3.5 sm:px-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="inline-flex items-center gap-2.5 text-[13px] font-medium text-snow">
              <Loader2 className="h-4 w-4 animate-spin text-electric-light" />
              Agents are working autonomously
            </span>
            <span className="text-[12.5px] text-fog">
              {activeRuns.length === 1 ? `“${truncate(activeRuns[0].run.request_text, 96)}”` : `${activeRuns.length} runs in flight`} — you'll be
              asked to review when they finish.
            </span>
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <a
            key={s.label}
            href={s.href}
            className="panel hairline-top group rounded-xl px-4 py-4 transition hover:border-white/[0.16]"
          >
            <div className="flex items-center justify-between">
              <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]", s.accent)}>
                {s.icon}
              </span>
              {s.pulse ? <Badge tone="electric" pulse>live</Badge> : null}
            </div>
            <p className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-snow">{s.value}</p>
            <p className="mt-0.5 text-[12.5px] text-fog-2 transition group-hover:text-fog">{s.label}</p>
          </a>
        ))}
      </div>
    </section>
  );
}

function completedTasks(snapshot: WorkspaceSnapshot): number {
  let n = 0;
  for (const p of snapshot.projects) n += p.tasksByStatus.completed ?? 0;
  return n;
}

function totalTasks(snapshot: WorkspaceSnapshot): number {
  let n = 0;
  for (const p of snapshot.projects) n += Object.values(p.tasksByStatus).reduce((a, b) => a + b, 0);
  return n;
}

function memberSummary(count: number, roles: string[]): string {
  const tally: Record<string, number> = {};
  for (const r of roles) tally[r] = (tally[r] ?? 0) + 1;
  const bits: string[] = [];
  if (tally.owner) bits.push(`${tally.owner} ${tally.owner === 1 ? "owner" : "owners"}`);
  if (tally.admin) bits.push(`${tally.admin} ${tally.admin === 1 ? "admin" : "admins"}`);
  if (tally.member) bits.push(`${tally.member} ${tally.member === 1 ? "member" : "members"}`);
  return `${count} ${count === 1 ? "person" : "people"} (${bits.join(", ")})`;
}

function AnchorChip({ href, label, count }: { href: string; label: string; count?: number | string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[12px] font-medium text-fog transition hover:border-white/20 hover:text-snow"
    >
      {label}
      {typeof count === "number" ? <span className="font-mono text-[10.5px] text-fog-2">{count}</span> : null}
    </a>
  );
}
