import { useEffect } from "react";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Features } from "@/components/sections/Features";
import { TrustStrip } from "@/components/sections/TrustStrip";

/**
 * Feature grid at `/features`.
 * Split out from the single-page landing so each marketing concern has its own URL.
 */
export function FeaturesPage() {
  useEffect(() => {
    document.title = "Features — AI-OS";
  }, []);

  return (
    <div className="min-h-screen bg-ink text-snow">
      <Header />
      <main className="pt-16 lg:pt-[68px]">
        <div className="border-b border-white/[0.06] bg-ink-2/40">
          <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-8 sm:py-16">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-electric-light">Features</p>
            <h1 className="mt-3 max-w-3xl text-balance text-[2rem] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[2.75rem] lg:text-[3rem]">
              Everything an engineering workflow needs.
            </h1>
            <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-fog sm:text-lg">
              From first requirement to final approval, every capability lives in the same workspace — planning, code, tests, reviews, and project memory.
            </p>
          </div>
        </div>
        <Features />
        <TrustStrip />
      </main>
      <Footer />
    </div>
  );
}
