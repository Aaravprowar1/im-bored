import { describe, expect, it } from "vitest";
import { handleVerifiedEvent, type ApplyOutcome, type VerifiedEvent } from "@/lib/payments/webhook";
import { as, createDb, createUser, type Db } from "./harness";

const USER = "00000000-0000-4000-8000-0000000000c1";

/** Runs the real webhook handler against the real SQL function. */
function deps(db: Db) {
  return {
    applyPaymentEvent: async (i: Parameters<Parameters<typeof handleVerifiedEvent>[1]["applyPaymentEvent"]>[0]) =>
      as(db, "service_role", null, async () => {
        const r = await db.query<{ o: ApplyOutcome }>(
          "select public.apply_payment_event($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) o",
          [i.eventId, i.eventType, i.livemode, i.submissionId, i.checkoutSessionId, i.paymentIntentId, i.amountCents, i.currency, i.toStatus, i.fromStatuses],
        );
        return r.rows[0].o;
      }),
  };
}

function completed(subId: string, id: string, patch: Record<string, unknown> = {}): VerifiedEvent {
  return {
    id,
    type: "checkout.session.completed",
    livemode: false,
    data: { object: { id: "cs_live", client_reference_id: subId, metadata: { submission_id: subId }, payment_status: "paid", amount_total: 100, currency: "usd", payment_intent: "pi_1", ...patch } },
  };
}

describe("webhook flow against the database", () => {
  it("is idempotent, verifies identifiers and never publishes", async () => {
    const db = await createDb({ seed: false });
    await createUser(db, USER, "payer");
    const subId = (
      await as(db, "authenticated", USER, () =>
        db.query<{ id: string }>("select public.create_submission($1,'Paid idea here','Something fun to do for a few minutes.','creative',5,'easy','anywhere','low','free','either') id", [
          "44444444-4444-4444-8444-444444444444",
        ]),
      )
    ).rows[0].id;
    await db.query("update public.activity_submissions set payment_status='checkout_created', stripe_checkout_session_id='cs_live' where id=$1", [subId]);

    const d = deps(db);
    // Concurrent duplicate deliveries of the same event.
    const outcomes = await Promise.all([handleVerifiedEvent(completed(subId, "evt_a"), d), handleVerifiedEvent(completed(subId, "evt_a"), d)]);
    expect(outcomes.sort()).toEqual(["applied", "duplicate"]);
    // A different event for an already-paid submission is recorded but changes nothing.
    expect(await handleVerifiedEvent(completed(subId, "evt_b"), d)).toBe("invalid_transition");

    const row = (await db.query<Record<string, unknown>>("select payment_status, moderation_status, paid_at is not null as paid, stripe_payment_intent_id from public.activity_submissions where id=$1", [subId])).rows[0];
    expect(row).toEqual({ payment_status: "paid", moderation_status: "pending_review", paid: true, stripe_payment_intent_id: "pi_1" });
    const published = await db.query("select 1 from public.activities");
    expect(published.rows).toHaveLength(0);

    // Refund by payment intent.
    await db.query("update public.activity_submissions set moderation_status='rejected' where id=$1", [subId]);
    expect(
      await handleVerifiedEvent({ id: "evt_r", type: "charge.refunded", livemode: false, data: { object: { refunded: true, amount: 100, amount_refunded: 100, payment_intent: "pi_1", currency: "usd" } } }, d),
    ).toBe("applied");
    const refunded = (await db.query<{ payment_status: string }>("select payment_status from public.activity_submissions where id=$1", [subId])).rows[0];
    expect(refunded.payment_status).toBe("refunded");
  });
});
