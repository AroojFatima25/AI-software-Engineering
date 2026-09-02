import { motion } from "framer-motion";
import { Reveal, Stagger, StaggerItem } from "@/components/ui/motion";
import { Container, Glow, Section, SectionHeading } from "@/components/ui/primitives";
import { PROBLEM_AREAS } from "@/data/features";

export function Problem() {
  return (
    <Section className="overflow-hidden">
      <Container>
        <SectionHeading
          eyebrow="The problem"
          tone="ember"
          title="Software development shouldn't mean managing everything yourself."
          description="Modern developers constantly move between contexts. Every switch loses information, breaks focus, and slows the work that matters."
        />

        <Stagger className="mt-16 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" stagger={0.06}>
          {PROBLEM_AREAS.map((area, i) => {
            const Icon = area.icon;
            return (
              <StaggerItem key={area.id}>
                <motion.div
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.35 }}
                  className="glow-border group relative h-full rounded-xl border border-white/[0.07] bg-surface/80 p-6 transition-colors duration-500 hover:bg-surface-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-fog transition-colors duration-500 group-hover:border-electric/40 group-hover:text-electric-light">
                      <Icon className="h-4 w-4" strokeWidth={1.6} />
                    </span>
                    <span className="font-mono text-[10.5px] text-fog-2">{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="mt-5 text-[15px] font-semibold tracking-tight text-snow">{area.title}</h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-fog">{area.description}</p>
                </motion.div>
              </StaggerItem>
            );
          })}
        </Stagger>

        {/* Transition */}
        <div className="relative mt-24 flex flex-col items-center text-center sm:mt-28">
          <Glow tone="electric" className="top-10 h-56 w-[36rem] opacity-70" />
          <div className="relative h-24 w-px overflow-hidden bg-white/[0.06]">
            <span className="absolute inset-x-0 h-1/2 bg-gradient-to-b from-transparent via-electric to-transparent animate-beam" />
          </div>
          <Reveal className="relative mt-8 max-w-3xl">
            <p className="text-balance text-2xl font-medium leading-snug tracking-[-0.03em] text-snow sm:text-3xl lg:text-[2.35rem]">
              AI-OS brings the engineering workflow into <span className="text-gradient-electric animate-shimmer">one intelligent workspace.</span>
            </p>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}
