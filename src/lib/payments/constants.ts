/**
 * The submission fee is fixed here, on the server, and nowhere else. Requests
 * from the browser never carry an amount or currency. The database also has
 * CHECK constraints (amount_cents = 100, currency = 'usd').
 */
export const SUBMISSION_FEE = Object.freeze({ amountCents: 100, currency: "usd" as const });
export const SUBMISSION_FEE_LABEL = "$1.00 USD";
/** Stripe's minimum Checkout lifetime is 30 minutes. */
export const CHECKOUT_TTL_SECONDS = 30 * 60;
