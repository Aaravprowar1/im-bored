import { CHECKOUT_TTL_SECONDS, SUBMISSION_FEE } from "./constants";
import type { ModerationStatus, PaymentStatus } from "@/lib/submissions/state";

export interface CheckoutSubmission {
  id: string;
  submitter_id: string | null;
  title: string;
  payment_status: PaymentStatus;
  moderation_status: ModerationStatus;
  stripe_checkout_session_id: string | null;
  checkout_expires_at: string | null;
  checkout_attempts: number;
}

export interface CheckoutSessionParams {
  mode: "payment";
  client_reference_id: string;
  line_items: {
    quantity: 1;
    price_data: { currency: "usd"; unit_amount: number; product_data: { name: string; description: string } };
  }[];
  metadata: { submission_id: string };
  payment_intent_data: { metadata: { submission_id: string }; description: string };
  success_url: string;
  cancel_url: string;
  expires_at: number;
}

/** The pieces of Stripe and the database that checkout creation needs. Injected for testing. */
export interface CheckoutDeps {
  createSession(params: CheckoutSessionParams, idempotencyKey: string): Promise<{ id: string; url: string | null; expires_at: number }>;
  retrieveSession(id: string): Promise<{ id: string; url: string | null; status: string | null }>;
  recordSession(input: {
    submissionId: string;
    sessionId: string;
    expiresAt: string;
    attempts: number;
    expectedStatuses: PaymentStatus[];
  }): Promise<boolean>;
  now(): number;
}

export type CheckoutResult =
  | { ok: true; url: string; reused: boolean }
  | { ok: false; code: "not_found" | "already_paid" | "not_payable" | "conflict" };

export function buildCheckoutParams(submission: Pick<CheckoutSubmission, "id">, siteUrl: string, nowMs: number): CheckoutSessionParams {
  const statusUrl = `${siteUrl}/submit/status/${submission.id}`;
  return {
    mode: "payment",
    client_reference_id: submission.id,
    line_items: [
      {
        quantity: 1,
        price_data: {
          // Fixed server-side values. Never taken from the request.
          currency: SUBMISSION_FEE.currency,
          unit_amount: SUBMISSION_FEE.amountCents,
          product_data: {
            name: "im bored. activity submission review fee",
            description: "Pays for moderator review. Approval and publication are not guaranteed.",
          },
        },
      },
    ],
    metadata: { submission_id: submission.id },
    payment_intent_data: { metadata: { submission_id: submission.id }, description: "Activity submission review fee" },
    success_url: `${statusUrl}?checkout=success`,
    cancel_url: `${statusUrl}?checkout=cancel`,
    expires_at: Math.floor(nowMs / 1000) + CHECKOUT_TTL_SECONDS,
  };
}

/**
 * Creates (or reuses) a Stripe Checkout Session for a submission the caller
 * owns. Duplicate charges are avoided three ways: an open session is reused
 * instead of creating another; the Stripe idempotency key is derived from the
 * submission and attempt number, so a retried request returns the same
 * session; and the database update only succeeds from the expected status.
 */
export async function createCheckoutForSubmission(
  submission: CheckoutSubmission | null,
  userId: string,
  siteUrl: string,
  deps: CheckoutDeps,
): Promise<CheckoutResult> {
  if (!submission || submission.submitter_id !== userId) return { ok: false, code: "not_found" };
  if (["paid", "refund_pending", "refunded"].includes(submission.payment_status)) return { ok: false, code: "already_paid" };
  if (submission.moderation_status !== "pending_payment") return { ok: false, code: "not_payable" };

  if (
    submission.payment_status === "checkout_created" &&
    submission.stripe_checkout_session_id &&
    submission.checkout_expires_at &&
    Date.parse(submission.checkout_expires_at) - deps.now() > 60_000
  ) {
    const existing = await deps.retrieveSession(submission.stripe_checkout_session_id);
    if (existing.status === "open" && existing.url) return { ok: true, url: existing.url, reused: true };
    if (existing.status === "complete") return { ok: false, code: "already_paid" };
  }

  const attempt = submission.checkout_attempts + 1;
  const params = buildCheckoutParams(submission, siteUrl, deps.now());
  const session = await deps.createSession(params, `submission-checkout:${submission.id}:${attempt}`);
  if (!session.url) return { ok: false, code: "conflict" };

  const recorded = await deps.recordSession({
    submissionId: submission.id,
    sessionId: session.id,
    expiresAt: new Date(session.expires_at * 1000).toISOString(),
    attempts: attempt,
    expectedStatuses: ["unpaid", "failed", "checkout_created"],
  });
  if (!recorded) return { ok: false, code: "conflict" };
  return { ok: true, url: session.url, reused: false };
}
