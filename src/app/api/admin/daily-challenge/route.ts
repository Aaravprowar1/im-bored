import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/session";
import { apiError, apiOk, fromDbError } from "@/lib/http";
import { uuidSchema } from "@/lib/validation";

const schema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), activityId: uuidSchema });

export async function POST(request: Request) {
  const ctx = await requireAdminApi();
  if (!ctx.ok) {
    return ctx.error === "forbidden"
      ? apiError("forbidden", "Administrators only.")
      : apiError(ctx.error === "unauthenticated" ? "unauthenticated" : "not_configured", "Please sign in as an administrator.");
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalid_input", "Pick a date (UTC) and an activity.");
  const { data, error } = await ctx.supabase.rpc("admin_set_daily_challenge", {
    p_date: parsed.data.date,
    p_activity_id: parsed.data.activityId,
  });
  if (error) return fromDbError(error);
  return apiOk({ challenge: data });
}
