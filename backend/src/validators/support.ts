import { z } from "zod";

function boundedTrimmedString(maxLength: number) {
  return z.preprocess(
    (value) =>
      typeof value === "string" ? value.trim().slice(0, maxLength) : value,
    z.string().max(maxLength),
  );
}

const aiConciergeSuggestionSchema = z.object({
  href: boundedTrimmedString(500),
  image: boundedTrimmedString(1000),
  name: boundedTrimmedString(120),
  priceLabel: boundedTrimmedString(160),
  productId: boundedTrimmedString(120),
  type: boundedTrimmedString(80),
});

const aiConciergeMemoryMessageSchema = z.object({
  body: boundedTrimmedString(1000),
  senderRole: z.enum(["admin", "bot", "user"]),
  suggestions: z.array(aiConciergeSuggestionSchema).max(4).default([]),
});

export const aiConciergeRequestSchema = z.object({
  memory: z.array(aiConciergeMemoryMessageSchema).max(8).default([]),
  message: z.string().trim().min(1).max(1000),
});

const adminAiOperationsMemoryMessageSchema = z.object({
  body: boundedTrimmedString(1000),
  senderRole: z.enum(["admin", "bot"]),
  suggestions: z.array(aiConciergeSuggestionSchema).max(4).default([]),
});

export const adminAiOperationsRequestSchema = z.object({
  memory: z.array(adminAiOperationsMemoryMessageSchema).max(8).default([]),
  message: z.string().trim().min(1).max(1000),
});
