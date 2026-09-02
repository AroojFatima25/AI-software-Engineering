import { ArrowRight } from "lucide-react";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/motion";
import { Container, Eyebrow, Glow } from "@/components/ui/primitives";

export function FinalCTA() {
  const { open } = useAuthModal();
  return (
    <section id="cta" className="relative scroll-mt-16 overflow-hidden py-32 sm:py-40 lg:py-48">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="bg-grid absolute inset-0 mask-radial opacity-60" />
        <Glow tone="electric" drift className="left-1/2 top-[55%] h-[36rem] w-[70rem] -translate-x-1/2 -translate-y-1/2 opacity-90" />
        <Glow tone="ember" drift="reverse" className="right-[-8rem] top-[20%] h-[24rem] w-[30rem] opacity-70" />
        {/* Horizon */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-electric/60 to-transparent" />
        <div className="absolute inset-x-[15%] bottom-0 h-40 bg-[radial-gradient(60%_100%_at_50%_100%,rgba(59,130,246,0.25),transparent)]" />
      </div>

      <Container className="relative">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <Reveal>
            <Eyebrow>Get started</Eyebrow>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="text-gradient mt-6 text-balance text-[2.4rem] font-semibold leading-[1.04] tracking-[-0.04em] sm:text-6xl lg:text-[4.5rem]">
              Build your next software project with an AI engineering team.
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-7 max-w-2xl text-pretty text-base leading-relaxed text-fog sm:text-lg">
              From first idea to reviewed code, AI-OS brings intelligent software engineering into one workspace.
            </p>
          </Reveal>
          <Reveal delay={0.3} className="mt-10 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
            <Button size="lg" className="w-full sm:w-auto" onClick={() => open("sign-up")}>
              Start Building
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-0.5" />
            </Button>
            <Button size="lg" variant="secondary" className="w-full sm:w-auto" href="#agents">
              Explore AI Agents
            </Button>
          </Reveal>
          <Reveal delay={0.4}>
            <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.22em] text-fog-2">Your AI Engineering Team. One Intelligent Workspace.</p>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
