import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CheckCircle2, KeyRound, Loader2, MailWarning } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthProvider";
import { FormBanner, PasswordField } from "@/components/auth/fields";
import { Button } from "@/components/ui/Button";
import { EASE } from "@/components/ui/motion";
import { LogoMark } from "@/components/ui/primitives";
import {
  MIN_PASSWORD_LENGTH,
  sendPasswordReset,
  updatePassword,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
  type AuthResult,
} from "@/lib/auth";

/**
 * Protected password-recovery route (`/reset-password`).
 *
 * The user gets here by clicking the link from `resetPasswordForEmail`.
 * Supabase exchanges the link for a short-lived *recovery* session, which
 * `<AuthProvider>` picks up (`PASSWORD_RECOVERY`). With that session in hand
 * `supabase.auth.updateUser({ password })` is allowed.
 *
 * Three states are handled explicitly:
 *   • no session (link expired / used / opened in another browser) → we show
 *     the "request a new link" form rather than a dead form
 *   • valid session → new password + confirm password
 *   • saved → redirect to /workspace
 */
export function ResetPasswordPage() {
  const { ready, isSignedIn, user, linkError, clearLinkError, recoveryMode, clearRecoveryMode, notify } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string | null; confirm?: string | null }>({});
  const [result, setResult] = useState<AuthResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  // supabase-js resolves getSession() only after it has exchanged the `?code=`
  // in the URL, but a recovery session can still land a tick later. Hold the
  // splash briefly so a valid link never flashes the "expired" screen.
  const [grace, setGrace] = useState(true);

  useEffect(() => {
    const id = window.setTimeout(() => setGrace(false), 900);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    document.title = "Reset password — AI-OS";
    return () => {
      document.title = "AI-OS";
    };
  }, []);

  // After a successful save, hand the user over to their workspace.
  useEffect(() => {
    if (!done) return;
    const id = window.setTimeout(() => navigate("/workspace", { replace: true }), 1400);
    return () => window.clearTimeout(id);
  }, [done, navigate]);

  if (!ready || (grace && !isSignedIn && !linkError)) return <Splash />;

  // No session on this route means the recovery link never produced one:
  // expired, already used, or opened in a different browser.
  if (!isSignedIn) {
    return <ExpiredLink message={linkError} onRetryStart={clearLinkError} />;
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const passwordError = validatePassword(password);
    const confirmError = passwordError ? null : validatePasswordConfirmation(password, confirm);
    setErrors({ password: passwordError, confirm: confirmError });
    if (passwordError || confirmError) return;

    setSaving(true);
    setResult(null);
    void updatePassword(password, confirm).then((res) => {
      setResult(res);
      setSaving(false);
      if (res.ok) {
        setDone(true);
        clearRecoveryMode();
        notify("Password updated — you're signed in.", "success");
      }
    });
  };

  return (
    <Shell
      title={recoveryMode ? "Choose a new password" : "Set a new password"}
      subtitle={
        user?.email
          ? `Updating the password for ${user.email}.`
          : "Pick something you don't use anywhere else."
      }
    >
      <form onSubmit={onSubmit} noValidate className="mt-7 space-y-3.5">
        <PasswordField
          label="New password"
          showLabel
          autoFocus
          autoComplete="new-password"
          value={password}
          error={errors.password}
          disabled={saving || done}
          onChange={(e) => {
            setPassword(e.target.value);
            if (errors.password) setErrors((p) => ({ ...p, password: null }));
          }}
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
        />
        <PasswordField
          label="Confirm new password"
          showLabel
          autoComplete="new-password"
          value={confirm}
          error={errors.confirm}
          disabled={saving || done}
          onChange={(e) => {
            setConfirm(e.target.value);
            if (errors.confirm) setErrors((p) => ({ ...p, confirm: null }));
          }}
          placeholder="Re-enter the new password"
        />

        <Button type="submit" className="w-full justify-center" disabled={saving || done}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : done ? <CheckCircle2 className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
          {done ? "Password updated" : "Update password"}
        </Button>
      </form>

      <AnimatePresence mode="wait">
        {result ? (
          <div className="mt-4">
            <FormBanner ok={result.ok}>
              {result.message}
              {result.ok ? " Redirecting to your workspace…" : ""}
            </FormBanner>
          </div>
        ) : null}
      </AnimatePresence>

      <div className="mt-7 flex items-center justify-between text-xs text-fog-2">
        <Link to="/" className="transition hover:text-snow">
          Back to AI-OS
        </Link>
        <Link to="/workspace" className="inline-flex items-center gap-1.5 transition hover:text-snow">
          Skip to workspace <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* Expired / invalid link                                              */
/* ------------------------------------------------------------------ */

function ExpiredLink({ message, onRetryStart }: { message: string | null; onRetryStart: () => void }) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [result, setResult] = useState<AuthResult | null>(null);
  const [sending, setSending] = useState(false);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const err = validateEmail(email);
    setEmailError(err);
    if (err) return;
    onRetryStart();
    setSending(true);
    setResult(null);
    void sendPasswordReset(email).then((res) => {
      setResult(res);
      setSending(false);
    });
  };

  return (
    <Shell
      title="This reset link has expired"
      subtitle={message ?? "Password reset links are single-use and valid for about an hour. Request a fresh one below."}
      tone="warning"
    >
      <form onSubmit={onSubmit} noValidate className="mt-7 space-y-3">
        <div className="space-y-1.5">
          <label htmlFor="reset-email" className="block text-[12.5px] font-medium text-fog">
            Email address
          </label>
          <input
            id="reset-email"
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            aria-invalid={emailError ? true : undefined}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError(null);
            }}
            placeholder="you@company.com"
            className={
              "h-11 w-full rounded-full border bg-ink/60 px-4 text-sm text-snow outline-none transition placeholder:text-fog-2 focus:ring-2 " +
              (emailError ? "border-ember/60 focus:border-ember focus:ring-ember/30" : "border-white/10 focus:border-electric/60 focus:ring-electric/30")
            }
          />
          {emailError ? <p role="alert" className="px-1 text-[12px] text-ember-soft">{emailError}</p> : null}
        </div>

        <Button type="submit" className="w-full justify-center" disabled={sending}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailWarning className="h-4 w-4" />}
          Send a new reset link
        </Button>
      </form>

      <AnimatePresence mode="wait">
        {result ? (
          <div className="mt-4">
            <FormBanner ok={result.ok}>{result.message}</FormBanner>
          </div>
        ) : null}
      </AnimatePresence>

      <p className="mt-7 text-center text-xs text-fog-2">
        <Link to="/" className="text-snow underline-offset-4 hover:underline">
          Back to AI-OS
        </Link>
      </p>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

function Shell({
  title,
  subtitle,
  tone = "electric",
  children,
}: {
  title: string;
  subtitle: string;
  tone?: "electric" | "warning";
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink px-4 py-16 text-snow">
      <div
        className={
          "pointer-events-none absolute left-1/2 top-0 h-72 w-[36rem] -translate-x-1/2 rounded-full blur-3xl " +
          (tone === "warning" ? "bg-ember/15" : "bg-electric/20")
        }
      />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="glass relative w-full max-w-[440px] rounded-2xl p-7 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)] sm:p-8"
      >
        <LogoMark className="h-9 w-9 rounded-[10px]" />
        <h1 className="mt-5 text-xl font-semibold tracking-tight text-snow">{title}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-fog">{subtitle}</p>
        {children}
      </motion.div>
    </div>
  );
}

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink text-snow">
      <div className="flex flex-col items-center gap-4">
        <LogoMark className="h-10 w-10 rounded-xl" />
        <Loader2 className="h-4 w-4 animate-spin text-electric-light" />
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-fog-2">Verifying your link…</p>
      </div>
    </div>
  );
}
