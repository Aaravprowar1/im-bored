"use client";
import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured, publicConfig } from "@/lib/config";

let client: ReturnType<typeof createBrowserClient> | null = null;

/** Browser client (anon key only). Null when Supabase is not configured. */
export function getSupabaseBrowserClient() {
  if (!isSupabaseConfigured()) return null;
  client ??= createBrowserClient(publicConfig.supabaseUrl!, publicConfig.supabaseAnonKey!);
  return client;
}
