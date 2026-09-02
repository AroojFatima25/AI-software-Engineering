import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getCurrentSession, onAuthStateChange, signOut as requestSignOut } from "@/lib/auth";

/**
 * Holds the current Supabase session for the whole app.
 *
 * `onAuthStateChange` fires `INITIAL_SESSION` on mount and again whenever the
 * session changes — magic-link return, OAuth redirect, token refresh, or
 * sign-out — so the header and modal stay in sync without prop drilling.
 */

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  /** True until the first session lookup settles. */
  initializing: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let active = true;

    void getCurrentSession().then((restored) => {
      if (!active) return;
      setSession(restored);
      setInitializing(false);
    });

    const unsubscribe = onAuthStateChange((next) => {
      if (!active) return;
      setSession(next);
      setInitializing(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      initializing,
      signOut: async () => {
        await requestSignOut();
        if (session) setSession(null);
      },
    }),
    [session, initializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
