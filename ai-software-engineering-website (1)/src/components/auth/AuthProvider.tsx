import type { Session, User } from "@supabase/supabase-js";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { EASE } from "@/components/ui/motion";
import { describeRedirectError, signOut as supabaseSignOut } from "@/lib/auth";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Supabase session handling for the whole app.
 *
 * - Restores the persisted session on load (users stay signed in across
 *   visits — supabase-js keeps it in localStorage and refreshes the token).
 * - Completes the magic-link / OAuth / password-recovery round trips:
 *   Supabase bounces the user back with `?code=...` (PKCE) or a `#access_token`
 *   fragment; `detectSessionInUrl` exchanges it for a session, then we scrub
 *   the URL so refreshes don't re-trigger the flow.
 * - Broadcasts sign-in/sign-out through `useAuth()`.
 * - Routes the user: completing the magic-link / OAuth / password sign-in
 *   round trip lands on the protected `/workspace` dashboard; a recovery link
 *   lands on `/reset-password` instead and stays there until the new password
 *   is saved. Signing out (or an expired session) from a protected route
 *   returns to the public landing page.
 */

interface AuthContextValue {
  /** False until the initial session check finished (prevents UI flicker). */
  ready: boolean;
  /** True when the VITE_SUPABASE_* env vars are present. */
  configured: boolean;
  session: Session | null;
  user: User | null;
  isSignedIn: boolean;
  /**
   * True while the current session came from a password-recovery link. The
   * `/reset-password` page uses it to know the user arrived legitimately, and
   * clears it once the new password is saved.
   */
  recoveryMode: boolean;
  clearRecoveryMode: () => void;
  /**
   * Error copy from a failed/expired auth link (`?error=...`), consumed by the
   * `/reset-password` page so it can explain what went wrong.
   */
  linkError: string | null;
  clearLinkError: () => void;
  /** Push a toast from anywhere in the app. */
  notify: (text: string, tone?: "success" | "info" | "error") => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

/** Query params Supabase appends when it redirects back after an email link. */
const REDIRECT_PARAMS = ["code", "state", "error", "error_code", "error_description", "type", "token_hash"] as const;

/** Fragment params used by the legacy (implicit) flow and by error bounces. */
const HASH_PARAMS = ["access_token", "refresh_token", "expires_in", "expires_at", "token_type", "type", "error", "error_code", "error_description"] as const;

/** Routes that require a session; signing out from one bounces to "/". */
const PROTECTED_PATHS = ["/workspace", "/reset-password"];

type Notice = { id: number; text: string; tone: "success" | "info" | "error" };

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [session, setSession] = useState<AuthContextValue["session"]>(null);
  const [ready, setReady] = useState(!configured);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // True while the page was loaded directly from an auth redirect, so we only
  // toast "signed in" for the actual round trip, not for token refreshes.
  const completingRedirect = useRef(false);
  const signedOutOnPurpose = useRef(false);
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

  const notify = useCallback((text: string, tone: Notice["tone"] = "info") => {
    setNotice({ id: Date.now(), text, tone });
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

    const hasQueryRedirect = REDIRECT_PARAMS.some((key) => params.has(key));
    const hasHashRedirect = HASH_PARAMS.some((key) => hash.has(key));
    completingRedirect.current = hasQueryRedirect || hasHashRedirect;

    const errorCode = params.get("error_code") ?? hash.get("error_code") ?? params.get("error") ?? hash.get("error");
    const errorDescription = params.get("error_description") ?? hash.get("error_description");
    const linkFailed = Boolean(errorCode);

    // Supabase marks recovery links with `type=recovery`; PKCE links only carry
    // `?code=`, so we also treat a landing on /reset-password as recovery.
    const linkType = params.get("type") ?? hash.get("type");
    const arrivedForRecovery =
      linkType === "recovery" || (window.location.pathname === "/reset-password" && completingRedirect.current);
    if (arrivedForRecovery && !linkFailed) setRecoveryMode(true);

    if (completingRedirect.current) {
      REDIRECT_PARAMS.forEach((key) => params.delete(key));
      const query = params.toString();
      const keepHash = hasHashRedirect ? "" : window.location.hash;
      window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}${keepHash}`);
    }

    if (linkFailed) {
      completingRedirect.current = false;
      const text = describeRedirectError(errorCode, errorDescription);
      setLinkError(text);
      notify(text, "error");
    }

    // getSession() resolves the restored (persisted) session so users stay
    // signed in across visits; onAuthStateChange keeps it fresh afterwards.
    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession ?? null);
      setReady(true);

      if (event === "PASSWORD_RECOVERY") {
        completingRedirect.current = false;
        setRecoveryMode(true);
        setLinkError(null);
        if (pathRef.current !== "/reset-password") navigate("/reset-password", { replace: true });
        return;
      }

      if (event === "SIGNED_IN" && completingRedirect.current) {
        completingRedirect.current = false;
        // A recovery link must land on the reset form, not the dashboard.
        if (arrivedForRecovery || pathRef.current === "/reset-password") {
          setRecoveryMode(true);
          if (pathRef.current !== "/reset-password") navigate("/reset-password", { replace: true });
          return;
        }
        const email = nextSession?.user.email;
        notify(email ? `Signed in as ${email}. Welcome to AI-OS.` : "Signed in. Welcome to AI-OS.", "success");
        // The magic-link / OAuth round trip means the user's intent was to get
        // into their workspace — drop them on the protected dashboard.
        if (pathRef.current !== "/workspace") navigate("/workspace");
      }

      if (event === "SIGNED_OUT") {
        setRecoveryMode(false);
        notify(
          signedOutOnPurpose.current
            ? "Signed out. Your workspace will be here when you're back."
            : "Your session expired — sign in again to continue.",
          signedOutOnPurpose.current ? "info" : "error",
        );
        signedOutOnPurpose.current = false;
        if (PROTECTED_PATHS.includes(pathRef.current)) navigate("/", { replace: true });
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setReady(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    signedOutOnPurpose.current = true;
    await supabaseSignOut();
    setSession(null);
    setRecoveryMode(false);
  }, []);

  const clearRecoveryMode = useCallback(() => setRecoveryMode(false), []);
  const clearLinkError = useCallback(() => setLinkError(null), []);

  // Auto-dismiss toasts.
  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 8000);
    return () => window.clearTimeout(id);
  }, [notice]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      configured,
      session,
      user: session?.user ?? null,
      isSignedIn: Boolean(session),
      recoveryMode,
      clearRecoveryMode,
      linkError,
      clearLinkError,
      notify,
      signOut,
    }),
    [ready, configured, session, recoveryMode, clearRecoveryMode, linkError, clearLinkError, notify, signOut],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}

      <AnimatePresence>
        {notice ? (
          <motion.div
            key={notice.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.4, ease: EASE }}
            role="status"
            aria-live="polite"
            className="fixed bottom-5 left-1/2 z-[110] -translate-x-1/2 px-4 sm:bottom-8"
          >
            <div className="glass flex w-full max-w-md items-start gap-3 rounded-xl border-white/10 px-4 py-3 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]">
              <span
                className={
                  "mt-1.5 h-2 w-2 shrink-0 rounded-full " +
                  (notice.tone === "success" ? "bg-success" : notice.tone === "error" ? "bg-ember" : "bg-electric")
                }
              />
              <p className="flex-1 text-[13px] leading-snug text-snow">{notice.text}</p>
              <button onClick={() => setNotice(null)} aria-label="Dismiss" className="mt-0.5 rounded-full p-1 text-fog-2 transition hover:bg-white/5 hover:text-snow">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </AuthContext.Provider>
  );
}
