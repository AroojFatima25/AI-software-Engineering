import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client factory.
 *
 * Configuration is read exclusively from Vite environment variables — nothing
 * is hardcoded anywhere in this app:
 *
 *   VITE_SUPABASE_URL              Project URL, e.g. https://xyz.supabase.co
 *   VITE_SUPABASE_PUBLISHABLE_KEY  Publishable (anon) API key — safe to ship in
 *                                  the browser bundle; the service_role key must
 *                                  NEVER appear here.
 *
 * On Vercel these come from Project Settings → Environment Variables; locally,
 * copy `.env.example` to `.env.local`. When the variables are absent (a bare
 * preview deploy, for instance) the client resolves to `null` and the UI shows a
 * friendly "not wired up yet" message instead of throwing.
 */

export function supabaseConfig(): { url: string; key: string } | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return null;
  return { url, key };
}

export function isSupabaseConfigured(): boolean {
  return supabaseConfig() !== null;
}

let client: SupabaseClient | null = null;

/** Lazily creates a single shared client for the whole app. */
export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  const config = supabaseConfig();
  if (!config) return null;

  client = createClient(config.url, config.key, {
    auth: {
      // Keep users signed in across reloads/visits.
      persistSession: true,
      autoRefreshToken: true,
      // Consumes the `?code=...` (PKCE) params Supabase appends when the user
      // returns from a magic-link or OAuth email click and exchanges it for a
      // session automatically.
      detectSessionInUrl: true,
      flowType: "pkce",
      // Avoid clobbering localStorage keys used by other apps on the domain.
      storageKey: "ai-os-supabase-auth",
    },
  });
  return client;
}

/**
 * Where Supabase should send the user back to after they click the magic link.
 * Derived at runtime so it works on localhost, preview URLs, and the Vercel
 * production domain alike (each must be allowed in Supabase → Auth → URL
 * Configuration).
 */
export function authRedirectTo(): string {
  if (typeof window === "undefined") return "http://localhost:5173/";
  return `${window.location.origin}${window.location.pathname}`;
}

/**
 * Absolute redirect URL for a specific in-app route (e.g. "/reset-password").
 * Used by the password-recovery and sign-up confirmation emails so the user
 * lands exactly where the flow continues. Each origin must be allow-listed in
 * Supabase → Auth → URL Configuration → Redirect URLs.
 */
export function redirectToPath(path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  if (typeof window === "undefined") return `http://localhost:5173${suffix}`;
  return `${window.location.origin}${suffix}`;
}
