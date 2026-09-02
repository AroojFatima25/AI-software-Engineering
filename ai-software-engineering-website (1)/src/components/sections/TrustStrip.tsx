import { Reveal } from "@/components/ui/motion";
import { Container } from "@/components/ui/primitives";
import { TRUST_LABELS } from "@/data/navigation";

export function TrustStrip() {
  return (
    <section className="relative border-y border-white/[0.06] bg-ink-2/60">
      <Container className="py-10 sm:py-12">
        <Reveal amount={0.5}>
          <p className="text-center font-mono text-[11px] uppercase tracking-[0.22em] text-fog-2">Built for the next generation of software development</p>
        </Reveal>
        <Reveal delay={0.15} amount={0.5} className="mt-7">
          <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 sm:gap-x-14">
            {TRUST_LABELS.map((label, i) => (
              <li key={label} className="flex items-center gap-10 sm:gap-14">
                <span className="text-[13px] font-medium uppercase tracking-[0.2em] text-fog transition-colors duration-300 hover:text-snow">{label}</span>
                {i < TRUST_LABELS.length - 1 ? <span className="hidden h-1 w-1 rounded-full bg-white/15 sm:block" /> : null}
              </li>
            ))}
          </ul>
        </Reveal>
      </Container>
    </section>
  );
}
