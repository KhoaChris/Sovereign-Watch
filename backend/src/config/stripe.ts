import Stripe from "stripe";

import { env } from "./env";

let stripeClient: InstanceType<typeof Stripe> | null = null;

export function getStripe(): InstanceType<typeof Stripe> {
  if (!env.STRIPE_SECRET_KEY.trim()) {
    throw new Error(
      "Missing STRIPE_SECRET_KEY in backend/.env. Add your Stripe secret key to enable embedded checkout.",
    );
  }

  if (!stripeClient) {
    stripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-03-25.dahlia",
    });
  }

  return stripeClient;
}
