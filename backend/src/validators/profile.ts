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

const emailOtpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit verification code.");

export const requestEmailOtpSchema = z.object({
  email: z.string().trim().email().max(254),
});

export const verifyEmailOtpSchema = requestEmailOtpSchema.extend({
  code: emailOtpCodeSchema,
});

export const updateUserProfileSchema = syncAuthSessionSchema.extend({
  email: z.string().trim().email().max(254).optional(),
  emailOtpCode: emailOtpCodeSchema.optional(),
});
