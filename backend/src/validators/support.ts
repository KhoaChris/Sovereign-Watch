import { z } from "zod";

export const aiConciergeRequestSchema = z.object({
  message: z.string().trim().min(1).max(1000),
});
