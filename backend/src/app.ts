import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { env } from "./config/env";
import { authRouter } from "./routes/auth";
import { cartRouter } from "./routes/cart";
import { favoritesRouter } from "./routes/favorites";
import { ordersRouter } from "./routes/orders";
import { productsRouter } from "./routes/products";
import { reviewsRouter } from "./routes/reviews";

export const app = express();

const LOCAL_DEVELOPMENT_ORIGIN =
  /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;

function isAllowedCorsOrigin(origin?: string): boolean {
  if (!origin) {
    return true;
  }

  if (origin === env.FRONTEND_URL) {
    return true;
  }

  return env.NODE_ENV !== "production" && LOCAL_DEVELOPMENT_ORIGIN.test(origin);
}

app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, isAllowedCorsOrigin(origin));
    },
  }),
);
app.use(express.json({ limit: "8mb" }));

app.get("/api/health", (_request, response) => {
  response.json({
    success: true,
    data: {
      status: "ok",
      environment: env.NODE_ENV,
    },
  });
});

app.use("/api/products", productsRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/auth", authRouter);
app.use("/api/cart", cartRouter);
app.use("/api/favorites", favoritesRouter);

app.use((_request, response) => {
  response.status(404).json({ success: false, error: "Route not found." });
});

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof ZodError) {
    response.status(400).json({
      success: false,
      error: "Validation failed.",
      details: error.issues.map((issue) => issue.message),
    });
    return;
  }

  if (error instanceof Error) {
    const statusCode = (error as { statusCode?: number }).statusCode;

    response.status(statusCode ?? 500).json({
      success: false,
      error: error.message,
    });
    return;
  }

  response.status(500).json({
    success: false,
    error: "Unexpected server error.",
  });
});
