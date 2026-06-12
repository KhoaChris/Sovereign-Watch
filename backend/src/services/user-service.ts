import type { DecodedIdToken } from "firebase-admin/auth";

import { env } from "../config/env";
import { getAdminAuth, getDb } from "../config/firebase";
import type {
  AuthUserProfile,
  SyncAuthSessionPayload,
  UpdateUserProfilePayload,
  UserRole,
} from "../shared";
import { nowIsoString } from "../utils/dates";
import { normalizeOtpEmail, verifyEmailOtp } from "./email-otp-service";

const USERS_COLLECTION = "users";

function createConflictError(message: string): Error & { statusCode: number } {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = 409;

  return error;
}

export function isAdminEmail(email?: string): boolean {
  if (!email) {
    return false;
  }

  const normalizedEmail = email.trim().toLowerCase();

  return env.ADMIN_EMAILS
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalizedEmail);
}

function normalizeRole(existingRole?: string, email?: string): UserRole {
  if (existingRole === "admin" || isAdminEmail(email)) {
    return "admin";
  }

  return "user";
}

function fallbackFullName(email?: string, tokenName?: string | null): string {
  if (tokenName?.trim()) {
    return tokenName.trim();
  }

  if (!email) {
    return "Watchroom Client";
  }

  return email
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function buildProfile(
  existing: AuthUserProfile | null,
  token: DecodedIdToken,
  payload: SyncAuthSessionPayload | UpdateUserProfilePayload,
): Omit<AuthUserProfile, "createdAt" | "updatedAt"> {
  const avatarUrl =
    payload.avatarUrl === null
      ? ""
      : typeof payload.avatarUrl === "string"
        ? payload.avatarUrl.trim()
        : undefined;
  const fullName = payload.fullName?.trim();
  const phoneNumber = payload.phoneNumber?.trim();
  const address = payload.address?.trim();
  const payloadEmail =
    "email" in payload && typeof payload.email === "string"
      ? normalizeOtpEmail(payload.email)
      : undefined;
  const email = payloadEmail || existing?.email || token.email || "";

  return {
    id: existing?.id ?? token.uid,
    firebaseUid: token.uid,
    email,
    fullName: fullName || existing?.fullName || fallbackFullName(token.email, token.name),
    avatarUrl: avatarUrl ?? existing?.avatarUrl ?? "",
    phoneNumber: phoneNumber ?? existing?.phoneNumber ?? "",
    address: address ?? existing?.address ?? "",
    role: normalizeRole(existing?.role, email),
  };
}

function hasProfileChanges(
  existing: AuthUserProfile,
  nextProfile: Omit<AuthUserProfile, "createdAt" | "updatedAt">,
): boolean {
  return (
    existing.id !== nextProfile.id ||
    existing.firebaseUid !== nextProfile.firebaseUid ||
    existing.email !== nextProfile.email ||
    existing.fullName !== nextProfile.fullName ||
    existing.avatarUrl !== nextProfile.avatarUrl ||
    existing.phoneNumber !== nextProfile.phoneNumber ||
    existing.address !== nextProfile.address ||
    existing.role !== nextProfile.role
  );
}

export async function getUserProfile(userId: string): Promise<AuthUserProfile | null> {
  const snapshot = await getDb().collection(USERS_COLLECTION).doc(userId).get();

  if (!snapshot.exists) {
    return null;
  }

  const profile = snapshot.data() as AuthUserProfile;

  return {
    ...profile,
    avatarUrl: profile.avatarUrl ?? "",
  };
}

export async function assertEmailAvailable(
  email: string,
  allowedFirebaseUid?: string,
): Promise<void> {
  const normalizedEmail = normalizeOtpEmail(email);

  try {
    const user = await getAdminAuth().getUserByEmail(normalizedEmail);

    if (user.uid !== allowedFirebaseUid) {
      throw createConflictError(
        "This email is already registered in Firebase Authentication. Sign in with this email or use another email.",
      );
    }
  } catch (error) {
    const code = (error as { code?: string }).code;

    if (code !== "auth/user-not-found") {
      throw error;
    }
  }

  const snapshot = await getDb()
    .collection(USERS_COLLECTION)
    .where("email", "==", normalizedEmail)
    .limit(2)
    .get();
  const conflictingProfile = snapshot.docs.find(
    (document) => document.id !== allowedFirebaseUid,
  );

  if (conflictingProfile) {
    throw createConflictError(
      "This email is already registered in user profiles.",
    );
  }
}

export async function syncAuthenticatedUser(
  token: DecodedIdToken,
  payload: SyncAuthSessionPayload = {},
): Promise<AuthUserProfile> {
  const existing = await getUserProfile(token.uid);
  const nextProfile = buildProfile(existing, token, payload);

  if (!existing) {
    const createdAt = nowIsoString();
    const profile: AuthUserProfile = {
      ...nextProfile,
      createdAt,
      updatedAt: createdAt,
    };

    await getDb().collection(USERS_COLLECTION).doc(profile.id).set(profile);

    return profile;
  }

  if (!hasProfileChanges(existing, nextProfile)) {
    return existing;
  }

  const profile: AuthUserProfile = {
    ...nextProfile,
    createdAt: existing.createdAt,
    updatedAt: nowIsoString(),
  };
  await getDb().collection(USERS_COLLECTION).doc(profile.id).set(profile);

  return profile;
}

export async function updateUserProfile(
  token: DecodedIdToken,
  payload: UpdateUserProfilePayload,
): Promise<AuthUserProfile> {
  const existing = await getUserProfile(token.uid);
  const currentEmail = normalizeOtpEmail(existing?.email || token.email || "");
  const requestedEmail = payload.email ? normalizeOtpEmail(payload.email) : "";
  const emailChanged =
    requestedEmail.length > 0 && requestedEmail !== currentEmail;

  if (emailChanged) {
    if (existing?.role === "admin" || isAdminEmail(currentEmail)) {
      throw new Error("Admin account email changes are disabled.");
    }

    if (isAdminEmail(requestedEmail)) {
      throw new Error("Admin account email is reserved.");
    }

    if (!payload.emailOtpCode) {
      throw new Error("Verify the new email before saving your profile.");
    }

    await assertEmailAvailable(requestedEmail, token.uid);
    await verifyEmailOtp({
      code: payload.emailOtpCode,
      email: requestedEmail,
      purpose: "profile_email_update",
    });
    await getAdminAuth().updateUser(token.uid, {
      email: requestedEmail,
      emailVerified: true,
    });
  }

  const nextProfile = buildProfile(existing, token, {
    ...payload,
    email: emailChanged ? requestedEmail : existing?.email ?? token.email,
  });

  if (!existing) {
    const createdAt = nowIsoString();
    const profile: AuthUserProfile = {
      ...nextProfile,
      createdAt,
      updatedAt: createdAt,
    };

    await getDb().collection(USERS_COLLECTION).doc(profile.id).set(profile);

    return profile;
  }

  if (!hasProfileChanges(existing, nextProfile)) {
    return existing;
  }

  const profile: AuthUserProfile = {
    ...nextProfile,
    createdAt: existing.createdAt,
    updatedAt: nowIsoString(),
  };
  await getDb().collection(USERS_COLLECTION).doc(profile.id).set(profile);

  return profile;
}
