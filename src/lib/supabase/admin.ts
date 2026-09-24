import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only service-role client for the Studio admin (guestbook
 * moderation, contact inbox). Bypasses RLS — never expose this client or
 * the key to the browser, and never give the key a NEXT_PUBLIC_ prefix.
 * Every caller must guard with isStudioOwner().
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return null;
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
