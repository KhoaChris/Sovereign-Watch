import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

import { getDb } from "../config/firebase";
import type { EmailOtpResponse } from "../shared";
import { nowIsoString } from "../utils/dates";
import { sendEmailOtp } from "./email-service";

export type EmailOtpPurpose = "profile_email_update" | "sign_up";

interface EmailOtpChallenge {
  attempts: number;
  codeHash: string;
  createdAt: string;
  email: string;
  expiresAt: string;
  purpose: EmailOtpPurpose;
  requestCount: number;
  resendAvailableAt: string;
  salt: string;
  updatedAt: string;
  windowStartedAt: string;
}

const EMAIL_OTP_COLLECTION = "emailOtpChallenges";
const OTP_EXPIRES_IN_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_REQUEST_WINDOW_MS = 60 * 60 * 1000;
const OTP_MAX_REQUESTS_PER_WINDOW = 5;
const OTP_MAX_ATTEMPTS = 5;

export function normalizeOtpEmail(email: string): string {
  return email.trim().toLowerCase();
}

function challengeDocId(email: string, purpose: EmailOtpPurpose): string {
  return createHash("sha256")
    .update(`${purpose}:${normalizeOtpEmail(email)}`)
    .digest("hex");
}

function hashCode(code: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function secondsUntil(value: string, nowMs: number): number {
  return Math.max(0, Math.ceil((new Date(value).getTime() - nowMs) / 1000));
}

function assertCodeMatches(code: string, challenge: EmailOtpChallenge): void {
  const expected = Buffer.from(challenge.codeHash, "hex");
  const received = Buffer.from(hashCode(code, challenge.salt), "hex");

  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new Error("The verification code is incorrect.");
  }
}

export async function requestEmailOtp({
  email,
  purpose,
}: {
  email: string;
  purpose: EmailOtpPurpose;
}): Promise<EmailOtpResponse> {
  const normalizedEmail = normalizeOtpEmail(email);
  const now = Date.now();
  const nowIso = nowIsoString();
  const documentRef = getDb()
    .collection(EMAIL_OTP_COLLECTION)
    .doc(challengeDocId(normalizedEmail, purpose));
  const snapshot = await documentRef.get();
  const existing = snapshot.exists
    ? (snapshot.data() as EmailOtpChallenge)
    : null;

  if (existing) {
    const resendAvailableAtMs = new Date(existing.resendAvailableAt).getTime();

    if (resendAvailableAtMs > now) {
      throw new Error(
        `Please wait ${secondsUntil(existing.resendAvailableAt, now)} seconds before requesting another code.`,
      );
    }

    const windowStartedAtMs = new Date(existing.windowStartedAt).getTime();
    const withinWindow = now - windowStartedAtMs < OTP_REQUEST_WINDOW_MS;

    if (withinWindow && existing.requestCount >= OTP_MAX_REQUESTS_PER_WINDOW) {
      throw new Error(
        "Too many verification emails were requested. Please try again later.",
      );
    }
  }

  const code = generateOtpCode();
  const salt = randomBytes(16).toString("hex");
  const withinExistingWindow =
    existing !== null &&
    now - new Date(existing.windowStartedAt).getTime() < OTP_REQUEST_WINDOW_MS;
  const requestCount = withinExistingWindow ? existing.requestCount + 1 : 1;
  const windowStartedAt = withinExistingWindow
    ? existing.windowStartedAt
    : nowIso;
  const expiresAt = new Date(now + OTP_EXPIRES_IN_MS).toISOString();
  const resendAvailableAt = new Date(now + OTP_RESEND_COOLDOWN_MS).toISOString();

  const challenge: EmailOtpChallenge = {
    attempts: 0,
    codeHash: hashCode(code, salt),
    createdAt: existing?.createdAt ?? nowIso,
    email: normalizedEmail,
    expiresAt,
    purpose,
    requestCount,
    resendAvailableAt,
    salt,
    updatedAt: nowIso,
    windowStartedAt,
  };

  await documentRef.set(challenge);
  await sendEmailOtp({ code, email: normalizedEmail, purpose });

  return {
    email: normalizedEmail,
    expiresInSeconds: Math.floor(OTP_EXPIRES_IN_MS / 1000),
    resendAvailableInSeconds: Math.ceil(OTP_RESEND_COOLDOWN_MS / 1000),
  };
}

export async function verifyEmailOtp({
  code,
  email,
  purpose,
}: {
  code: string;
  email: string;
  purpose: EmailOtpPurpose;
}): Promise<void> {
  const normalizedEmail = normalizeOtpEmail(email);
  const documentRef = getDb()
    .collection(EMAIL_OTP_COLLECTION)
    .doc(challengeDocId(normalizedEmail, purpose));
  const snapshot = await documentRef.get();

  if (!snapshot.exists) {
    throw new Error("Request a verification code before continuing.");
  }

  const challenge = snapshot.data() as EmailOtpChallenge;

  if (new Date(challenge.expiresAt).getTime() < Date.now()) {
    await documentRef.delete();
    throw new Error("The verification code has expired. Request a new code.");
  }

  if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
    await documentRef.delete();
    throw new Error("Too many incorrect attempts. Request a new code.");
  }

  try {
    assertCodeMatches(code.trim(), challenge);
  } catch (error) {
    await documentRef.update({
      attempts: challenge.attempts + 1,
      updatedAt: nowIsoString(),
    });
    throw error;
  }

  await documentRef.delete();
}
