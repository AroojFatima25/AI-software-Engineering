import { AnimatePresence, motion, useInView } from "framer-motion";
import { ArrowRight, Check, CornerDownLeft, ShieldCheck, UserCheck } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { EASE } from "@/components/ui/motion";
import { Chip, Container, Glow, Section, SectionHeading, StatusDot, Window } from "@/components/ui/primitives";
import { PROPOSED_CHANGE } from "@/data/mock";
import { WORKFLOW_STEPS } from "@/data/workflow";
import { useCycle } from "@/hooks";
import { cn } from "@/utils/cn";

const INTERVAL = 4600;

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

function Label({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.2em] text-fog-2">{children}</span>
      {right}
    </div>
  );
}

function Row({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.45, ease: EASE }} className={className}>
      {children}
    </motion.div>
  );
}

function TypedText({ text, speed = 22 }: { text: string; speed?: number }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (count >= text.length) return;
    const id = window.setTimeout(() => setCount((c) => c + 1), speed);
    return () => window.clearTimeout(id);
  }, [count, text.length, speed]);
  return (
    <span>
      {text.slice(0, count)}
      <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] bg-electric-light animate-caret" />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Step visuals                                                        */
/* ------------------------------------------------------------------ */

function DescribeVisual() {
  return (
    <div>
      <Label right={<Chip tone="electric">New request</Chip>}>Describe</Label>
      <div className="rounded-xl border border-white/[0.08] bg-black/30 p-5 text-[15px] leading-relaxed text-snow">
        <TypedText text="Build a student management system with role-based access, course enrolment, and grade tracking." />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {["Next.js", "PostgreSQL", "GitHub repo connected"].map((t) => (
          <span key={t} className="rounded-full border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 font-mono text-[10.5px] text-fog">
            {t}
          </span>
        ))}
      </div>
      <Row delay={1.8} className="mt-6 flex items-center justify-between">
        <span className="text-[12.5px] text-fog">Manager Agent will scope this into a run.</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-snow px-3.5 py-1.5 text-[12px] font-medium text-ink">
          Start run <CornerDownLeft className="h-3 w-3" />
        </span>
      </Row>
    </div>
  );
}

const REQUIREMENTS = ["Students can enrol in published courses", "Teachers record and publish grades", "Admins manage users and roles"];
const TASKS = [
  ["Design data model & roles", "Architect"],
  ["Auth with role-based access", "Coding"],
  ["Course enrolment API", "Coding"],
  ["Grade tracking module", "Coding"],
  ["Integration test suite", "Testing"],
];

