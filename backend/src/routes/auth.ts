import { Router } from "express";

import {
  assertAuthProfile,
  assertAuthUser,
  AuthenticatedRequest,
  requireAuth,
} from "../middleware/auth";
import { syncAuthenticatedUser, updateUserProfile } from "../services/user-service";
import { syncAuthSessionSchema, updateUserProfileSchema } from "../validators/profile";

export const authRouter = Router();

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
    const user = await syncAuthenticatedUser(assertAuthUser(request as AuthenticatedRequest), payload);
    response.json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
});

authRouter.patch("/me", async (request, response, next) => {
  try {
    const payload = updateUserProfileSchema.parse(request.body ?? {});
    const user = await updateUserProfile(assertAuthUser(request as AuthenticatedRequest), payload);
    response.json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
});
