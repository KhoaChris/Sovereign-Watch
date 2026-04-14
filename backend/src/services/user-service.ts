import type { DecodedIdToken } from "firebase-admin/auth";

import { env } from "../config/env";
import { getDb } from "../config/firebase";
import type {
  AuthUserProfile,
  SyncAuthSessionPayload,
  UpdateUserProfilePayload,
  UserRole,
} from "../shared";
import { nowIsoString } from "../utils/dates";

const USERS_COLLECTION = "users";

function isAdminEmail(email?: string): boolean {
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

  return {
    id: existing?.id ?? token.uid,
    firebaseUid: token.uid,
    email: token.email ?? existing?.email ?? "",
    fullName: fullName || existing?.fullName || fallbackFullName(token.email, token.name),
    avatarUrl: avatarUrl ?? existing?.avatarUrl ?? "",
    phoneNumber: phoneNumber ?? existing?.phoneNumber ?? "",
    address: address ?? existing?.address ?? "",
    role: normalizeRole(existing?.role, token.email ?? existing?.email),
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
