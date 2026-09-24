import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Public anon browser/server client for the portfolio.
 * Read-only (RLS) — used for published projects and the guestbook.
 */
export function getSupabaseAnonClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // Static fallback: site works without Supabase configured.
    return null;
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
