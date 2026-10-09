import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicConfig } from "@/lib/config";
import { serverConfig } from "@/lib/server-config";

/**
 * Service-role client. Bypasses RLS, so it is only used for the few
 * operations that must not be callable by users: recording Stripe checkout
 * sessions, applying verified webhook events, refunds and account deletion.
 * Never import this from client components.
 */
export function createSupabaseAdminClient() {
  const key = serverConfig().supabaseServiceRoleKey;
  if (!publicConfig.supabaseUrl || !key) return null;
  return createClient(publicConfig.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type AdminSupabase = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
