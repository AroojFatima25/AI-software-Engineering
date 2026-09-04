import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, Loader2, Mail, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthProvider";
import { FormBanner, PasswordField, TextField } from "@/components/auth/fields";
import { PasswordSettingsDialog } from "@/components/auth/PasswordSettingsDialog";
import { Button } from "@/components/ui/Button";
import { GithubIcon, GoogleIcon } from "@/components/ui/icons";
import { EASE } from "@/components/ui/motion";
import { LogoMark } from "@/components/ui/primitives";
import {
  MIN_PASSWORD_LENGTH,
  sendMagicLink,
  sendPasswordReset,
  signInWithPassword,
  signInWithProvider,
  signUpWithPassword,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
  type AuthResult,
  type OAuthProvider,
} from "@/lib/auth";

/**
 * The single sign-in surface for the marketing site.
 *
 * Modes:
 *   "sign-in"  → email + password, with a "Send a magic link instead" escape
 *                hatch and a "Forgot password?" link
 *   "sign-up"  → email + password + confirm password
 *   "forgot"   → email only, sends a reset link to /reset-password
 *
 * OAuth (Google / GitHub) sits above all of them and is unchanged.
 */

type Mode = "sign-in" | "sign-up" | "forgot";

interface AuthModalContextValue {
  open: (mode?: Mode) => void;
  close: () => void;
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error("useAuthModal must be used within AuthModalProvider");
  return ctx;
}

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const { isSignedIn } = useAuth();

  const open = useCallback((m: Mode = "sign-up") => setMode(m), []);
  const close = useCallback(() => setMode(null), []);
  const value = useMemo(() => ({ open, close }), [open, close]);

  useEffect(() => {
    if (!mode) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [mode, close]);

  // If the magic link (or OAuth) completes while the dialog is open, dismiss it.
  useEffect(() => {
    if (isSignedIn) setMode(null);
  }, [isSignedIn]);

  return (
    <AuthModalContext.Provider value={value}>
      {children}
      <AnimatePresence>{mode ? <AuthDialog mode={mode} onClose={close} onSwitch={setMode} /> : null}</AnimatePresence>
    </AuthModalContext.Provider>
  );
}

interface Errors {
  email?: string | null;
  password?: string | null;
  confirm?: string | null;
}

