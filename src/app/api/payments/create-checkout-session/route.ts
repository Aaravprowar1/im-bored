import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { publicConfig } from "@/lib/config";
import { apiError, apiOk } from "@/lib/http";
import { createCheckoutForSubmission, type CheckoutSubmission } from "@/lib/payments/checkout";
import { getStripe } from "@/lib/payments/stripe";
import { rateLimit } from "@/lib/rate-limit";
import { isStripeConfigured } from "@/lib/server-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { uuidSchema } from "@/lib/validation";

// Only the submission id is read. Amount and currency are fixed on the server.
const bodySchema = z.object({ submissionId: uuidSchema });

export async function POST(request: Request) {
  const { supabase, user } = await getSessionUser();
  if (!supabase) return apiError("not_configured", "Accounts aren't set up on this site yet.");
  if (!user) return apiError("unauthenticated", "Sign in to pay for your submission.");

  const stripe = getStripe();
  const admin = createSupabaseAdminClient();
  if (!stripe || !admin || !isStripeConfigured()) {
    return apiError(
      "payment_unavailable",
      "Payments aren't configured on this site yet, so no payment can be taken. Your submission is saved and will wait for payment.",
    );
  }
  if (!rateLimit(`checkout:${user.id}`, 10, 10 * 60_000).ok) return apiError("rate_limited", "Too many checkout attempts. Try again in a few minutes.");

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalid_input", "Invalid submission.");

  // Ownership: RLS only returns the caller's own rows, and we also compare ids.
  const { data } = await supabase
    .from("activity_submissions")
    .select("id,submitter_id,title,payment_status,moderation_status,stripe_checkout_session_id,checkout_expires_at,checkout_attempts")
    .eq("id", parsed.data.submissionId)
    .maybeSingle();

  try {
    const result = await createCheckoutForSubmission(data as CheckoutSubmission | null, user.id, publicConfig.siteUrl, {
      now: () => Date.now(),
      createSession: async (params, idempotencyKey) => {
        const s = await stripe.checkout.sessions.create(params, { idempotencyKey });
        return { id: s.id, url: s.url, expires_at: s.expires_at };
      },
      retrieveSession: async (id) => {
        const s = await stripe.checkout.sessions.retrieve(id);
        return { id: s.id, url: s.url, status: s.status };
      },
      recordSession: async ({ submissionId, sessionId, expiresAt, attempts, expectedStatuses }) => {
        const { data: updated, error } = await admin
          .from("activity_submissions")
          .update({
            payment_status: "checkout_created",
            stripe_checkout_session_id: sessionId,
            checkout_expires_at: expiresAt,
            checkout_attempts: attempts,
          })
          .eq("id", submissionId)
          .eq("submitter_id", user.id)
          .in("payment_status", expectedStatuses)
          .select("id");
        return !error && (updated?.length ?? 0) === 1;
      },
    });
    if (!result.ok) {
      if (result.code === "not_found") return apiError("not_found", "Submission not found.");
      if (result.code === "already_paid") return apiError("conflict", "This submission has already been paid for.");
      if (result.code === "not_payable") return apiError("conflict", "This submission doesn't need payment.");
      return apiError("conflict", "Checkout couldn't be started. Please refresh and try again.");
    }
    return apiOk({ url: result.url });
  } catch {
    console.error("Stripe checkout creation failed");
    return apiError("server_error", "Checkout couldn't be started. Please try again.");
  }
}
