import { z } from "zod";

export const createOrderSchema = z.object({
  shippingAddress: z.string().min(10),
  items: z
    .array(
      z.object({
        productVariantId: z.string().min(1),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
  paymentMethod: z.enum(["card", "bank_transfer", "cash_on_delivery", "wallet"]),
});

export const updateOrderSchema = z.object({
  status: z
    .enum(["pending", "confirmed", "paid", "processing", "shipped", "delivered", "cancelled"])
    .optional(),
  shippingStatus: z
    .enum(["pending", "packed", "in_transit", "delivered", "returned"])
    .optional(),
  paymentStatus: z
    .enum(["pending", "authorized", "paid", "failed", "refunded"])
    .optional(),
  trackingNumber: z.string().min(1).optional(),
  courierName: z.string().min(1).optional(),
});
