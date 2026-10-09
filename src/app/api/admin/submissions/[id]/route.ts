import { requireAdminApi } from "@/lib/auth/session";
import { apiError, apiOk, fromDbError } from "@/lib/http";
import { getStripe } from "@/lib/payments/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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

  if (action === "refund") {
    const stripe = getStripe();
    const admin = createSupabaseAdminClient();
    if (!stripe || !admin) return apiError("payment_unavailable", "Refunds need Stripe and the service role key configured.");
    const { data: sub } = await ctx.supabase
      .from("activity_submissions")
      .select("id,payment_status,moderation_status,stripe_payment_intent_id")
      .eq("id", id)
      .maybeSingle();
    if (!sub) return apiError("not_found", "Submission not found.");
    if (sub.payment_status !== "paid" || sub.moderation_status !== "rejected" || !sub.stripe_payment_intent_id) {
      return apiError("conflict", "Only paid, rejected submissions can be refunded here.");
    }
    try {
      // Idempotency key: repeated clicks never create a second refund.
      await stripe.refunds.create(
        { payment_intent: sub.stripe_payment_intent_id, reason: "requested_by_customer", metadata: { submission_id: id } },
        { idempotencyKey: `submission-refund:${id}` },
      );
    } catch {
      return apiError("server_error", "Stripe couldn't create the refund. Check the Stripe dashboard.");
    }
    const { error } = await admin.rpc("mark_refund_pending", { p_submission_id: id, p_actor: ctx.user.id, p_notes: notes ?? null });
    if (error) return fromDbError(error);
    return apiOk({ payment_status: "refund_pending" });
  }

  const { data, error } = await ctx.supabase.rpc("moderate_submission", {
    p_submission_id: id,
    p_action: action,
    p_notes: notes ?? null,
  });
  if (error) return fromDbError(error);
  if (action === "approve") revalidatePath("/challenges");
  return apiOk(data);
}
