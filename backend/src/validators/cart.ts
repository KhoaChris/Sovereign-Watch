import { z } from "zod";

export const addCartItemSchema = z.object({
  productVariantId: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1).max(10).default(1),
});

export const updateCartItemSchema = z.object({
  quantity: z.coerce.number().int().min(0).max(10),
});

export const checkoutCartSchema = z.object({
  shippingAddress: z.string().trim().min(10),
  paymentMethod: z.enum(["card", "bank_transfer", "cash_on_delivery", "wallet"]),
});
