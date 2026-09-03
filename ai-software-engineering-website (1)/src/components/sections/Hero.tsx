import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import { Button } from "@/components/ui/Button";
import { EASE, TextReveal } from "@/components/ui/motion";
import { Container, Eyebrow, Glow } from "@/components/ui/primitives";
import { HeroVisual } from "./HeroVisual";

export function Hero() {
  const { open } = useAuthModal();
  const reduce = useReducedMotion();
  const fade = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.9, ease: EASE, delay },
  });

  return (
    <section id="product" className="relative overflow-hidden pt-32 sm:pt-40 lg:pt-44">
      {/* Atmosphere */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="bg-grid absolute inset-0 mask-radial opacity-70" />
        <Glow tone="electric" drift className="left-1/2 top-[-12rem] h-[34rem] w-[60rem] -translate-x-1/2 sm:h-[40rem] sm:w-[80rem]" />
        <Glow tone="ember" drift="reverse" className="right-[-10rem] top-[24rem] h-[26rem] w-[36rem] opacity-80" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      </div>

      <Container className="relative">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <motion.div {...fade(0.15)}>
            <Eyebrow>Open AI Software Engineering Platform</Eyebrow>
          </motion.div>

          <TextReveal
            as="h1"
            text="Build Software With an AI Engineering Team"
            delay={0.3}
            className="mt-7 text-balance text-[2.65rem] font-semibold leading-[1.02] tracking-[-0.045em] text-snow sm:text-6xl md:text-7xl lg:text-[5.4rem]"
            wordClassName="text-gradient"
          />

          <motion.p {...fade(0.9)} className="mt-7 max-w-2xl text-pretty text-base leading-relaxed text-fog sm:text-lg lg:text-[1.2rem] lg:leading-relaxed">
            Turn ideas into production-ready software with specialized AI agents that plan, architect, code, test, review, and document your
            projects.
          </motion.p>

          <motion.div {...fade(1.05)} className="mt-9 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
            <Button size="lg" className="w-full sm:w-auto" onClick={() => open("sign-up")}>
              Start Building
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-0.5" />
            </Button>
            <Button size="lg" variant="secondary" className="w-full sm:w-auto" href="/how-it-works">
              <Play className="h-3.5 w-3.5 fill-current" />
              See How It Works
            </Button>
          </motion.div>

          <motion.p {...fade(1.2)} className="mt-6 font-mono text-[11px] uppercase tracking-[0.22em] text-fog-2">
            Free to use · Sign up and start building
          </motion.p>
        </div>

        <div className="relative mt-16 sm:mt-20 lg:mt-24">
          <HeroVisual />
        </div>
      </Container>

      {/* Fade into the next section */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-ink" />
    </section>
  );
}
