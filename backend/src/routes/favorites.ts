import { Router } from "express";

import { assertAuthUser, AuthenticatedRequest, requireAuth } from "../middleware/auth";
import {
  addFavoriteProduct,
  clearFavoriteRecord,
  getFavoriteRecord,
  removeFavoriteProduct,
} from "../services/favorite-service";

export const favoritesRouter = Router();

favoritesRouter.use(requireAuth);

favoritesRouter.get("/", async (request, response, next) => {
  try {
    const favorites = await getFavoriteRecord(assertAuthUser(request as AuthenticatedRequest).uid);
    response.json({ success: true, data: favorites });
  } catch (error) {
    next(error);
  }
});

favoritesRouter.post("/:productId", async (request, response, next) => {
  try {
    const favorites = await addFavoriteProduct(
      assertAuthUser(request as AuthenticatedRequest).uid,
      request.params.productId,
    );

    response.status(201).json({ success: true, data: favorites });
  } catch (error) {
    next(error);
  }
});

favoritesRouter.delete("/", async (request, response, next) => {
  try {
    const favorites = await clearFavoriteRecord(assertAuthUser(request as AuthenticatedRequest).uid);

    response.json({ success: true, data: favorites });
  } catch (error) {
    next(error);
  }
});

favoritesRouter.delete("/:productId", async (request, response, next) => {
  try {
    const favorites = await removeFavoriteProduct(
      assertAuthUser(request as AuthenticatedRequest).uid,
      request.params.productId,
    );

    response.json({ success: true, data: favorites });
  } catch (error) {
    next(error);
  }
});
