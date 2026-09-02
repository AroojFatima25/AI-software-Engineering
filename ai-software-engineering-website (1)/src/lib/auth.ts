import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Auth service boundary.
 *
 * The UI only talks to these functions, so swapping Supabase for another
 * provider never touches a component. Every call degrades gracefully when the
 * `VITE_SUPABASE_*` env vars are absent, so the site still renders in a bare
 * local checkout.
 */

export type OAuthProvider = "github" | "google";

export interface AuthResult {
  ok: boolean;
  message: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const NOT_CONFIGURED: AuthResult = {
  ok: false,
  message:
    "Authentication isn't configured in this build. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then redeploy.",
};

export { isSupabaseConfigured };

/**
 * Where Supabase sends the user after they click a magic link or approve an
 * OAuth prompt. Kept on the current origin + path so it works unchanged on
 * localhost, Vercel previews, and production — each must be listed under
 * Supabase → Authentication → URL Configuration → Redirect URLs.
 */
function currentUrl(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${window.location.pathname}`;
}

/** Prefer Supabase's own message (it explains rate limits) over a generic one. */
function failure(error: { name?: string; message?: string } | null, fallback: string): AuthResult {
  // Unreachable auth server: a deleted or mistyped project URL, a DNS/egress
  // problem, or Supabase being down. The raw message is just "Failed to fetch",
  // which tells a visitor nothing, so keep the UI copy human and put the
  // diagnostic detail where a developer will find it.
  // Matched on `name` the same way supabase-js's own isAuthRetryableFetchError does.
  if (error?.name === "AuthRetryableFetchError") {
    console.error("[AI-OS] Could not reach the Supabase auth server:", error.message);
    return { ok: false, message: "We can't reach the sign-in service right now. Please try again shortly." };
  }

  const message = error?.message?.trim();
  return { ok: false, message: message ? message : fallback };
}

function providerLabel(provider: OAuthProvider) {
  return provider === "github" ? "GitHub" : "Google";
}

/**
 * Redirects the browser to the given OAuth provider. On success Supabase
 * navigates away, so the returned result only surfaces configuration errors.
 */
export async function signInWithProvider(provider: OAuthProvider): Promise<AuthResult> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ...NOT_CONFIGURED, message: `${providerLabel(provider)} sign-in is unavailable. ${NOT_CONFIGURED.message}` };
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: currentUrl() },
  });

  if (error) return failure(error, `${providerLabel(provider)} sign-in failed. Try again in a moment.`);
  return { ok: true, message: `Continuing to ${providerLabel(provider)}…` };
}

/**
 * Sends a magic link. Also signs the user up when the address is new
 * (`shouldCreateUser` defaults to true), so one flow covers both modes.
 */
export async function signInWithEmail(email: string): Promise<AuthResult> {
  const normalized = email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(normalized)) {
    return { ok: false, message: "Enter a valid email address." };
  }

  const supabase = getSupabase();
  if (!supabase) return NOT_CONFIGURED;

  const { error } = await supabase.auth.signInWithOtp({
    email: normalized,
    options: {
      emailRedirectTo: currentUrl(),
      shouldCreateUser: true,
    },
  });

  if (error) return failure(error, "We couldn't send that magic link. Try again in a moment.");
  return { ok: true, message: `Magic link sent — check ${normalized} and click the link to finish signing in.` };
}

/** The persisted session, if any. Resolves to `null` when auth is unconfigured. */
export async function getCurrentSession(): Promise<Session | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/**
 * Subscribes to session changes (initial load, magic-link return, OAuth
 * redirect, token refresh, sign-out). Returns an unsubscribe function.
 */
export function onAuthStateChange(listener: (session: Session | null) => void): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => listener(session));
  return () => data.subscription.unsubscribe();
}

export async function signOut(): Promise<AuthResult> {
  const supabase = getSupabase();
  if (!supabase) return NOT_CONFIGURED;
  const { error } = await supabase.auth.signOut();
  if (error) return failure(error, "Couldn't sign you out. Refresh the page and try again.");
  return { ok: true, message: "Signed out." };
}

/** Best available human-readable name, falling back to the email address. */
export function userLabel(user: User | null): string {
  if (!user) return "";
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const candidates = ["full_name", "name", "user_name", "preferred_username", "nickname"];
  for (const field of candidates) {
    const value = meta[field];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return user.email ?? "Signed in";
}

export function userInitial(user: User | null): string {
  return (userLabel(user).charAt(0) || "U").toUpperCase();
}
