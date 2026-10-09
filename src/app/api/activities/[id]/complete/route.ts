import { getSessionUser } from "@/lib/auth/session";
import { apiError, apiOk, fromDbError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { uuidSchema } from "@/lib/validation";

/**
 * Records a completion. XP comes from the activity row inside the
 * complete_activity database function; nothing from the request body is used.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await getSessionUser();
  if (!supabase) return apiError("not_configured", "Accounts aren't set up on this site yet, so XP can't be saved.");
  if (!user) return apiError("unauthenticated", "Sign in to earn XP for this.");
  if (!rateLimit(`complete:${user.id}`, 30, 60_000).ok) return apiError("rate_limited", "Slow down a little.");

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return apiError("not_found", "That activity isn't available.");

  const { data, error } = await supabase.rpc("complete_activity", { p_activity_id: id });
  if (error) return fromDbError(error);
  return apiOk(data);
}
