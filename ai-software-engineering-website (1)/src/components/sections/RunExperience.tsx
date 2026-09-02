import { motion, useInView } from "framer-motion";
import { Check, CornerDownLeft, Loader2 } from "lucide-react";
import { useRef } from "react";
import { EASE, Reveal } from "@/components/ui/motion";
import { Chip, Container, Glow, Section, SectionHeading } from "@/components/ui/primitives";
import { RUN_REQUEST, RUN_STAGES } from "@/data/workflow";
import { useSequence } from "@/hooks";
import { cn } from "@/utils/cn";

const STEP_MS = 1100;
const HOLD_MS = 4200;

export function RunExperience() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3 });
  const step = useSequence(RUN_STAGES.length, STEP_MS, HOLD_MS, inView);

  return (
    <Section id="runs" className="overflow-hidden">
      <Glow tone="electric" className="right-[-18rem] top-1/4 h-[40rem] w-[40rem] opacity-50" />
      <Container>
        <div ref={ref} className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
          {/* Left: copy + request */}
          <div className="lg:sticky lg:top-28">
            <SectionHeading
              align="left"
              eyebrow="The AI run"
              title="Give your team a task. Watch it move."
              description="Every request becomes a run. Agents pick it up in sequence, hand off their output, and stop at the point where you decide."
            />

            <Reveal delay={0.15} className="mt-10">
              <div className="panel hairline-top rounded-xl p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-fog-2">Your request</p>
                <div className="mt-3 flex items-start gap-3">
                  <span className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-gradient-to-br from-fog to-fog-2" />
                  <p className="text-[15px] leading-relaxed text-snow sm:text-base">“{RUN_REQUEST}”</p>
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4">
                  <span className="flex items-center gap-2 text-[12px] text-fog">
                    {step < RUN_STAGES.length - 1 && step >= 0 ? <Loader2 className="h-3.5 w-3.5 animate-spin text-electric-light" /> : null}
                    {step < 0 ? "Ready to run" : step >= RUN_STAGES.length - 1 ? "Waiting for your approval" : `Stage ${step + 1} of ${RUN_STAGES.length}`}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-snow">
                    Run <CornerDownLeft className="h-3 w-3" />
                  </span>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.25} className="mt-6 hidden lg:block">
              <ul className="space-y-3 text-[13.5px] text-fog">
                {["Each agent sees the full project context, not just the message.", "Outputs are structured — designs, diffs, test results, review notes.", "You can pause, redirect, or stop a run at any stage."].map((t) => (
                  <li key={t} className="flex items-start gap-3">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-electric" />
                    {t}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          {/* Right: pipeline */}
          <ol className="relative" aria-label="AI run pipeline">
            {RUN_STAGES.map((stage, i) => {
              const Icon = stage.icon;
              const done = i < step;
              const active = i === step;
              const isLast = i === RUN_STAGES.length - 1;
              const reached = i <= step;
              const isHuman = stage.kind === "human";

              return (
                <li key={stage.id} className="relative flex gap-5 pb-2 last:pb-0">
                  {/* Spine */}
                  <div className="flex flex-col items-center">
                    <motion.span
                      animate={{
                        borderColor: reached ? (isHuman ? "rgba(245,158,11,0.7)" : "rgba(59,130,246,0.7)") : "rgba(255,255,255,0.1)",
                        backgroundColor: reached ? (isHuman ? "rgba(245,158,11,0.12)" : "rgba(59,130,246,0.12)") : "rgba(11,11,16,1)",
                        boxShadow: active ? (isHuman ? "0 0 24px -4px rgba(245,158,11,0.8)" : "0 0 24px -4px rgba(59,130,246,0.9)") : "0 0 0px 0px rgba(0,0,0,0)",
                      }}
                      transition={{ duration: 0.5 }}
                      className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
                    >
                      {done ? (
                        <Check className={cn("h-4 w-4", isHuman ? "text-ember-soft" : "text-electric-light")} strokeWidth={2.5} />
                      ) : (
                        <Icon className={cn("h-4 w-4 transition-colors duration-500", reached ? (isHuman ? "text-ember-soft" : "text-electric-light") : "text-fog-2")} strokeWidth={1.7} />
                      )}
                      {active ? <span className={cn("absolute inset-0 rounded-full border animate-ping", isHuman ? "border-ember/50" : "border-electric/50")} style={{ animationDuration: "1.8s" }} /> : null}
                    </motion.span>
                    {!isLast ? (
                      <span className="relative my-1 w-px flex-1 bg-white/[0.07]" aria-hidden>
                        <motion.span
                          className={cn("absolute inset-x-0 top-0 origin-top", isHuman || RUN_STAGES[i + 1].kind === "human" ? "bg-gradient-to-b from-electric to-ember" : "bg-electric")}
                          initial={false}
                          animate={{ height: i < step ? "100%" : "0%" }}
                          transition={{ duration: i < step ? STEP_MS / 1000 : 0.3, ease: "linear" }}
                        />
                      </span>
                    ) : null}
                  </div>

                  {/* Card */}
                  <motion.div
                    animate={{ opacity: reached ? 1 : 0.45 }}
                    transition={{ duration: 0.5 }}
                    className={cn(
                      "mb-3 flex-1 rounded-xl border p-4 transition-colors duration-500 sm:p-5",
                      active ? (isHuman ? "border-ember/40 bg-ember/[0.06]" : "border-electric/40 bg-electric/[0.05]") : "border-white/[0.07] bg-surface/60",
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[14.5px] font-semibold tracking-tight text-snow">{stage.label}</span>
                      {stage.kind === "user" ? (
                        <Chip tone="fog">Input</Chip>
                      ) : active ? (
                        <Chip tone={isHuman ? "ember" : "electric"}>{isHuman ? "Awaiting you" : "Working"}</Chip>
                      ) : done ? (
                        <Chip tone="success">Done</Chip>
                      ) : (
                        <Chip tone="fog">Queued</Chip>
                      )}
                    </div>
                    <motion.p
                      initial={false}
                      animate={{ opacity: reached ? 1 : 0, height: reached ? "auto" : 0, marginTop: reached ? 6 : 0 }}
                      transition={{ duration: 0.45, ease: EASE }}
                      className="overflow-hidden text-[13px] leading-relaxed text-fog"
                    >
                      {stage.detail}
                    </motion.p>
                    {isHuman && active ? (
                      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-4 flex gap-2">
                        <a href="#control" className="rounded-full bg-snow px-3.5 py-1.5 text-[12px] font-medium text-ink">
                          Review change
                        </a>
                        <span className="rounded-full border border-white/10 px-3.5 py-1.5 text-[12px] font-medium text-fog">Request revision</span>
                      </motion.div>
                    ) : null}
                  </motion.div>
                </li>
              );
            })}
          </ol>
        </div>
      </Container>
    </Section>
  );
}
