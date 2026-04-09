import { Router } from "express";

import { requireAuth, requireRole } from "../middleware/auth";
import {
  createProductSchema,
  productDiscoveryQuerySchema,
  productImageUploadSchema,
  updateProductSchema,
} from "../validators/product";
import {
  createProduct,
  getProductDiscovery,
  getProductById,
  listProducts,
  softDeleteProduct,
  updateProduct,
  uploadProductImage,
} from "../services/product-service";

export const productsRouter = Router();
//CRUD (important )

productsRouter.get("/", async (request, response, next) => {
  try {
    const products = await listProducts({
      categoryId: typeof request.query.categoryId === "string" ? request.query.categoryId : undefined,
      brandId: typeof request.query.brandId === "string" ? request.query.brandId : undefined,
      search: typeof request.query.search === "string" ? request.query.search : undefined,
    });

    response.json({ success: true, data: products });
  } catch (error) {
    next(error);
  }
});

productsRouter.get("/discovery", async (request, response, next) => {
  try {
    const query = productDiscoveryQuerySchema.parse({
      availability: typeof request.query.availability === "string" ? request.query.availability : undefined,
      brand: typeof request.query.brand === "string" ? request.query.brand : undefined,
      category: typeof request.query.category === "string" ? request.query.category : undefined,
      priceMax: typeof request.query.priceMax === "string" ? request.query.priceMax : undefined,
      priceMin: typeof request.query.priceMin === "string" ? request.query.priceMin : undefined,
      search: typeof request.query.search === "string" ? request.query.search : undefined,
      size: typeof request.query.size === "string" ? request.query.size : undefined,
      sort: typeof request.query.sort === "string" ? request.query.sort : undefined,
    });
    const discovery = await getProductDiscovery(query);

    response.json({ success: true, data: discovery });
  } catch (error) {
    next(error);
  }
});

productsRouter.post("/uploads", requireAuth, requireRole("admin"), async (request, response, next) => {
  try {
    const payload = productImageUploadSchema.parse(request.body);
    const image = await uploadProductImage(payload);
    response.status(201).json({ success: true, data: image });
  } catch (error) {
    next(error);
  }
});

productsRouter.get("/:id", async (request, response, next) => {
  try {
    const product = await getProductById(request.params.id);

    if (!product) {
      response.status(404).json({ success: false, error: "Product not found." });
      return;
    }

    response.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
});

productsRouter.post("/", requireAuth, requireRole("admin"), async (request, response, next) => {
  try {
    const payload = createProductSchema.parse(request.body);
    const product = await createProduct(payload);
    response.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
});

productsRouter.put("/:id", requireAuth, requireRole("admin"), async (request, response, next) => {
  try {
    const productId = Array.isArray(request.params.id)
      ? request.params.id[0]
      : request.params.id;
    const payload = updateProductSchema.parse(request.body);
    const product = await updateProduct(productId, payload);

    if (!product) {
      response.status(404).json({ success: false, error: "Product not found." });
      return;
    }

    response.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
});

productsRouter.delete("/:id", requireAuth, requireRole("admin"), async (request, response, next) => {
  try {
    const productId = Array.isArray(request.params.id)
      ? request.params.id[0]
      : request.params.id;
    const removed = await softDeleteProduct(productId);

    if (!removed) {
      response.status(404).json({ success: false, error: "Product not found." });
      return;
    }

    response.json({ success: true, data: { id: productId } });
  } catch (error) {
    next(error);
  }
});
