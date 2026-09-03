import { useEffect } from "react";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { HumanInTheLoop } from "@/components/sections/HumanInTheLoop";
import { RunExperience } from "@/components/sections/RunExperience";

/**
 * Standalone workflow page at `/how-it-works`.
 * Previously three anchored sections on `/` — now a dedicated route with its
 * own document title and deep-linkable URL.
 */
export function HowItWorksPage() {
  useEffect(() => {
    document.title = "How It Works — AI-OS";
  }, []);

  return (
    <div className="min-h-screen bg-ink text-snow">
      <Header />
      <main className="pt-16 lg:pt-[68px]">
        <div className="border-b border-white/[0.06] bg-ink-2/40">
          <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-8 sm:py-16">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-electric-light">How it works</p>
            <h1 className="mt-3 max-w-3xl text-balance text-[2rem] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[2.75rem] lg:text-[3rem]">
              Describe it. The agents do the rest — you stay in control.
            </h1>
            <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-fog sm:text-lg">
              Every request becomes a run: plan, code, test, and review stages run autonomously and pause for your approval before any destructive action.
            </p>
          </div>
        </div>
        <HowItWorks />
        <RunExperience />
        <HumanInTheLoop />
      </main>
      <Footer />
    </div>
  );
}
