import { useEffect } from "react";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Container } from "@/components/ui/primitives";

export function BlogPage() {
  useEffect(() => {
    document.title = "Blog — AI-OS";
  }, []);
  return (
    <div className="min-h-screen bg-ink text-snow">
      <Header />
      <main className="pt-16 lg:pt-[68px]">
        <Container className="py-12 sm:py-16">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-electric-light">Blog</p>
          <h1 className="mt-3 text-[2.5rem] font-semibold tracking-[-0.035em] sm:text-[3rem]">Updates from the workspace.</h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-fog">Product notes, agent design write-ups, and engineering workflow learnings. The full blog lives on the site — this route keeps the footer link from 404ing on the multi-page build.</p>
          <div className="mt-10 space-y-4">
            {[
              { date: "2026-09-01", title: "Why every AI run should be reviewable", excerpt: "If agents propose and humans approve, you get speed without losing control." },
              { date: "2026-08-24", title: "Shared context beats prompt chains", excerpt: "Project memory is the difference between a model that writes code and a team that ships." },
            ].map((post) => (
              <article key={post.title} className="rounded-xl border border-white/[0.07] bg-surface/60 p-6">
                <p className="font-mono text-[11px] tracking-wide text-fog-2">{post.date}</p>
                <h3 className="mt-2 text-base font-semibold text-snow">{post.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-fog">{post.excerpt}</p>
              </article>
            ))}
          </div>
        </Container>
      </main>
      <Footer />
    </div>
  );
}
