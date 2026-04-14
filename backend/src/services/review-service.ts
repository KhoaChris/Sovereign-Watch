import { getDb } from "../config/firebase";
import type {
  AuthUserProfile,
  ProductReviewSummary,
  ProductReviewsResponse,
  PublicReviewRecord,
  ReviewAdminQuery,
  ReviewRecord,
  UpsertReviewPayload,
} from "../shared";
import { nowIsoString } from "../utils/dates";
import { createEntityId } from "../utils/ids";
import { getProductById, listProducts } from "./product-service";

const REVIEWS_COLLECTION = "reviews";

function buildAuthorInitials(fullName: string): string {
  const segments = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (segments.length === 0) {
    return "WC";
  }

  return segments
    .map((segment) => segment.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);
}

function normalizeReviewComment(comment?: string): string {
  return comment?.trim() ?? "";
}

function toPublicReviewRecord(review: ReviewRecord): PublicReviewRecord {
  return {
    authorInitials: review.authorInitials,
    authorName: review.authorName,
    comment: review.comment,
    createdAt: review.createdAt,
    id: review.id,
    productId: review.productId,
    rating: review.rating,
    updatedAt: review.updatedAt,
  };
}

function sortReviewsNewestFirst<T extends { createdAt: string; updatedAt: string }>(
  reviews: T[],
): T[] {
  return [...reviews].sort((left, right) => {
    return (
      new Date(right.updatedAt || right.createdAt).getTime() -
      new Date(left.updatedAt || left.createdAt).getTime()
    );
  });
}

function buildProductReviewSummary(
  reviews: ReviewRecord[],
): ProductReviewSummary {
  const distribution = [5, 4, 3, 2, 1].map((rating) => ({
    count: reviews.filter((review) => review.rating === rating).length,
    rating,
  }));
  const reviewCount = reviews.length;
  const averageRating =
    reviewCount === 0
      ? 0
      : Number(
          (
            reviews.reduce((sum, review) => sum + review.rating, 0) /
            reviewCount
          ).toFixed(1),
        );

  return {
    averageRating,
    distribution,
    reviewCount,
  };
}

export async function listReviewRecordsByProduct(
  productId: string,
): Promise<ReviewRecord[]> {
  const snapshot = await getDb()
    .collection(REVIEWS_COLLECTION)
    .where("productId", "==", productId)
    .get();

  return sortReviewsNewestFirst(
    snapshot.docs.map((document) => document.data() as ReviewRecord),
  );
}

export async function getViewerReviewRecord(
  productId: string,
  customerId: string,
): Promise<ReviewRecord | null> {
  const reviews = await listReviewRecordsByProduct(productId);

  return reviews.find((review) => review.customerId === customerId) ?? null;
}

export async function getProductReviews(
  productId: string,
): Promise<ProductReviewsResponse | null> {
  const product = await getProductById(productId);

  if (!product) {
    return null;
  }

  const reviews = await listReviewRecordsByProduct(productId);

  return {
    items: reviews.map(toPublicReviewRecord),
    summary: buildProductReviewSummary(reviews),
    viewerReview: null,
  };
}

export async function getViewerProductReview(
  productId: string,
  customerId: string,
): Promise<PublicReviewRecord | null> {
  const product = await getProductById(productId);

  if (!product) {
    return null;
  }

  const review = await getViewerReviewRecord(productId, customerId);

  return review ? toPublicReviewRecord(review) : null;
}

export async function upsertProductReview(
  productId: string,
  profile: AuthUserProfile,
  payload: UpsertReviewPayload,
): Promise<PublicReviewRecord | null> {
  const product = await getProductById(productId);

  if (!product) {
    return null;
  }

  const existing = await getViewerReviewRecord(productId, profile.id);
  const timestamp = nowIsoString();
  const review: ReviewRecord = {
    authorInitials: buildAuthorInitials(profile.fullName),
    authorName: profile.fullName.trim() || "Watchroom Member",
    comment: normalizeReviewComment(payload.comment),
    createdAt: existing?.createdAt ?? timestamp,
    customerId: profile.id,
    id: existing?.id ?? createEntityId(),
    productId,
    rating: payload.rating,
    updatedAt: timestamp,
  };

  await getDb().collection(REVIEWS_COLLECTION).doc(review.id).set(review);

  return toPublicReviewRecord(review);
}

export async function deleteViewerReview(
  productId: string,
  customerId: string,
): Promise<boolean> {
  const review = await getViewerReviewRecord(productId, customerId);

  if (!review) {
    return false;
  }

  await getDb().collection(REVIEWS_COLLECTION).doc(review.id).delete();

  return true;
}

export async function listAdminReviews(
  query: ReviewAdminQuery = {},
): Promise<ReviewRecord[]> {
  const [snapshot, products] = await Promise.all([
    getDb().collection(REVIEWS_COLLECTION).get(),
    listProducts({}),
  ]);
  const productNameLookup = new Map(
    products.map((product) => [product.id, product.name]),
  );
  const searchTerm = query.search?.trim().toLowerCase() ?? "";
  const enrichedReviews = snapshot.docs.map((document) => {
    const review = document.data() as ReviewRecord;

    return {
      ...review,
      productName: productNameLookup.get(review.productId) ?? "Removed product",
    };
  });
  const filteredReviews = searchTerm
    ? enrichedReviews.filter((review) =>
        [review.authorName, review.comment, review.productName]
          .join(" ")
          .toLowerCase()
          .includes(searchTerm),
      )
    : enrichedReviews;

  return [...filteredReviews].sort((left, right) => {
    if (query.sort === "rating-asc") {
      if (left.rating !== right.rating) {
        return left.rating - right.rating;
      }
    }

    if (query.sort === "rating-desc") {
      if (left.rating !== right.rating) {
        return right.rating - left.rating;
      }
    }

    return (
      new Date(right.updatedAt || right.createdAt).getTime() -
      new Date(left.updatedAt || left.createdAt).getTime()
    );
  });
}

export async function deleteReviewById(reviewId: string): Promise<boolean> {
  const reviewReference = getDb().collection(REVIEWS_COLLECTION).doc(reviewId);
  const snapshot = await reviewReference.get();

  if (!snapshot.exists) {
    return false;
  }

  await reviewReference.delete();

  return true;
}

export async function deleteProductReviews(productId: string): Promise<void> {
  const snapshot = await getDb()
    .collection(REVIEWS_COLLECTION)
    .where("productId", "==", productId)
    .get();

  if (snapshot.empty) {
    return;
  }

  const batch = getDb().batch();

  snapshot.docs.forEach((document) => {
    batch.delete(document.ref);
  });

  await batch.commit();
}
