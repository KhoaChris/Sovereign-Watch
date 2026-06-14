import { Router } from "express";

import { assertAuthUser, AuthenticatedRequest, requireAuth } from "../middleware/auth";
import {
  addCartItem,
  clearCartRecord,
  finalizeCheckout,
  checkoutCartRecord,
  getCartRecord,
  prepareCheckoutPayment,
  removeCartItem,
  updateCartItemQuantity,
} from "../services/cart-service";
import {
  addCartItemSchema,
  checkoutCartSchema,
  finalizeCheckoutSchema,
  prepareCheckoutPaymentSchema,
  updateCartItemSchema,
} from "../validators/cart";

export const cartRouter = Router();

cartRouter.use(requireAuth);

cartRouter.get("/", async (request, response, next) => {
  try {
    const cart = await getCartRecord(assertAuthUser(request as AuthenticatedRequest).uid);
    response.json({ success: true, data: cart });
  } catch (error) {
    next(error);
  }
});

cartRouter.post("/items", async (request, response, next) => {
  try {
    const payload = addCartItemSchema.parse(request.body);
    const cart = await addCartItem(assertAuthUser(request as AuthenticatedRequest).uid, payload);
    response.status(201).json({ success: true, data: cart });
  } catch (error) {
    next(error);
  }
});

cartRouter.patch("/items/:itemId", async (request, response, next) => {
  try {
    const payload = updateCartItemSchema.parse(request.body);
    const cart = await updateCartItemQuantity(
      assertAuthUser(request as AuthenticatedRequest).uid,
      request.params.itemId,
      payload,
    );
    response.json({ success: true, data: cart });
  } catch (error) {
    next(error);
  }
});

cartRouter.delete("/items/:itemId", async (request, response, next) => {
  try {
    const cart = await removeCartItem(assertAuthUser(request as AuthenticatedRequest).uid, request.params.itemId);
    response.json({ success: true, data: cart });
  } catch (error) {
    next(error);
  }
});

cartRouter.delete("/", async (request, response, next) => {
  try {
    const cart = await clearCartRecord(assertAuthUser(request as AuthenticatedRequest).uid);

    response.json({ success: true, data: cart });
  } catch (error) {
    next(error);
  }
});

cartRouter.post("/checkout", async (request, response, next) => {
  try {
    const payload = checkoutCartSchema.parse(request.body);
    const result = await checkoutCartRecord(
      assertAuthUser(request as AuthenticatedRequest).uid,
      payload,
    );
    response.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

cartRouter.post("/checkout/prepare", async (request, response, next) => {
  try {
    const payload = prepareCheckoutPaymentSchema.parse(request.body);
    const result = await prepareCheckoutPayment(
      assertAuthUser(request as AuthenticatedRequest).uid,
      payload,
    );
    response.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

cartRouter.post("/checkout/finalize", async (request, response, next) => {
  try {
    const payload = finalizeCheckoutSchema.parse(request.body);
    const result = await finalizeCheckout(
      assertAuthUser(request as AuthenticatedRequest).uid,
      payload,
    );
    response.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});
