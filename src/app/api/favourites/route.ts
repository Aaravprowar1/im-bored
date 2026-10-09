import { z } from "zod";
import { PUBLIC_ACTIVITY_COLUMNS } from "@/lib/activities/types";
import { getSessionUser } from "@/lib/auth/session";
import { apiError, apiOk, fromDbError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { uuidSchema } from "@/lib/validation";

const bodySchema = z.object({ activityId: uuidSchema });

async function context() {
  const { supabase, user } = await getSessionUser();
  if (!supabase) return { error: apiError("not_configured", "Accounts aren't set up yet. Favourites are saved on this device only.") };
  if (!user) return { error: apiError("unauthenticated", "Sign in to save favourites to your account.") };
  return { supabase, user };
}

export async function GET() {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  const { data, error } = await ctx.supabase
    .from("user_favourites")
    .select(`created_at, activity:activities(${PUBLIC_ACTIVITY_COLUMNS})`)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return fromDbError(error);
  // RLS hides archived activities, which arrive as null.
  const activities = (data ?? []).map((r) => r.activity).filter(Boolean);
  return apiOk({ activities });
}

export async function POST(request: Request) {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  if (!rateLimit(`fav:${ctx.user.id}`, 60, 60_000).ok) return apiError("rate_limited", "Slow down a little.");
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalid_input", "Invalid activity.");
  // user_id comes from the session, never from the request.
  const { error } = await ctx.supabase
    .from("user_favourites")
    .upsert({ user_id: ctx.user.id, activity_id: parsed.data.activityId }, { onConflict: "user_id,activity_id", ignoreDuplicates: true });
  if (error) {
    if (error.code === "42501") return apiError("not_found", "That activity isn't available.");
    return fromDbError(error);
  }
  return apiOk({ saved: true });
}

export async function DELETE(request: Request) {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalid_input", "Invalid activity.");
  const { error } = await ctx.supabase
    .from("user_favourites")
    .delete()
    .eq("user_id", ctx.user.id)
    .eq("activity_id", parsed.data.activityId);
  if (error) return fromDbError(error);
  return apiOk({ saved: false });
}
