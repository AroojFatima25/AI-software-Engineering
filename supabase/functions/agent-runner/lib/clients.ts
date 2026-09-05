/**
 * Supabase client factories.
 *
 * The runner deliberately uses TWO clients with different powers:
 *
 *   `createUserClient`  — anon key + the caller's own JWT. Row Level Security
 *                         applies. Used for the two things that must be proven
 *                         under the same rules the dashboard uses: "is this
 *                         JWT a real user?" and "is that user a member of the
 *                         workspace that owns this run?".
 *
 *   `createAdminClient` — service_role key. Bypasses RLS. Used ONLY for the
 *                         pipeline's own writes (stages, tasks, activity,
 *                         changes, files) which the schema intentionally
 *                         forbids the browser client from making.
 *
 * The service_role key is read from the Edge Function environment and is never
 * returned in a response, logged, or placed in a `VITE_*` variable.
 */
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.114.0";
import type { RunnerConfig } from "./config.ts";

const CLIENT_INFO = "agent-runner-edge-function";

function baseOptions() {
  return {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { "X-Client-Info": CLIENT_INFO },
    },
  } as const;
}

/** service_role client — full write access, bypasses RLS. Server-side only. */
export function createAdminClient(config: RunnerConfig): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    ...baseOptions(),
    global: {
      headers: {
        "X-Client-Info": CLIENT_INFO,
        Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      },
    },
  });
}

/**
 * Client that acts AS the caller: anon key with their JWT swapped into the
 * Authorization header, so Postgres receives `auth.uid()` = that user and RLS
 * policies evaluate exactly as they do for the dashboard.
 */
export function createUserClient(config: RunnerConfig, userJwt: string): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    ...baseOptions(),
    global: {
      headers: {
        "X-Client-Info": CLIENT_INFO,
        Authorization: `Bearer ${userJwt}`,
      },
    },
  });
}
