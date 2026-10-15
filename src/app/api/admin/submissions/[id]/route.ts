import { requireAdminApi } from "@/lib/auth/session";
import { apiError, apiOk, fromDbError } from "@/lib/http";
import { fieldErrors, moderationSchema, uuidSchema } from "@/lib/validation";
import { revalidatePath } from "next/cache";

const DENIED = {
  not_configured: () => apiError("not_configured", "Supabase isn't configured."),
  unauthenticated: () => apiError("unauthenticated", "Please sign in."),
  forbidden: () => apiError("forbidden", "Administrators only."),
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdminApi();
  if (!ctx.ok) return DENIED[ctx.error]();
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return apiError("not_found", "Submission not found.");
  const parsed = moderationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalid_input", "Invalid moderation request.", fieldErrors(parsed.error));
  const { action, notes } = parsed.data;

  const { data, error } = await ctx.supabase.rpc("moderate_submission", {
    p_submission_id: id,
    p_action: action,
    p_notes: notes ?? null,
  });
  if (error) return fromDbError(error);
  if (action === "approve") revalidatePath("/challenges");
  return apiOk(data);
}
