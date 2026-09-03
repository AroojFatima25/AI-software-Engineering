import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  ChevronDown,
  Circle,
  GitBranch,
  GitPullRequest,
  Loader2,
  Play,
  Send,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Badge, Card, EmptyState, type BadgeTone } from "@/components/workspace/bits";
import { useWorkspace } from "@/hooks/useWorkspace";
import { durationBetween, formatDateTime, timeAgo, truncate } from "@/lib/format";
import { EASE } from "@/components/ui/motion";
import { cn } from "@/utils/cn";
import type { AgentActivityRow, RunDetail, RunRow, RunStageRow, StageStatus, TaskRow, TaskStatus } from "@/types/workspace";

export function RunsSection() {
  const { snapshot, ui } = useWorkspace();
  if (!snapshot) return null;
  const runs = snapshot.runs;

  return (
    <section id="workspace-runs" className="scroll-mt-24">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-snow">Runs</h2>
          <p className="mt-0.5 text-[13px] text-fog">
            Each run is one software-engineering request executed by the agent pipeline. Expand a run to watch its stages, agents, and tasks.
          </p>
        </div>
        <Button variant="electric" size="sm" onClick={() => ui.openNewRequest()}>
          <Send className="h-3.5 w-3.5" /> New request
        </Button>
      </div>

      {runs.length === 0 ? (
        <EmptyState
          icon={<Play className="h-5 w-5" />}
          title="No runs yet"
          description="Submit a software-engineering request and the agents will start a run — planning, implementation, testing, and security review happen automatically."
          action={
            <Button onClick={() => ui.openNewRequest()}>
              Launch your first run
              <Send className="h-4 w-4" />
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {runs.slice(0, 25).map((detail) => (
            <RunCard key={detail.run.id} detail={detail} />
          ))}
        </div>
      )}
    </section>
  );
}

const RUN_BADGE: Record<RunRow["status"], { label: string; tone: BadgeTone; pulse?: boolean }> = {
  queued: { label: "Queued", tone: "fog" },
  running: { label: "Running", tone: "electric", pulse: true },
  ready_for_review: { label: "Ready for review", tone: "ember" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  revision_requested: { label: "Revision requested", tone: "ember" },
  merged: { label: "Merged", tone: "electric" },
  failed: { label: "Failed", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "fog" },
};

function RunCard({ detail }: { detail: RunDetail }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const { run, project, stages, agentActivity, tasks, changes } = detail;
  const badge = RUN_BADGE[run.status];
  const stageProgress = stages.length ? stages.filter((s) => s.status === "completed").length : null;
  const reviewableCount = changes.filter((c) => c.runStatus === "ready_for_review" && c.change.status === "pending").length;
  const isMine = user?.id === run.requested_by;

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.015] sm:px-5"
      >
        <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 text-fog-2 transition-transform duration-300", open && "rotate-180")} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <Badge tone={badge.tone} pulse={badge.pulse}>
              {badge.label}
            </Badge>
            <span className="text-[13px] font-medium text-snow">
              {project ? truncate(project.name, 40) : "Project"}
              <span className="ml-1.5 font-mono text-[11px] text-fog-2">run on {formatDateTime(run.created_at)}</span>
            </span>
            {isMine ? (
              <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-fog-2">by you</span>
            ) : (
              <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-fog-2">workspace member</span>
            )}
          </div>
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-fog">{run.request_text}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-fog-2">
            {run.branch_name ? (
              <span className="inline-flex items-center gap-1">
                <GitBranch className="h-3 w-3" /> {run.branch_name}
              </span>
            ) : null}
            {stageProgress !== null ? (
              <span>
                stages {stageProgress}/{stages.length}
              </span>
            ) : null}
            {agentActivity.length ? <span>{agentActivity.length} agent event{agentActivity.length === 1 ? "" : "s"}</span> : null}
            <span>{durationBetween(run.started_at, run.completed_at)}</span>
            <span className="normal-case">{timeAgo(run.created_at)}</span>
          </div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.07] bg-ink/40 px-4 py-4 sm:px-5">
              {stages.length || agentActivity.length || tasks.length ? (
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.4fr)]">
                  <StageColumn stages={stages} run={run} />
                  <div className="space-y-5">
                    <AgentColumn activity={agentActivity} />
                    <TaskColumn tasks={tasks} />
                  </div>
                </div>
              ) : (
                <p className="text-[12.5px] italic text-fog-2">
                  {run.status === "queued" || run.status === "running"
                    ? "Agents are still booting this run — stages and activity will appear here."
                    : "No stage detail recorded for this run."}
                </p>
              )}

              {changes.length > 0 ? (
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3.5">
                  <GitPullRequest className="h-4 w-4 text-electric-light" />
                  <span className="text-[13px] text-fog">
                    {changes.length} proposed change{changes.length === 1 ? "" : "s"} attached
                  </span>
                  <Badge tone={reviewableCount > 0 ? "ember" : "success"}>{reviewableCount > 0 ? `${reviewableCount} awaiting your decision` : "all decided"}</Badge>
                  <a href="#workspace-reviews" className="ml-auto text-[12.5px] font-medium text-electric-light transition hover:underline">
                    Review ↓
                  </a>
                </div>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Card>
  );
}