function PlanVisual() {
  return (
    <div>
      <Label right={<Chip tone="electric">Product Agent</Chip>}>Plan</Label>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-fog-2">Requirements</p>
          <ul className="mt-3 space-y-2.5">
            {REQUIREMENTS.map((r, i) => (
              <Row key={r} delay={0.1 + i * 0.15} className="flex items-start gap-2 text-[12.5px] text-fog">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-electric" />
                {r}
              </Row>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-fog-2">Tasks · 5 created</p>
          <ul className="mt-3 space-y-2">
            {TASKS.map(([t, a], i) => (
              <Row key={t} delay={0.6 + i * 0.12} className="flex items-center justify-between gap-3 text-[12px]">
                <span className="flex items-center gap-2 text-snow">
                  <span className="h-3 w-3 rounded-[3px] border border-white/15" />
                  {t}
                </span>
                <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-wider text-fog-2">{a}</span>
              </Row>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ArchitectVisual() {
  const box = "fill-[#0f0f16] stroke-white/15";
  const text = "fill-[#f5f5f7] text-[11px] font-medium";
  const sub = "fill-[#71717a] text-[9px]";
  return (
    <div>
      <Label right={<Chip tone="electric">Architect Agent</Chip>}>Architect</Label>
      <div className="rounded-xl border border-white/[0.07] bg-black/30 p-3">
        <svg viewBox="0 0 440 190" className="h-auto w-full" aria-label="Architecture diagram">
          <defs>
            <linearGradient id="hiw-line" x1="0" x2="1">
              <stop offset="0" stopColor="#3b82f6" stopOpacity="0.2" />
              <stop offset="0.5" stopColor="#7db4ff" stopOpacity="0.9" />
              <stop offset="1" stopColor="#3b82f6" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          {/* connections */}
          <motion.path d="M120 60 H160" stroke="url(#hiw-line)" strokeWidth="1.2" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.5, duration: 0.6 }} />
          <motion.path d="M280 60 H320" stroke="url(#hiw-line)" strokeWidth="1.2" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.8, duration: 0.6 }} />
          <motion.path d="M220 84 V116" stroke="url(#hiw-line)" strokeWidth="1.2" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.1, duration: 0.5 }} />
          <motion.path d="M280 140 H320 V84" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="3 4" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.4, duration: 0.6 }} />

          {/* nodes */}
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            <rect x="20" y="36" width="100" height="48" rx="8" className={box} />
            <text x="70" y="57" textAnchor="middle" className={text}>Web App</text>
            <text x="70" y="72" textAnchor="middle" className={sub}>Next.js · RSC</text>
          </motion.g>
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
            <rect x="160" y="36" width="120" height="48" rx="8" className="fill-electric/10 stroke-electric/50" />
            <text x="220" y="57" textAnchor="middle" className={text}>REST API</text>
            <text x="220" y="72" textAnchor="middle" className="fill-[#7db4ff] text-[9px]">/courses · /grades · /auth</text>
          </motion.g>
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>
            <rect x="320" y="36" width="100" height="48" rx="8" className={box} />
            <text x="370" y="57" textAnchor="middle" className={text}>PostgreSQL</text>
            <text x="370" y="72" textAnchor="middle" className={sub}>row-level security</text>
          </motion.g>
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>
            <rect x="160" y="116" width="120" height="48" rx="8" className={box} />
            <text x="220" y="137" textAnchor="middle" className={text}>Auth Service</text>
            <text x="220" y="152" textAnchor="middle" className={sub}>JWT sessions · roles</text>
          </motion.g>
        </svg>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        {["Roles enforced at DB layer", "Stateless JWT sessions", "REST for v1, typed client"].map((d, i) => (
          <Row key={d} delay={1.5 + i * 0.12} className="rounded-lg border border-white/[0.06] px-3 py-2 text-[11.5px] text-fog">
            {d}
          </Row>
        ))}
      </ul>
    </div>
  );
}

function BuildVisual() {
  const lines = PROPOSED_CHANGE.diff.slice(0, 11);
  return (
    <div>
      <Label right={<Chip tone="electric">Coding Agent</Chip>}>Build</Label>
      <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-black/40">
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2 font-mono text-[10.5px] text-fog-2">
          <span className="text-fog">src/routes/auth.ts</span>
          <span className="ml-auto text-success">+41</span>
          <span className="text-danger">−6</span>
        </div>
        <div className="p-3 font-mono text-[11px] leading-[1.75]">
          {lines.map((l, i) => (
            <Row
              key={i}
              delay={0.1 + i * 0.09}
              className={cn(
                "flex gap-3 whitespace-pre rounded-sm px-2",
                l.type === "add" && "bg-success/[0.08] text-success",
                l.type === "remove" && "bg-danger/[0.08] text-danger line-through decoration-danger/40",
                l.type === "context" && "text-fog-2",
              )}
            >
              <span className="w-3 select-none text-right opacity-60">{l.type === "add" ? "+" : l.type === "remove" ? "−" : " "}</span>
              <span>{l.text || " "}</span>
            </Row>
          ))}
        </div>
      </div>
      <Row delay={1.2} className="mt-3 flex items-center justify-between text-[12px] text-fog">
        <span>3 files changed</span>
        <span className="font-mono text-[11px]">
          <span className="text-success">+166</span> <span className="text-danger">−6</span>
        </span>
      </Row>
    </div>
  );
}

const TEST_CASES = [
  "redirects to Google with signed state",
  "exchanges authorization code for profile",
  "links Google account to existing user",
  "rejects mismatched state parameter",
  "sets httpOnly, secure session cookie",
  "refreshes expired tokens transparently",
];

