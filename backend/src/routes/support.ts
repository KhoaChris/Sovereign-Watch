import { Router } from "express";

import {
  assertAuthProfile,
  type AuthenticatedRequest,
  requireAuth,
} from "../middleware/auth";
import { buildAiConciergeReply } from "../services/ai-concierge-service";
import { aiConciergeRequestSchema } from "../validators/support";

export const supportRouter = Router();

supportRouter.post("/ai-concierge", requireAuth, async (request, response, next) => {
  try {
    const payload = aiConciergeRequestSchema.parse(request.body ?? {});
    const profile = assertAuthProfile(request as AuthenticatedRequest);
    const reply = await buildAiConciergeReply(profile, payload.message);

    response.json({ success: true, data: reply });
  } catch (error) {
    next(error);
  }
});
