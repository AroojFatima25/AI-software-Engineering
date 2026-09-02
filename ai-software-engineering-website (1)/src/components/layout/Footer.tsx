import { Container, Logo, StatusDot } from "@/components/ui/primitives";
import { FOOTER_COLUMNS } from "@/data/navigation";

export function Footer() {
  return (
    <footer className="relative border-t border-white/[0.06] bg-ink">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-electric/40 to-transparent" />
      <Container className="py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))] lg:gap-8">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-fog">An AI-powered software engineering workspace.</p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 font-mono text-[11px] tracking-wide text-fog">
              <StatusDot tone="success" pulse />
              All agents operational
            </div>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-fog-2">{column.title}</h3>
              <ul className="mt-5 space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="text-sm text-fog transition-colors duration-300 hover:text-snow">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-white/[0.06] pt-8 text-xs text-fog-2 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} AI-OS. All rights reserved.</p>
          <p className="font-mono tracking-wide">Plan. Build. Test. Review. Ship.</p>
        </div>
      </Container>
    </footer>
  );
}
