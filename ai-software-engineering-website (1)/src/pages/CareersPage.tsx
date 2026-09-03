import { useEffect } from "react";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Container } from "@/components/ui/primitives";

export function CareersPage() {
  useEffect(() => {
    document.title = "Careers — AI-OS";
  }, []);
  return (
    <div className="min-h-screen bg-ink text-snow">
      <Header />
      <main className="pt-16 lg:pt-[68px]">
        <Container className="py-12 sm:py-16">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-electric-light">Careers</p>
          <h1 className="mt-3 text-[2.5rem] font-semibold tracking-[-0.035em] sm:text-[3rem]">Build the engineering OS.</h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-fog">We&apos;re a small team building the workspace where humans and AI agents ship software together. No formal openings right now — but we&apos;re always open to conversations.</p>
          <div className="mt-10 rounded-xl border border-white/[0.07] bg-surface/60 p-6">
            <p className="text-sm text-fog">Send a short note and relevant work to <span className="text-snow">careers@ai-os.example</span>. We read every message.</p>
          </div>
        </Container>
      </main>
      <Footer />
    </div>
  );
}
