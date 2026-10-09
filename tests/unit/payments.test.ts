import { describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { buildCheckoutParams, createCheckoutForSubmission, type CheckoutDeps, type CheckoutSubmission } from "@/lib/payments/checkout";
import { SUBMISSION_FEE } from "@/lib/payments/constants";
import { handleVerifiedEvent, interpretEvent, type ApplyPaymentEventInput, type VerifiedEvent } from "@/lib/payments/webhook";
import { canTransitionPayment, checkModeration, paymentDisplay } from "@/lib/submissions/state";

const SUB_ID = "7a1d2c3e-1111-4111-8111-111111111111";
const USER = "user-1";

function submission(patch: Partial<CheckoutSubmission> = {}): CheckoutSubmission {
  return {
    id: SUB_ID,
    submitter_id: USER,
    title: "A thing",
    payment_status: "unpaid",
    moderation_status: "pending_payment",
    stripe_checkout_session_id: null,
    checkout_expires_at: null,
    checkout_attempts: 0,
    ...patch,
  };
}

function deps(patch: Partial<CheckoutDeps> = {}): CheckoutDeps & { createSession: ReturnType<typeof vi.fn> } {
  return {
    now: () => Date.parse("2026-10-09T00:00:00Z"),
    createSession: vi.fn(async () => ({ id: "cs_new", url: "https://checkout.stripe.com/c/pay/cs_new", expires_at: 1_791_000_000 })),
    retrieveSession: vi.fn(async () => ({ id: "cs_old", url: "https://checkout.stripe.com/c/pay/cs_old", status: "open" })),
    recordSession: vi.fn(async () => true),
    ...patch,
  } as never;
}

describe("checkout session creation", () => {
  it("uses exactly 100 cents in USD, set on the server", async () => {
    const d = deps();
    const r = await createCheckoutForSubmission(submission(), USER, "https://imbored.test", d);
    expect(r).toEqual({ ok: true, url: "https://checkout.stripe.com/c/pay/cs_new", reused: false });
    const [params, key] = d.createSession.mock.calls[0];
    expect(params.line_items).toEqual([
      expect.objectContaining({ quantity: 1, price_data: expect.objectContaining({ unit_amount: 100, currency: "usd" }) }),
    ]);
    expect(SUBMISSION_FEE).toEqual({ amountCents: 100, currency: "usd" });
    expect(params.metadata).toEqual({ submission_id: SUB_ID });
    expect(params.client_reference_id).toBe(SUB_ID);
    expect(key).toBe(`submission-checkout:${SUB_ID}:1`);
  });

  it("points success/cancel URLs at the status page, which never confirms payment by itself", () => {
    const p = buildCheckoutParams({ id: SUB_ID }, "https://imbored.test", 0);
    expect(p.success_url).toBe(`https://imbored.test/submit/status/${SUB_ID}?checkout=success`);
    expect(p.cancel_url).toBe(`https://imbored.test/submit/status/${SUB_ID}?checkout=cancel`);
    expect(paymentDisplay("checkout_created", "success")).toBe("pending_verification");
    expect(paymentDisplay("unpaid", "success")).toBe("not_started");
  });

  it("refuses other users' submissions and already-paid ones", async () => {
    expect(await createCheckoutForSubmission(submission({ submitter_id: "someone-else" }), USER, "x", deps())).toEqual({ ok: false, code: "not_found" });
    expect(await createCheckoutForSubmission(null, USER, "x", deps())).toEqual({ ok: false, code: "not_found" });
    expect(await createCheckoutForSubmission(submission({ payment_status: "paid", moderation_status: "pending_review" }), USER, "x", deps())).toEqual({ ok: false, code: "already_paid" });
  });

  it("reuses an open session instead of creating a duplicate", async () => {
    const d = deps();
    const r = await createCheckoutForSubmission(
      submission({ payment_status: "checkout_created", stripe_checkout_session_id: "cs_old", checkout_expires_at: "2026-10-09T00:20:00Z", checkout_attempts: 1 }),
      USER,
      "x",
      d,
    );
    expect(r).toEqual({ ok: true, url: "https://checkout.stripe.com/c/pay/cs_old", reused: true });
    expect(d.createSession).not.toHaveBeenCalled();
  });

  it("creates a new attempt after a failed or expired session, with a new idempotency key", async () => {
    const d = deps();
    await createCheckoutForSubmission(submission({ payment_status: "failed", checkout_attempts: 2 }), USER, "x", d);
    expect(d.createSession.mock.calls[0][1]).toBe(`submission-checkout:${SUB_ID}:3`);
  });

  it("reports a conflict when the state changed concurrently", async () => {
    const r = await createCheckoutForSubmission(submission(), USER, "x", deps({ recordSession: async () => false }));
    expect(r).toEqual({ ok: false, code: "conflict" });
  });
});

const WEBHOOK_SECRET = "whsec_test_secret";
const stripe = new Stripe("sk_test_dummy");

function signed(event: object) {
  const payload = JSON.stringify(event);
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  return { payload, header };
}

function sessionEvent(type: string, patch: Record<string, unknown> = {}, id = "evt_1"): VerifiedEvent {
  return {
    id,
    type,
    livemode: false,
    data: {
      object: {
        id: "cs_123",
        object: "checkout.session",
        client_reference_id: SUB_ID,
        metadata: { submission_id: SUB_ID },
        payment_status: "paid",
        amount_total: 100,
        currency: "usd",
        payment_intent: "pi_123",
        ...patch,
      },
    },
  };
}

describe("webhook signature verification", () => {
  it("accepts a correctly signed payload and rejects tampered or unsigned ones", () => {
    const { payload, header } = signed(sessionEvent("checkout.session.completed"));
    expect(stripe.webhooks.constructEvent(payload, header, WEBHOOK_SECRET).id).toBe("evt_1");
    expect(() => stripe.webhooks.constructEvent(payload.replace('"amount_total":100', '"amount_total":1'), header, WEBHOOK_SECRET)).toThrow();
    expect(() => stripe.webhooks.constructEvent(payload, header, "whsec_other")).toThrow();
    expect(() => stripe.webhooks.constructEvent(payload, "t=1,v1=bad", WEBHOOK_SECRET)).toThrow();
  });
});

describe("webhook event handling", () => {
  function recorder() {
    const calls: ApplyPaymentEventInput[] = [];
    const seen = new Set<string>();
    return {
      calls,
      deps: {
        applyPaymentEvent: async (input: ApplyPaymentEventInput) => {
          calls.push(input);
          if (seen.has(input.eventId)) return "duplicate" as const;
          seen.add(input.eventId);
          return input.toStatus ? ("applied" as const) : ("ignored" as const);
        },
      },
    };
  }

  it("maps a paid checkout to paid, from pre-payment states only", async () => {
    const r = recorder();
    expect(await handleVerifiedEvent(sessionEvent("checkout.session.completed"), r.deps)).toBe("applied");
    expect(r.calls[0]).toMatchObject({ submissionId: SUB_ID, checkoutSessionId: "cs_123", toStatus: "paid", amountCents: 100, currency: "usd" });
    expect(r.calls[0].fromStatuses).not.toContain("refunded");
  });

  it("reports duplicates without a second transition", async () => {
    const r = recorder();
    await handleVerifiedEvent(sessionEvent("checkout.session.completed"), r.deps);
    expect(await handleVerifiedEvent(sessionEvent("checkout.session.completed"), r.deps)).toBe("duplicate");
  });

  it("does not mark async (unpaid) completions as paid", async () => {
    const r = recorder();
    expect(await handleVerifiedEvent(sessionEvent("checkout.session.completed", { payment_status: "unpaid" }), r.deps)).toBe("ignored");
    expect(r.calls[0].toStatus).toBeNull();
  });

  it("refuses amounts or currencies other than 100 USD", async () => {
    const r = recorder();
    expect(await handleVerifiedEvent(sessionEvent("checkout.session.completed", { amount_total: 9900 }), r.deps)).toBe("amount_mismatch");
    expect(await handleVerifiedEvent(sessionEvent("checkout.session.completed", { currency: "inr" }, "evt_2"), r.deps)).toBe("amount_mismatch");
    expect(r.calls.every((c) => c.toStatus === null)).toBe(true);
  });

  it("requires metadata and client_reference_id to agree", async () => {
    const r = recorder();
    await handleVerifiedEvent(sessionEvent("checkout.session.completed", { client_reference_id: "3c0e0000-1111-4111-8111-111111111111" }), r.deps);
    expect(r.calls[0]).toMatchObject({ submissionId: null, toStatus: null });
  });

  it("handles failed and expired (cancelled) checkouts", async () => {
    const r = recorder();
    await handleVerifiedEvent(sessionEvent("checkout.session.async_payment_failed", {}, "evt_f"), r.deps);
    await handleVerifiedEvent(sessionEvent("checkout.session.expired", { payment_status: "unpaid" }, "evt_e"), r.deps);
    expect(r.calls.map((c) => c.toStatus)).toEqual(["failed", "unpaid"]);
  });

  it("maps full refunds by payment intent and ignores unrelated events", async () => {
    const r = recorder();
    await handleVerifiedEvent(
      { id: "evt_r", type: "charge.refunded", livemode: false, data: { object: { refunded: true, amount: 100, amount_refunded: 100, payment_intent: "pi_123", currency: "usd" } } },
      r.deps,
    );
    expect(r.calls[0]).toMatchObject({ toStatus: "refunded", paymentIntentId: "pi_123", submissionId: null });
    expect(await handleVerifiedEvent({ id: "evt_x", type: "customer.created", livemode: false, data: { object: {} } }, r.deps)).toBe("ignored");
    expect(interpretEvent({ id: "e", type: "charge.refunded", livemode: false, data: { object: { refunded: false, amount: 100, amount_refunded: 50 } } }).trigger).toBeNull();
  });
});

describe("state machines", () => {
  it("keeps payment and moderation separate", () => {
    expect(checkModeration({ payment_status: "checkout_created", moderation_status: "pending_payment" }, "approve")).toEqual({ ok: false, reason: "payment_not_verified" });
    expect(checkModeration({ payment_status: "paid", moderation_status: "pending_review" }, "approve")).toEqual({ ok: true, to: "approved" });
    expect(checkModeration({ payment_status: "paid", moderation_status: "pending_review" }, "reject", "")).toEqual({ ok: false, reason: "reason_required" });
    expect(checkModeration({ payment_status: "paid", moderation_status: "approved" }, "approve")).toEqual({ ok: false, reason: "invalid_transition" });
    expect(canTransitionPayment("refunded", "checkout_completed_paid")).toBe(false);
    expect(canTransitionPayment("checkout_created", "checkout_expired")).toBe(true);
  });

  it("shows every payment display state from server data", () => {
    expect(paymentDisplay("unpaid", null)).toBe("not_started");
    expect(paymentDisplay("checkout_created", null)).toBe("checkout_in_progress");
    expect(paymentDisplay("checkout_created", "success")).toBe("pending_verification");
    expect(paymentDisplay("paid", null)).toBe("confirmed");
    expect(paymentDisplay("failed", null)).toBe("failed");
    expect(paymentDisplay("checkout_created", "cancel")).toBe("cancelled");
    expect(paymentDisplay("refund_pending", null)).toBe("refund_pending");
    expect(paymentDisplay("refunded", null)).toBe("refunded");
  });
});
