import { getSessionUser } from "@/lib/auth/session";
import { apiError, apiOk, fromDbError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

/** Awards today's bonus once per user, enforced by a primary key in the database. */
export async function POST() {
  const { supabase, user } = await getSessionUser();
  if (!supabase) return apiError("not_configured", "Accounts aren't set up on this site yet, so XP can't be saved.");
  if (!user) return apiError("unauthenticated", "Sign in to claim the daily bonus.");
  if (!rateLimit(`daily:${user.id}`, 10, 60_000).ok) return apiError("rate_limited", "Slow down a little.");
  const { data, error } = await supabase.rpc("complete_daily_challenge");
  if (error) return fromDbError(error);
  return apiOk(data);
}
