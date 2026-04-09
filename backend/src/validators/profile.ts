import { z } from "zod";

export const syncAuthSessionSchema = z.object({
  fullName: z.string().trim().min(2).max(80).optional(),
  phoneNumber: z.string().trim().max(40).optional(),
  address: z.string().trim().max(240).optional(),
});

export const updateUserProfileSchema = syncAuthSessionSchema;
