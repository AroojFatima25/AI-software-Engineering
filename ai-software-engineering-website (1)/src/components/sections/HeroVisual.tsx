import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Check, Circle, Code2, DraftingCompass, FlaskConical, GitBranch, ScanSearch, ShieldCheck, type LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { GithubIcon } from "@/components/ui/icons";
import { EASE } from "@/components/ui/motion";
import { StatusDot } from "@/components/ui/primitives";
import { useElementWidth, useMediaQuery } from "@/hooks";
import { cn } from "@/utils/cn";

const W = 1000;
const H = 600;

/* ------------------------------------------------------------------ */
/* Shared card contents                                                */
/* ------------------------------------------------------------------ */

function AgentHeader({ icon: Icon, name, tone, pulse = true }: { icon: LucideIcon; name: string; tone: "electric" | "ember" | "fog" | "success"; pulse?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-white/[0.04]">
          <Icon className="h-3.5 w-3.5 text-snow" />
        </span>
        <span className="text-[12.5px] font-medium tracking-tight text-snow">{name}</span>
      </div>
      <StatusDot tone={tone} pulse={pulse} />
    </div>
  );
}

function ProjectChip() {
  return (
    <div className="glass flex h-full items-center justify-center gap-3 rounded-full px-4 font-mono text-[10.5px] tracking-wide text-fog">
      <span className="flex items-center gap-1.5 text-snow">
        <GithubIcon className="h-3.5 w-3.5" />
        open-dev/collab-editor
      </span>
      <span className="h-3 w-px bg-white/10" />
      <span className="flex items-center gap-1.5">
        <GitBranch className="h-3 w-3" />
        feat/crdt-sync
      </span>
    </div>
  );
}

function RunCard({ progressDelay = 1.2 }: { progressDelay?: number }) {
  return (
    <div className="flex h-full flex-col p-5">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-electric-light">
          <StatusDot pulse />
          AI Engineering Run
        </span>
        <span className="font-mono text-[10.5px] text-fog-2">#128</span>
      </div>
      <h3 className="mt-3.5 text-[17px] font-semibold tracking-tight text-snow">Realtime Collaborative Editor</h3>
      <p className="mt-0.5 text-[12px] text-fog">Add conflict-free live editing to the editor</p>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-fog">Progress</span>
          <span className="font-mono text-snow">43%</span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-electric-deep via-electric to-electric-light"
            initial={{ width: 0 }}
            animate={{ width: "43%" }}
            transition={{ duration: 1.6, ease: EASE, delay: progressDelay }}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          ["Tasks", "9 / 21"],
          ["Tests", "24 passed"],
          ["Agents", "4 active"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
            <div className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-fog-2">{label}</div>
            <div className="mt-0.5 text-[12px] font-medium text-snow">{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-white/[0.06] pt-3.5">
        <div className="flex -space-x-1.5">
          {["A", "C", "T", "R"].map((initial, i) => (
            <span
              key={initial}
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full border border-ink text-[9px] font-semibold",
                i === 0 ? "bg-electric text-white" : i === 3 ? "bg-ember/80 text-ink" : "bg-surface-3 text-snow",
              )}
            >
              {initial}
            </span>
          ))}
        </div>
        <span className="text-[11px] text-fog">Manager Agent orchestrating</span>
      </div>
    </div>
  );
}

