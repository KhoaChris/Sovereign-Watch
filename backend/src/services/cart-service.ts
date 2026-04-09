import { getDb } from "../config/firebase";
import type {
  AddCartItemPayload,
  CartItemRecord,
  CartRecord,
  CheckoutCartPayload,
  CheckoutCartResponse,
  UpdateCartItemPayload,
} from "../shared";
import { nowIsoString } from "../utils/dates";
import { createEntityId } from "../utils/ids";
import { findVariantById } from "./product-service";
import { createOrder } from "./order-service";

const CARTS_COLLECTION = "carts";

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

  return {
    cart: clearedCart,
    order,
  };
}
