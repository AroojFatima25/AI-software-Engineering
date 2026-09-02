import { Check } from "lucide-react";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import { Button } from "@/components/ui/Button";
import { Stagger, StaggerItem } from "@/components/ui/motion";
import { Chip, Container, Glow, Section, SectionHeading } from "@/components/ui/primitives";
import { PRICING_TIERS } from "@/data/features";
import { cn } from "@/utils/cn";

export function Pricing() {
  const { open } = useAuthModal();
  return (
    <Section id="pricing" className="overflow-hidden">
      <Glow tone="electric" className="left-1/2 top-1/2 h-[30rem] w-[60rem] -translate-x-1/2 -translate-y-1/2 opacity-40" />
      <Container>
        <SectionHeading
          eyebrow="Pricing"
          title="Simple plans for every stage."
          description="Start free while we're in early access. Upgrade when your team is ready to ship together."
        />

        <Stagger className="mt-16 grid gap-4 lg:grid-cols-3" stagger={0.1}>
          {PRICING_TIERS.map((tier) => (
            <StaggerItem key={tier.id} className="h-full">
              <div
                className={cn(
                  "relative flex h-full flex-col rounded-xl border p-7 transition-colors duration-500",
                  tier.highlighted ? "glow-border glow-border-on border-white/[0.12] bg-surface shadow-[0_30px_80px_-40px_rgba(59,130,246,0.5)]" : "border-white/[0.07] bg-surface/50 hover:bg-surface",
                )}
              >
                {tier.highlighted ? (
                  <div aria-hidden className="pointer-events-none absolute inset-0 rounded-xl bg-[radial-gradient(70%_40%_at_50%_0%,rgba(59,130,246,0.14),transparent)]" />
                ) : null}
                <div className="relative flex items-center justify-between">
                  <h3 className="text-[15px] font-semibold tracking-tight text-snow">{tier.name}</h3>
                  {tier.highlighted ? <Chip tone="electric">Most popular</Chip> : tier.id === "developer" ? <Chip tone="fog">Early access</Chip> : null}
                </div>
                <div className="relative mt-5 flex items-end gap-1.5">
                  <span className="text-4xl font-semibold tracking-[-0.03em] text-snow">{tier.price}</span>
                  {tier.period ? <span className="mb-1.5 text-[12.5px] text-fog">{tier.period}</span> : null}
                </div>
                <p className="relative mt-3 text-[13.5px] leading-relaxed text-fog">{tier.description}</p>
                <ul className="relative mt-6 space-y-2.5 border-t border-white/[0.06] pt-6">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[13.5px] text-fog">
                      <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full", tier.highlighted ? "bg-electric/20" : "bg-white/[0.06]")}>
                        <Check className={cn("h-2.5 w-2.5", tier.highlighted ? "text-electric-light" : "text-fog")} strokeWidth={3} />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="relative mt-8 pt-2">
                  <Button variant={tier.highlighted ? "primary" : "secondary"} className="w-full" onClick={() => open("sign-up")}>
                    {tier.cta}
                  </Button>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
        <p className="mt-6 text-center text-[12px] text-fog-2">Prices shown in USD. Early access plans may change before general availability.</p>
      </Container>
    </Section>
  );
}
