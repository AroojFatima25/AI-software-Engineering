import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { EASE } from "@/components/ui/motion";
import { cn } from "@/utils/cn";
import { useWorkspace, type WorkspaceNotice } from "@/hooks/useWorkspace";

/* ------------------------------------------------------------------ */
/* Badges                                                              */
/* ------------------------------------------------------------------ */

export type BadgeTone = "fog" | "electric" | "ember" | "success" | "danger";

const BADGE_TONES: Record<BadgeTone, string> = {
  fog: "border-white/10 bg-white/[0.04] text-fog",
  electric: "border-electric/30 bg-electric/10 text-electric-light",
  ember: "border-ember/30 bg-ember/10 text-ember-soft",
  success: "border-success/30 bg-success/10 text-success",
  danger: "border-danger/30 bg-danger/10 text-danger",
};

const DOT_TONES: Record<BadgeTone, string> = {
  fog: "bg-fog-2",
  electric: "bg-electric",
  ember: "bg-ember",
  success: "bg-success",
  danger: "bg-danger",
};

export function Badge({
  tone = "fog",
  pulse = false,
  children,
  className,
  title,
}: {
  tone?: BadgeTone;
  pulse?: boolean;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] whitespace-nowrap",
        BADGE_TONES[tone],
        className,
      )}
    >
      {pulse ? (
        <span className="relative inline-flex h-1.5 w-1.5">
          <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-70", DOT_TONES[tone])} />
          <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", DOT_TONES[tone])} />
        </span>
      ) : null}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Card / panel wrappers                                               */
/* ------------------------------------------------------------------ */

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("panel hairline-top rounded-xl", className)}>{children}</div>;
}

export function PanelHeading({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3.5 sm:px-5">
      <h3 className="text-sm font-semibold tracking-[-0.01em] text-snow">{title}</h3>
      {right}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Notices (success / error toasts inside the workspace)               */
/* ------------------------------------------------------------------ */

const NOTICE_STYLES: Record<WorkspaceNotice["tone"], { dot: string; box: string }> = {
  success: { dot: "bg-success", box: "border-success/25 bg-success/[0.06]" },
  error: { dot: "bg-danger", box: "border-danger/25 bg-danger/[0.06]" },
  info: { dot: "bg-electric", box: "border-electric/25 bg-electric/[0.06]" },
};

export function NoticeList({ className }: { className?: string }) {
  const { notices, dismissNotice } = useWorkspace();
  if (!notices.length) return null;
  return (
    <div className={cn("pointer-events-none fixed right-4 top-20 z-[90] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2", className)} aria-live="polite">
      <AnimatePresence>
        {notices.map((n) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: EASE }}
            className={cn("pointer-events-auto glass flex items-start gap-2.5 rounded-xl px-3.5 py-3 shadow-[0_18px_50px_-16px_rgba(0,0,0,0.85)]", NOTICE_STYLES[n.tone].box)}
          >
            <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", NOTICE_STYLES[n.tone].dot)} />
            <p className="flex-1 text-[13px] leading-snug text-snow">{n.text}</p>
            <button
              onClick={() => dismissNotice(n.id)}
              aria-label="Dismiss"
              className="rounded-full p-0.5 text-fog-2 transition hover:bg-white/5 hover:text-snow"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modal shell                                                         */
/* ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <button aria-label="Close dialog" className="absolute inset-0 bg-ink/70 backdrop-blur-md" onClick={onClose} />
          <motion.div
            className={cn(
              "glass relative w-full rounded-t-2xl p-6 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)] sm:rounded-2xl sm:p-7",
              wide ? "max-w-[640px]" : "max-w-[440px]",
            )}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <div className="pointer-events-none absolute -top-20 left-1/2 h-40 w-64 -translate-x-1/2 rounded-full bg-electric/20 blur-3xl" />
            <button
              onClick={onClose}
              className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-fog transition hover:bg-white/5 hover:text-snow"
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </button>
            <h2 className="pr-8 text-lg font-semibold tracking-tight text-snow">{title}</h2>
            {subtitle ? <p className="mt-1 text-[13px] leading-relaxed text-fog">{subtitle}</p> : null}
            <div className="mt-5 max-h-[72vh] overflow-y-auto pr-1">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/* Empty / loading states                                              */
/* ------------------------------------------------------------------ */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("panel hairline-top flex flex-col items-center rounded-xl px-6 py-12 text-center", className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-fog">{icon}</div>
      <h3 className="mt-4 text-[15px] font-semibold tracking-[-0.01em] text-snow">{title}</h3>
      {description ? <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-fog">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="panel hairline-top flex flex-col items-center rounded-xl px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-danger/25 bg-danger/10 text-danger">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-[15px] font-semibold tracking-[-0.01em] text-snow">Couldn't load the workspace</h3>
      <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-fog">{message}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="panel hairline-top space-y-3 rounded-xl px-5 py-5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-white/[0.05]" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/5 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-2.5 w-4/5 animate-pulse rounded bg-white/[0.04]" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tiny shared bits                                                    */
/* ------------------------------------------------------------------ */

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-fog-2">
        {label}
        {hint ? <em className="font-normal normal-case tracking-normal text-fog-2/70">{hint}</em> : null}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  "h-11 w-full rounded-xl border border-white/10 bg-ink/60 px-3.5 text-sm text-snow placeholder:text-fog-2/70 transition focus:border-electric/60 focus:ring-2 focus:ring-electric/25";

export const textareaClass =
  "w-full resize-y rounded-xl border border-white/10 bg-ink/60 px-3.5 py-3 text-sm leading-relaxed text-snow placeholder:text-fog-2/70 transition focus:border-electric/60 focus:ring-2 focus:ring-electric/25";