function ArchitectCard() {
  return (
    <div className="flex h-full flex-col p-4">
      <AgentHeader icon={DraftingCompass} name="Architect Agent" tone="electric" />
      <p className="mt-2 text-[11px] text-fog">Designing sync protocol</p>
      <div className="mt-3 flex items-center gap-1.5">
        {["Client", "WebSocket", "Postgres"].map((node, i) => (
          <div key={node} className="contents">
            <span className={cn("rounded-md border px-2 py-1 font-mono text-[10px]", i === 1 ? "border-electric/40 bg-electric/10 text-electric-light" : "border-white/10 bg-white/[0.03] text-fog")}>
              {node}
            </span>
            {i < 2 ? <span className="h-px flex-1 bg-gradient-to-r from-electric/60 to-electric/20" /> : null}
          </div>
        ))}
      </div>
      <div className="mt-auto flex flex-wrap gap-1.5">
        {["WebSockets", "Yjs CRDT", "Presence"].map((t) => (
          <span key={t} className="rounded-full border border-white/[0.08] px-2 py-0.5 font-mono text-[9.5px] text-fog-2">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

const CODE_LINES: ReactNode[] = [
  <>
    <span className="text-electric-light">export function</span> <span className="text-snow">applyRemoteUpdate</span>(doc, payload) {"{"}
  </>,
  <>
    {"  "}
    <span className="text-electric-light">const</span> update = <span className="text-snow">decodeUpdate</span>(payload)
  </>,
  <>
    {"  "}
    <span className="text-electric-light">return</span> <span className="text-snow">applyUpdate</span>(doc, update)
  </>,
  <>{"}"}</>,
];

function CodeCard({ animate = true }: { animate?: boolean }) {
  return (
    <div className="flex h-full flex-col p-4">
      <AgentHeader icon={Code2} name="Code Agent" tone="electric" />
      <p className="mt-2 text-[11px] text-fog">Implementing CRDT sync</p>
      <div className="mt-2.5 flex-1 overflow-hidden rounded-lg border border-white/[0.06] bg-black/40 px-3 py-2.5 font-mono text-[10px] leading-[1.7] text-fog">
        {CODE_LINES.map((line, i) => (
          <motion.div
            key={i}
            className="whitespace-pre"
            initial={animate ? { opacity: 0, x: -6 } : false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.5 + i * 0.28, duration: 0.5, ease: EASE }}
          >
            {line}
            {i === CODE_LINES.length - 1 ? <span className="ml-0.5 inline-block h-[11px] w-[5px] translate-y-[2px] bg-electric-light animate-caret" /> : null}
          </motion.div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between font-mono text-[9.5px] text-fog-2">
        <span>src/ws/documents.ts</span>
        <span className="text-success">+82</span>
      </div>
    </div>
  );
}

const TESTS = ["concurrent edits merge deterministically", "offline updates replay on reconnect", "foreign tenant update is rejected"];

function TestingCard({ animate = true }: { animate?: boolean }) {
  return (
    <div className="flex h-full flex-col p-4">
      <AgentHeader icon={FlaskConical} name="Testing Agent" tone="success" />
      <p className="mt-2 text-[11px] text-fog">Verifying implementation</p>
      <ul className="mt-2.5 space-y-1.5">
        {TESTS.map((t, i) => (
          <motion.li
            key={t}
            className="flex items-center gap-2 text-[10.5px] text-fog"
            initial={animate ? { opacity: 0, x: -6 } : false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.8 + i * 0.3, duration: 0.5, ease: EASE }}
          >
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-success/15">
              <Check className="h-2.5 w-2.5 text-success" strokeWidth={3} />
            </span>
            <span className="truncate font-mono">{t}</span>
          </motion.li>
        ))}
      </ul>
      <div className="mt-auto font-mono text-[9.5px] text-fog-2">
        <span className="text-success">24 passed</span> · 0 failed · 1.8s
      </div>
    </div>
  );
}

function ReviewCard() {
  return (
    <div className="flex h-full flex-col p-4">
      <AgentHeader icon={ScanSearch} name="Review Agent" tone="ember" />
      <p className="mt-2 text-[11px] text-fog">Reviewing 3 changed files</p>
      <ul className="mt-2.5 space-y-1.5 text-[10.5px]">
        <li className="flex items-center gap-2 text-fog">
          <ShieldCheck className="h-3 w-3 text-success" />
          Security · no critical issues
        </li>
        <li className="flex items-center gap-2 text-fog">
          <span className="h-1.5 w-1.5 rounded-full bg-ember" />1 suggestion · extract reconnect backoff helper
        </li>
      </ul>
      <div className="mt-auto flex items-center gap-2">
        <span className="rounded-full bg-electric px-2.5 py-1 text-[10px] font-medium text-white shadow-[0_0_16px_-4px_rgba(59,130,246,0.9)]">Approve</span>
        <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-medium text-fog">Revise</span>
        <span className="ml-auto font-mono text-[9.5px] text-fog-2">awaiting you</span>
      </div>
    </div>
  );
}

const TASKS: { label: string; state: "done" | "active" | "pending" }[] = [
  { label: "Design CRDT sync protocol", state: "done" },
  { label: "Implement live document sync", state: "active" },
  { label: "Write integration tests", state: "pending" },
];

function TasksCard() {
  return (
    <div className="flex h-full flex-col px-5 py-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-fog-2">Tasks</span>
        <span className="font-mono text-[10.5px] text-fog">9 / 21</span>
      </div>
      <ul className="mt-2.5 space-y-1.5">
        {TASKS.map((t) => (
          <li key={t.label} className="flex items-center gap-2.5 text-[11px]">
            {t.state === "done" ? (
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-success/15">
                <Check className="h-2.5 w-2.5 text-success" strokeWidth={3} />
              </span>
            ) : t.state === "active" ? (
              <StatusDot pulse className="mx-[3px]" />
            ) : (
              <Circle className="h-3.5 w-3.5 text-fog-2/60" strokeWidth={1.5} />
            )}
            <span className={cn(t.state === "done" ? "text-fog-2 line-through decoration-white/20" : t.state === "active" ? "text-snow" : "text-fog")}>{t.label}</span>
            {t.state === "active" ? <span className="ml-auto font-mono text-[9.5px] text-electric-light">Coding Agent</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Desktop canvas                                                      */
/* ------------------------------------------------------------------ */

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 22, scale: 0.97 },
  show: (delay: number) => ({ opacity: 1, y: 0, scale: 1, transition: { duration: 0.9, ease: EASE, delay } }),
};

interface CardProps {
  x: number;
  y: number;
  w: number;
  h: number;
  delay: number;
  float?: number;
  frame?: boolean;
  className?: string;
  children: ReactNode;
}

function Card({ x, y, w, h, delay, float, frame = true, className, children }: CardProps) {
  const floatStyle: CSSProperties | undefined = float !== undefined ? { animationDelay: `${float}s`, animationDuration: `${7 + float}s` } : undefined;
  return (
    <motion.div variants={cardVariants} custom={delay} className="absolute" style={{ left: x, top: y, width: w, height: h }}>
      <div className={cn("h-full w-full", frame && "panel hairline-top rounded-xl", float !== undefined && "animate-float", className)} style={floatStyle}>
        {children}
      </div>
    </motion.div>
  );
}

const CONNECTORS = [
  { d: "M500,44 L500,130", begin: "-0.4s" },
  { d: "M320,210 C296,210 304,165 280,165", begin: "-1.1s" },
  { d: "M680,200 C704,200 696,155 720,155", begin: "-2.2s" },
  { d: "M680,350 C704,350 696,455 720,455", begin: "-0.7s" },
  { d: "M320,350 C296,350 304,455 280,455", begin: "-1.8s" },
  { d: "M500,430 L500,460", begin: "-2.6s" },
];

function Connectors({ reduce }: { reduce: boolean }) {
  return (
    <motion.svg
      viewBox={`0 0 ${W} ${H}`}
      className="pointer-events-none absolute inset-0 h-full w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 1, duration: 1 }}
      aria-hidden
    >
      <defs>
        <filter id="hero-glow" x="-300%" y="-300%" width="700%" height="700%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {CONNECTORS.map(({ d, begin }) => (
        <g key={d}>
          <path d={d} fill="none" stroke="rgba(59,130,246,0.22)" strokeWidth="1" />
          {!reduce ? (
            <>
              <path d={d} fill="none" stroke="rgba(125,180,255,0.55)" strokeWidth="1" strokeDasharray="3 11" className="animate-flow" />
              <circle r="2.4" fill="#9cc4ff" filter="url(#hero-glow)">
                <animateMotion dur="3.4s" repeatCount="indefinite" path={d} begin={begin} />
              </circle>
            </>
          ) : null}
        </g>
      ))}
    </motion.svg>
  );
}

function DesktopCanvas() {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const reduce = useReducedMotion() ?? false;
  const scale = width ? Math.min(width / W, 1.1) : 1;

  return (
    <div ref={ref} className="relative w-full" style={{ height: H * scale }}>
      <motion.div
        className="absolute left-1/2 top-0"
        style={{ width: W, height: H, x: "-50%", scale, transformOrigin: "top center", transformPerspective: 1600 }}
        initial={reduce ? false : { opacity: 0, rotateX: 10, y: 40 }}
        animate={{ opacity: 1, rotateX: 0, y: 0 }}
        transition={{ duration: 1.4, ease: EASE, delay: 0.5 }}
      >
        <motion.div className="relative h-full w-full" initial={reduce ? false : "hidden"} animate="show">
          <Connectors reduce={reduce} />

          <Card x={355} y={10} w={290} h={34} delay={0.7} frame={false}>
            <ProjectChip />
          </Card>

          <Card x={320} y={130} w={360} h={300} delay={0.8} className="shadow-[0_0_0_1px_rgba(59,130,246,0.12),0_40px_90px_-30px_rgba(59,130,246,0.35)]">
            <RunCard />
          </Card>

          <Card x={40} y={90} w={240} h={150} delay={1.05} float={0}>
            <ArchitectCard />
          </Card>
          <Card x={720} y={70} w={240} h={170} delay={1.15} float={1.4}>
            <CodeCard />
          </Card>
          <Card x={720} y={380} w={240} h={150} delay={1.25} float={0.6}>
            <TestingCard />
          </Card>
          <Card x={40} y={380} w={240} h={150} delay={1.35} float={2.1}>
            <ReviewCard />
          </Card>

          <Card x={320} y={460} w={360} h={110} delay={1.45}>
            <TasksCard />
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Compact (mobile) layout                                             */
/* ------------------------------------------------------------------ */

function VerticalLink() {
  return (
    <div className="mx-auto flex h-7 w-px items-stretch justify-center" aria-hidden>
      <span className="w-px bg-gradient-to-b from-electric/10 via-electric/60 to-electric/10" />
    </div>
  );
}

function CompactCanvas() {
  const reduce = useReducedMotion() ?? false;
  return (
    <motion.div
      className="mx-auto w-full max-w-md"
      initial={reduce ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, ease: EASE, delay: 0.5 }}
    >
      <div className="h-9">
        <ProjectChip />
      </div>
      <VerticalLink />
      <div className="panel hairline-top h-[300px] rounded-xl shadow-[0_0_0_1px_rgba(59,130,246,0.12),0_30px_60px_-30px_rgba(59,130,246,0.35)]">
        <RunCard progressDelay={0.9} />
      </div>
      <VerticalLink />
      <div className="grid gap-3 min-[480px]:grid-cols-2">
        <div className="panel h-[150px] rounded-xl">
          <ArchitectCard />
        </div>
        <div className="panel h-[170px] rounded-xl">
          <CodeCard />
        </div>
        <div className="panel h-[150px] rounded-xl">
          <TestingCard />
        </div>
        <div className="panel h-[150px] rounded-xl">
          <ReviewCard />
        </div>
      </div>
      <VerticalLink />
      <div className="panel h-[110px] rounded-xl">
        <TasksCard />
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */

export function HeroVisual() {
  const isDesktop = useMediaQuery("(min-width: 768px)", true);
  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(59,130,246,0.22),transparent_75%)] blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute right-[8%] top-[65%] h-[40%] w-[30%] rounded-full bg-[radial-gradient(closest-side,rgba(245,158,11,0.14),transparent_75%)] blur-2xl" />
      {isDesktop ? <DesktopCanvas /> : <CompactCanvas />}
    </div>
  );
}
