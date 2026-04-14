import { randomUUID } from "node:crypto";

import { getDb, getStorageBucket } from "../config/firebase";
import { env } from "../config/env";
import {
  formatProductSize,
  normalizeProductSizeValue,
  productSizesMatch,
} from "../shared";
import type {
  CreateProductPayload,
  ProductAvailabilityFilter,
  ProductDiscoveryAppliedQuery,
  ProductDiscoveryQuery,
  ProductDiscoveryResponse,
  ProductFacetOption,
  ProductFilters,
  ProductRecord,
  ProductSortOption,
  ProductVariant,
  UpdateProductPayload,
} from "../shared";
import { nowIsoString } from "../utils/dates";
import { createEntityId } from "../utils/ids";

const PRODUCTS_COLLECTION = "products";
const DEFAULT_DISCOVERY_SORT: ProductSortOption = "newest";
const DEFAULT_DISCOVERY_AVAILABILITY: ProductAvailabilityFilter = "all";
const PRODUCT_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_PRODUCT_IMAGE_BYTES = 4 * 1024 * 1024;

function isMissingBucketError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as { code?: number; message?: string };
  return (
    candidate.code === 404 ||
    /bucket does not exist/i.test(candidate.message ?? "")
  );
}

function uniqueBucketCandidates(): string[] {
  const candidates = [
    env.FIREBASE_STORAGE_BUCKET.trim(),
    env.FIREBASE_PROJECT_ID
      ? `${env.FIREBASE_PROJECT_ID}.firebasestorage.app`
      : "",
    env.FIREBASE_PROJECT_ID ? `${env.FIREBASE_PROJECT_ID}.appspot.com` : "",
  ];

  return [...new Set(candidates.filter(Boolean))];
}

function parseProductImageDataUrl(dataUrl: string, mimeType: string): Buffer {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png));base64,([\s\S]+)$/);

  if (!match) {
    throw new Error("Invalid image payload. Choose a PNG or JPG file.");
  }

  if (match[1] !== mimeType) {
    throw new Error("Image type does not match the uploaded file.");
  }

  const buffer = Buffer.from(match[2], "base64");

  if (buffer.length === 0) {
    throw new Error("Uploaded image is empty.");
  }

  if (buffer.length > MAX_PRODUCT_IMAGE_BYTES) {
    throw new Error("Each product image must be 4MB or smaller.");
  }

  return buffer;
}

function normalizeProductImageFileName(fileName: string, mimeType: string): string {
  const extension = mimeType === "image/png" ? "png" : "jpg";
  const stem = fileName
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return `${stem || "product-image"}.${extension}`;
}

