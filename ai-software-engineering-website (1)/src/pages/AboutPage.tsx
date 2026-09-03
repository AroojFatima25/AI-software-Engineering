import { useEffect } from "react";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Container, Glow } from "@/components/ui/primitives";

export function AboutPage() {
  useEffect(() => {
    document.title = "About — AI-OS";
  }, []);
  return (
    <div className="min-h-screen bg-ink text-snow">
      <Header />
      <main className="pt-16 lg:pt-[68px]">
        <div className="relative overflow-hidden border-b border-white/[0.06] bg-ink-2/40">
          <Glow tone="electric" className="right-0 top-0 h-[24rem] w-[24rem] opacity-30" />
          <Container className="relative py-12 sm:py-16">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-electric-light">Company</p>
            <h1 className="mt-3 max-w-3xl text-balance text-[2.5rem] font-semibold tracking-[-0.035em] sm:text-[3rem]">An open platform for AI software engineering.</h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-fog">
              AI-OS is an open, human-in-the-loop workspace where specialized AI agents plan, build, test and review software alongside you — with every change proposed, not pushed.
            </p>
          </Container>
        </div>
        <Container className="py-16 sm:py-20">
          <div className="mx-auto max-w-3xl space-y-6 text-[15px] leading-relaxed text-fog">
            <p>We started AI-OS because the way software gets built hasn&apos;t kept up with the models that write it. Teams juggle PRDs, repos, CI, and chat threads — and every handoff loses context. AI-OS keeps planning, architecture, implementation, testing, review and documentation in one shared workspace so agents and humans speak the same language.</p>
            <p>The workspace is backed by Supabase Postgres with row-level security, real-time project memory, and an explicit approval gate for any destructive action. Agents are autonomous, but you are always in control: every diff, test run and security check waits for your review before it lands.</p>
            <p>AI-OS is open by design — anyone can sign up, create a workspace, and invite the team. No pricing walls, no hidden service keys in the bundle.</p>
          </div>
        </Container>
      </main>
      <Footer />
    </div>
  );
}
