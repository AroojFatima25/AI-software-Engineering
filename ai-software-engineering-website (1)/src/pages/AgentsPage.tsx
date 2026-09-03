import { useEffect } from "react";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Agents } from "@/components/sections/Agents";
import { WorkspacePreview } from "@/components/sections/WorkspacePreview";

/**
 * Agents catalogue at `/agents`.
 * Previously an anchored section (`#agents`) on the monolithic landing page.
 */
export function AgentsPage() {
  useEffect(() => {
    document.title = "AI Agents — AI-OS";
  }, []);

  return (
    <div className="min-h-screen bg-ink text-snow">
      <Header />
      <main className="pt-16 lg:pt-[68px]">
        <div className="border-b border-white/[0.06] bg-ink-2/40">
          <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-8 sm:py-16">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ember-soft">AI agents</p>
            <h1 className="mt-3 max-w-3xl text-balance text-[2rem] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[2.75rem] lg:text-[3rem]">
              Eight specialists. One team.
            </h1>
            <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-fog sm:text-lg">
              Each agent has a clear role and hands off structured output to the next — just like a well-run engineering team.
            </p>
          </div>
        </div>
        <Agents />
        <WorkspacePreview />
      </main>
      <Footer />
    </div>
  );
}
