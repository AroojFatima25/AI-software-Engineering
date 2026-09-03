import { useEffect } from "react";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Intelligence } from "@/components/sections/Intelligence";
import { Problem } from "@/components/sections/Problem";
import { Productivity } from "@/components/sections/Productivity";
import { TrustStrip } from "@/components/sections/TrustStrip";

/**
 * Dedicated product overview — previously anchored inside the single landing
 * page (`#product`), now a first-class route at `/product` so it can be
 * linked, deep-linked, and pre-rendered independently.
 */
export function ProductPage() {
  useEffect(() => {
    document.title = "Product — AI-OS";
  }, []);

  return (
    <div className="min-h-screen bg-ink text-snow">
      <Header />
      <main className="pt-16 lg:pt-[68px]">
        <div className="border-b border-white/[0.06] bg-ink-2/40">
          <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-8 sm:py-16">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-electric-light">Product</p>
            <h1 className="mt-3 max-w-3xl text-balance text-[2rem] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[2.75rem] lg:text-[3rem]">
              The engineering workspace your team actually wanted.
            </h1>
            <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-fog sm:text-lg">
              One shared context for requirements, code, tests and reviews — so agents and humans hand off work without losing information.
            </p>
          </div>
        </div>
        <TrustStrip />
        <Problem />
        <Intelligence />
        <Productivity />
      </main>
      <Footer />
    </div>
  );
}
