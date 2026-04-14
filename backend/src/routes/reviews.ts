import { Router } from "express";

import {
  assertAuthProfile,
  type AuthenticatedRequest,
  requireAuth,
  requireRole,
} from "../middleware/auth";
import { deleteReviewById, listAdminReviews } from "../services/review-service";
import { reviewAdminQuerySchema } from "../validators/review";

export const reviewsRouter = Router();

reviewsRouter.use(requireAuth, requireRole("admin"));

reviewsRouter.get("/", async (request, response, next) => {
  try {
    const query = reviewAdminQuerySchema.parse({
      search:
        typeof request.query.search === "string" ? request.query.search : undefined,
      sort:
        typeof request.query.sort === "string" ? request.query.sort : undefined,
    });
    const reviews = await listAdminReviews(query);

    response.json({ success: true, data: reviews });
  } catch (error) {
    next(error);
  }
});

reviewsRouter.delete("/:id", async (request, response, next) => {
  try {
    assertAuthProfile(request as AuthenticatedRequest);
    const reviewId = Array.isArray(request.params.id)
      ? request.params.id[0]
      : request.params.id;
    const removed = await deleteReviewById(reviewId);

    if (!removed) {
      response.status(404).json({ success: false, error: "Review not found." });
      return;
    }

    response.json({ success: true, data: { id: reviewId } });
  } catch (error) {
    next(error);
  }
});
