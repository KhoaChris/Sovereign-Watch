import { getStripe } from "../config/stripe";
import { getDb } from "../config/firebase";
import type {
  AddCartItemPayload,
  CartItemRecord,
  CartRecord,
  CheckoutDetailsInput,
  CheckoutCartPayload,
  CheckoutCartResponse,
  FinalizeCheckoutPayload,
  OrderRecord,
  PrepareCheckoutPaymentPayload,
  PrepareCheckoutPaymentResponse,
  StripeCheckoutPaymentMethod,
  UpdateCartItemPayload,
} from "../shared";
import { nowIsoString } from "../utils/dates";
import { createEntityId } from "../utils/ids";
import { sendOrderConfirmationEmail } from "./email-service";
import { findVariantById } from "./product-service";
import { createOrder, getOrderById, updateOrder } from "./order-service";
import { getUserProfile } from "./user-service";

const CARTS_COLLECTION = "carts";
const STRIPE_CHECKOUT_INTENTS_COLLECTION = "stripeCheckoutIntents";
const STRIPE_CHECKOUT_PROCESSING_TIMEOUT_MS = 60_000;
const STRIPE_CHECKOUT_WAIT_ATTEMPTS = 8;
const STRIPE_CHECKOUT_WAIT_MS = 250;

type StripeClient = ReturnType<typeof getStripe>;
type StripePaymentIntent = Awaited<
  ReturnType<StripeClient["paymentIntents"]["retrieve"]>
>;

type StripeCheckoutSyncStatus =
  | "requires_payment_method"
  | "processing"
  | "succeeded"
  | "failed"
  | "canceled";

interface StripeCheckoutIntentRecord {
  id: string;
  amount: number;
  cartId: string;
  cartUpdatedAt: string;
  checkoutDetails: CheckoutDetailsInput;
  createdAt: string;
  currency: string;
  emailSentAt: string | null;
  failureMessage: string | null;
  items: Array<{
    productVariantId: string;
    quantity: number;
  }>;
  lastStripeEventId: string | null;
  orderId: string | null;
  paymentIntentId: string;
  paymentMethod: StripeCheckoutPaymentMethod;
  processingStartedAt: string | null;
  stripeStatus: StripePaymentIntent["status"];
  syncStatus: StripeCheckoutSyncStatus;
  updatedAt: string;
  userId: string;
}

function createEmptyCart(userId: string): CartRecord {
  return {
    id: userId,
    userId,
    sessionId: null,
    totalAmount: 0,
    updatedAt: nowIsoString(),
    items: [],
    itemCount: 0,
  };
}