/* ---------------- stage timeline ---------------- */

const STAGE_ICON: Record<StageStatus, { node: React.ReactNode; tone: BadgeTone }> = {
  completed: { node: <CheckCircle2 className="h-3.5 w-3.5" />, tone: "success" },
  running: { node: <Loader2 className="h-3.5 w-3.5 animate-spin" />, tone: "electric" },
  queued: { node: <Circle className="h-3.5 w-3.5" />, tone: "fog" },
  failed: { node: <XCircle className="h-3.5 w-3.5" />, tone: "danger" },
  skipped: { node: <Circle className="h-3.5 w-3.5 opacity-40" />, tone: "fog" },
};

const STAGE_LABEL: Record<StageStatus, string> = {
  completed: "Completed",
  running: "Running",
  queued: "Queued",
  failed: "Failed",
  skipped: "Skipped",
};

function StageColumn({ stages, run }: { stages: RunStageRow[]; run: RunRow }) {
  return (
    <div>
      <h4 className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-fog-2">Stages</h4>
      {stages.length === 0 ? (
        <p className="mt-2 text-[12px] text-fog-2">No stages recorded yet.</p>
      ) : (
        <ol className="mt-3 space-y-0">
          {stages.map((stage, i) => {
            const meta = STAGE_ICON[stage.status];
            const isLast = i === stages.length - 1;
            return (
              <li key={stage.id} className="relative flex gap-3 pb-4">
                {!isLast ? <span className="absolute left-[7px] top-4 h-full w-px bg-white/[0.08]" aria-hidden /> : null}
                <span
                  className={cn(
                    "relative mt-0.5 flex h-[15px] w-[15px] items-center justify-center rounded-full border",
                    stage.status === "completed" && "border-success/40 bg-success/10 text-success",
                    stage.status === "running" && "border-electric/40 bg-electric/10 text-electric-light",
                    (stage.status === "queued" || stage.status === "skipped") && "border-white/15 bg-white/[0.03] text-fog-2",
                    stage.status === "failed" && "border-danger/40 bg-danger/10 text-danger",
                  )}
                >
                  {meta.node}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[12.5px] font-medium text-snow">{labelize(stage.stage_key)}</span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fog-2">
                      {STAGE_LABEL[stage.status]} · {formatDateTime(stage.completed_at ?? stage.started_at)}
                    </span>
                  </div>
                  {stage.error_message ? (
                    <p className="mt-0.5 truncate font-mono text-[11px] text-danger" title={stage.error_message}>
                      {stage.error_message}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {run.status === "running" || run.status === "queued" ? (
        <p className="font-mono text-[10.5px] text-electric-light/80">▍autonomous — no action needed</p>
      ) : null}
    </div>
  );
}

/* ---------------- agent activity ---------------- */

function AgentColumn({ activity }: { activity: AgentActivityRow[] }) {
  return (
    <div>
      <h4 className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-fog-2">Agent activity</h4>
      {activity.length === 0 ? (
        <p className="mt-2 text-[12px] text-fog-2">No agent activity yet.</p>
      ) : (
        <ul className="mt-2 space-y-1.5 border-l border-white/[0.07] pl-3">
          {activity.slice(-12).map((a) => (
            <li key={a.id} className="flex items-baseline gap-2 font-mono text-[11.5px] leading-snug">
              <span
                className={cn(
                  "shrink-0 font-medium",
                  a.status === "completed" && "text-success",
                  a.status === "working" && "text-electric-light",
                  a.status === "failed" && "text-danger",
                  a.status === "queued" && "text-fog-2",
                )}
              >
                [{a.agent?.agent_key ?? "agent"}]
              </span>
              <span className="min-w-0 flex-1 text-fog">
                {a.task_description || a.status}
                <span className="ml-1.5 whitespace-nowrap text-[10px] uppercase tracking-wider text-fog-2">
                  {a.status} · {timeAgo(a.created_at)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------- tasks ---------------- */

const TASK_TONE: Record<TaskStatus, BadgeTone> = {
  pending: "fog",
  in_progress: "electric",
  completed: "success",
  failed: "danger",
  blocked: "ember",
};

const TASK_LABEL: Record<TaskStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
  failed: "Failed",
  blocked: "Blocked",
};

function TaskColumn({ tasks }: { tasks: TaskRow[] }) {
  if (!tasks.length) return null;
  const byStatus = [...tasks].sort((a, b) => (a.status === b.status ? a.position - b.position : rank(a.status) - rank(b.status)));
  return (
    <div>
      <h4 className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-fog-2">Tasks</h4>
      <ul className="mt-2 space-y-1.5">
        {byStatus.map((task) => (
          <li key={task.id} className="flex items-start gap-2.5 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
            <Badge tone={TASK_TONE[task.status]} className="mt-px !px-2 !py-0.5">
              {TASK_LABEL[task.status]}
            </Badge>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-medium leading-snug text-snow">{task.title}</p>
              {task.description ? (
                <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-fog">{task.description}</p>
              ) : null}
              {task.agent ? (
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-fog-2">{task.agent.agent_key}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function rank(s: TaskStatus): number {
  return { in_progress: 0, pending: 1, blocked: 2, completed: 3, failed: 4 }[s];
}

/* ---------------- helpers ---------------- */

export function labelize(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
