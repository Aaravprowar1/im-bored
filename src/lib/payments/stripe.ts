import "server-only";
import Stripe from "stripe";
import { serverConfig } from "@/lib/server-config";

let client: Stripe | null = null;

/** Returns the Stripe SDK client, or null when Stripe is not configured. */
export function getStripe(): Stripe | null {
  const key = serverConfig().stripeSecretKey;
  if (!key) return null;
  client ??= new Stripe(key, { maxNetworkRetries: 2, appInfo: { name: "im bored." } });
  return client;
}
