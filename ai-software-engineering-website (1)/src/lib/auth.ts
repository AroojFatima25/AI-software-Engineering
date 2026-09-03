/**
 * Auth service boundary.
 *
 * The UI only talks to these functions; everything Supabase-specific lives
 * here. Sign-in is a passwordless email magic link (`signInWithOtp`): the
 * same link signs existing users in and creates new accounts on first use.
 * Session restoration after the user returns from the link is handled by
 * `@/components/auth/AuthProvider`.
 */
import { authRedirectTo, getSupabase } from "@/lib/supabase";

export type OAuthProvider = "github" | "google";

export interface AuthResult {
  ok: boolean;
  message: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const NOT_CONFIGURED: AuthResult = {
  ok: false,
  message: "Sign-in isn't wired up in this environment yet — the Supabase env vars are missing.",
};

/**
 * Sends a one-click magic link to `email`. Existing accounts are signed in;
 * unknown addresses get an account created (subject to the project's
 * "Confirm email" setting, which the link itself satisfies).
 */
export async function sendMagicLink(email: string): Promise<AuthResult> {
  const normalized = email.trim().toLowerCase();
  if (!EMAIL_RE.test(normalized)) {
    return { ok: false, message: "Enter a valid email address." };
  }

  const supabase = getSupabase();
  if (!supabase) return NOT_CONFIGURED;

  const { error } = await supabase.auth.signInWithOtp({
    email: normalized,
    options: {
      emailRedirectTo: authRedirectTo(),
      shouldCreateUser: true,
    },
  });

  if (error) return { ok: false, message: describeError(error.message) };
  return { ok: true, message: `Magic link sent to ${normalized} — open it on this device to finish.` };
}

/**
 * Real OAuth via Supabase for the modal's alternate buttons. If a provider
 * isn't enabled in the project yet, we degrade to a helpful message instead
 * of a redirect to a dead endpoint.
 */
export async function signInWithProvider(provider: OAuthProvider): Promise<AuthResult> {
  const supabase = getSupabase();
  if (!supabase) return NOT_CONFIGURED;

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: authRedirectTo() },
  });

  if (error) {
    return {
      ok: false,
      message: `${label(provider)} sign-in isn't connected yet — use the email magic link instead.`,
    };
  }
  return { ok: true, message: `Redirecting to ${label(provider)}…` };
}

export async function signOut(): Promise<void> {
  await getSupabase()?.auth.signOut();
}

function label(provider: OAuthProvider) {
  return provider === "github" ? "GitHub" : "Google";
}

function describeError(message: string) {
  if (/rate limit/i.test(message)) return "Too many requests — try again in a minute.";
  return message || "Couldn't send the magic link. Please try again.";
}
