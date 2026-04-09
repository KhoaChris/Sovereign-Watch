import { getDb } from "../config/firebase";
import type {
  CreateOrderPayload,
  OrderRecord,
  OrderStatus,
  PaymentStatus,
  ProductRecord,
  ProductVariant,
  ShippingStatus,
  UpdateOrderPayload,
} from "../shared";
import { nowIsoString } from "../utils/dates";
import { createEntityId } from "../utils/ids";
import { findVariantById, replaceProduct } from "./product-service";

const ORDERS_COLLECTION = "orders";

function createOrderNumber(): string {
  return `WS-${Date.now().toString().slice(-8)}-${createEntityId(4).toUpperCase()}`;
}

function resolveSellPrice(variant: ProductVariant): number {
  return variant.discountPrice ?? variant.price;
}

async function reserveVariants(items: CreateOrderPayload["items"]): Promise<
  Array<{
    productId: string;
    variantId: string;
    quantity: number;
    pricePerUnit: number;
    discountAmount: number;
  }>
> {
  const resolvedItems: Array<{
    productId: string;
    variantId: string;
    quantity: number;
    pricePerUnit: number;
    discountAmount: number;
  }> = [];

  const touchedProducts = new Map<string, ProductRecord>();

  for (const item of items) {
    const variantResult = await findVariantById(item.productVariantId);

    if (!variantResult) {
      throw new Error(`Variant ${item.productVariantId} was not found.`);
    }

    const { product, variant } = variantResult;
    const mutableProduct = touchedProducts.get(product.id) ?? structuredClone(product);
    const mutableVariant = mutableProduct.variants.find((entry) => entry.id === variant.id);

    if (!mutableVariant) {
      throw new Error(`Variant ${variant.id} is missing from product ${product.id}.`);
    }

    if (mutableVariant.stockQuantity < item.quantity) {
      throw new Error(`Variant ${variant.sku} does not have enough stock.`);
    }

    mutableVariant.stockQuantity -= item.quantity;
    mutableProduct.updatedAt = nowIsoString();
    touchedProducts.set(product.id, mutableProduct);

    resolvedItems.push({
      productId: product.id,
      variantId: variant.id,
      quantity: item.quantity,
      pricePerUnit: resolveSellPrice(variant),
      discountAmount: Math.max(0, variant.price - resolveSellPrice(variant)),
    });
  }

  await Promise.all(Array.from(touchedProducts.values()).map((product) => replaceProduct(product)));

  return resolvedItems;
}

async function restockOrder(order: OrderRecord): Promise<void> {
  for (const item of order.items) {
    const variantResult = await findVariantById(item.productVariantId);

    if (!variantResult) {
      continue;
    }

    const mutableProduct = structuredClone(variantResult.product);
    const variant = mutableProduct.variants.find((entry) => entry.id === item.productVariantId);

    if (!variant) {
      continue;
    }

    variant.stockQuantity += item.quantity;
    mutableProduct.updatedAt = nowIsoString();
    await replaceProduct(mutableProduct);
  }
}

export async function listOrders(): Promise<OrderRecord[]> {
  const snapshot = await getDb().collection(ORDERS_COLLECTION).orderBy("createdAt", "desc").get();
  return snapshot.docs.map((document) => document.data() as OrderRecord);
}

export async function listOrdersByCustomer(customerId: string): Promise<OrderRecord[]> {
  const snapshot = await getDb()
    .collection(ORDERS_COLLECTION)
    .where("customerId", "==", customerId)
    .get();

  return snapshot.docs
    .map((document) => document.data() as OrderRecord)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function getOrderById(orderId: string): Promise<OrderRecord | null> {
  const snapshot = await getDb().collection(ORDERS_COLLECTION).doc(orderId).get();

  if (!snapshot.exists) {
    return null;
  }

  return snapshot.data() as OrderRecord;
}

export async function createOrder(
  customerId: string,
  payload: CreateOrderPayload,
): Promise<OrderRecord> {
  const reservedItems = await reserveVariants(payload.items);
  const createdAt = nowIsoString();
  const totalAmount = reservedItems.reduce(
    (sum, item) => sum + item.pricePerUnit * item.quantity,
    0,
  );
  const orderId = createEntityId();

  const order: OrderRecord = {
    id: orderId,
    customerId,
    orderNumber: createOrderNumber(),
    shippingAddress: payload.shippingAddress,
    totalAmount,
    status: "pending",
    createdAt,
    updatedAt: createdAt,
    items: reservedItems.map((item) => ({
      id: createEntityId(),
      orderId,
      productVariantId: item.variantId,
      quantity: item.quantity,
      pricePerUnit: item.pricePerUnit,
      discountAmount: item.discountAmount,
    })),
    payment: {
      id: createEntityId(),
      orderId,
      method: payload.paymentMethod,
      amount: totalAmount,
      status: "pending",
      paymentDate: null,
    },
    shipping: {
      id: createEntityId(),
      orderId,
      courierName: "Pending assignment",
      trackingNumber: "Pending",
      status: "pending",
    },
  };

  await getDb().collection(ORDERS_COLLECTION).doc(orderId).set(order);
  return order;
}

function maybePaymentDate(status: PaymentStatus, currentPaymentDate: string | null): string | null {
  if (status === "paid") {
    return currentPaymentDate ?? nowIsoString();
  }

  return currentPaymentDate;
}

function mapOrderStatus(
  order: OrderRecord,
  status?: OrderStatus,
  shippingStatus?: ShippingStatus,
  paymentStatus?: PaymentStatus,
): OrderStatus {
  if (status) {
    return status;
  }

  if (shippingStatus === "delivered") {
    return "delivered";
  }

  if (shippingStatus === "in_transit") {
    return "shipped";
  }

  if (paymentStatus === "paid") {
    return "paid";
  }

  return order.status;
}

export async function updateOrder(
  orderId: string,
  payload: UpdateOrderPayload,
): Promise<OrderRecord | null> {
  const existing = await getOrderById(orderId);

  if (!existing) {
    return null;
  }

  const updatedOrder: OrderRecord = {
    ...existing,
    status: mapOrderStatus(existing, payload.status, payload.shippingStatus, payload.paymentStatus),
    updatedAt: nowIsoString(),
    payment: existing.payment
      ? {
          ...existing.payment,
          status: payload.paymentStatus ?? existing.payment.status,
          paymentDate: maybePaymentDate(
            payload.paymentStatus ?? existing.payment.status,
            existing.payment.paymentDate,
          ),
        }
      : null,
    shipping: existing.shipping
      ? {
          ...existing.shipping,
          status: payload.shippingStatus ?? existing.shipping.status,
          trackingNumber: payload.trackingNumber ?? existing.shipping.trackingNumber,
          courierName: payload.courierName ?? existing.shipping.courierName,
        }
      : null,
  };

  await getDb().collection(ORDERS_COLLECTION).doc(orderId).set(updatedOrder);
  return updatedOrder;
}

export async function deleteOrder(orderId: string): Promise<boolean> {
  const order = await getOrderById(orderId);

  if (!order) {
    return false;
  }

  await restockOrder(order);
  await getDb().collection(ORDERS_COLLECTION).doc(orderId).delete();
  return true;
}
