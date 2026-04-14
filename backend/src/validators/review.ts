import { z } from "zod";

export const upsertReviewSchema = z.object({
  comment: z.string().trim().max(1200).optional(),
  rating: z
    .number()
    .int("Rating must be a whole number.")
    .min(1, "Rating must be between 1 and 5.")
    .max(5, "Rating must be between 1 and 5."),
});

export const reviewAdminQuerySchema = z.object({
  search: z.string().trim().optional(),
  sort: z.enum(["newest", "rating-asc", "rating-desc"]).optional(),
});
