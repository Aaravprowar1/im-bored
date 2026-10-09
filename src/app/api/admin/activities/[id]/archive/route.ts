import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdminApi } from "@/lib/auth/session";
import { apiError, apiOk, fromDbError } from "@/lib/http";
import { uuidSchema } from "@/lib/validation";

const schema = z.object({ reason: z.string().trim().min(3, "Give a short reason.").max(2000) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdminApi();
  if (!ctx.ok) {
    return ctx.error === "forbidden"
      ? apiError("forbidden", "Administrators only.")
      : apiError(ctx.error === "unauthenticated" ? "unauthenticated" : "not_configured", "Please sign in as an administrator.");
  }
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return apiError("not_found", "Activity not found.");
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalid_input", "Give a short reason.", { reason: "Give a short reason." });
  const { error } = await ctx.supabase.rpc("archive_activity", { p_activity_id: id, p_reason: parsed.data.reason });
  if (error) return fromDbError(error);
  revalidatePath("/challenges");
  return apiOk({ status: "archived" });
}
