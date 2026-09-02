/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL, e.g. https://<project-ref>.supabase.co */
  readonly VITE_SUPABASE_URL: string;
  /** Supabase publishable (client-side) API key. Safe to expose in the browser. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
}
