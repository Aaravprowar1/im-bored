import "server-only";
import { cache } from "react";
import { createSupabaseServerClient, type ServerSupabase } from "@/lib/supabase/server";

export type SessionUser = { id: string; email: string | null };

/**
 * Returns the authenticated user, verified with Supabase Auth (getUser makes
 * a request to the Auth server, unlike getSession which trusts the cookie).
 */
export const getSessionUser = cache(async (): Promise<{ supabase: ServerSupabase | null; user: SessionUser | null }> => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { supabase: null, user: null };
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { supabase, user: null };
  return { supabase, user: { id: data.user.id, email: data.user.email ?? null } };
});

/** Admin status comes only from the server-side admin_users table. */
export async function isAdmin(supabase: ServerSupabase): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_admin");
  return !error && data === true;
}

/**
 * For admin route handlers: authenticates and authorizes on the server.
 * The database functions re-check is_admin() independently.
 */
export async function requireAdminApi() {
  const { supabase, user } = await getSessionUser();
  if (!supabase) return { ok: false as const, error: "not_configured" as const };
  if (!user) return { ok: false as const, error: "unauthenticated" as const };
  if (!(await isAdmin(supabase))) return { ok: false as const, error: "forbidden" as const };
  return { ok: true as const, supabase, user };
}
