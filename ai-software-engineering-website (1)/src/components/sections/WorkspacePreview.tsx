import { motion, useInView, type Variants } from "framer-motion";
import {
  Bell,
  Bot,
  Check,
  ChevronRight,
  Circle,
  FolderKanban,
  GitBranch,
  LayoutDashboard,
  ListChecks,
  Play,
  ScanSearch,
  Search,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { useRef } from "react";
import { EASE } from "@/components/ui/motion";
import { Chip, Container, Glow, LogoMark, Section, SectionHeading, StatusDot } from "@/components/ui/primitives";
import { MOCK_PROJECT, SIDEBAR_ITEMS } from "@/data/mock";
import { cn } from "@/utils/cn";

const SIDEBAR_ICONS: Record<(typeof SIDEBAR_ITEMS)[number], LucideIcon> = {
  Dashboard: LayoutDashboard,
  Projects: FolderKanban,
  Tasks: ListChecks,
  "AI Agents": Bot,
  Repository: GitBranch,
  Runs: Play,
  Reviews: ScanSearch,
  Settings: Settings,
};

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.2 } } };
const item: Variants = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } } };

export function WorkspacePreview() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.25 });
  const p = MOCK_PROJECT;

  return (
    <Section id="workspace" className="overflow-hidden pb-0 sm:pb-0 lg:pb-0">
      <Container>
        <SectionHeading
          eyebrow="The workspace"
          title="Every project, every agent, one workspace."
          description="Track what your AI engineering team is doing, what is finished, and what is waiting on you."
        />
      </Container>

      <div className="relative mt-16 lg:mt-20">
        <Glow tone="electric" className="left-1/2 top-0 h-[30rem] w-[70rem] -translate-x-1/2 opacity-70" />
        <Container>
          <motion.div
            ref={ref}
            variants={container}
            initial="hidden"
            animate={inView ? "show" : "hidden"}
            className="panel hairline-top relative overflow-hidden rounded-t-xl border-b-0 shadow-[0_-20px_80px_-30px_rgba(59,130,246,0.35)]"
          >
            {/* Top bar */}
            <div className="flex h-12 items-center justify-between border-b border-white/[0.06] px-4">
              <div className="flex items-center gap-3">
                <LogoMark className="h-6 w-6 rounded-[6px]" />
                <span className="hidden font-mono text-[11px] text-fog-2 sm:inline">open-dev</span>
                <ChevronRight className="hidden h-3 w-3 text-fog-2 sm:inline" />
                <span className="font-mono text-[11px] text-fog">{p.slug}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden h-7 items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 text-[11px] text-fog-2 md:flex">
                  <Search className="h-3 w-3" />
                  Search or run a command
                  <kbd className="ml-4 rounded border border-white/10 px-1 font-mono text-[9px]">⌘K</kbd>
                </div>
                <Bell className="h-3.5 w-3.5 text-fog-2" />
                <span className="h-6 w-6 rounded-full bg-gradient-to-br from-electric to-electric-deep" />
              </div>
            </div>

            <div className="flex">
              {/* Sidebar */}
              <aside className="hidden w-52 shrink-0 border-r border-white/[0.06] p-3 md:block">
                <nav className="space-y-0.5">
                  {SIDEBAR_ITEMS.map((label) => {
                    const Icon = SIDEBAR_ICONS[label];
                    const active = label === "Projects";
                    return (
                      <motion.a
                        key={label}
                        variants={item}
                        href="/workspace"
                        className={cn(
                          "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12.5px] transition-colors",
                          active ? "bg-white/[0.06] text-snow" : "text-fog hover:bg-white/[0.03] hover:text-snow",
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" strokeWidth={1.7} />
                        {label}
                        {label === "Reviews" ? <span className="ml-auto rounded-full bg-ember/20 px-1.5 font-mono text-[9.5px] text-ember-soft">1</span> : null}
                        {label === "Runs" ? <StatusDot pulse className="ml-auto" /> : null}
                      </motion.a>
                    );
                  })}
                </nav>
                <div className="mt-6 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-fog-2">Current run</p>
                  <p className="mt-1.5 text-[11.5px] leading-snug text-snow">{p.currentRun}</p>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <motion.div className="h-full bg-electric" initial={{ width: 0 }} animate={inView ? { width: "58%" } : {}} transition={{ duration: 1.4, ease: EASE, delay: 0.8 }} />
                  </div>
                </div>
              </aside>

              {/* Main */}
              <div className="min-w-0 flex-1 p-4 sm:p-6">
                {/* Mobile nav strip */}
                <div className="no-scrollbar -mx-4 mb-4 flex gap-1 overflow-x-auto px-4 md:hidden">
                  {SIDEBAR_ITEMS.map((label) => (
                    <span key={label} className={cn("shrink-0 rounded-full border px-3 py-1 text-[11px]", label === "Projects" ? "border-white/15 bg-white/[0.06] text-snow" : "border-white/[0.06] text-fog")}>
                      {label}
                    </span>
                  ))}
                </div>

                <motion.div variants={item} className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2 font-mono text-[10.5px] text-fog-2">
                      Projects <ChevronRight className="h-3 w-3" /> <span className="text-fog">{p.name}</span>
                    </div>
                    <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-snow sm:text-2xl">{p.name}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Chip tone="electric">
                        <StatusDot pulse /> Run in progress
                      </Chip>
                      <span className="flex items-center gap-1.5 font-mono text-[10.5px] text-fog-2">
                        <GitBranch className="h-3 w-3" /> {p.branch}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <span className="rounded-full border border-white/10 px-3.5 py-1.5 text-[12px] font-medium text-fog">Open repository</span>
                    <span className="rounded-full bg-snow px-3.5 py-1.5 text-[12px] font-medium text-ink">New run</span>
                  </div>
                </motion.div>

                {/* Stats */}
                <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <motion.div variants={item} className="col-span-2 rounded-lg border border-white/[0.07] bg-white/[0.02] p-4 lg:col-span-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-fog-2">Project progress</span>
                    </div>
                    <div className="mt-2 flex items-end gap-2">
                      <span className="text-3xl font-semibold tracking-tight text-snow">{p.progress}%</span>
                      <span className="mb-1.5 text-[11px] text-fog">
                        {p.tasksDone}/{p.tasksTotal} tasks
                      </span>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-electric-deep via-electric to-electric-light"
                        initial={{ width: 0 }}
                        animate={inView ? { width: `${p.progress}%` } : {}}
                        transition={{ duration: 1.6, ease: EASE, delay: 0.6 }}
                      />
                    </div>
                  </motion.div>
                  {[
                    ["Active agents", `${p.activeAgents.filter((a) => a.status === "active").length}`, "of 8 available"],
                    ["Tests", `${p.testsPassed}`, "passed · 0 failed"],
                    ["Open reviews", `${p.openReviews}`, "awaiting you"],
                  ].map(([k, v, s]) => (
                    <motion.div key={k} variants={item} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-4">
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-fog-2">{k}</span>
                      <div className="mt-2 text-3xl font-semibold tracking-tight text-snow">{v}</div>
                      <div className="mt-1 text-[11px] text-fog">{s}</div>
                    </motion.div>
                  ))}
                </div>

                {/* Agents + activity */}
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <motion.div variants={item} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-fog-2">Active AI agents</span>
                      <span className="text-[11px] text-fog-2">live</span>
                    </div>
                    <ul className="mt-3 divide-y divide-white/[0.05]">
                      {p.activeAgents.map((a) => {
                        const active = a.status === "active";
                        return (
                          <li key={a.id} className="flex items-center gap-3 py-2.5">
                            <StatusDot tone={active ? "electric" : "fog"} pulse={active} />
                            <span className="text-[13px] font-medium text-snow">{a.name}</span>
                            <span className="mx-1 text-fog-2">—</span>
                            <span className={cn("truncate text-[12.5px]", active ? "text-fog" : "text-fog-2")}>{a.task}</span>
                            {active ? (
                              <span className="ml-auto flex gap-0.5">
                                {[0, 1, 2].map((d) => (
                                  <span key={d} className="h-1 w-1 rounded-full bg-electric/70 animate-pulse" style={{ animationDelay: `${d * 0.2}s` }} />
                                ))}
                              </span>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </motion.div>

                  <motion.div variants={item} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-fog-2">Recent activity</span>
                      <span className="text-[11px] text-fog-2">run #128</span>
                    </div>
                    <ul className="mt-3 space-y-2.5">
                      {p.activity.map((a) => (
                        <li key={a.id} className="flex items-center gap-3 text-[12.5px]">
                          {a.state === "done" ? (
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-success/15">
                              <Check className="h-2.5 w-2.5 text-success" strokeWidth={3} />
                            </span>
                          ) : a.state === "active" ? (
                            <span className="flex h-4 w-4 items-center justify-center">
                              <StatusDot pulse />
                            </span>
                          ) : (
                            <Circle className="h-4 w-4 p-0.5 text-fog-2/60" strokeWidth={1.5} />
                          )}
                          <span className={cn(a.state === "done" ? "text-fog" : a.state === "active" ? "text-snow" : "text-fog-2")}>{a.label}</span>
                          {a.timestamp ? <span className="ml-auto font-mono text-[10px] text-fog-2">{a.timestamp}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                </div>

                {/* Log */}
                <motion.div variants={item} className="mt-3 hidden overflow-hidden rounded-lg border border-white/[0.07] bg-black/40 sm:block">
                  <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2 font-mono text-[10px] text-fog-2">
                    <StatusDot pulse />
                    run log · streaming
                  </div>
                  <div className="space-y-1 p-3 font-mono text-[11px] leading-relaxed">
                    {p.log.map((line, i) => (
                      <motion.div
                        key={line}
                        initial={{ opacity: 0, x: -6 }}
                        animate={inView ? { opacity: 1, x: 0 } : {}}
                        transition={{ delay: 1 + i * 0.25, duration: 0.4 }}
                        className={cn("whitespace-pre text-fog", i === p.log.length - 1 && "text-fog-2")}
                      >
                        <span className="mr-3 text-fog-2/60">{String(i + 1).padStart(2, "0")}</span>
                        {line}
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </Container>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-ink to-transparent" />
      </div>
    </Section>
  );
}
