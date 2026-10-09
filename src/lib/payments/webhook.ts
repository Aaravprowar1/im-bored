import { SUBMISSION_FEE } from "./constants";
import { PAYMENT_TRANSITIONS, type PaymentStatus, type PaymentTrigger } from "@/lib/submissions/state";

/** Minimal structural view of a verified Stripe event. */
export interface VerifiedEvent {
  id: string;
  type: string;
  livemode: boolean;
  data: { object: unknown };
}

export interface ApplyPaymentEventInput {
  eventId: string;
  eventType: string;
  livemode: boolean;
  submissionId: string | null;
  checkoutSessionId: string | null;
  paymentIntentId: string | null;
  amountCents: number | null;
  currency: string | null;
  toStatus: PaymentStatus | null;
  fromStatuses: PaymentStatus[];
}

export type ApplyOutcome =
  | "applied"
  | "duplicate"
  | "ignored"
  | "unknown_submission"
  | "session_mismatch"
  | "payment_intent_mismatch"
  | "amount_mismatch"
  | "invalid_transition";

export interface WebhookDeps {
  /** Atomically records the event id and applies the transition (apply_payment_event). */
  applyPaymentEvent(input: ApplyPaymentEventInput): Promise<ApplyOutcome>;
}

type Obj = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : null);
const num = (v: unknown) => (typeof v === "number" ? v : null);
const idOf = (v: unknown) => (typeof v === "string" ? v : v && typeof v === "object" ? str((v as Obj).id) : null);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Translates a verified Stripe event into a state-machine trigger and identifiers. */
export function interpretEvent(event: VerifiedEvent): {
  trigger: PaymentTrigger | null;
  submissionId: string | null;
  checkoutSessionId: string | null;
  paymentIntentId: string | null;
  amountCents: number | null;
  currency: string | null;
} {
  const o = (event.data?.object ?? {}) as Obj;
  const empty = { trigger: null, submissionId: null, checkoutSessionId: null, paymentIntentId: null, amountCents: null, currency: null };

  if (event.type.startsWith("checkout.session.")) {
    const metadata = (o.metadata ?? {}) as Obj;
    const fromMeta = str(metadata.submission_id);
    const fromRef = str(o.client_reference_id);
    // Both identifiers are set by our server; they must agree.
    const submissionId = fromMeta && fromMeta === fromRef && UUID.test(fromMeta) ? fromMeta : null;
    let trigger: PaymentTrigger | null = null;
    if (event.type === "checkout.session.completed") {
      trigger = o.payment_status === "paid" ? "checkout_completed_paid" : "checkout_completed_unpaid";
    } else if (event.type === "checkout.session.async_payment_succeeded") trigger = "async_payment_succeeded";
    else if (event.type === "checkout.session.async_payment_failed") trigger = "async_payment_failed";
    else if (event.type === "checkout.session.expired") trigger = "checkout_expired";
    return {
      trigger,
      submissionId,
      checkoutSessionId: str(o.id),
      paymentIntentId: idOf(o.payment_intent),
      amountCents: num(o.amount_total),
      currency: str(o.currency),
    };
  }

  if (event.type === "charge.refunded") {
    // Only full refunds count as "refunded".
    const fully = o.refunded === true && num(o.amount_refunded) === num(o.amount);
    return {
      ...empty,
      trigger: fully ? "charge_refunded" : null,
      paymentIntentId: idOf(o.payment_intent),
      amountCents: num(o.amount),
      currency: str(o.currency),
    };
  }

  return empty;
}

export const HANDLED_EVENT_TYPES = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "charge.refunded",
] as const;

/**
 * Processes a signature-verified event. Idempotency and the compare-and-set
 * transition both happen inside apply_payment_event, so duplicate or
 * concurrent deliveries cannot cause double transitions.
 */
export async function handleVerifiedEvent(event: VerifiedEvent, deps: WebhookDeps): Promise<ApplyOutcome> {
  if (!(HANDLED_EVENT_TYPES as readonly string[]).includes(event.type)) return "ignored";
  const info = interpretEvent(event);
  const transition = info.trigger ? PAYMENT_TRANSITIONS[info.trigger] : null;

  // Checkout events must identify a submission; refunds are matched by payment intent.
  if (event.type.startsWith("checkout.session.") && !info.submissionId) {
    return deps.applyPaymentEvent({ ...baseInput(event, info), toStatus: null, fromStatuses: [] });
  }
  // Belt and braces: the SQL function re-checks amount and currency against the row.
  if (transition?.to === "paid" && (info.amountCents !== SUBMISSION_FEE.amountCents || info.currency !== SUBMISSION_FEE.currency)) {
    return deps.applyPaymentEvent({ ...baseInput(event, info), toStatus: null, fromStatuses: [] }).then((o) =>
      o === "duplicate" ? o : "amount_mismatch",
    );
  }
  return deps.applyPaymentEvent({
    ...baseInput(event, info),
    toStatus: transition?.to ?? null,
    fromStatuses: transition ? [...transition.from] : [],
  });
}

function baseInput(event: VerifiedEvent, info: ReturnType<typeof interpretEvent>) {
  return {
    eventId: event.id,
    eventType: event.type,
    livemode: event.livemode,
    submissionId: info.submissionId,
    checkoutSessionId: event.type.startsWith("checkout.session.") ? info.checkoutSessionId : null,
    paymentIntentId: info.paymentIntentId,
    amountCents: info.amountCents,
    currency: info.currency,
  };
}
