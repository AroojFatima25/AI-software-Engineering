/// <reference types="vite/client" />

/**
 * Typed, Vite-exposed environment variables (public by design — only
 * VITE_-prefixed vars are inlined into the client bundle). The values are
 * injected by Vercel at build time or by a local `.env.local`; this file only
 * declares their shapes, never the secrets themselves.
 */
interface ImportMetaEnv {
  /** Supabase project URL, e.g. https://xyzcompany.supabase.co */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase publishable (anon) API key. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
