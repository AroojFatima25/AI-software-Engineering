import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { Stagger, StaggerItem } from "@/components/ui/motion";
import { Container, Glow, Section, SectionHeading, StatusDot } from "@/components/ui/primitives";
import { AGENTS, STATUS_META } from "@/data/agents";
import type { Agent } from "@/types";
import { cn } from "@/utils/cn";

function AgentCard({ agent, index }: { agent: Agent; index: number }) {
  const Icon = agent.icon;
  const status = STATUS_META[agent.status];
  const dotTone = agent.status === "active" ? "electric" : agent.status === "reviewing" ? "ember" : agent.status === "done" ? "success" : "fog";
  const pulse = agent.status === "active" || agent.status === "reviewing";

  return (
    <motion.article
      tabIndex={0}
      aria-label={`${agent.name}: ${agent.role}`}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.35 }}
      className="glow-border group relative flex h-[280px] flex-col overflow-hidden rounded-xl border border-white/[0.07] bg-surface/80 p-6 outline-none transition-colors duration-500 hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-electric/60 lg:h-[304px]"
    >
      {/* Default state */}
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-snow transition-colors duration-500 group-hover:border-electric/40 group-hover:text-electric-light group-focus-within:border-electric/40">
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.6} />
        </span>
        <span className="font-mono text-[10.5px] text-fog-2">{String(index + 1).padStart(2, "0")}</span>
      </div>

      <div className="mt-auto transition-all duration-500 group-hover:-translate-y-2 group-hover:opacity-0 group-focus-within:-translate-y-2 group-focus-within:opacity-0">
        <div className="flex items-center gap-2">
          <StatusDot tone={dotTone} pulse={pulse} />
          <span className={cn("font-mono text-[10px] uppercase tracking-[0.18em]", status.text)}>{status.label}</span>
        </div>
        <h3 className="mt-2.5 text-[17px] font-semibold tracking-tight text-snow">{agent.name}</h3>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-fog">{agent.role}</p>
      </div>

      {/* Hover state */}
      <div className="absolute inset-x-0 bottom-0 translate-y-4 bg-gradient-to-t from-surface-2 via-surface-2/95 to-surface-2/0 p-6 pt-10 opacity-0 transition-all duration-500 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-semibold tracking-tight text-snow">{agent.name}</h3>
          <span className={cn("flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em]", status.text)}>
            <StatusDot tone={dotTone} pulse={pulse} />
            {status.label}
          </span>
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-fog">
          <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-fog-2">Purpose · </span>
          {agent.purpose}
        </p>
        <div className="mt-3 rounded-lg border border-white/[0.07] bg-black/40 px-3 py-2.5">
          <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-fog-2">Example task</p>
          <p className="mt-1 font-mono text-[11px] leading-relaxed text-electric-light">{agent.exampleTask}</p>
        </div>
      </div>

      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-electric/10 opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-100" />
    </motion.article>
  );
}

export function Agents() {
  return (
    <Section id="agents" className="overflow-hidden">
      <Glow tone="ember" className="right-[-16rem] top-0 h-[36rem] w-[36rem] opacity-50" />
      <Container>
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            align="left"
            eyebrow="AI agents"
            title="Meet your AI engineering team."
            description="Eight specialised agents, each with a clear role. They hand work to one another the way a well-run engineering team does."
            className="lg:max-w-2xl"
          />
          <a href="/workspace" className="group inline-flex items-center gap-2 self-start text-sm text-fog transition-colors hover:text-snow lg:self-end">
            See them in the workspace
            <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </a>
        </div>

        <Stagger className="mt-14 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" stagger={0.06}>
          {AGENTS.map((agent, i) => (
            <StaggerItem key={agent.id}>
              <AgentCard agent={agent} index={i} />
            </StaggerItem>
          ))}
        </Stagger>

        <p className="mt-6 text-center text-[12px] text-fog-2">Hover or focus an agent to see its purpose, live status, and an example task.</p>
      </Container>
    </Section>
  );
}
