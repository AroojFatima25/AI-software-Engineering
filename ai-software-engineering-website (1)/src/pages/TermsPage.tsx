import { useEffect } from "react";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Container } from "@/components/ui/primitives";

export function TermsPage() {
  useEffect(() => {
    document.title = "Terms — AI-OS";
  }, []);
  return (
    <div className="min-h-screen bg-ink text-snow">
      <Header />
      <main className="pt-16 lg:pt-[68px]">
        <Container className="py-12 sm:py-16">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-electric-light">Legal</p>
          <h1 className="mt-3 text-[2.5rem] font-semibold tracking-[-0.035em] sm:text-[3rem]">Terms</h1>
          <div className="mt-8 max-w-3xl space-y-4 text-[14px] leading-relaxed text-fog">
            <p>By using AI-OS you agree that AI-generated proposals are suggestions that require human review. Destructive actions and merges are gated behind the approval RPC and never executed silently by agents.</p>
            <p>You retain ownership of your repositories and workspace data. The platform is provided as-is for demonstration and iteration — see the repository license for details.</p>
            <p>This is a demo terms placeholder for the multi-page marketing site. Replace with your actual terms before production.</p>
          </div>
        </Container>
      </main>
      <Footer />
    </div>
  );
}
