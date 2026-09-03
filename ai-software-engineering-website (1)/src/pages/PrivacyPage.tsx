import { useEffect } from "react";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Container } from "@/components/ui/primitives";

export function PrivacyPage() {
  useEffect(() => {
    document.title = "Privacy — AI-OS";
  }, []);
  return (
    <div className="min-h-screen bg-ink text-snow">
      <Header />
      <main className="pt-16 lg:pt-[68px]">
        <Container className="py-12 sm:py-16">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-electric-light">Legal</p>
          <h1 className="mt-3 text-[2.5rem] font-semibold tracking-[-0.035em] sm:text-[3rem]">Privacy</h1>
          <div className="mt-8 max-w-3xl space-y-4 text-[14px] leading-relaxed text-fog">
            <p>AI-OS uses Supabase Auth for authentication. Sessions are stored in the browser with PKCE and refreshed automatically. We don&apos;t ship a service_role key to the client — all data access is enforced by Postgres RLS policies through the anon key.</p>
            <p>Workspace data is scoped to your memberships. Agents write runs, stages, tasks, and proposed changes; you write projects and run requests. No other client-side writes are permitted.</p>
            <p>This is a demo privacy placeholder for the multi-page marketing site. Replace with your actual policy before production.</p>
          </div>
        </Container>
      </main>
      <Footer />
    </div>
  );
}
