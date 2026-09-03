import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/utils/cn";
import { Reveal } from "./motion";

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

export function Container({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto w-full max-w-[1200px] px-5 sm:px-8", className)} {...props} />;
}

interface SectionProps extends HTMLAttributes<HTMLElement> {
  id?: string;
  children: ReactNode;
}

export function Section({ className, children, ...props }: SectionProps) {
  return (
    <section className={cn("relative scroll-mt-16 py-24 sm:py-32 lg:py-40", className)} {...props}>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Typography                                                          */
/* ------------------------------------------------------------------ */

export function Eyebrow({ children, className, tone = "electric" }: { children: ReactNode; className?: string; tone?: "electric" | "ember" | "fog" }) {
  const dot = tone === "electric" ? "bg-electric" : tone === "ember" ? "bg-ember" : "bg-fog";
  const text = tone === "electric" ? "text-electric-light" : tone === "ember" ? "text-ember-soft" : "text-fog";
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.22em]", text, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", dot, tone === "electric" && "animate-pulse-ring")} />
      {children}
    </span>
  );
}

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
  tone?: "electric" | "ember" | "fog";
  titleClassName?: string;
}

export function SectionHeading({ eyebrow, title, description, align = "center", className, tone, titleClassName }: SectionHeadingProps) {
  return (
    <Reveal className={cn("max-w-3xl", align === "center" ? "mx-auto text-center" : "text-left", className)}>
      {eyebrow ? <Eyebrow tone={tone} className="mb-5">{eyebrow}</Eyebrow> : null}
      <h2
        className={cn(
          "text-gradient text-balance text-[2rem] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-[2.75rem] lg:text-[3.35rem]",
          titleClassName,
        )}
      >
        {title}
      </h2>
      {description ? (
        <p className={cn("mt-5 text-pretty text-base leading-relaxed text-fog sm:text-lg", align === "center" && "mx-auto max-w-2xl")}>{description}</p>
      ) : null}
    </Reveal>
  );
}

/* ------------------------------------------------------------------ */
/* Brand                                                               */
/* ------------------------------------------------------------------ */

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex h-7 w-7 items-center justify-center rounded-[8px] border border-white/10 bg-gradient-to-b from-white/[0.10] to-white/[0.02] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
        <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="2" className="text-snow" />
        <circle cx="17.5" cy="6.5" r="2.4" className="fill-electric" />
      </svg>
      <span className="absolute -inset-px rounded-[8px] bg-electric/20 opacity-0 blur-md transition-opacity duration-500 group-hover/logo:opacity-100" />
    </span>
  );
}

export function Logo({ className, wordmarkClassName }: { className?: string; wordmarkClassName?: string }) {
  return (
    <a href="/" className={cn("group/logo inline-flex items-center gap-2.5", className)} aria-label="AI-OS home">
      <LogoMark />
      <span className={cn("text-[15px] font-semibold tracking-[-0.02em] text-snow", wordmarkClassName)}>AI-OS</span>
    </a>
  );
}

/* ------------------------------------------------------------------ */
/* Lighting                                                            */
/* ------------------------------------------------------------------ */

interface GlowProps {
  className?: string;
  tone?: "electric" | "ember" | "white";
  drift?: boolean | "reverse";
}

export function Glow({ className, tone = "electric", drift = false }: GlowProps) {
  const color =
    tone === "electric"
      ? "bg-[radial-gradient(closest-side,rgba(59,130,246,0.42),rgba(59,130,246,0.12)_45%,transparent_75%)]"
      : tone === "ember"
        ? "bg-[radial-gradient(closest-side,rgba(245,158,11,0.28),rgba(245,158,11,0.08)_45%,transparent_75%)]"
        : "bg-[radial-gradient(closest-side,rgba(255,255,255,0.12),transparent_70%)]";
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute rounded-full will-change-transform",
        color,
        drift === true && "animate-drift",
        drift === "reverse" && "animate-drift-reverse",
        className,
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Status                                                              */
/* ------------------------------------------------------------------ */

type DotTone = "electric" | "ember" | "success" | "fog";

export function StatusDot({ tone = "electric", pulse = false, className }: { tone?: DotTone; pulse?: boolean; className?: string }) {
  const bg = { electric: "bg-electric", ember: "bg-ember", success: "bg-success", fog: "bg-fog-2" }[tone];
  return (
    <span className={cn("relative inline-flex h-2 w-2 shrink-0", className)}>
      {pulse ? <span className={cn("absolute inset-0 rounded-full opacity-60 animate-ping", bg)} style={{ animationDuration: "2.2s" }} /> : null}
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", bg)} />
    </span>
  );
}

export function Chip({ children, className, tone = "fog" }: { children: ReactNode; className?: string; tone?: DotTone }) {
  const styles = {
    electric: "border-electric/30 bg-electric/10 text-electric-light",
    ember: "border-ember/30 bg-ember/10 text-ember-soft",
    success: "border-success/30 bg-success/10 text-success",
    fog: "border-white/10 bg-white/[0.04] text-fog",
  }[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.14em]", styles, className)}>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Window frame for product mockups                                    */
/* ------------------------------------------------------------------ */

interface WindowProps {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function Window({ title, right, children, className, bodyClassName }: WindowProps) {
  return (
    <div className={cn("panel hairline-top overflow-hidden rounded-xl shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]", className)}>
      {title !== undefined ? (
        <div className="flex h-10 items-center justify-between border-b border-white/[0.07] px-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-white/10" />
            <span className="h-2 w-2 rounded-full bg-white/10" />
            <span className="ml-2 font-mono text-[11px] tracking-wide text-fog-2">{title}</span>
          </div>
          {right}
        </div>
      ) : null}
      <div className={cn("relative", bodyClassName)}>{children}</div>
    </div>
  );
}
