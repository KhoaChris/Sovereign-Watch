import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  ADMIN_EMAILS: z.string().default(""),
  FIREBASE_PROJECT_ID: z.string().default(""),
  FIREBASE_CLIENT_EMAIL: z.string().default(""),
  FIREBASE_PRIVATE_KEY: z.string().default(""),
  FIREBASE_STORAGE_BUCKET: z.string().default(""),
  STRIPE_SECRET_KEY: z.string().default(""),
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z
    .preprocess(
      (value) => (value === "" || value === undefined ? undefined : value),
      z.enum(["true", "false"]).default("false"),
    )
    .transform((value) => value === "true"),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  SMTP_FROM_EMAIL: z.string().default(""),
  SMTP_FROM_NAME: z.string().default("Sovereign"),
});

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  FRONTEND_URL: process.env.FRONTEND_URL,
  ADMIN_EMAILS: process.env.ADMIN_EMAILS,
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
  FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_SECURE: process.env.SMTP_SECURE,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL,
  SMTP_FROM_NAME: process.env.SMTP_FROM_NAME,
});