function TestVisual() {
  return (
    <div>
      <Label right={<Chip tone="electric">Testing Agent</Chip>}>Test</Label>
      <div className="rounded-xl border border-white/[0.07] bg-black/40 p-4">
        <ul className="space-y-2">
          {TEST_CASES.map((t, i) => (
            <Row key={t} delay={0.15 + i * 0.22} className="flex items-center gap-2.5 font-mono text-[11.5px] text-fog">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-success/15">
                <Check className="h-2.5 w-2.5 text-success" strokeWidth={3} />
              </span>
              <span className="truncate">{t}</span>
              <span className="ml-auto text-[10px] text-fog-2">{(0.12 + i * 0.07).toFixed(2)}s</span>
            </Row>
          ))}
        </ul>
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div className="h-full bg-success" initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 1.6, ease: "linear", delay: 0.2 }} />
        </div>
        <Row delay={1.8} className="mt-3 flex items-center justify-between font-mono text-[11px]">
          <span className="text-success">12 passed</span>
          <span className="text-fog-2">0 failed · 1.8s</span>
        </Row>
      </div>
    </div>
  );
}

function ReviewVisual() {
  return (
    <div>
      <Label right={<Chip tone="ember">Review</Chip>}>Review</Label>
      <div className="space-y-3">
        <Row delay={0.1} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2">
            <StatusDot tone="ember" pulse />
            <span className="text-[13px] font-medium text-snow">Reviewer Agent</span>
            <span className="ml-auto font-mono text-[10px] text-fog-2">src/routes/auth.ts:42</span>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-fog">
            Consider extracting token refresh into <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[11px] text-snow">refreshSession()</code> — the same logic appears in two handlers.
          </p>
          <span className="mt-3 inline-block rounded-full border border-ember/30 bg-ember/10 px-2 py-0.5 font-mono text-[10px] text-ember-soft">Suggestion · non-blocking</span>
        </Row>
        <Row delay={0.5} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-success" />
            <span className="text-[13px] font-medium text-snow">Security Agent</span>
            <span className="ml-auto font-mono text-[10px] text-fog-2">3 files scanned</span>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-fog">State parameter is validated, cookies are httpOnly and secure, and no secrets are logged.</p>
          <span className="mt-3 inline-block rounded-full border border-success/30 bg-success/10 px-2 py-0.5 font-mono text-[10px] text-success">No critical issues</span>
        </Row>
      </div>
    </div>
  );
}

function ApproveVisual() {
  return (
    <div>
      <Label right={<Chip tone="fog">Human in the loop</Chip>}>Approve</Label>
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-electric/30 bg-electric/10">
            <UserCheck className="h-4 w-4 text-electric-light" />
          </span>
          <div>
            <p className="text-[14px] font-semibold tracking-tight text-snow">{PROPOSED_CHANGE.title}</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-fog">{PROPOSED_CHANGE.summary}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            ["Files", "3 changed"],
            ["Tests", "12 passed"],
            ["Security", "No critical"],
          ].map(([k, v], i) => (
            <Row key={k} delay={0.2 + i * 0.1} className="rounded-lg border border-white/[0.06] px-3 py-2">
              <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-fog-2">{k}</p>
              <p className="mt-0.5 text-[12.5px] font-medium text-snow">{v}</p>
            </Row>
          ))}
        </div>
        <Row delay={0.6} className="mt-5 flex flex-col gap-2 sm:flex-row">
          <span className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-electric py-2 text-[12.5px] font-medium text-white shadow-[0_0_24px_-6px_rgba(59,130,246,0.9)]">
            <Check className="h-3.5 w-3.5" /> Approve Changes
          </span>
          <span className="inline-flex flex-1 items-center justify-center rounded-full border border-white/10 py-2 text-[12.5px] font-medium text-fog">Request Revision</span>
        </Row>
      </div>
      <Row delay={0.9} className="mt-3 text-center text-[12px] text-fog-2">
        Nothing merges without your decision.
      </Row>
    </div>
  );
}

