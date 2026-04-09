import { Router } from "express";

import {
  assertAuthProfile,
  AuthenticatedRequest,
  requireAuth,
  requireRole,
} from "../middleware/auth";
import {
  createOrder,
  deleteOrder,
  getOrderById,
  listOrders,
  listOrdersByCustomer,
  updateOrder,
} from "../services/order-service";
import { createOrderSchema, updateOrderSchema } from "../validators/order";

export const ordersRouter = Router();

ordersRouter.use(requireAuth);

ordersRouter.get("/", async (request, response, next) => {
  try {
    const profile = assertAuthProfile(request as AuthenticatedRequest);
    const orders =
      profile.role === "admin"
        ? await listOrders()
        : await listOrdersByCustomer(profile.id);

    response.json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
});

ordersRouter.get("/:id", async (request, response, next) => {
  try {
    const profile = assertAuthProfile(request as AuthenticatedRequest);
    const order = await getOrderById(request.params.id);

    if (!order) {
      response.status(404).json({ success: false, error: "Order not found." });
      return;
    }

    if (profile.role !== "admin" && order.customerId !== profile.id) {
      response.status(403).json({
        success: false,
        error: "You do not have permission to view this order.",
      });
      return;
    }

    response.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
});

ordersRouter.post("/", async (request, response, next) => {
  try {
    const profile = assertAuthProfile(request as AuthenticatedRequest);
    const payload = createOrderSchema.parse(request.body);
    const order = await createOrder(profile.id, payload);
    response.status(201).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
});

ordersRouter.patch("/:id", requireRole("admin"), async (request, response, next) => {
  try {
    const orderId = Array.isArray(request.params.id)
      ? request.params.id[0]
      : request.params.id;
    const payload = updateOrderSchema.parse(request.body);
    const order = await updateOrder(orderId, payload);

    if (!order) {
      response.status(404).json({ success: false, error: "Order not found." });
      return;
    }

    response.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
});

ordersRouter.delete("/:id", requireRole("admin"), async (request, response, next) => {
  try {
    const orderId = Array.isArray(request.params.id)
      ? request.params.id[0]
      : request.params.id;
    const deleted = await deleteOrder(orderId);

    if (!deleted) {
      response.status(404).json({ success: false, error: "Order not found." });
      return;
    }

    response.json({ success: true, data: { id: orderId } });
  } catch (error) {
    next(error);
  }
});
