import { z } from "zod";

const avatarUrlSchema = z
  .string()
  .trim()
  .max(550_000, "Avatar image is too large to save.")
  .refine(
    (value) =>
      value.length === 0 ||
      /^data:image\/(?:png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/i.test(
        value,
      ) ||
      /^https?:\/\//i.test(value),
    "Avatar image format is not supported.",
  );

export const syncAuthSessionSchema = z.object({
  avatarUrl: avatarUrlSchema.nullable().optional(),
  fullName: z.string().trim().min(2).max(80).optional(),
  phoneNumber: z.string().trim().max(40).optional(),
  address: z.string().trim().max(240).optional(),
});

export const updateUserProfileSchema = syncAuthSessionSchema;
