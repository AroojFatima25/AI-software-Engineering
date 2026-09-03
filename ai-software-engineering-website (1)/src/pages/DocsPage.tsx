import { useEffect } from "react";
import { Link } from "react-router-dom";
import { BookOpenText, Plug, ShieldCheck } from "lucide-react";
import { GithubIcon } from "@/components/ui/icons";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Container, Glow, SectionHeading } from "@/components/ui/primitives";

/**
 * Documentation landing at `/docs`.
 * Replaces the old `#docs` anchor. Provides an overview of integration,
 * workspace concepts, and links to GitHub / workspace.
 */
export function DocsPage() {
  useEffect(() => {
    document.title = "Docs — AI-OS";
  }, []);

  return (
    <div className="min-h-screen bg-ink text-snow">
      <Header />
      <main className="pt-16 lg:pt-[68px]">
        <div className="relative overflow-hidden border-b border-white/[0.06] bg-ink-2/40">
          <Glow tone="electric" className="left-1/2 top-1/2 h-[28rem] w-[40rem] -translate-x-1/2 -translate-y-1/2 opacity-30" />
          <Container className="relative py-12 sm:py-16">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-electric-light">Documentation</p>
            <h1 className="mt-3 max-w-3xl text-balance text-[2rem] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[2.75rem] lg:text-[3rem]">
              Bring AI-OS into your workflow.
            </h1>
            <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-fog sm:text-lg">
              Connect a repository, define agent policies, and learn how runs, reviews, and project memory work. Every project stays in one workspace with full audit history.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/workspace" className="inline-flex items-center gap-2 rounded-full bg-snow px-5 py-2.5 text-sm font-medium text-ink hover:bg-white">
                Open Workspace
              </Link>
              <a
                href="https://github.com/AroojFatima25/AI-software-Engineering"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-5 py-2.5 text-sm font-medium text-snow hover:bg-white/[0.06]"
              >
                <GithubIcon className="h-4 w-4" /> View on GitHub
              </a>
            </div>
          </Container>
        </div>

        <Container className="py-16 sm:py-20">
          <SectionHeading
            eyebrow="Getting started"
            title="Three steps to your first run."
            description="The workspace is provisioned automatically on sign-up. From there it’s one request per run, with agents handling the handoffs."
            align="left"
            className="max-w-3xl"
          />

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {[
              {
                icon: Plug,
                title: "1. Connect a project",
                body: "Create a project and point it at a GitHub repository. AI-OS tracks the branch and keeps project memory scoped to that repo.",
              },
              {
                icon: BookOpenText,
                title: "2. Describe the work",
                body: "Submit a request in plain English. The manager agent scopes it into requirements, tasks, and stage assignments.",
              },
              {
                icon: ShieldCheck,
                title: "3. Review and approve",
                body: "When the run reaches ready_for_review, inspect the diff, test results and security summary — approve, request changes, or reject.",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-xl border border-white/[0.07] bg-surface/60 p-6">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-electric-light">
                    <Icon className="h-4 w-4" />
                  </span>
                  <h3 className="mt-4 text-[15px] font-semibold tracking-tight text-snow">{item.title}</h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-fog">{item.body}</p>
                </div>
              );
            })}
          </div>

          <div id="github" className="mt-16 rounded-xl border border-white/[0.07] bg-surface/40 p-6 sm:p-8">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-snow">
              <GithubIcon className="h-4 w-4 text-electric-light" /> GitHub integration
            </h3>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-fog">
              AI-OS works alongside your existing repository. Agents read the codebase, propose changes on a dedicated branch, and never push directly to your default branch without an approval recorded through the <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[11px]">submit_approval</code> RPC. RLS policies enforce workspace membership for every read and write.
            </p>
            <p className="mt-4 text-[13px] text-fog-2">
              Enable it in the workspace once per project — no service_role key ever ships to the browser.
            </p>
          </div>
        </Container>
      </main>
      <Footer />
    </div>
  );
}
