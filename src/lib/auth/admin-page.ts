import "server-only";
import { notFound, redirect } from "next/navigation";
import { getSessionUser, isAdmin } from "@/lib/auth/session";

/**
 * Guards admin pages on the server. Non-admins get a 404 so the area isn't
 * advertised. Database RLS and the moderation functions enforce the same rule.
 */
export async function requireAdminPage(path: string) {
  const { supabase, user } = await getSessionUser();
  if (!supabase) notFound();
  if (!user) redirect(`/login?next=${encodeURIComponent(path)}`);
  if (!(await isAdmin(supabase))) notFound();
  return { supabase, user };
}
