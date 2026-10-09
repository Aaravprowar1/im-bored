import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { apiError, apiOk } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ confirm: z.literal("DELETE") });

/**
 * Deletes the caller's account. Profile, progress, completions and favourites
 * cascade. Submissions keep their payment and review records with the
 * submitter removed (see privacy policy).
 */
export async function DELETE(request: Request) {
  const { supabase, user } = await getSessionUser();
  if (!supabase) return apiError("not_configured", "Accounts aren't set up yet.");
  if (!user) return apiError("unauthenticated", "Please sign in.");
  if (!schema.safeParse(await request.json().catch(() => null)).success) {
    return apiError("invalid_input", 'Type DELETE to confirm.', { confirm: 'Type DELETE to confirm.' });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return apiError("not_configured", "Account deletion needs SUPABASE_SERVICE_ROLE_KEY on the server. Contact us to delete your account.");
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return apiError("server_error", "We couldn't delete your account. Please try again.");
  await supabase.auth.signOut();
  return apiOk({ deleted: true });
}
