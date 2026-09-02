import { AnimatePresence, motion } from "framer-motion";
import { Check, FileCode2, FlaskConical, GitPullRequest, RotateCcw, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EASE, Reveal } from "@/components/ui/motion";
import { Chip, Container, Glow, Section, SectionHeading, StatusDot, Window } from "@/components/ui/primitives";
import { PROPOSED_CHANGE } from "@/data/mock";
import type { ReviewDecision } from "@/types";
import { cn } from "@/utils/cn";

const PRINCIPLES = [
  { title: "Agents propose, you decide", body: "Every change arrives as a reviewable proposal with tests and a security summary attached." },
  { title: "Nothing merges silently", body: "Repository writes, deployments, and destructive actions always wait for an explicit approval." },
  { title: "Revisions stay in context", body: "Request a change and the same agents pick it up with full memory of the run." },
];

export function HumanInTheLoop() {
  const [decision, setDecision] = useState<ReviewDecision>("pending");
  const [activeFile, setActiveFile] = useState(1);
  const change = PROPOSED_CHANGE;

  // Visual prototype only: auto-reset so the demo can be replayed.
  useEffect(() => {
    if (decision === "pending") return;
    const id = window.setTimeout(() => setDecision("pending"), 4500);
    return () => window.clearTimeout(id);
  }, [decision]);

  return (
    <Section id="control" className="overflow-hidden">
      <Glow tone="ember" className="left-[-14rem] bottom-0 h-[32rem] w-[32rem] opacity-50" />
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
          <div>
            <SectionHeading
              align="left"
              eyebrow="Human in the loop"
              tone="ember"
              title="AI moves fast. You stay in control."
              description="AI agents can plan and generate changes, but important actions require developer approval. You review what they propose, the same way you would review a teammate's pull request."
            />
            <Reveal delay={0.15} className="mt-10 space-y-6">
              {PRINCIPLES.map((p, i) => (
                <div key={p.title} className="flex gap-4">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] font-mono text-[10px] text-fog">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="text-[15px] font-semibold tracking-tight text-snow">{p.title}</h3>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-fog">{p.body}</p>
                  </div>
                </div>
              ))}
            </Reveal>
          </div>

          <Reveal delay={0.1}>
            <Window
              title="review · #128"
              right={
                <span className="flex items-center gap-2 font-mono text-[10px] text-fog-2">
                  <GitPullRequest className="h-3 w-3" /> {change.branch} → main
                </span>
              }
            >
              <div className="p-5 sm:p-6">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-electric-light">AI Proposed Change</span>
                    </div>
                    <h3 className="mt-2 text-lg font-semibold tracking-tight text-snow">{change.title}</h3>
                    <p className="mt-1 max-w-md text-[13px] leading-relaxed text-fog">{change.summary}</p>
                  </div>
                  <AnimatePresence mode="wait">
                    <motion.div key={decision} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.25 }}>
                      {decision === "pending" ? (
                        <Chip tone="ember">
                          <StatusDot tone="ember" pulse /> Awaiting approval
                        </Chip>
                      ) : decision === "approved" ? (
                        <Chip tone="success">
                          <Check className="h-3 w-3" /> Approved · merging
                        </Chip>
                      ) : (
                        <Chip tone="electric">
                          <RotateCcw className="h-3 w-3" /> Revision requested
                        </Chip>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Stats */}
                <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
                  {[
                    { icon: FileCode2, label: "Files changed", value: String(change.filesChanged.length), tone: "text-snow" },
                    { icon: FlaskConical, label: "Tests", value: `${change.testsPassed} passed`, tone: "text-success" },
                    { icon: ShieldCheck, label: "Security", value: change.securitySummary, tone: "text-success" },
                  ].map(({ icon: Icon, label, value, tone }) => (
                    <div key={label} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3 sm:p-4">
                      <div className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-fog-2">
                        <Icon className="h-3 w-3" />
                        <span className="truncate">{label}</span>
                      </div>
                      <p className={cn("mt-1.5 truncate text-[13px] font-semibold sm:text-[15px]", tone)}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Diff */}
                <div className="mt-5 overflow-hidden rounded-lg border border-white/[0.07] bg-black/40">
                  <div className="no-scrollbar flex overflow-x-auto border-b border-white/[0.06]">
                    {change.filesChanged.map((f, i) => (
                      <button
                        key={f.path}
                        type="button"
                        onClick={() => setActiveFile(i)}
                        className={cn(
                          "flex shrink-0 items-center gap-2 border-r border-white/[0.06] px-3 py-2 font-mono text-[10.5px] transition-colors",
                          activeFile === i ? "bg-white/[0.04] text-snow" : "text-fog-2 hover:text-fog",
                        )}
                      >
                        {f.path.split("/").pop()}
                        <span className="text-success">+{f.additions}</span>
                        {f.deletions ? <span className="text-danger">−{f.deletions}</span> : null}
                      </button>
                    ))}
                  </div>
                  <div className="max-h-56 overflow-hidden p-3 font-mono text-[11px] leading-[1.75]">
                    <AnimatePresence mode="wait">
                      <motion.div key={activeFile} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                        {(change.fileDiffs?.[activeFile] ?? change.diff).map((l, i) => (
                          <div
                            key={i}
                            className={cn(
                              "flex gap-3 whitespace-pre rounded-sm px-2",
                              l.type === "add" && "bg-success/[0.08] text-success",
                              l.type === "remove" && "bg-danger/[0.08] text-danger",
                              l.type === "context" && "text-fog-2",
                            )}
                          >
                            <span className="w-5 select-none text-right text-fog-2/50">{i + (activeFile === 1 ? 12 : 1)}</span>
                            <span className="w-3 select-none opacity-70">{l.type === "add" ? "+" : l.type === "remove" ? "−" : " "}</span>
                            <span>{l.text || " "}</span>
                          </div>
                        ))}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button variant="electric" className="sm:flex-1" onClick={() => setDecision("approved")} disabled={decision !== "pending"}>
                    <Check className="h-4 w-4" />
                    Approve Changes
                  </Button>
                  <Button variant="secondary" className="sm:flex-1" onClick={() => setDecision("revision")} disabled={decision !== "pending"}>
                    <RotateCcw className="h-4 w-4" />
                    Request Revision
                  </Button>
                </div>

                <AnimatePresence>
                  {decision !== "pending" ? (
                    <motion.p
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.35, ease: EASE }}
                      className="mt-4 text-center text-[12px] text-fog"
                    >
                      {decision === "approved"
                        ? "Change approved. Documentation Agent is updating the API reference."
                        : "Revision requested. Coding Agent is picking this up with your notes."}
                    </motion.p>
                  ) : null}
                </AnimatePresence>
              </div>
            </Window>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}