export async function uploadProductImage(payload: {
  dataUrl: string;
  fileName: string;
  mimeType: string;
}): Promise<{ path: string; url: string }> {
  if (!PRODUCT_IMAGE_MIME_TYPES.has(payload.mimeType)) {
    throw new Error("Only PNG and JPG images are supported.");
  }

  const buffer = parseProductImageDataUrl(payload.dataUrl, payload.mimeType);
  const storageToken = randomUUID();
  const objectPath = `products/${Date.now()}-${randomUUID()}-${normalizeProductImageFileName(
    payload.fileName,
    payload.mimeType,
  )}`;
  const bucketCandidates = uniqueBucketCandidates();

  for (const bucketName of bucketCandidates) {
    try {
      const bucket = getStorageBucket(bucketName);

      await bucket.file(objectPath).save(buffer, {
        resumable: false,
        metadata: {
          cacheControl: "public,max-age=31536000,immutable",
          contentType: payload.mimeType,
          metadata: {
            firebaseStorageDownloadTokens: storageToken,
          },
        },
      });

      const encodedPath = encodeURIComponent(objectPath);
      const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${storageToken}`;

      return {
        path: objectPath,
        url,
      };
    } catch (error) {
      if (!isMissingBucketError(error)) {
        throw error;
      }
    }
  }

  const checkedBuckets = bucketCandidates.join(", ");
  throw new Error(
    `Cloud Storage bucket not found. Checked: ${checkedBuckets}. Open Firebase Storage in the console to confirm the active bucket, then update backend/.env FIREBASE_STORAGE_BUCKET.`,
  );
}

function normalizeVariant(productId: string, variant: CreateProductPayload["variants"][number]): ProductVariant {
  const normalizedSize = normalizeProductSizeValue(variant.size);

  return {
    id: variant.id ?? createEntityId(),
    productId,
    sku: variant.sku,
    color: variant.color,
    size: normalizedSize || variant.size.trim(),
    price: variant.price,
    discountPrice: variant.discountPrice ?? null,
    stockQuantity: variant.stockQuantity,
  };
}

function normalizePersistedProduct(product: ProductRecord): {
  normalizedProduct: ProductRecord;
  sizeUpdated: boolean;
} {
  let sizeUpdated = false;
  const normalizedVariants = product.variants.map((variant) => {
    const normalizedSize = normalizeProductSizeValue(variant.size);

    if (!normalizedSize || normalizedSize === variant.size) {
      return variant;
    }

    sizeUpdated = true;

    return {
      ...variant,
      size: normalizedSize,
    };
  });

  if (!sizeUpdated) {
    return {
      normalizedProduct: product,
      sizeUpdated: false,
    };
  }

  return {
    normalizedProduct: {
      ...product,
      variants: normalizedVariants,
    },
    sizeUpdated: true,
  };
}

async function syncNormalizedProductSizes(product: ProductRecord): Promise<ProductRecord> {
  const { normalizedProduct, sizeUpdated } = normalizePersistedProduct(product);

  if (!sizeUpdated) {
    return normalizedProduct;
  }

  await getDb()
    .collection(PRODUCTS_COLLECTION)
    .doc(product.id)
    .update({ variants: normalizedProduct.variants });

  return normalizedProduct;
}

function formatFacetLabel(value: string): string {
  return value
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function categoryLabel(product: ProductRecord): string {
  return product.category?.name?.trim() || formatFacetLabel(product.categoryId);
}

function brandLabel(product: ProductRecord): string {
  return product.brand?.name?.trim() || formatFacetLabel(product.brandId);
}

function effectiveVariantPrice(variant: ProductVariant): number {
  return variant.discountPrice ?? variant.price;
}

function effectiveProductPrice(product: ProductRecord): number {
  return product.variants.reduce((lowestPrice, variant) => {
    return Math.min(lowestPrice, effectiveVariantPrice(variant));
  }, Number.POSITIVE_INFINITY);
}

function totalProductStock(product: ProductRecord): number {
  return product.variants.reduce((stock, variant) => stock + variant.stockQuantity, 0);
}

function availabilityForProduct(product: ProductRecord): ProductAvailabilityFilter {
  const stock = totalProductStock(product);

  if (stock <= 0) {
    return "soldout";
  }

  if (stock <= 8) {
    return "limited";
  }

  return "available";
}

function normalizeDiscoveryQuery(query: ProductDiscoveryQuery): ProductDiscoveryAppliedQuery {
  return {
    availability: query.availability ?? DEFAULT_DISCOVERY_AVAILABILITY,
    brand: query.brand?.trim() || undefined,
    category: query.category?.trim() || undefined,
    priceMax: query.priceMax,
    priceMin: query.priceMin,
    search: query.search?.trim() || undefined,
    size: normalizeProductSizeValue(query.size ?? "") || undefined,
    sort: query.sort ?? DEFAULT_DISCOVERY_SORT,
  };
}

function matchesProductDiscoveryQuery(
  product: ProductRecord,
  query: ProductDiscoveryAppliedQuery,
): boolean {
  if (query.category && product.categoryId !== query.category) {
    return false;
  }

  if (query.brand && product.brandId !== query.brand) {
    return false;
  }

  if (
    query.size &&
    !product.variants.some((variant) => productSizesMatch(variant.size, query.size))
  ) {
    return false;
  }

  if (query.availability !== "all" && availabilityForProduct(product) !== query.availability) {
    return false;
  }

  if (query.search) {
    const variantHaystack = product.variants
      .map(
        (variant) =>
          `${variant.sku} ${variant.color} ${variant.size} ${formatProductSize(
            variant.size,
          )}`,
      )
      .join(" ");
    const haystack = `${product.name} ${product.description} ${product.type} ${variantHaystack}`.toLowerCase();

    if (!haystack.includes(query.search.toLowerCase())) {
      return false;
    }
  }

  if (query.priceMin !== undefined || query.priceMax !== undefined) {
    const hasVariantInRange = product.variants.some((variant) => {
      const price = effectiveVariantPrice(variant);
      const aboveMinimum = query.priceMin === undefined || price >= query.priceMin;
      const belowMaximum = query.priceMax === undefined || price <= query.priceMax;
      return aboveMinimum && belowMaximum;
    });

    if (!hasVariantInRange) {
      return false;
    }
  }

  return true;
}

function sortDiscoveryProducts(
  products: ProductRecord[],
  sort: ProductSortOption,
): ProductRecord[] {
  const sortedProducts = [...products];

  sortedProducts.sort((left, right) => {
    if (sort === "price-asc") {
      return effectiveProductPrice(left) - effectiveProductPrice(right);
    }

    if (sort === "price-desc") {
      return effectiveProductPrice(right) - effectiveProductPrice(left);
    }

    if (sort === "name-asc") {
      return left.name.localeCompare(right.name);
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });

  return sortedProducts;
}

function createFacetOptions(
  entries: Map<string, { count: number; label: string }>,
): ProductFacetOption[] {
  return [...entries.entries()]
    .map(([id, value]) => ({
      id,
      label: value.label,
      count: value.count,
    }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.label.localeCompare(right.label);
    });
}

function buildDiscoveryFacets(products: ProductRecord[]): ProductDiscoveryResponse["facets"] {
  const categories = new Map<string, { count: number; label: string }>();
  const brands = new Map<string, { count: number; label: string }>();
  const sizes = new Map<string, { count: number; label: string }>();
  const availability = new Map<string, { count: number; label: string }>();

  let minPrice = Number.POSITIVE_INFINITY;
  let maxPrice = 0;

  for (const product of products) {
    categories.set(product.categoryId, {
      count: (categories.get(product.categoryId)?.count ?? 0) + 1,
      label: categoryLabel(product),
    });

    brands.set(product.brandId, {
      count: (brands.get(product.brandId)?.count ?? 0) + 1,
      label: brandLabel(product),
    });

    const seenSizes = new Set<string>();
    for (const variant of product.variants) {
      const price = effectiveVariantPrice(variant);
      minPrice = Math.min(minPrice, price);
      maxPrice = Math.max(maxPrice, price);

      const normalizedSize = normalizeProductSizeValue(variant.size) || variant.size;

      if (seenSizes.has(normalizedSize)) {
        continue;
      }

      seenSizes.add(normalizedSize);
      sizes.set(normalizedSize, {
        count: (sizes.get(normalizedSize)?.count ?? 0) + 1,
        label: formatProductSize(normalizedSize, normalizedSize),
      });
    }

    const availabilityId = availabilityForProduct(product);
    const availabilityLabel =
      availabilityId === "available"
        ? "Ready now"
        : availabilityId === "limited"
          ? "Low stock"
          : "Sold out";

    availability.set(availabilityId, {
      count: (availability.get(availabilityId)?.count ?? 0) + 1,
      label: availabilityLabel,
    });
  }

  return {
    availability: createFacetOptions(availability),
    brands: createFacetOptions(brands),
    categories: createFacetOptions(categories),
    priceRange: {
      max: Number.isFinite(maxPrice) ? maxPrice : 0,
      min: Number.isFinite(minPrice) ? minPrice : 0,
    },
    sizes: createFacetOptions(sizes),
  };
}

function applyFilters(products: ProductRecord[], filters: ProductFilters): ProductRecord[] {
  return products.filter((product) => {
    if (product.deletedAt) {
      return false;
    }

    if (filters.categoryId && product.categoryId !== filters.categoryId) {
      return false;
    }

    if (filters.brandId && product.brandId !== filters.brandId) {
      return false;
    }

    if (filters.search) {
      const searchTerm = filters.search.trim().toLowerCase();
      const haystack = `${product.name} ${product.description} ${product.type}`.toLowerCase();

      if (!haystack.includes(searchTerm)) {
        return false;
      }
    }

    return true;
  });
}

export async function listProducts(filters: ProductFilters): Promise<ProductRecord[]> {
  const snapshot = await getDb().collection(PRODUCTS_COLLECTION).get();
  const products = await Promise.all(
    snapshot.docs.map((document) =>
      syncNormalizedProductSizes(document.data() as ProductRecord),
    ),
  );

  return applyFilters(products, filters);
}

export async function getProductDiscovery(
  query: ProductDiscoveryQuery,
): Promise<ProductDiscoveryResponse> {
  const products = await listProducts({});
  const activeProducts = products.filter((product) => !product.deletedAt);
  const applied = normalizeDiscoveryQuery(query);
  const filteredProducts = activeProducts.filter((product) =>
    matchesProductDiscoveryQuery(product, applied),
  );

  return {
    applied,
    facets: buildDiscoveryFacets(activeProducts),
    items: sortDiscoveryProducts(filteredProducts, applied.sort),
    total: filteredProducts.length,
  };
}

export async function getProductById(productId: string): Promise<ProductRecord | null> {
  const snapshot = await getDb().collection(PRODUCTS_COLLECTION).doc(productId).get();

  if (!snapshot.exists) {
    return null;
  }

  const product = await syncNormalizedProductSizes(snapshot.data() as ProductRecord);
  return product.deletedAt ? null : product;
}

export async function createProduct(payload: CreateProductPayload): Promise<ProductRecord> {
  const db = getDb();
  const productId = createEntityId();
  const createdAt = nowIsoString();

  const product: ProductRecord = {
    id: productId,
    categoryId: payload.categoryId,
    brandId: payload.brandId,
    name: payload.name,
    description: payload.description,
    type: payload.type,
    images: payload.images,
    deletedAt: null,
    createdAt,
    updatedAt: createdAt,
    variants: payload.variants.map((variant) => normalizeVariant(productId, variant)),
  };

  await db.collection(PRODUCTS_COLLECTION).doc(productId).set(product);

  return product;
}

export async function updateProduct(
  productId: string,
  payload: UpdateProductPayload,
): Promise<ProductRecord | null> {
  const existing = await getProductById(productId);

  if (!existing) {
    return null;
  }

  const updatedAt = nowIsoString();
  const variants =
    payload.variants?.map((variant) => normalizeVariant(productId, variant)) ?? existing.variants;

  const updatedProduct: ProductRecord = {
    ...existing,
    ...payload,
    variants,
    updatedAt,
  };

  await getDb().collection(PRODUCTS_COLLECTION).doc(productId).set(updatedProduct);

  return updatedProduct;
}

export async function deleteProduct(productId: string): Promise<boolean> {
  const documentReference = getDb().collection(PRODUCTS_COLLECTION).doc(productId);
  const snapshot = await documentReference.get();

  if (!snapshot.exists) {
    return false;
  }

  const relatedReviews = await getDb()
    .collection("reviews")
    .where("productId", "==", productId)
    .get();

  if (!relatedReviews.empty) {
    const batch = getDb().batch();

    relatedReviews.docs.forEach((document) => {
      batch.delete(document.ref);
    });

    await batch.commit();
  }

  await documentReference.delete();

  return true;
}

export async function findVariantById(
  variantId: string,
): Promise<{ product: ProductRecord; variant: ProductVariant } | null> {
  const products = await listProducts({});

  for (const product of products) {
    const variant = product.variants.find((entry) => entry.id === variantId);
    if (variant) {
      return { product, variant };
    }
  }

  return null;
}

export async function replaceProduct(product: ProductRecord): Promise<void> {
  const { normalizedProduct } = normalizePersistedProduct(product);
  await getDb().collection(PRODUCTS_COLLECTION).doc(product.id).set(normalizedProduct);
}
