import { z } from "zod";

const EMBEDDED_PRODUCT_IMAGE_MAX_CHARS = 180_000;
const EMBEDDED_PRODUCT_IMAGE_TOTAL_MAX_CHARS = 600_000;

export const productVariantInputSchema = z.object({
  id: z.string().min(1).optional(),
  sku: z.string().min(1),
  color: z.string().min(1),
  size: z.string().min(1),
  price: z.number().nonnegative(),
  discountPrice: z.number().nonnegative().nullable().default(null),
  stockQuantity: z.number().int().nonnegative(),
});

export const productImageUploadSchema = z.object({
  dataUrl: z
    .string()
    .min(1)
    .regex(
      /^data:image\/(?:png|jpeg);base64,/,
      "Image payload must be a PNG or JPG file.",
    ),
  fileName: z.string().trim().min(1).max(160),
  mimeType: z.enum(["image/png", "image/jpeg"]),
});

const productImageSchema = z.union([
  z.string().url(),
  z
    .string()
    .regex(
      /^data:image\/(?:jpeg|png|webp);base64,/,
      "Embedded image must be a valid PNG, JPG, or WebP data URL.",
    )
    .max(
      EMBEDDED_PRODUCT_IMAGE_MAX_CHARS,
      "One embedded product image is too large for Firestore.",
    ),
]);

const hasSafeEmbeddedImagePayload = (images?: string[]) => {
  if (images === undefined) {
    return true;
  }

  return (
    images.reduce((total, image) => total + image.length, 0) <=
    EMBEDDED_PRODUCT_IMAGE_TOTAL_MAX_CHARS
  );
};

const productSchemaBase = z.object({
  categoryId: z.string().min(1),
  brandId: z.string().min(1),
  name: z.string().min(2),
  description: z.string().min(10),
  type: z.string().min(2),
  images: z.array(productImageSchema).min(1),
  variants: z.array(productVariantInputSchema).min(1),
});

export const createProductSchema = productSchemaBase.refine(
  (value) => hasSafeEmbeddedImagePayload(value.images),
  {
    message:
      "Embedded product images are too large for Firestore. Use fewer images or smaller files.",
    path: ["images"],
  },
);

export const updateProductSchema = productSchemaBase.partial().refine(
  (value) => hasSafeEmbeddedImagePayload(value.images),
  {
    message:
      "Embedded product images are too large for Firestore. Use fewer images or smaller files.",
    path: ["images"],
  },
);

export const productDiscoveryQuerySchema = z.object({
  availability: z.enum(["all", "available", "limited", "soldout"]).optional(),
  brand: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  priceMax: z.coerce.number().nonnegative().optional(),
  priceMin: z.coerce.number().nonnegative().optional(),
  search: z.string().trim().optional(),
  size: z.string().trim().min(1).optional(),
  sort: z.enum(["newest", "price-asc", "price-desc", "name-asc"]).optional(),
}).refine(
  (value) => {
    if (value.priceMin === undefined || value.priceMax === undefined) {
      return true;
    }

    return value.priceMin <= value.priceMax;
  },
  {
    message: "Minimum price cannot be greater than maximum price.",
    path: ["priceMin"],
  },
);