function AuthDialog({ mode, onClose, onSwitch }: { mode: Mode; onClose: () => void; onSwitch: (m: Mode) => void }) {
  const { isSignedIn, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState<string | null>(null);
  const [result, setResult] = useState<AuthResult | null>(null);
  const [passwordSettings, setPasswordSettings] = useState(false);

  // Switching modes should never carry stale validation errors across.
  useEffect(() => {
    setErrors({});
    setResult(null);
    setConfirm("");
  }, [mode]);

  const run = async (key: string, fn: () => Promise<AuthResult>) => {
    setPending(key);
    setResult(null);
    const res = await fn();
    setResult(res);
    setPending(null);
    return res;
  };

  const isSignUp = mode === "sign-up";
  const isForgot = mode === "forgot";

  /** Field-level validation before we ever hit the network. */
  const validate = (): boolean => {
    const next: Errors = { email: validateEmail(email) };
    if (!isForgot) {
      next.password = validatePassword(password, { requireStrong: isSignUp });
    }
    if (isSignUp) {
      next.confirm = next.password ? null : validatePasswordConfirmation(password, confirm);
    }
    setErrors(next);
    return !next.email && !next.password && !next.confirm;
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (isForgot) {
      void run("forgot", () => sendPasswordReset(email));
      return;
    }
    if (isSignUp) {
      void run("submit", async () => {
        const res = await signUpWithPassword(email, password);
        // With email confirmation off, sign-up returns a live session — send
        // the new user straight into their workspace.
        if (res.ok && !res.needsEmailConfirmation) goToWorkspace();
        return res;
      });
      return;
    }
    void run("submit", async () => {
      const res = await signInWithPassword(email, password);
      if (res.ok) goToWorkspace();
      return res;
    });
  };

  /** Password sign-in doesn't go through a redirect, so route explicitly. */
  const goToWorkspace = () => {
    onClose();
    navigate("/workspace");
  };

  const onMagicLink = () => {
    const emailError = validateEmail(email);
    setErrors({ email: emailError });
    if (emailError) return;
    void run("magic", () => sendMagicLink(email));
  };

  const provider = (p: OAuthProvider) => () => void run(p, () => signInWithProvider(p));

  // Already authenticated: swap the form for a compact account panel so every
  // entry point (header, hero, CTA) stays honest without a second sign-in flow.
  if (isSignedIn) {
    if (passwordSettings) return <PasswordSettingsDialog onClose={() => setPasswordSettings(false)} />;
    return (
      <Shell onClose={onClose} title="You're signed in" subtitle="Your AI engineering team is ready when you are.">
        <div className="mt-6 rounded-xl border border-success/25 bg-success/[0.07] px-4 py-3.5">
          <p className="flex items-center gap-2 text-sm font-medium text-snow">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
            <span className="truncate" title={user?.email ?? undefined}>{user?.email}</span>
          </p>
          <p className="mt-1.5 text-[13px] leading-snug text-fog">
            Stay signed in on this device — you'll come straight back here next time.
          </p>
        </div>
        <div className="mt-6 grid gap-2.5">
          <Button className="w-full justify-center" href="/workspace" onClick={onClose}>
            Open your workspace
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button variant="secondary" className="w-full justify-center" onClick={() => setPasswordSettings(true)}>
            <KeyRound className="h-4 w-4" />
            Set or change password
          </Button>
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="ghost" className="w-full justify-center" onClick={onClose}>
              Back to site
            </Button>
            <Button variant="secondary" className="w-full justify-center" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </Shell>
    );
  }

  /* ---------------------------- Forgot password --------------------------- */

  if (isForgot) {
    return (
      <Shell onClose={onClose} title="Reset your password" subtitle="We'll email you a link to choose a new password.">
        <form onSubmit={onSubmit} noValidate className="mt-6 space-y-3">
          <TextField
            label="Email address"
            showLabel
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            error={errors.email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((p) => ({ ...p, email: null }));
            }}
            placeholder="you@company.com"
          />
          <Button type="submit" className="w-full justify-center" disabled={pending !== null}>
            {pending === "forgot" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Send reset link
          </Button>
        </form>

        <AnimatePresence mode="wait">{result ? <div className="mt-4"><FormBanner ok={result.ok}>{result.message}</FormBanner></div> : null}</AnimatePresence>

        <button
          type="button"
          onClick={() => onSwitch("sign-in")}
          className="mt-6 inline-flex w-full items-center justify-center gap-1.5 text-xs text-fog-2 transition hover:text-snow"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </button>
      </Shell>
    );
  }

  /* ------------------------- Sign in / sign up ---------------------------- */

  return (
    <Shell
      onClose={onClose}
      title={isSignUp ? "Create your free workspace" : "Sign in to AI-OS"}
      subtitle={
        isSignUp
          ? "Open to everyone. Choose a password, or use a magic link instead."
          : "Welcome back. Use your password, a magic link, or Google."
      }
    >
      <div className="mt-6 grid gap-2.5">
        <Button variant="secondary" className="w-full justify-center" onClick={provider("github")} disabled={pending !== null}>
          {pending === "github" ? <Loader2 className="h-4 w-4 animate-spin" /> : <GithubIcon className="h-4 w-4" />}
          Continue with GitHub
        </Button>
        <Button variant="secondary" className="w-full justify-center" onClick={provider("google")} disabled={pending !== null}>
          {pending === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon className="h-4 w-4" />}
          Continue with Google
        </Button>
      </div>

      <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-fog-2">
        <span className="h-px flex-1 bg-white/10" />
        or
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-3">
        <TextField
          label="Email address"
          type="email"
          autoComplete="email"
          value={email}
          error={errors.email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errors.email) setErrors((p) => ({ ...p, email: null }));
          }}
          placeholder="you@company.com"
        />

        <PasswordField
          label="Password"
          autoComplete={isSignUp ? "new-password" : "current-password"}
          value={password}
          error={errors.password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (errors.password) setErrors((p) => ({ ...p, password: null }));
          }}
          placeholder={isSignUp ? `At least ${MIN_PASSWORD_LENGTH} characters` : "Your password"}
        />

        {isSignUp ? (
          <PasswordField
            label="Confirm password"
            autoComplete="new-password"
            value={confirm}
            error={errors.confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              if (errors.confirm) setErrors((p) => ({ ...p, confirm: null }));
            }}
            placeholder="Re-enter your password"
          />
        ) : null}

        {!isSignUp ? (
          <div className="flex justify-end">
            <button type="button" onClick={() => onSwitch("forgot")} className="px-1 text-xs text-fog transition hover:text-snow">
              Forgot password?
            </button>
          </div>
        ) : null}

        <Button type="submit" className="w-full justify-center" disabled={pending !== null}>
          {pending === "submit" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isSignUp ? "Create account" : "Sign in"}
          <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
        </Button>
      </form>

      <button
        type="button"
        onClick={onMagicLink}
        disabled={pending !== null}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full py-2 text-[13px] text-fog transition hover:text-snow disabled:opacity-50"
      >
        {pending === "magic" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
        Email me a magic link instead
      </button>

      <AnimatePresence mode="wait">
        {result ? (
          <div className="mt-4">
            <FormBanner ok={result.ok}>{result.message}</FormBanner>
          </div>
        ) : null}
      </AnimatePresence>

      <p className="mt-6 text-center text-xs text-fog-2">
        {isSignUp ? "Already have a workspace?" : "New to AI-OS?"}{" "}
        <button type="button" onClick={() => onSwitch(isSignUp ? "sign-in" : "sign-up")} className="text-snow underline-offset-4 hover:underline">
          {isSignUp ? "Sign in" : "Get started"}
        </button>
      </p>
    </Shell>
  );
}

function Shell({ onClose, title, subtitle, children }: { onClose: () => void; title: string; subtitle: string; children: ReactNode }) {
  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto sm:items-center sm:py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-title"
    >
      <button aria-label="Close" className="absolute inset-0 bg-ink/70 backdrop-blur-md" onClick={onClose} />
      <motion.div
        className="glass relative my-auto w-full max-w-[420px] rounded-t-2xl p-7 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)] sm:rounded-2xl sm:p-8"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-electric/25 blur-3xl" />
        <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-1.5 text-fog transition hover:bg-white/5 hover:text-snow" aria-label="Close dialog">
          <X className="h-4 w-4" />
        </button>

        <div className="relative">
          <LogoMark className="h-9 w-9 rounded-[10px]" />
          <h2 id="auth-title" className="mt-5 text-xl font-semibold tracking-tight text-snow">
            {title}
          </h2>
          <p className="mt-1.5 text-sm text-fog">{subtitle}</p>
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}
