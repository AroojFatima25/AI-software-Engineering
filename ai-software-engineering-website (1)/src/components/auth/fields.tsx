import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { useId, useState, type InputHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

/**
 * Shared form controls for every auth surface (modal, reset page, account
 * settings) so validation copy, focus rings and error styling stay identical.
 */

const inputBase =
  "h-11 w-full rounded-full border bg-ink/60 px-4 text-sm text-snow placeholder:text-fog-2 transition outline-none focus:ring-2 disabled:opacity-60";
const inputOk = "border-white/10 focus:border-electric/60 focus:ring-electric/30";
const inputBad = "border-ember/60 focus:border-ember focus:ring-ember/30";

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {
  label: string;
  /** Validation message; when present the field renders in its error state. */
  error?: string | null;
  /** Show the label above the input instead of visually hiding it. */
  showLabel?: boolean;
  className?: string;
}

export function TextField({ label, error, showLabel = false, className, id, ...rest }: FieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={inputId} className={showLabel ? "block text-[12.5px] font-medium text-fog" : "sr-only"}>
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(inputBase, error ? inputBad : inputOk)}
        {...rest}
      />
      <FieldError id={errorId} message={error} />
    </div>
  );
}

/** Password input with a show/hide toggle. */
export function PasswordField({ label, error, showLabel = false, className, id, ...rest }: FieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  const [visible, setVisible] = useState(false);
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={inputId} className={showLabel ? "block text-[12.5px] font-medium text-fog" : "sr-only"}>
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(inputBase, "pr-11", error ? inputBad : inputOk)}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-fog-2 transition hover:bg-white/5 hover:text-snow"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <FieldError id={errorId} message={error} />
    </div>
  );
}

export function FieldError({ id, message }: { id?: string; message?: string | null }) {
  return (
    <AnimatePresence initial={false}>
      {message ? (
        <motion.p
          id={id}
          key={message}
          role="alert"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="flex items-start gap-1.5 px-1 text-[12px] leading-snug text-ember-soft"
        >
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>{message}</span>
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
}

/** Full-width success/error banner for a submitted form's outcome. */
export function FormBanner({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      role={ok ? "status" : "alert"}
      className={cn(
        "rounded-lg border px-3 py-2 text-[13px] leading-snug",
        ok ? "border-success/30 bg-success/10 text-success" : "border-ember/30 bg-ember/10 text-ember-soft",
      )}
    >
      {children}
    </motion.p>
  );
}
