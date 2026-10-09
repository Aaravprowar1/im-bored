/**
 * Explicit state machines for paid submissions. Payment and moderation are
 * deliberately separate: payment is driven only by verified Stripe events,
 * moderation only by administrators. The database enforces the same rules
 * (check constraints + apply_payment_event / moderate_submission).
 */

export const PAYMENT_STATUSES = [
  "unpaid",
  "checkout_created",
  "paid",
  "failed",
  "refund_pending",
  "refunded",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const MODERATION_STATUSES = [
  "pending_payment",
  "pending_review",
  "needs_changes",
  "approved",
  "rejected",
] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

/** Payment events we act on, after Stripe signature verification. */
export type PaymentTrigger =
  | "checkout_completed_paid" // checkout.session.completed with payment_status = paid
  | "checkout_completed_unpaid" // completed but payment still processing (async methods)
  | "async_payment_succeeded"
  | "async_payment_failed"
  | "checkout_expired"
  | "charge_refunded";

/** For each trigger: the target state and the states it may move from. */
export const PAYMENT_TRANSITIONS: Record<
  PaymentTrigger,
  { to: PaymentStatus; from: readonly PaymentStatus[] } | null
> = {
  checkout_completed_paid: { to: "paid", from: ["checkout_created", "unpaid", "failed"] },
  checkout_completed_unpaid: null, // wait for async_payment_succeeded/failed
  async_payment_succeeded: { to: "paid", from: ["checkout_created", "unpaid", "failed"] },
  async_payment_failed: { to: "failed", from: ["checkout_created"] },
  checkout_expired: { to: "unpaid", from: ["checkout_created"] },
  charge_refunded: { to: "refunded", from: ["refund_pending", "paid"] },
};

export function canTransitionPayment(from: PaymentStatus, trigger: PaymentTrigger): boolean {
  const t = PAYMENT_TRANSITIONS[trigger];
  return t !== null && t.from.includes(from);
}

export type ModerationAction = "approve" | "reject" | "request_changes";

export const MODERATION_TRANSITIONS: Record<
  ModerationAction,
  { to: ModerationStatus; from: readonly ModerationStatus[]; requiresPaid: boolean; requiresNotes: boolean }
> = {
  approve: { to: "approved", from: ["pending_review"], requiresPaid: true, requiresNotes: false },
  reject: { to: "rejected", from: ["pending_review", "needs_changes"], requiresPaid: false, requiresNotes: true },
  request_changes: { to: "needs_changes", from: ["pending_review"], requiresPaid: true, requiresNotes: true },
};

export type ModerationCheck =
  | { ok: true; to: ModerationStatus }
  | { ok: false; reason: "payment_not_verified" | "invalid_transition" | "reason_required" };

export function checkModeration(
  submission: { payment_status: PaymentStatus; moderation_status: ModerationStatus },
  action: ModerationAction,
  notes?: string | null,
): ModerationCheck {
  const t = MODERATION_TRANSITIONS[action];
  if (t.requiresPaid && submission.payment_status !== "paid") {
    return { ok: false, reason: action === "approve" ? "payment_not_verified" : "invalid_transition" };
  }
  if (!t.from.includes(submission.moderation_status)) return { ok: false, reason: "invalid_transition" };
  if (t.requiresNotes && !notes?.trim()) return { ok: false, reason: "reason_required" };
  return { ok: true, to: t.to };
}

/** What the submitter should see about their payment, from verified server state. */
export type PaymentDisplay =
  | "not_started"
  | "checkout_in_progress"
  | "pending_verification"
  | "confirmed"
  | "failed"
  | "cancelled"
  | "refund_pending"
  | "refunded";

/**
 * Maps the stored payment status (plus where the browser came from) to a
 * display state. Returning from Stripe never shows "confirmed" by itself:
 * only a stored `paid` status, set by a verified webhook, does.
 */
export function paymentDisplay(status: PaymentStatus, returnedFrom: "success" | "cancel" | null): PaymentDisplay {
  switch (status) {
    case "paid":
      return "confirmed";
    case "refund_pending":
      return "refund_pending";
    case "refunded":
      return "refunded";
    case "failed":
      return "failed";
    case "checkout_created":
      if (returnedFrom === "success") return "pending_verification";
      if (returnedFrom === "cancel") return "cancelled";
      return "checkout_in_progress";
    case "unpaid":
      return returnedFrom === "cancel" ? "cancelled" : "not_started";
  }
}

export const PAYMENT_DISPLAY_COPY: Record<PaymentDisplay, { label: string; detail: string }> = {
  not_started: { label: "Payment not started", detail: "Pay the $1.00 USD review fee to send your activity to our moderators." },
  checkout_in_progress: { label: "Checkout in progress", detail: "A checkout session is open. Finish paying in Stripe, or start again." },
  pending_verification: {
    label: "Payment pending verification",
    detail: "Thanks! We're waiting for Stripe to confirm your payment. This page updates automatically.",
  },
  confirmed: { label: "Payment confirmed", detail: "Stripe confirmed your $1.00 USD payment. Your activity is in the review queue." },
  failed: { label: "Payment failed", detail: "Stripe reported that the payment did not go through. You have not been charged; you can try again." },
  cancelled: { label: "Payment cancelled", detail: "You left checkout before paying. Nothing was charged. You can try again whenever you like." },
  refund_pending: { label: "Refund pending", detail: "A refund has been issued and is waiting for Stripe to complete it." },
  refunded: { label: "Refunded", detail: "Your $1.00 USD fee was refunded." },
};

export const MODERATION_COPY: Record<ModerationStatus, { label: string; detail: string }> = {
  pending_payment: { label: "Waiting for payment", detail: "We review submissions once the $1 fee is confirmed." },
  pending_review: { label: "In review", detail: "A moderator will look at your activity. Approval isn't guaranteed." },
  needs_changes: { label: "Changes requested", detail: "A moderator asked for changes. Edit and resubmit at no extra cost." },
  approved: { label: "Approved and published", detail: "Your activity is live in the library." },
  rejected: { label: "Not approved", detail: "This activity wasn't accepted. See the moderator's note below." },
};
