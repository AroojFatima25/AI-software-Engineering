/**
 * Auth service boundary.
 *
 * The UI only talks to these functions. When Supabase is connected,
 * replace the bodies with `supabase.auth.signInWithOAuth` /
 * `supabase.auth.signInWithOtp` calls — no component changes needed.
 */

export type OAuthProvider = "github" | "google";

export interface AuthResult {
  ok: boolean;
  message: string;
}

const NOT_CONFIGURED: AuthResult = {
  ok: false,
  message: "Early access — sign-in will be enabled when your workspace is provisioned.",
};

export async function signInWithProvider(provider: OAuthProvider): Promise<AuthResult> {
  // TODO(supabase): return supabase.auth.signInWithOAuth({ provider })
  await delay(600);
  return { ...NOT_CONFIGURED, message: `${label(provider)} ${NOT_CONFIGURED.message.toLowerCase()}` };
}

export async function signInWithEmail(email: string): Promise<AuthResult> {
  // TODO(supabase): return supabase.auth.signInWithOtp({ email })
  await delay(600);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  return { ok: true, message: `You're on the list. We'll reach out at ${email}.` };
}

function label(provider: OAuthProvider) {
  return provider === "github" ? "GitHub" : "Google";
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
