/**
 * Auth service boundary.
 *
 * The UI only talks to these functions; everything Supabase-specific lives
 * here. Three ways in are supported side by side:
 *
 *   1. Email + password  (`signUp` / `signInWithPassword`)
 *   2. Passwordless magic link (`signInWithOtp`) — unchanged, still available
 *   3. OAuth (Google / GitHub) — unchanged, still available
 *
 * Password recovery is a two-step round trip: `resetPasswordForEmail` mails a
 * link back to `/reset-password`, where the recovered session lets the user
 * call `updateUser({ password })`.
 *
 * Session restoration after the user returns from any link is handled by
 * `@/components/auth/AuthProvider`.
 */
import type { AuthError } from "@supabase/supabase-js";
import { authRedirectTo, getSupabase, redirectToPath } from "@/lib/supabase";

export type OAuthProvider = "github" | "google";

export interface AuthResult {
  ok: boolean;
  message: string;
  /** Set when the call succeeded but the user must still confirm their email. */
  needsEmailConfirmation?: boolean;
}

/** Minimum password length enforced in the UI (Supabase default is 6). */
export const MIN_PASSWORD_LENGTH = 8;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const NOT_CONFIGURED: AuthResult = {
  ok: false,
  message: "Sign-in isn't wired up in this environment yet — the Supabase env vars are missing.",
};

/* ------------------------------------------------------------------ */
/* Client-side validation                                              */
/* ------------------------------------------------------------------ */

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Returns an error string, or `null` when the email looks valid. */
export function validateEmail(email: string): string | null {
  const value = email.trim();
  if (!value) return "Enter your email address.";
  if (!EMAIL_RE.test(normalizeEmail(value))) return "Enter a valid email address.";
  return null;
}

/** Returns an error string, or `null` when the password is acceptable. */
export function validatePassword(password: string, { requireStrong = true } = {}): string | null {
  if (!password) return "Enter your password.";
  if (requireStrong && password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

/** Returns an error string, or `null` when both passwords match. */
export function validatePasswordConfirmation(password: string, confirmation: string): string | null {
  if (!confirmation) return "Re-enter your password to confirm it.";
  if (password !== confirmation) return "Passwords do not match.";
  return null;
}

/* ------------------------------------------------------------------ */
/* Email + password                                                    */
/* ------------------------------------------------------------------ */

/**
 * Creates an account with an email + password. When the project has
 * "Confirm email" enabled Supabase returns a user with no session and mails a
 * confirmation link — we surface that as `needsEmailConfirmation` so the UI
 * can tell the user to check their inbox instead of pretending they're in.
 */
export async function signUpWithPassword(email: string, password: string): Promise<AuthResult> {
  const emailError = validateEmail(email);
  if (emailError) return { ok: false, message: emailError };
  const passwordError = validatePassword(password);
  if (passwordError) return { ok: false, message: passwordError };

  const supabase = getSupabase();
  if (!supabase) return NOT_CONFIGURED;

  const normalized = normalizeEmail(email);
  const { data, error } = await supabase.auth.signUp({
    email: normalized,
    password,
    options: { emailRedirectTo: redirectToPath("/workspace") },
  });

  if (error) return { ok: false, message: describeError(error) };

  // Supabase returns an obfuscated user with an empty identities array when
  // the address is already registered (to avoid leaking account existence).
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return {
      ok: false,
      message: "An account with this email already exists. Sign in instead, or reset your password.",
    };
  }

  if (!data.session) {
    return {
      ok: true,
      needsEmailConfirmation: true,
      message: `Almost there — confirm your email. We sent a link to ${normalized}.`,
    };
  }

  return { ok: true, message: "Account created. Taking you to your workspace…" };
}

/** Signs an existing user in with their email + password. */
export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  const emailError = validateEmail(email);
  if (emailError) return { ok: false, message: emailError };
  // Don't apply the length rule on sign-in — legacy passwords may be shorter;
  // an actually-wrong password is reported by Supabase as invalid credentials.
  const passwordError = validatePassword(password, { requireStrong: false });
  if (passwordError) return { ok: false, message: passwordError };

  const supabase = getSupabase();
  if (!supabase) return NOT_CONFIGURED;

  const { error } = await supabase.auth.signInWithPassword({
    email: normalizeEmail(email),
    password,
  });

  if (error) return { ok: false, message: describeError(error) };
  return { ok: true, message: "Signed in. Taking you to your workspace…" };
}

/* ------------------------------------------------------------------ */
/* Password recovery                                                   */
/* ------------------------------------------------------------------ */

/**
 * Mails a recovery link that lands on `/reset-password`. The response is
 * deliberately identical for known and unknown addresses so the form can't be
 * used to enumerate accounts.
 */