const VISUALS: Record<string, () => ReactNode> = {
  describe: DescribeVisual,
  plan: PlanVisual,
  architect: ArchitectVisual,
  build: BuildVisual,
  test: TestVisual,
  review: ReviewVisual,
  approve: ApproveVisual,
};

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.25 });
  const { index, select, tick } = useCycle(WORKFLOW_STEPS.length, INTERVAL, inView);
  const step = WORKFLOW_STEPS[index];
  const Visual = VISUALS[step.id];

  return (
    <Section id="how-it-works" className="overflow-hidden">
      <Glow tone="electric" className="left-[-20rem] top-1/3 h-[40rem] w-[40rem] opacity-50" />
      <Container>
        <SectionHeading
          eyebrow="How it works"
          title="From idea to software."
          description="A single request moves through your AI engineering team. Each stage is handled by an agent built for it, and you make the final call."
        />

        <div ref={ref} className="mt-16 grid items-start gap-8 lg:mt-20 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
          {/* Steps */}
          <ol className="order-2 relative lg:order-1" aria-label="Workflow steps">
            <span aria-hidden className="absolute bottom-3 left-[1.35rem] top-3 w-px bg-white/[0.06]" />
            {WORKFLOW_STEPS.map((s, i) => {
              const active = i === index;
              const done = i < index;
              return (
                <li key={s.id} className="relative">
                  <button
                    type="button"
                    onClick={() => select(i)}
                    aria-current={active ? "step" : undefined}
                    className={cn(
                      "group relative flex w-full items-start gap-4 rounded-xl py-3.5 pl-3 pr-4 text-left transition-colors duration-300",
                      active ? "bg-white/[0.035]" : "hover:bg-white/[0.02]",
                    )}
                  >
                    <span
                      className={cn(
                        "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-mono text-[10.5px] transition-all duration-500",
                        active
                          ? "border-electric/60 bg-electric/15 text-electric-light shadow-[0_0_18px_-4px_rgba(59,130,246,0.8)]"
                          : done
                            ? "border-white/10 bg-surface-2 text-fog"
                            : "border-white/10 bg-ink text-fog-2",
                      )}
                    >
                      {done ? <Check className="h-3.5 w-3.5 text-success" strokeWidth={2.5} /> : s.number}
                    </span>
                    <span className="min-w-0 flex-1 pt-1">
                      <span className="flex items-center justify-between">
                        <span className={cn("text-[15px] font-semibold tracking-tight transition-colors duration-300", active ? "text-snow" : "text-fog group-hover:text-snow")}>{s.title}</span>
                        <span className={cn("font-mono text-[10px] uppercase tracking-[0.18em] transition-opacity", active ? "text-electric-light opacity-100" : "opacity-0")}>Running</span>
                      </span>
                      <AnimatePresence initial={false}>
                        {active ? (
                          <motion.span
                            key="desc"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.4, ease: EASE }}
                            className="block overflow-hidden"
                          >
                            <span className="block pt-1 text-[13.5px] leading-relaxed text-fog">{s.description}</span>
                            <span className="mt-3 block h-px w-full overflow-hidden bg-white/[0.06]">
                              <motion.span
                                key={tick}
                                className="block h-full bg-gradient-to-r from-electric to-electric-light"
                                initial={{ width: "0%" }}
                                animate={{ width: inView ? "100%" : "0%" }}
                                transition={{ duration: INTERVAL / 1000, ease: "linear" }}
                              />
                            </span>
                          </motion.span>
                        ) : null}
                      </AnimatePresence>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {/* Visual */}
          <div className="order-1 lg:order-2 lg:sticky lg:top-28">
            <Window
              title={`ai-os · run #128 · ${step.title.toLowerCase()}`}
              right={
                <span className="flex items-center gap-2 font-mono text-[10px] text-fog-2">
                  <StatusDot pulse />
                  stage {step.number} / 07
                </span>
              }
              bodyClassName="min-h-[400px] sm:min-h-[430px]"
            >
              <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid-fine opacity-40 mask-fade-b" />
              <AnimatePresence mode="wait">
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                  transition={{ duration: 0.45, ease: EASE }}
                  className="relative p-5 sm:p-6"
                >
                  <Visual />
                </motion.div>
              </AnimatePresence>
            </Window>
            <div className="mt-4 flex items-center justify-between px-1 text-[12px] text-fog-2">
              <span>Click any stage to preview it.</span>
              <a href="#agents" className="inline-flex items-center gap-1 text-fog transition-colors hover:text-snow">
                Meet the agents <ArrowRight className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
