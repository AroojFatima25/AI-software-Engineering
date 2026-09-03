import { useEffect } from "react";
import { Mail, MessageCircle } from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Container } from "@/components/ui/primitives";

export function ContactPage() {
  useEffect(() => {
    document.title = "Contact — AI-OS";
  }, []);
  return (
    <div className="min-h-screen bg-ink text-snow">
      <Header />
      <main className="pt-16 lg:pt-[68px]">
        <Container className="py-12 sm:py-16">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-electric-light">Contact</p>
          <h1 className="mt-3 text-[2.5rem] font-semibold tracking-[-0.035em] sm:text-[3rem]">Talk to the team.</h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-fog">Questions about the platform, self-hosting, or enterprise workspace policies? We&apos;d love to hear from you.</p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-white/[0.07] bg-surface/60 p-6">
              <Mail className="h-5 w-5 text-electric-light" />
              <h3 className="mt-3 text-[15px] font-semibold text-snow">Email</h3>
              <p className="mt-1 text-sm text-fog">hello@ai-os.example — we reply within one business day.</p>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-surface/60 p-6">
              <MessageCircle className="h-5 w-5 text-electric-light" />
              <h3 className="mt-3 text-[15px] font-semibold text-snow">GitHub Discussions</h3>
              <p className="mt-1 text-sm text-fog">Open a discussion on the repository for product feedback and roadmap ideas.</p>
            </div>
          </div>
        </Container>
      </main>
      <Footer />
    </div>
  );
}
