import type { NextFunction, Request, Response } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";

import { getAdminAuth } from "../config/firebase";
import type { AuthUserProfile, UserRole } from "../shared";
import { getUserProfile, syncAuthenticatedUser } from "../services/user-service";

export interface AuthenticatedRequest extends Request {
  authProfile?: AuthUserProfile;
  authUser?: DecodedIdToken;
}

function extractBearerToken(value?: string): string | null {
  if (!value) {
    return null;
  }

  const [scheme, token] = value.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export async function requireAuth(
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractBearerToken(request.headers.authorization);

  if (!token) {
    response.status(401).json({
      success: false,
      error: "Authentication is required for this action.",
    });
    return;
  }

  try {
    request.authUser = await getAdminAuth().verifyIdToken(token);
    request.authProfile =
      (await getUserProfile(request.authUser.uid)) ??
      (await syncAuthenticatedUser(request.authUser));
    next();
  } catch {
    response.status(401).json({
      success: false,
      error: "Your session is no longer valid. Please sign in again.",
    });
  }
}

export function assertAuthUser(request: AuthenticatedRequest): DecodedIdToken {
  if (!request.authUser) {
    throw new Error("Authenticated user context is missing.");
  }

  return request.authUser;
}

export function assertAuthProfile(request: AuthenticatedRequest): AuthUserProfile {
  if (!request.authProfile) {
    throw new Error("Authenticated profile context is missing.");
  }

  return request.authProfile;
}

export function requireRole(...roles: UserRole[]) {
  return (
    request: AuthenticatedRequest,
    response: Response,
    next: NextFunction,
  ): void => {
    const profile = assertAuthProfile(request);

    if (!roles.includes(profile.role)) {
      response.status(403).json({
        success: false,
        error: "You do not have permission to access this resource.",
      });
      return;
    }

    next();
  };
}
