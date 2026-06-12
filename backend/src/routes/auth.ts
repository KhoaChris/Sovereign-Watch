import { Router } from "express";

import {
  assertAuthProfile,
  assertAuthUser,
  AuthenticatedRequest,
  requireAuth,
} from "../middleware/auth";
import { getAdminAuth } from "../config/firebase";
import {
  assertEmailAvailable,
  isAdminEmail,
  syncAuthenticatedUser,
  updateUserProfile,
} from "../services/user-service";
import {
  normalizeOtpEmail,
  requestEmailOtp,
  verifyEmailOtp,
} from "../services/email-otp-service";
import {
  requestEmailOtpSchema,
  syncAuthSessionSchema,
  updateUserProfileSchema,
  verifyEmailOtpSchema,
} from "../validators/profile";

export const authRouter = Router();

authRouter.post("/email-otp/sign-up/request", async (request, response, next) => {
  try {
    const payload = requestEmailOtpSchema.parse(request.body ?? {});
    const email = normalizeOtpEmail(payload.email);

    if (isAdminEmail(email)) {
      response.status(403).json({
        success: false,
        error: "Admin account email is reserved.",
      });
      return;
    }

    await assertEmailAvailable(email);
    const result = await requestEmailOtp({ email, purpose: "sign_up" });
    response.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/email-otp/sign-up/verify", async (request, response, next) => {
  try {
    const payload = verifyEmailOtpSchema.parse(request.body ?? {});
    const email = normalizeOtpEmail(payload.email);

    if (isAdminEmail(email)) {
      response.status(403).json({
        success: false,
        error: "Admin account email is reserved.",
      });
      return;
    }

    await assertEmailAvailable(email);
    await verifyEmailOtp({
      code: payload.code,
      email,
      purpose: "sign_up",
    });
    response.json({
      success: true,
      data: {
        email,
        expiresInSeconds: 0,
        resendAvailableInSeconds: 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

authRouter.use(requireAuth);

authRouter.get("/me", async (request, response, next) => {
  try {
    const user = assertAuthProfile(request as AuthenticatedRequest);
    response.json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/session", async (request, response, next) => {
  try {
    const payload = syncAuthSessionSchema.parse(request.body ?? {});
    const user = await syncAuthenticatedUser(
      assertAuthUser(request as AuthenticatedRequest),
      payload,
    );
    response.json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/firebase-token", async (request, response, next) => {
  try {
    const user = assertAuthProfile(request as AuthenticatedRequest);
    const customToken = await getAdminAuth().createCustomToken(user.firebaseUid, {
      role: user.role,
    });

    response.json({ success: true, data: { customToken } });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/email-otp/profile/request", async (request, response, next) => {
  try {
    const payload = requestEmailOtpSchema.parse(request.body ?? {});
    const profile = assertAuthProfile(request as AuthenticatedRequest);
    const email = normalizeOtpEmail(payload.email);

    if (profile.role === "admin" || isAdminEmail(profile.email)) {
      response.status(403).json({
        success: false,
        error: "Admin account email changes are disabled.",
      });
      return;
    }

    if (isAdminEmail(email)) {
      response.status(403).json({
        success: false,
        error: "Admin account email is reserved.",
      });
      return;
    }

    if (email === normalizeOtpEmail(profile.email)) {
      response.status(400).json({
        success: false,
        error: "Enter a new email address before requesting a code.",
      });
      return;
    }

    await assertEmailAvailable(email, profile.firebaseUid);
    const result = await requestEmailOtp({
      email,
      purpose: "profile_email_update",
    });
    response.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

authRouter.patch("/me", async (request, response, next) => {
  try {
    const payload = updateUserProfileSchema.parse(request.body ?? {});
    const user = await updateUserProfile(
      assertAuthUser(request as AuthenticatedRequest),
      payload,
    );
    response.json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
});
