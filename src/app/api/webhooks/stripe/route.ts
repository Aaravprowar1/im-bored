import { getStripe } from "@/lib/payments/stripe";
import { handleVerifiedEvent, type ApplyOutcome, type VerifiedEvent } from "@/lib/payments/webhook";
import { serverConfig } from "@/lib/server-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Stripe webhook. The signature is verified against the raw request body
 * before anything is trusted. Processing is idempotent per Stripe event id.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = serverConfig().stripeWebhookSecret;
  const admin = createSupabaseAdminClient();
  if (!stripe || !secret || !admin) {
    return new Response("Stripe webhooks are not configured", { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });
  const rawBody = await request.text();

  let event: VerifiedEvent;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret) as unknown as VerifiedEvent;
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    const outcome = await handleVerifiedEvent(event, {
      applyPaymentEvent: async (input) => {
        const { data, error } = await admin.rpc("apply_payment_event", {
          p_event_id: input.eventId,
          p_event_type: input.eventType,
          p_livemode: input.livemode,
          p_submission_id: input.submissionId,
          p_checkout_session_id: input.checkoutSessionId,
          p_payment_intent_id: input.paymentIntentId,
          p_amount_cents: input.amountCents,
          p_currency: input.currency,
          p_to_status: input.toStatus,
          p_from_statuses: input.fromStatuses,
        });
        if (error) throw new Error("apply_payment_event failed");
        return data as ApplyOutcome;
      },
    });
    if (outcome !== "applied" && outcome !== "duplicate" && outcome !== "ignored") {
      // Recorded in payment_events for an admin to investigate. Only ids are logged.
      console.warn("Stripe event not applied", { id: event.id, type: event.type, outcome });
    }
    return Response.json({ received: true, outcome });
  } catch {
    // A 500 makes Stripe retry later; nothing was committed.
    return new Response("Processing failed", { status: 500 });
  }
}