function formatCheckoutShippingAddress(
  payload: CheckoutDetailsInput,
): string {
  return [
    `${payload.fullName.trim()} · ${payload.phoneNumber.trim()}`,
    payload.shippingAddress.trim(),
    payload.deliveryNotes?.trim()
      ? `Notes: ${payload.deliveryNotes.trim()}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function toStripeAmount(value: number): number {
  return Math.round(value * 100);
}

function normalizeCheckoutDetails(
  details: CheckoutDetailsInput,
): CheckoutDetailsInput {
  return {
    deliveryNotes: details.deliveryNotes?.trim() ?? "",
    email: details.email.trim(),
    fullName: details.fullName.trim(),
    phoneNumber: details.phoneNumber.trim(),
    saveToAccount: Boolean(details.saveToAccount),
    shippingAddress: details.shippingAddress.trim(),
  };
}

function mapPaymentIntentSyncStatus(
  status: StripePaymentIntent["status"],
): StripeCheckoutSyncStatus {
  switch (status) {
    case "canceled":
      return "canceled";
    case "processing":
      return "processing";
    case "succeeded":
      return "succeeded";
    case "requires_payment_method":
      return "requires_payment_method";
    default:
      return "requires_payment_method";
  }
}

function getStripeCheckoutIntentRef(paymentIntentId: string) {
  return getDb()
    .collection(STRIPE_CHECKOUT_INTENTS_COLLECTION)
    .doc(paymentIntentId);
}

function buildStripeCheckoutIntentRecord(
  userId: string,
  cart: CartRecord,
  paymentIntent: StripePaymentIntent,
  payload: PrepareCheckoutPaymentPayload,
): StripeCheckoutIntentRecord {
  const createdAt = nowIsoString();
  const normalizedCart = withCartTotals(cart);

  return {
    id: paymentIntent.id,
    amount: normalizedCart.totalAmount,
    cartId: normalizedCart.id,
    cartUpdatedAt: normalizedCart.updatedAt,
    checkoutDetails: normalizeCheckoutDetails(payload.details),
    createdAt,
    currency: paymentIntent.currency,
    emailSentAt: null,
    failureMessage: null,
    items: normalizedCart.items.map((item) => ({
      productVariantId: item.productVariantId,
      quantity: item.quantity,
    })),
    lastStripeEventId: null,
    orderId: null,
    paymentIntentId: paymentIntent.id,
    paymentMethod: payload.paymentMethod,
    processingStartedAt: null,
    stripeStatus: paymentIntent.status,
    syncStatus: mapPaymentIntentSyncStatus(paymentIntent.status),
    updatedAt: createdAt,
    userId,
  };
}

async function getStripeCheckoutIntentRecord(
  paymentIntentId: string,
): Promise<StripeCheckoutIntentRecord | null> {
  const snapshot = await getStripeCheckoutIntentRef(paymentIntentId).get();

  if (!snapshot.exists) {
    return null;
  }

  return snapshot.data() as StripeCheckoutIntentRecord;
}

async function persistStripeCheckoutIntentRecord(
  record: StripeCheckoutIntentRecord,
): Promise<void> {
  await getStripeCheckoutIntentRef(record.paymentIntentId).set(record);
}

function withCartTotals(cart: CartRecord): CartRecord {
  const items = cart.items.map((item) => ({
    ...item,
    lineTotal: item.pricePerUnit * item.quantity,
  }));

  return {
    ...cart,
    items,
    totalAmount: items.reduce((sum, item) => sum + item.lineTotal, 0),
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
  };
}

async function getStoredCart(userId: string): Promise<CartRecord> {
  const snapshot = await getDb().collection(CARTS_COLLECTION).doc(userId).get();

  if (!snapshot.exists) {
    const empty = createEmptyCart(userId);
    await getDb().collection(CARTS_COLLECTION).doc(userId).set(empty);
    return empty;
  }

  return withCartTotals(snapshot.data() as CartRecord);
}

async function persistCart(cart: CartRecord): Promise<CartRecord> {
  const normalized = withCartTotals({
    ...cart,
    updatedAt: nowIsoString(),
  });

  await getDb().collection(CARTS_COLLECTION).doc(cart.id).set(normalized);
  return normalized;
}

export async function clearCartRecord(userId: string): Promise<CartRecord> {
  const cart = await getStoredCart(userId);

  return persistCart({
    ...cart,
    items: [],
  });
}

async function clearCartItemsFromStripeSnapshot(
  record: StripeCheckoutIntentRecord,
): Promise<CartRecord> {
  const cart = await getStoredCart(record.userId);

  if (cart.items.length === 0) {
    return cart;
  }

  const paidQuantities = new Map<string, number>();

  for (const item of record.items) {
    paidQuantities.set(
      item.productVariantId,
      (paidQuantities.get(item.productVariantId) ?? 0) + item.quantity,
    );
  }

  const items = cart.items.flatMap((item) => {
    const paidQuantity = paidQuantities.get(item.productVariantId) ?? 0;

    if (paidQuantity <= 0) {
      return [item];
    }

    const quantity = item.quantity - paidQuantity;

    if (quantity <= 0) {
      return [];
    }

    return [
      {
        ...item,
        lineTotal: item.pricePerUnit * quantity,
        quantity,
      },
    ];
  });

  return persistCart({
    ...cart,
    items,
  });
}

function buildCartItem(
  cartId: string,
  productId: string,
  payload: AddCartItemPayload,
  snapshot: Awaited<ReturnType<typeof findVariantById>>,
): CartItemRecord {
  if (!snapshot) {
    throw new Error("Variant not found.");
  }

  const { product, variant } = snapshot;
  const pricePerUnit = variant.discountPrice ?? variant.price;

  return {
    id: createEntityId(),
    cartId,
    productId,
    productVariantId: variant.id,
    quantity: payload.quantity,
    pricePerUnit,
    productName: product.name,
    productType: product.type,
    productImage: product.images[0] ?? "",
    variantColor: variant.color,
    variantSize: variant.size,
    addedAt: nowIsoString(),
    lineTotal: pricePerUnit * payload.quantity,
  };
}

export async function getCartRecord(userId: string): Promise<CartRecord> {
  return withCartTotals(await getStoredCart(userId));
}

export async function addCartItem(userId: string, payload: AddCartItemPayload): Promise<CartRecord> {
  const snapshot = await findVariantById(payload.productVariantId);

  if (!snapshot) {
    throw new Error("Variant not found.");
  }

  if (payload.quantity < 1) {
    throw new Error("Quantity must be at least 1.");
  }

  if (payload.quantity > snapshot.variant.stockQuantity) {
    throw new Error("The requested quantity exceeds available stock.");
  }

  const cart = await getStoredCart(userId);
  const existingItem = cart.items.find((item) => item.productVariantId === payload.productVariantId);

  if (existingItem) {
    const nextQuantity = existingItem.quantity + payload.quantity;

    if (nextQuantity > snapshot.variant.stockQuantity) {
      throw new Error("The requested quantity exceeds available stock.");
    }

    existingItem.quantity = nextQuantity;
    existingItem.lineTotal = existingItem.pricePerUnit * existingItem.quantity;
    existingItem.productName = snapshot.product.name;
    existingItem.productType = snapshot.product.type;
    existingItem.productImage = snapshot.product.images[0] ?? "";
    existingItem.variantColor = snapshot.variant.color;
    existingItem.variantSize = snapshot.variant.size;
  } else {
    cart.items.unshift(buildCartItem(cart.id, snapshot.product.id, payload, snapshot));
  }

  return persistCart(cart);
}

export async function updateCartItemQuantity(
  userId: string,
  itemId: string,
  payload: UpdateCartItemPayload,
): Promise<CartRecord> {
  const cart = await getStoredCart(userId);
  const targetItem = cart.items.find((item) => item.id === itemId);

  if (!targetItem) {
    throw new Error("Cart item not found.");
  }

  if (payload.quantity <= 0) {
    return removeCartItem(userId, itemId);
  }

  const snapshot = await findVariantById(targetItem.productVariantId);

  if (!snapshot) {
    throw new Error("Variant not found.");
  }

  if (payload.quantity > snapshot.variant.stockQuantity) {
    throw new Error("The requested quantity exceeds available stock.");
  }

  targetItem.quantity = payload.quantity;
  targetItem.pricePerUnit = snapshot.variant.discountPrice ?? snapshot.variant.price;
  targetItem.variantColor = snapshot.variant.color;
  targetItem.variantSize = snapshot.variant.size;
  targetItem.productName = snapshot.product.name;
  targetItem.productType = snapshot.product.type;
  targetItem.productImage = snapshot.product.images[0] ?? "";
  targetItem.lineTotal = targetItem.pricePerUnit * targetItem.quantity;

  return persistCart(cart);
}

export async function removeCartItem(userId: string, itemId: string): Promise<CartRecord> {
  const cart = await getStoredCart(userId);

  return persistCart({
    ...cart,
    items: cart.items.filter((item) => item.id !== itemId),
  });
}

export async function checkoutCartRecord(
  userId: string,
  payload: CheckoutCartPayload,
): Promise<CheckoutCartResponse> {
  const cart = await getStoredCart(userId);

  if (cart.items.length === 0) {
    throw new Error("Your reserve cart is empty.");
  }

  const order = await createOrder(userId, {
    items: cart.items.map((item) => ({
      productVariantId: item.productVariantId,
      quantity: item.quantity,
    })),
    paymentMethod: payload.paymentMethod,
    shippingAddress: payload.shippingAddress.trim(),
  });

  const clearedCart = await clearCartRecord(userId);
  const profile = await getUserProfile(userId);

  if (profile?.email) {
    await notifyOrderConfirmation(order, profile.email, profile.fullName);
  }

  return {
    cart: clearedCart,
    order,
  };
}

export async function prepareCheckoutPayment(
  userId: string,
  payload: PrepareCheckoutPaymentPayload,
): Promise<PrepareCheckoutPaymentResponse> {
  const cart = await getStoredCart(userId);

  if (cart.items.length === 0) {
    throw new Error("Your reserve cart is empty.");
  }

  const normalizedCart = withCartTotals(cart);
  const stripe = getStripe();
  const paymentIntent = await stripe.paymentIntents.create({
    amount: toStripeAmount(normalizedCart.totalAmount),
    automatic_payment_methods: {
      enabled: true,
    },
    currency: "usd",
    metadata: {
      cartId: normalizedCart.id,
      cartUpdatedAt: normalizedCart.updatedAt,
      checkoutSnapshot: "stripeCheckoutIntents",
      paymentMethodPreference: payload.paymentMethod,
      userId,
    },
    receipt_email: payload.details.email.trim(),
  });

  if (!paymentIntent.client_secret) {
    throw new Error("Stripe did not return a payment secret for this checkout.");
  }

  await persistStripeCheckoutIntentRecord(
    buildStripeCheckoutIntentRecord(userId, normalizedCart, paymentIntent, payload),
  );

  return {
    amount: normalizedCart.totalAmount,
    clientSecret: paymentIntent.client_secret,
    currency: paymentIntent.currency,
    paymentIntentId: paymentIntent.id,
  };
}

async function createCheckoutOrder(
  userId: string,
  payload: FinalizeCheckoutPayload,
): Promise<CheckoutCartResponse> {
  const order = await createOrder(userId, {
    items: (await getStoredCart(userId)).items.map((item) => ({
      productVariantId: item.productVariantId,
      quantity: item.quantity,
    })),
    paymentMethod: payload.paymentMethod,
    shippingAddress: formatCheckoutShippingAddress(payload.details),
  });

  const clearedCart = await clearCartRecord(userId);

  return {
    cart: clearedCart,
    order,
  };
}

async function notifyOrderConfirmation(
  order: CheckoutCartResponse["order"],
  customerEmail: string,
  customerName: string,
): Promise<void> {
  try {
    await sendOrderConfirmationEmail({
      customerEmail,
      customerName,
      order,
    });
  } catch (error) {
    console.error(
      `Order confirmation email failed for ${order.orderNumber}:`,
      error,
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForSyncedStripeCheckoutOrder(
  paymentIntentId: string,
): Promise<OrderRecord | null> {
  for (let attempt = 0; attempt < STRIPE_CHECKOUT_WAIT_ATTEMPTS; attempt += 1) {
    await sleep(STRIPE_CHECKOUT_WAIT_MS);

    const record = await getStripeCheckoutIntentRecord(paymentIntentId);

    if (!record?.orderId) {
      continue;
    }

    return getOrderById(record.orderId);
  }

  return null;
}

async function claimStripeCheckoutIntent(
  paymentIntentId: string,
  eventId: string | null,
): Promise<
  | { record: StripeCheckoutIntentRecord; state: "claimed" }
  | { record: StripeCheckoutIntentRecord; state: "processing" }
  | { record: StripeCheckoutIntentRecord; state: "synced" }
  | { state: "missing" }
> {
  const ref = getStripeCheckoutIntentRef(paymentIntentId);
  const now = nowIsoString();

  return getDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);

    if (!snapshot.exists) {
      return { state: "missing" as const };
    }

    const record = snapshot.data() as StripeCheckoutIntentRecord;

    if (record.orderId) {
      return { record, state: "synced" as const };
    }

    const processingStartedAt = record.processingStartedAt
      ? Date.parse(record.processingStartedAt)
      : 0;
    const processingStillFresh =
      record.syncStatus === "processing" &&
      Number.isFinite(processingStartedAt) &&
      Date.now() - processingStartedAt < STRIPE_CHECKOUT_PROCESSING_TIMEOUT_MS;

    if (processingStillFresh) {
      return { record, state: "processing" as const };
    }

    const nextRecord: StripeCheckoutIntentRecord = {
      ...record,
      lastStripeEventId: eventId ?? record.lastStripeEventId,
      processingStartedAt: now,
      syncStatus: "processing",
      updatedAt: now,
    };

    transaction.set(ref, nextRecord);
    return { record: nextRecord, state: "claimed" as const };
  });
}

async function markStripeCheckoutIntent(
  paymentIntentId: string,
  patch: Partial<StripeCheckoutIntentRecord>,
): Promise<StripeCheckoutIntentRecord | null> {
  const existing = await getStripeCheckoutIntentRecord(paymentIntentId);

  if (!existing) {
    return null;
  }

  const updated: StripeCheckoutIntentRecord = {
    ...existing,
    ...patch,
    updatedAt: nowIsoString(),
  };

  await persistStripeCheckoutIntentRecord(updated);
  return updated;
}

async function notifyStripeCheckoutOrder(
  record: StripeCheckoutIntentRecord,
  order: OrderRecord,
): Promise<void> {
  if (record.emailSentAt) {
    return;
  }

  await notifyOrderConfirmation(
    order,
    record.checkoutDetails.email,
    record.checkoutDetails.fullName,
  );

  await markStripeCheckoutIntent(record.paymentIntentId, {
    emailSentAt: nowIsoString(),
  });
}

async function ensureStripeCheckoutIntentFromFinalize(
  userId: string,
  paymentIntent: StripePaymentIntent,
  payload: FinalizeCheckoutPayload,
): Promise<void> {
  const existing = await getStripeCheckoutIntentRecord(paymentIntent.id);
  const checkoutDetails = normalizeCheckoutDetails(payload.details);

  if (existing) {
    await markStripeCheckoutIntent(paymentIntent.id, {
      checkoutDetails,
      paymentMethod: payload.paymentMethod as StripeCheckoutPaymentMethod,
      stripeStatus: paymentIntent.status,
    });
    return;
  }

  const cart = await getStoredCart(userId);

  if (cart.items.length === 0) {
    throw new Error(
      "Stripe confirmed the payment, but the checkout snapshot is no longer available.",
    );
  }

  const normalizedCart = withCartTotals(cart);

  if (toStripeAmount(normalizedCart.totalAmount) !== paymentIntent.amount) {
    throw new Error(
      "Stripe confirmed an amount that no longer matches the reserve cart.",
    );
  }

  await persistStripeCheckoutIntentRecord(
    buildStripeCheckoutIntentRecord(userId, normalizedCart, paymentIntent, {
      details: checkoutDetails,
      paymentMethod: payload.paymentMethod as StripeCheckoutPaymentMethod,
    }),
  );
}

async function buildStripeCheckoutResponse(
  userId: string,
  order: OrderRecord,
): Promise<CheckoutCartResponse> {
  return {
    cart: await getCartRecord(userId),
    order,
  };
}

export async function markStripeCheckoutPaymentFailed(
  paymentIntent: StripePaymentIntent,
  eventId?: string,
): Promise<void> {
  await markStripeCheckoutIntent(paymentIntent.id, {
    failureMessage:
      paymentIntent.last_payment_error?.message ??
      "Stripe marked this payment as failed.",
    lastStripeEventId: eventId ?? null,
    processingStartedAt: null,
    stripeStatus: paymentIntent.status,
    syncStatus:
      paymentIntent.status === "canceled" ? "canceled" : "failed",
  });
}

export async function syncSucceededStripeCheckoutPayment(
  paymentIntent: StripePaymentIntent,
  options: {
    eventId?: string;
    expectedUserId?: string;
  } = {},
): Promise<CheckoutCartResponse | null> {
  if (paymentIntent.status !== "succeeded") {
    throw new Error("Stripe has not confirmed this payment yet.");
  }

  const record = await getStripeCheckoutIntentRecord(paymentIntent.id);

  if (!record) {
    return null;
  }

  if (options.expectedUserId && record.userId !== options.expectedUserId) {
    throw new Error("This Stripe payment does not belong to the active account.");
  }

  if (toStripeAmount(record.amount) !== paymentIntent.amount) {
    throw new Error("Stripe payment amount does not match the checkout record.");
  }

  const claim = await claimStripeCheckoutIntent(
    paymentIntent.id,
    options.eventId ?? null,
  );

  if (claim.state === "missing") {
    return null;
  }

  if (claim.state === "synced") {
    const order = claim.record.orderId
      ? await getOrderById(claim.record.orderId)
      : null;

    if (!order) {
      throw new Error("Stripe checkout record points to a missing order.");
    }

    const paidOrder = await updateOrder(order.id, {
      paymentStatus: "paid",
    });
    const syncedOrder = paidOrder ?? order;
    await notifyStripeCheckoutOrder(claim.record, syncedOrder);
    return buildStripeCheckoutResponse(claim.record.userId, syncedOrder);
  }

  if (claim.state === "processing") {
    const syncedOrder = await waitForSyncedStripeCheckoutOrder(paymentIntent.id);

    if (!syncedOrder) {
      return null;
    }

    return buildStripeCheckoutResponse(claim.record.userId, syncedOrder);
  }

  try {
    const order = await createOrder(claim.record.userId, {
      items: claim.record.items,
      paymentMethod: claim.record.paymentMethod,
      shippingAddress: formatCheckoutShippingAddress(
        claim.record.checkoutDetails,
      ),
    });
    const paidOrder = await updateOrder(order.id, {
      paymentStatus: "paid",
    });

    if (!paidOrder) {
      throw new Error("The order was created, but payment sync could not finish.");
    }

    await clearCartItemsFromStripeSnapshot(claim.record);
    await markStripeCheckoutIntent(paymentIntent.id, {
      failureMessage: null,
      lastStripeEventId: options.eventId ?? claim.record.lastStripeEventId,
      orderId: paidOrder.id,
      processingStartedAt: null,
      stripeStatus: paymentIntent.status,
      syncStatus: "succeeded",
    });
    await notifyStripeCheckoutOrder(
      {
        ...claim.record,
        orderId: paidOrder.id,
        syncStatus: "succeeded",
      },
      paidOrder,
    );

    return buildStripeCheckoutResponse(claim.record.userId, paidOrder);
  } catch (error) {
    await markStripeCheckoutIntent(paymentIntent.id, {
      failureMessage:
        error instanceof Error ? error.message : "Stripe payment sync failed.",
      processingStartedAt: null,
      stripeStatus: paymentIntent.status,
      syncStatus: "failed",
    });
    throw error;
  }
}

function isStripePaymentMethod(
  method: FinalizeCheckoutPayload["paymentMethod"],
): method is "card" | "wallet" {
  return method === "card" || method === "wallet";
}

export async function finalizeCheckout(
  userId: string,
  payload: FinalizeCheckoutPayload,
): Promise<CheckoutCartResponse> {
  if (!isStripePaymentMethod(payload.paymentMethod)) {
    const cart = await getStoredCart(userId);

    if (cart.items.length === 0) {
      throw new Error("Your reserve cart is empty.");
    }

    const result = await createCheckoutOrder(userId, payload);
    await notifyOrderConfirmation(
      result.order,
      payload.details.email,
      payload.details.fullName,
    );
    return result;
  }

  if (!payload.paymentIntentId) {
    throw new Error("A Stripe payment confirmation is required for this method.");
  }

  const stripe = getStripe();
  const paymentIntent = await stripe.paymentIntents.retrieve(
    payload.paymentIntentId,
  );

  if (
    !("metadata" in paymentIntent) ||
    paymentIntent.metadata.userId !== userId
  ) {
    throw new Error("This Stripe payment does not belong to the active account.");
  }

  if (paymentIntent.status !== "succeeded") {
    throw new Error("Stripe has not confirmed this payment yet.");
  }

  await ensureStripeCheckoutIntentFromFinalize(userId, paymentIntent, payload);

  const result = await syncSucceededStripeCheckoutPayment(paymentIntent, {
    expectedUserId: userId,
  });

  if (!result) {
    throw new Error(
      "Stripe confirmed the payment, but checkout sync is still pending.",
    );
  }

  return result;
}
