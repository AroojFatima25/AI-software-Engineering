import { ArrowRight } from "lucide-react";
import { Fragment } from "react";
import { Reveal, Stagger, StaggerItem } from "@/components/ui/motion";
import { Chip, Container, Glow, Section, SectionHeading, StatusDot } from "@/components/ui/primitives";
import { AIOS_FLOW, PRODUCTIVITY_POINTS, TRADITIONAL_FLOW } from "@/data/features";
import { cn } from "@/utils/cn";

function FlowChip({ label, tone }: { label: string; tone: "muted" | "electric" | "snow" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1.5 text-[12.5px] font-medium tracking-tight sm:px-3.5 sm:text-[13px]",
        tone === "muted" && "border-dashed border-white/15 bg-transparent text-fog",
        tone === "snow" && "border-white/15 bg-white/[0.05] text-snow",
        tone === "electric" && "border-electric/50 bg-electric/10 text-electric-light shadow-[0_0_20px_-6px_rgba(59,130,246,0.7)]",
      )}
    >
      {label}
    </span>
  );
}

export function Productivity() {
  return (
    <Section className="overflow-hidden">
      <Glow tone="electric" className="right-[-10rem] top-1/2 h-[36rem] w-[36rem] -translate-y-1/2 opacity-40" />
      <Container>
        <SectionHeading
          eyebrow="Productivity"
          title="Stop switching between tools. Start engineering."
          description="AI-OS brings the software engineering workflow into one workspace — so the context you build up while planning is the same context used to code, test, and review."
        />

        <div className="mt-16 grid gap-4 lg:grid-cols-2">
          {/* Traditional */}
          <Reveal>
            <div className="relative h-full rounded-xl border border-white/[0.07] bg-surface/50 p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-semibold tracking-tight text-fog">Traditional workflow</h3>
                <Chip tone="fog">8 contexts</Chip>
              </div>
              <p className="mt-2 text-[13px] text-fog-2">Every arrow is a tool switch, a copy-paste, or a lost detail.</p>
              <div className="mt-7 flex flex-wrap items-center gap-x-2 gap-y-3">
                {TRADITIONAL_FLOW.map((step, i) => (
                  <Fragment key={step}>
                    <FlowChip label={step} tone={i === 0 ? "snow" : "muted"} />
                    {i < TRADITIONAL_FLOW.length - 1 ? <ArrowRight className="h-3.5 w-3.5 shrink-0 text-fog-2/60" /> : null}
                  </Fragment>
                ))}
              </div>
              <div className="mt-8 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-6 text-[12px] text-fog-2">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em]">Context</p>
                  <p className="mt-1 text-fog">Scattered</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em]">Handoffs</p>
                  <p className="mt-1 text-fog">Manual</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em]">Review</p>
                  <p className="mt-1 text-fog">When time allows</p>
                </div>
              </div>
            </div>
          </Reveal>

          {/* AI-OS */}
          <Reveal delay={0.12}>
            <div className="glow-border glow-border-on relative h-full overflow-hidden rounded-xl border border-white/[0.1] bg-surface p-6 sm:p-8">
              <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_50%_at_50%_0%,rgba(59,130,246,0.14),transparent)]" />
              <div className="relative flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-snow">
                  <StatusDot pulse /> AI-OS
                </h3>
                <Chip tone="electric">1 workspace</Chip>
              </div>
              <p className="relative mt-2 text-[13px] text-fog">One idea in, one reviewed change out. The agents handle the handoffs.</p>
              <div className="relative mt-7 flex flex-wrap items-center gap-x-2 gap-y-3">
                {AIOS_FLOW.map((step, i) => (
                  <Fragment key={step}>
                    <FlowChip label={step} tone={i === 0 ? "snow" : i === 1 ? "electric" : "snow"} />
                    {i < AIOS_FLOW.length - 1 ? <ArrowRight className={cn("h-3.5 w-3.5 shrink-0", i === 0 ? "text-electric-light" : "text-electric/70")} /> : null}
                  </Fragment>
                ))}
              </div>
              <div className="relative mt-8 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-6 text-[12px]">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-fog-2">Context</p>
                  <p className="mt-1 text-snow">Shared</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-fog-2">Handoffs</p>
                  <p className="mt-1 text-snow">Automatic</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-fog-2">Review</p>
                  <p className="mt-1 text-snow">Every change</p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>

        <Stagger className="mt-6 grid gap-4 md:grid-cols-3" stagger={0.08}>
          {PRODUCTIVITY_POINTS.map((pt) => {
            const Icon = pt.icon;
            return (
              <StaggerItem key={pt.title}>
                <div className="flex h-full gap-4 rounded-xl border border-white/[0.07] bg-surface/50 p-5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-electric-light">
                    <Icon className="h-4 w-4" strokeWidth={1.6} />
                  </span>
                  <div>
                    <h4 className="text-[14.5px] font-semibold tracking-tight text-snow">{pt.title}</h4>
                    <p className="mt-1 text-[13px] leading-relaxed text-fog">{pt.description}</p>
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>
      </Container>
    </Section>
  );
}
