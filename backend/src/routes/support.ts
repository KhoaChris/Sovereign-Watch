import { Router } from "express";

import {
  assertAuthProfile,
  type AuthenticatedRequest,
  requireAuth,
  requireRole,
} from "../middleware/auth";
import { buildAdminAiOperationsReply } from "../services/admin-ai-operations-service";
import { buildAiConciergeReply } from "../services/ai-concierge-service";
import {
  adminAiOperationsRequestSchema,
  aiConciergeRequestSchema,
} from "../validators/support";

export const supportRouter = Router();

supportRouter.post("/ai-concierge", requireAuth, async (request, response, next) => {
  try {
    const payload = aiConciergeRequestSchema.parse(request.body ?? {});
    const profile = assertAuthProfile(request as AuthenticatedRequest);
    const reply = await buildAiConciergeReply(profile, payload.message, payload.memory);

    response.json({ success: true, data: reply });
  } catch (error) {
    next(error);
  }
});

supportRouter.post(
  "/admin-ai",
  requireAuth,
  requireRole("admin"),
  async (request, response, next) => {
    try {
      const payload = adminAiOperationsRequestSchema.parse(request.body ?? {});
      const profile = assertAuthProfile(request as AuthenticatedRequest);
      const reply = await buildAdminAiOperationsReply(
        profile,
        payload.message,
        payload.memory,
      );

      response.json({ success: true, data: reply });
    } catch (error) {
      next(error);
    }
  },
);
