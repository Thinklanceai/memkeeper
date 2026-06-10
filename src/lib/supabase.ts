/**
 * Supabase client — phase 2 (account + opt-in encrypted sync).
 * Deliberately unused in v1: the vault is local-only by design.
 * Wiring is here so phase 2 adds features without touching v1 paths.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!client) client = createClient(url, key);
  return client;
}
