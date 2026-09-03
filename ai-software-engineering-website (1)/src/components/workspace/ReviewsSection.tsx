import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  FileCode2,
  GitBranch,
  GitPullRequest,
  Loader2,
  Lock,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Badge, Card, EmptyState, type BadgeTone } from "@/components/workspace/bits";
import { useWorkspace } from "@/hooks/useWorkspace";
import { EASE } from "@/components/ui/motion";
import { timeAgo, truncate } from "@/lib/format";
import { cn } from "@/utils/cn";
import type { ApprovalDecision, ChangeDetail, ChangedFileRow } from "@/types/workspace";

export function ReviewsSection() {
  const { snapshot } = useWorkspace();
  if (!snapshot) return null;
  const changes = snapshot.changes;

  return (
    <section id="workspace-reviews" className="scroll-mt-24">
      <div className="mb-3">
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-snow">Proposed changes &amp; reviews</h2>
        <p className="mt-0.5 text-[13px] text-fog">
          When a run finishes, the agents leave a proposed change here for you. Approve it, request a revision, or reject it — a
          revision sends the agents back to work autonomously.
        </p>
      </div>

      {changes.length === 0 ? (
        <EmptyState
          icon={<GitPullRequest className="h-5 w-5" />}
          title="Nothing to review yet"
          description="Proposed changes appear here once an agent run completes. Keep an eye on Runs while the team works."
        />
      ) : (
        <div className="space-y-3">
          {changes.map((change) => (
            <ChangeCard key={change.change.id} change={change} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Change card                                                         */
/* ------------------------------------------------------------------ */

const CHANGE_BADGE: Record<ChangeDetail["change"]["status"], { label: string; tone: BadgeTone }> = {
  pending: { label: "Awaiting decision", tone: "ember" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  revision_requested: { label: "Revision requested", tone: "ember" },
  merged: { label: "Merged", tone: "electric" },
};

const APPROVAL_BADGE: Record<ApprovalDecision, { label: string; tone: BadgeTone }> = {
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  revision_requested: { label: "Requested changes", tone: "ember" },
};

function ChangeCard({ change }: { change: ChangeDetail }) {
  const { user, isSignedIn } = useAuth();
  const { snapshot } = useWorkspace();
  const [open, setOpen] = useState(false);
  const badge = CHANGE_BADGE[change.change.status];

  const agentsBusy = change.runStatus === "queued" || change.runStatus === "running" || change.runStatus === "revision_requested";
  const reviewable = change.runStatus === "ready_for_review" && change.change.status !== "merged";
  const canReview = isSignedIn && snapshot !== null && (snapshot.role === "owner" || snapshot.role === "admin" || change.requestedBy === user?.id);
  const memberRole = snapshot?.members.find((m) => m.user_id === change.requestedBy)?.role;

  return (
    <Card className="overflow-hidden">
      {/* Header row */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.015] sm:px-5"
      >
        <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 text-fog-2 transition-transform duration-300", open && "rotate-180")} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <Badge tone={badge.tone} pulse={agentsBusy && change.change.status === "pending"}>
              {badge.label}
            </Badge>
            {change.projectName ? <span className="text-[12px] font-medium text-fog-2">{change.projectName}</span> : null}
            <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-fog-2">{timeAgo(change.change.created_at)}</span>
            {reviewable ? <Badge tone="success">review open</Badge> : null}
          </div>
          <h3 className="mt-1 text-[14.5px] font-semibold tracking-[-0.01em] text-snow">{change.change.title}</h3>
          {change.change.summary ? (
            <p className="mt-1 line-clamp-2 max-w-3xl text-[12.5px] leading-relaxed text-fog">{change.change.summary}</p>
          ) : null}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.07] bg-ink/40 px-4 py-4 sm:px-5">
              {/* Meta strip */}
              <div className="flex flex-wrap items-center gap-1.5">
                {change.change.source_branch || change.change.target_branch ? (
                  <Badge tone="fog">
                    <GitBranch className="h-3 w-3" />
                    {change.change.source_branch ?? "?"} → {change.change.target_branch ?? change.projectName ?? "main"}
                  </Badge>
                ) : null}
                {change.change.tests_total > 0 ? (
                  <Badge tone={change.change.tests_passed >= change.change.tests_total ? "success" : "ember"}>
                    <CheckCircle2 className="h-3 w-3" />
                    {change.change.tests_passed}/{change.change.tests_total} tests
                  </Badge>
                ) : null}
                {change.change.security_summary ? (
                  <Badge tone={/no critical|clean|pass|none/i.test(change.change.security_summary) ? "success" : "ember"}>
                    <ShieldCheck className="h-3 w-3" />
                    {truncate(change.change.security_summary, 60)}
                  </Badge>
                ) : null}
                <Badge tone="fog">
                  <FileCode2 className="h-3 w-3" />
                  {change.files.length} file{change.files.length === 1 ? "" : "s"}
                </Badge>
              </div>

              {/* Files */}
              <div className="mt-3.5 space-y-1.5">
                {change.files.length === 0 ? <p className="text-[12px] italic text-fog-2">No changed files recorded yet.</p> : null}
                {change.files.map((file) => (
                  <FileRow key={file.id} file={file} />
                ))}
              </div>

              {/* Approval history */}
              {change.approvals.length > 0 ? (
                <div className="mt-4 border-t border-white/[0.06] pt-3">
                  <h4 className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-fog-2">Review activity</h4>
                  <ul className="mt-2 space-y-2">
                    {[...change.approvals].reverse().map((a) => {
                      const meta = APPROVAL_BADGE[a.decision];
                      const mine = user?.id === a.user_id;
                      return (
                        <li key={a.id} className="flex items-start gap-2.5 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                          <div className="min-w-0 flex-1">
                            {a.comment ? <p className="text-[12.5px] leading-snug text-fog">“{a.comment}”</p> : null}
                            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-fog-2">
                              {mine ? "you" : "workspace reviewer"} · {timeAgo(a.created_at)}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {/* Review actions — only once the run is complete */}
              <div className="mt-4 border-t border-white/[0.06] pt-3.5">
                {reviewable && canReview ? (
                  <ReviewComposer change={change} />
                ) : reviewable && !canReview ? (
                  <p className="flex items-center gap-2 text-[12.5px] text-fog-2">
                    <Lock className="h-3.5 w-3.5" />
                    This run is ready for review. Decisions are limited to the requester
                    {memberRole ? ` (workspace ${memberRole})` : ""} and workspace owners/admins.
                  </p>
                ) : agentsBusy ? (
                  <p className="flex items-center gap-2 text-[12.5px] text-fog-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-electric-light" />
                    Agents are still working on this run — approve / revise / reject unlocks once it is ready for review.
                  </p>
                ) : (
                  <p className="flex items-center gap-2 text-[12.5px] text-fog-2">
                    <Check className="h-3.5 w-3.5 text-fog-2" />
                    {change.change.status === "approved" || change.change.status === "merged"
                      ? "Decision recorded — this change has been " + change.change.status + "."
                      : "Decision recorded — this change was " + change.change.status.replace("_", " ") + "."}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Review composer                                                     */
/* ------------------------------------------------------------------ */

function ReviewComposer({ change }: { change: ChangeDetail }) {
  const { actions } = useWorkspace();
  const [comment, setComment] = useState("");
  const [busyDecision, setBusyDecision] = useState<ApprovalDecision | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (decision: ApprovalDecision) => {
    setBusyDecision(decision);
    setError(null);
    const res = await actions.review({ proposedChangeId: change.change.id, decision, comment });
    if (!res.ok) setError(res.message);
    else setComment("");
    setBusyDecision(null);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[12.5px] font-medium text-fog">Your decision:</span>
        <Button
          variant="electric"
          size="sm"
          disabled={busyDecision !== null}
          onClick={() => void submit("approved")}
          className="min-w-[92px] justify-center"
        >
          {busyDecision === "approved" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          Approve
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={busyDecision !== null}
          onClick={() => void submit("revision_requested")}
          className="min-w-[128px] justify-center"
        >
          {busyDecision === "revision_requested" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
          Request changes
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busyDecision !== null}
          onClick={() => void submit("rejected")}
          className="min-w-[84px] justify-center border border-white/10 text-danger hover:border-danger/40 hover:text-danger"
        >
          {busyDecision === "rejected" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
          Reject
        </Button>
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={"Leave a note for the agents (optional) — e.g. “ship it”, or specifics for the revision…"}
        className="mt-2.5 w-full resize-y rounded-xl border border-white/10 bg-ink/60 px-3.5 py-2.5 text-[13px] leading-relaxed text-snow placeholder:text-fog-2/70 transition focus:border-electric/60 focus:ring-2 focus:ring-electric/25"
        rows={2}
        maxLength={2000}
      />
      {error ? <p className="mt-2 text-[12.5px] text-danger">{error}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* File row with optional diff preview                                 */
/* ------------------------------------------------------------------ */

function FileRow({ file }: { file: ChangedFileRow }) {
  const [showDiff, setShowDiff] = useState(false);
  const hasDiff = Boolean(file.diff_text && file.diff_text.trim().length > 0);

  return (
    <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.02]">
      <button
        type="button"
        onClick={() => hasDiff && setShowDiff((v) => !v)}
        disabled={!hasDiff}
        className={cn(
          "flex w-full items-center gap-3 px-3 py-2 text-left",
          hasDiff && "transition hover:bg-white/[0.02]",
        )}
      >
        <FileCode2 className="h-3.5 w-3.5 shrink-0 text-fog-2" />
        <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-snow">{file.file_path}</span>
        <span className="shrink-0 font-mono text-[11px] text-success">+{file.additions}</span>
        <span className="shrink-0 font-mono text-[11px] text-danger">−{file.deletions}</span>
        {hasDiff ? <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-fog-2 transition-transform", showDiff && "rotate-180")} /> : null}
      </button>
      <AnimatePresence initial={false}>
        {showDiff && hasDiff ? (
          <motion.pre
            key="diff"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-x-auto border-t border-white/[0.06] bg-ink/60 px-3 py-2 font-mono text-[11px] leading-[1.6]"
          >
            {diffLines(file.diff_text!).map((line, i) => (
              <div
                key={i}
                className={cn(
                  "whitespace-pre",
                  line.type === "add" && "text-success",
                  line.type === "remove" && "text-danger/80",
                  line.type === "hunk" && "text-electric-light",
                  line.type === "context" && "text-fog/70",
                )}
              >
                {line.text}
              </div>
            ))}
          </motion.pre>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

type DiffLine = { type: "add" | "remove" | "hunk" | "context"; text: string };

function diffLines(diff: string, maxLines = 240): DiffLine[] {
  const raw = diff.split("\n");
  const trimmed = raw.length > maxLines ? raw.slice(0, maxLines) : raw;
  const lines: DiffLine[] = trimmed.map((text) => {
    if (text.startsWith("+")) return { type: "add", text };
    if (text.startsWith("-")) return { type: "remove", text };
    if (text.startsWith("@@")) return { type: "hunk", text };
    return { type: "context", text };
  });
  if (raw.length > maxLines) {
    lines.push({ type: "context", text: `… ${raw.length - maxLines} more lines …` });
  }
  return lines;
}
