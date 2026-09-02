import { ArrowRight, BookOpenText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Reveal, Stagger, StaggerItem } from "@/components/ui/motion";
import { Container, Glow, Section, SectionHeading } from "@/components/ui/primitives";
import { GithubIcon } from "@/components/ui/icons";
import { FEATURES } from "@/data/features";

export function Features() {
  return (
    <Section id="features" className="overflow-hidden">
      <Container>
        <SectionHeading
          eyebrow="Features"
          title="Everything an engineering workflow needs."
          description="From the first requirement to the final approval, each capability is built into the same workspace."
        />

        <Stagger className="mt-16 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-4" stagger={0.04}>
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <StaggerItem key={f.id} className="h-full">
                <div className="group relative h-full bg-ink p-6 transition-colors duration-500 hover:bg-surface-2">
                  <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(59,130,246,0.10),transparent)] opacity-0 transition-opacity duration-700 group-hover:opacity-100" />
                  <span className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-fog transition-colors duration-500 group-hover:border-electric/40 group-hover:text-electric-light">
                    <Icon className="h-4 w-4" strokeWidth={1.6} />
                  </span>
                  <h3 className="relative mt-5 text-[15px] font-semibold tracking-tight text-snow">{f.title}</h3>
                  <p className="relative mt-1.5 text-[13px] leading-relaxed text-fog">{f.description}</p>
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>
      </Container>

      {/* Docs strip */}
      <Container id="docs" className="relative mt-20 scroll-mt-28 lg:mt-24">
        <Glow tone="electric" className="left-1/2 top-1/2 h-[16rem] w-[40rem] -translate-x-1/2 -translate-y-1/2 opacity-40" />
        <Reveal>
          <div className="glass hairline-top relative flex flex-col gap-6 overflow-hidden rounded-xl p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
                <BookOpenText className="h-[18px] w-[18px] text-electric-light" strokeWidth={1.6} />
              </span>
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-snow">Documentation & GitHub integration</h3>
                <p className="mt-1 max-w-xl text-[13.5px] leading-relaxed text-fog">
                  Connect a repository, define agent policies, and learn how runs, reviews, and project memory work. Everything you need to bring AI-OS into your existing workflow.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <Button variant="secondary" href="#github">
                <GithubIcon className="h-4 w-4" />
                Connect GitHub
              </Button>
              <Button href="#docs">
                Read the docs
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-0.5" />
              </Button>
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
