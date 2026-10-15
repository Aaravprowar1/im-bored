import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { apiError, apiOk, fromDbError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { uuidSchema } from "@/lib/validation";

const bodySchema = z.object({ value: z.union([z.literal(1), z.literal(0), z.literal(-1)]) });

/**
 * Sets the caller's vote on an activity: 1 (up), -1 (down) or 0 (remove).
 * The user comes from the session; the cast_vote database function checks the
 * activity is published and keeps the totals exact.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await getSessionUser();
  if (!supabase) return apiError("not_configured", "Voting needs accounts, which aren't set up on this site yet.");
  if (!user) return apiError("unauthenticated", "Sign in to vote.");
  if (!rateLimit(`vote:${user.id}`, 60, 60_000).ok) return apiError("rate_limited", "Slow down a little.");

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return apiError("not_found", "That activity isn't available.");
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalid_input", "That isn't a valid vote.");

  const { data, error } = await supabase.rpc("cast_vote", { p_activity_id: id, p_value: parsed.data.value });
  if (error) return fromDbError(error);
  return apiOk(data as { upvotes: number; downvotes: number; my_vote: number });
}
