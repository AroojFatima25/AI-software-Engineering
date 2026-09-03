import type { Session, User } from "@supabase/supabase-js";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { EASE } from "@/components/ui/motion";
import { signOut as supabaseSignOut } from "@/lib/auth";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Supabase session handling for the whole app.
 *
 * - Restores the persisted session on load (users stay signed in across
 *   visits — supabase-js keeps it in localStorage and refreshes the token).
 * - Completes the magic-link round trip: Supabase bounces the user back to
 *   the site with `?code=...`; `detectSessionInUrl` exchanges it for a
 *   session, then we scrub the URL so refreshes don't re-trigger the flow.
 * - Broadcasts sign-in/sign-out through `useAuth()`.
 * - Routes the user: completing the magic-link / OAuth round trip lands on
 *   the protected `/workspace` dashboard; signing out (or an expired session)
 *   from `/workspace` returns to the public landing page.
 */

interface AuthContextValue {
  /** False until the initial session check finished (prevents UI flicker). */
  ready: boolean;
  /** True when the VITE_SUPABASE_* env vars are present. */
  configured: boolean;
  session: Session | null;
  user: User | null;
  isSignedIn: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

/** Query params Supabase appends when it redirects back after a magic link. */
const REDIRECT_PARAMS = ["code", "state", "error", "error_code", "error_description"] as const;

type Notice = { id: number; text: string; tone: "success" | "info" | "error" };

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [session, setSession] = useState<AuthContextValue["session"]>(null);
  const [ready, setReady] = useState(!configured);
  const [notice, setNotice] = useState<Notice | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // True while the page was loaded directly from a magic-link redirect, so we
  // only toast "signed in" for the actual round trip, not for token refreshes.
  const completingRedirect = useRef(false);
  const signedOutOnPurpose = useRef(false);
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    const params = new URLSearchParams(window.location.search);
    completingRedirect.current = REDIRECT_PARAMS.some((key) => params.has(key));
    const linkFailed = params.has("error") || params.has("error_code");

    if (completingRedirect.current) {
      REDIRECT_PARAMS.forEach((key) => params.delete(key));
      const query = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    }
    if (linkFailed) {
      completingRedirect.current = false;
      setNotice({ id: Date.now(), text: "That sign-in link didn't work — it may have expired. Request a fresh one.", tone: "error" });
    }

    // Fire the toast for the magic-link completion; getSession() resolves the
    // restored (persisted) session so users stay signed in across visits.
    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession ?? null);
      setReady(true);
      if (event === "SIGNED_IN" && completingRedirect.current) {
        completingRedirect.current = false;
        const email = nextSession?.user.email;
        setNotice({ id: Date.now(), text: email ? `Signed in as ${email}. Welcome to AI-OS.` : "Signed in. Welcome to AI-OS.", tone: "success" });
        // The magic-link / OAuth round trip means the user's intent was to get
        // into their workspace — drop them on the protected dashboard.
        if (pathRef.current !== "/workspace") navigate("/workspace");
      }
      if (event === "SIGNED_OUT") {
        setNotice({
          id: Date.now(),
          text: signedOutOnPurpose.current ? "Signed out. Your workspace will be here when you're back." : "Your session expired — sign in again to continue.",
          tone: signedOutOnPurpose.current ? "info" : "error",
        });
        signedOutOnPurpose.current = false;
        if (pathRef.current === "/workspace") navigate("/", { replace: true });
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
  }, []);

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
      signOut,
    }),
    [ready, configured, session, signOut],
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
