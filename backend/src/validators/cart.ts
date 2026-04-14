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

export const checkoutDetailsSchema = z.object({
  deliveryNotes: z.string().trim().max(240).optional(),
  email: z.string().trim().email(),
  fullName: z.string().trim().min(2).max(80),
  phoneNumber: z.string().trim().min(6).max(40),
  saveToAccount: z.boolean().optional(),
  shippingAddress: z.string().trim().min(10).max(240),
});

export const prepareCheckoutPaymentSchema = z.object({
  paymentMethod: z.enum(["card", "wallet"]),
});

export const finalizeCheckoutSchema = z.object({
  details: checkoutDetailsSchema,
  paymentIntentId: z.string().trim().min(1).optional(),
  paymentMethod: z.enum(["card", "bank_transfer", "cash_on_delivery", "wallet"]),
});
