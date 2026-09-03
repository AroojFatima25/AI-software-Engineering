import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Loader2, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { GithubIcon, GoogleIcon } from "@/components/ui/icons";
import { EASE } from "@/components/ui/motion";
import { LogoMark } from "@/components/ui/primitives";
import { sendMagicLink, signInWithProvider, type AuthResult, type OAuthProvider } from "@/lib/auth";
import { cn } from "@/utils/cn";

type Mode = "sign-in" | "sign-up";

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

function AuthDialog({ mode, onClose, onSwitch }: { mode: Mode; onClose: () => void; onSwitch: (m: Mode) => void }) {
  const { isSignedIn, user, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [result, setResult] = useState<AuthResult | null>(null);

  const run = async (key: string, fn: () => Promise<AuthResult>) => {
    setPending(key);
    setResult(null);
    const res = await fn();
    setResult(res);
    setPending(null);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void run("email", () => sendMagicLink(email));
  };

  const provider = (p: OAuthProvider) => () => void run(p, () => signInWithProvider(p));
  const isSignUp = mode === "sign-up";

  // Already authenticated: swap the form for a compact account panel so every
  // entry point (header, hero, CTA) stays honest without a second sign-in flow.
  if (isSignedIn) {
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

  return (
    <Shell
      onClose={onClose}
      title={isSignUp ? "Create your free workspace" : "Sign in to AI-OS"}
      subtitle={isSignUp ? "Open to everyone. We'll email you a secure link — no password." : "Welcome back. We'll email you a magic link."}
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

      <form onSubmit={onSubmit} className="space-y-2.5">
        <label className="sr-only" htmlFor="auth-email">
          Work email
        </label>
        <input
          id="auth-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="h-11 w-full rounded-full border border-white/10 bg-ink/60 px-4 text-sm text-snow placeholder:text-fog-2 transition focus:border-electric/60 focus:ring-2 focus:ring-electric/30"
        />
        <Button type="submit" className="w-full justify-center" disabled={pending !== null}>
          {pending === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isSignUp ? "Continue with email" : "Send magic link"}
          <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
        </Button>
      </form>

      <AnimatePresence mode="wait">
        {result ? (
          <motion.p
            key={result.message}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cn("mt-4 rounded-lg border px-3 py-2 text-[13px] leading-snug", result.ok ? "border-success/30 bg-success/10 text-success" : "border-ember/30 bg-ember/10 text-ember-soft")}
          >
            {result.message}
            {result.ok ? " Check your inbox, then come back — you'll be signed in." : ""}
          </motion.p>
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
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
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
        className="glass relative w-full max-w-[420px] rounded-t-2xl p-7 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)] sm:rounded-2xl sm:p-8"
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
