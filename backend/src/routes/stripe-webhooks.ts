import { Router } from "express";

import { env } from "../config/env";
import { getStripe } from "../config/stripe";
import {
  markStripeCheckoutPaymentFailed,
  syncSucceededStripeCheckoutPayment,
} from "../services/cart-service";

export const stripeWebhooksRouter = Router();

type StripeClient = ReturnType<typeof getStripe>;
type StripeWebhookEvent = ReturnType<
  StripeClient["webhooks"]["constructEvent"]
>;
type StripePaymentIntent = Awaited<
  ReturnType<StripeClient["paymentIntents"]["retrieve"]>
>;

function getStripeWebhookSecret(): string {
  const secret = env.STRIPE_WEBHOOK_SECRET.trim();

  if (!secret) {
    throw new Error(
      "Missing STRIPE_WEBHOOK_SECRET in backend/.env. Add your Stripe webhook signing secret before enabling Stripe webhooks.",
    );
  }

  return secret;
}

async function handleStripeWebhookEvent(
  event: StripeWebhookEvent,
): Promise<void> {
  switch (event.type) {
    case "payment_intent.succeeded":
      await syncSucceededStripeCheckoutPayment(
        event.data.object as StripePaymentIntent,
        { eventId: event.id },
      );
      return;
    case "payment_intent.canceled":
    case "payment_intent.payment_failed":
      await markStripeCheckoutPaymentFailed(
        event.data.object as StripePaymentIntent,
        event.id,
      );
      return;
    default:
      return;
  }
}

stripeWebhooksRouter.post("/", async (request, response, next) => {
  const signature = request.header("stripe-signature");

  if (!signature) {
    response.status(400).json({
      success: false,
      error: "Missing Stripe signature.",
    });
    return;
  }

  if (!Buffer.isBuffer(request.body)) {
    response.status(400).json({
      success: false,
      error: "Stripe webhook requires the raw request body.",
    });
    return;
  }

  let event: StripeWebhookEvent;

  try {
    event = getStripe().webhooks.constructEvent(
      request.body,
      signature,
      getStripeWebhookSecret(),
    );
  } catch (error) {
    response.status(400).json({
      success: false,
      error:
        error instanceof Error
          ? `Stripe webhook signature verification failed: ${error.message}`
          : "Stripe webhook signature verification failed.",
    });
    return;
  }

  try {
    await handleStripeWebhookEvent(event);
    response.json({ success: true, received: true });
  } catch (error) {
    next(error);
  }
});
