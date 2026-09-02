import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client boundary.
 *
 * Both values are injected at build time by Vite from `VITE_*` environment
 * variables. On Vercel they are set in Project → Settings → Environment
 * Variables; locally, copy `.env.example` to `.env.local`.
 *
 * The publishable key is designed to be shipped to the browser — it is not a
 * secret. Never add a `sb_secret_*` / `service_role` key to this file or to any
 * `VITE_*` variable.
 */

const url = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "").trim();

/** True when both env vars are present, so auth calls can reach Supabase. */
export const isSupabaseConfigured = url.length > 0 && key.length > 0;

// A Vercel build succeeds whether or not these vars are set, because the client
// below degrades to `null` instead of throwing. That makes a missing env var
// invisible in the deploy log, so say so loudly in the browser console instead —
// opening DevTools on a deployment immediately explains why auth is inert.
if (!isSupabaseConfigured) {
  console.warn(
    "[AI-OS] Supabase auth is disabled: VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY " +
      "were empty at build time. Set both in Vercel → Settings → Environment Variables " +
      "(Production and Preview) and redeploy.",
  );
}

let client: SupabaseClient | null = null;

/**
 * Returns the shared Supabase client, or `null` when the env vars are missing.
 *
 * Callers must handle `null` rather than crashing — `createClient()` throws on
 * an empty URL, and a marketing site should still render without auth.
 */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(url, key, {
      auth: {
        // Keep the session across reloads and refresh tokens in the background.
        persistSession: true,
        autoRefreshToken: true,
        // Pick up the session when Supabase redirects back from a magic link
        // or an OAuth provider.
        detectSessionInUrl: true,
        // Implicit flow suits a client-only SPA: the token arrives in the URL
        // fragment and supabase-js exchanges nothing server-side.
        flowType: "implicit",
      },
    });
  }
  return client;
}