export async function sendPasswordReset(email: string): Promise<AuthResult> {
  const emailError = validateEmail(email);
  if (emailError) return { ok: false, message: emailError };

  const supabase = getSupabase();
  if (!supabase) return NOT_CONFIGURED;

  const normalized = normalizeEmail(email);
  const { error } = await supabase.auth.resetPasswordForEmail(normalized, {
    redirectTo: redirectToPath("/reset-password"),
  });

  if (error) return { ok: false, message: describeError(error) };
  return {
    ok: true,
    message: `If an account exists for ${normalized}, a password reset link is on its way. The link expires in about an hour.`,
  };
}

/**
 * Sets a new password for the currently authenticated user. Used both by the
 * `/reset-password` recovery flow and by magic-link/OAuth users who want to
 * add or change a password from their account area.
 */
export async function updatePassword(password: string, confirmation: string): Promise<AuthResult> {
  const passwordError = validatePassword(password);
  if (passwordError) return { ok: false, message: passwordError };
  const confirmError = validatePasswordConfirmation(password, confirmation);
  if (confirmError) return { ok: false, message: confirmError };

  const supabase = getSupabase();
  if (!supabase) return NOT_CONFIGURED;

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, message: describeError(error) };
  return { ok: true, message: "Password updated. You can now sign in with your email and password." };
}

/* ------------------------------------------------------------------ */
/* Magic link (unchanged behaviour)                                    */
/* ------------------------------------------------------------------ */

/**
 * Sends a one-click magic link to `email`. Existing accounts are signed in;
 * unknown addresses get an account created (subject to the project's
 * "Confirm email" setting, which the link itself satisfies).
 */
export async function sendMagicLink(email: string): Promise<AuthResult> {
  const emailError = validateEmail(email);
  if (emailError) return { ok: false, message: emailError };

  const supabase = getSupabase();
  if (!supabase) return NOT_CONFIGURED;

  const normalized = normalizeEmail(email);
  const { error } = await supabase.auth.signInWithOtp({
    email: normalized,
    options: {
      emailRedirectTo: authRedirectTo(),
      shouldCreateUser: true,
    },
  });

  if (error) return { ok: false, message: describeError(error) };
  return { ok: true, message: `Magic link sent to ${normalized} — open it on this device to finish.` };
}

/* ------------------------------------------------------------------ */
/* OAuth (unchanged behaviour)                                         */
/* ------------------------------------------------------------------ */

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

/** True when the signed-in user already has an email/password identity. */
export async function hasPasswordIdentity(): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { data } = await supabase.auth.getUser();
  const identities = data.user?.identities ?? [];
  return identities.some((identity) => identity.provider === "email");
}

function label(provider: OAuthProvider) {
  return provider === "github" ? "GitHub" : "Google";
}

/* ------------------------------------------------------------------ */
/* Error copy                                                          */
/* ------------------------------------------------------------------ */

/**
 * Turns Supabase's terse API errors into something a person can act on.
 * Matching is done on both the stable `code` (newer supabase-js) and the
 * message text, so it keeps working across versions.
 */
export function describeError(error: AuthError | { message: string; code?: string; status?: number }): string {
  const message = error.message ?? "";
  const code = "code" in error ? (error.code ?? "") : "";

  if (code === "invalid_credentials" || /invalid login credentials/i.test(message)) {
    return "Incorrect email or password. Check them and try again.";
  }
  if (code === "email_not_confirmed" || /email not confirmed/i.test(message)) {
    return "Your email isn't confirmed yet. Open the confirmation link we emailed you, or request a new magic link.";
  }
  if (code === "user_already_exists" || /already registered|user already/i.test(message)) {
    return "An account with this email already exists. Sign in instead, or reset your password.";
  }
  if (code === "weak_password" || /password should be at least|weak password/i.test(message)) {
    return `Password is too short — use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (code === "same_password" || /should be different from the old password/i.test(message)) {
    return "That's already your current password — choose a different one.";
  }
  if (
    code === "otp_expired" ||
    code === "flow_state_expired" ||
    /expired|invalid flow state|token has expired|invalid or has expired/i.test(message)
  ) {
    return "This link has expired or was already used. Request a new password reset email.";
  }
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || /rate limit/i.test(message)) {
    return "Too many requests — wait a minute and try again.";
  }
  if (code === "session_not_found" || /auth session missing|session_not_found/i.test(message)) {
    return "Your reset link is no longer valid. Request a new password reset email.";
  }
  if (/failed to fetch|network/i.test(message)) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  return message || "Something went wrong. Please try again.";
}

/** Human copy for the `error`/`error_code` params Supabase puts on redirects. */
export function describeRedirectError(code: string | null, description: string | null): string {
  const raw = (code ?? "") + " " + (description ?? "");
  if (/otp_expired|expired|invalid_request|access_denied/i.test(raw)) {
    return "That link has expired or was already used. Request a new one to continue.";
  }
  return (description ?? "").replace(/\+/g, " ") || "That link didn't work. Request a new one to continue.";
}
