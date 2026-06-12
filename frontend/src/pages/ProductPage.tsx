import { useEffect, useMemo, useState } from "react";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Heart,
  LoaderCircle,
  MessageSquareMore,
  ShoppingBag,
  Star,
  Trash2,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { useFeedback } from "../feedback/feedback-context";
import { storefrontApi } from "../services/api";
import {
  formatProductSize,
  type ProductReviewSummary,
  type ProductRecord,
  type ProductVariant,
  type ProductReviewsResponse,
  type PublicReviewRecord,
} from "../shared";
import { useStorefront } from "../storefront/storefront-context";
import "../styles/pages/product-page.css";

const REVIEW_STAR_SCALE = [1, 2, 3, 4, 5];

function normalizeRatingValue(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(5, Math.max(0, Math.round(value)));
}

function createEmptyReviewSummary(): ProductReviewSummary {
  return {
    averageRating: 0,
    distribution: [5, 4, 3, 2, 1].map((rating) => ({
      count: 0,
      rating,
    })),
    reviewCount: 0,
  };
}

function formatReviewDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function ReviewStars({
  onRate,
  rating,
  readOnly = false,
}: {
  onRate?: (rating: number) => void;
  rating: number;
  readOnly?: boolean;
}) {
  const normalizedRating = normalizeRatingValue(rating);

  return (
    <div
      aria-label={
        readOnly ? `Rated ${normalizedRating} out of 5` : "Choose a rating"
      }
      className={`product-page__review-stars ${
        readOnly ? "product-page__review-stars--readonly" : ""
      }`}
      role={readOnly ? "img" : "group"}
    >
      {REVIEW_STAR_SCALE.map((value) => {
        const active = value <= normalizedRating;

        if (readOnly) {
          return (
            <span
              key={value}
              className={`product-page__review-star ${
                active ? "product-page__review-star--active" : ""
              }`}
            >
              <Star
                fill={active ? "currentColor" : "transparent"}
                size={16}
                strokeWidth={1.8}
              />
            </span>
          );
        }

        return (
          <button
            key={value}
            aria-label={`Rate ${value} out of 5`}
            className={`product-page__review-star-button ${
              active ? "product-page__review-star-button--active" : ""
            }`}
            onClick={() => onRate?.(value)}
            type="button"
          >
            <Star fill="currentColor" size={18} strokeWidth={1.8} />
          </button>
        );
      })}
    </div>
  );
}

function ReviewStreamItem({ review }: { review: PublicReviewRecord }) {
  const edited = review.updatedAt !== review.createdAt;
  const normalizedRating = normalizeRatingValue(review.rating);

  return (
    <motion.article
      className="product-page__review-item"
      initial={{ opacity: 0, y: 18 }}
      transition={{ duration: 0.32 }}
      viewport={{ amount: 0.16, once: true }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <div className="product-page__review-avatar" aria-hidden="true">
        {review.authorInitials}
      </div>
      <div className="product-page__review-copy">
        <div className="product-page__review-topline">
          <div>
            <strong>{review.authorName}</strong>
            <span>
              {formatReviewDate(review.createdAt)}
              {edited ? " · updated" : ""}
            </span>
          </div>
          <div className="product-page__review-rating-meta">
            <ReviewStars rating={normalizedRating} readOnly />
            <span>{normalizedRating}/5</span>
          </div>
        </div>
        <p>
          {review.comment.trim().length > 0
            ? review.comment
            : "Left a star rating without a written note."}
        </p>
      </div>
    </motion.article>
  );
}

function ProductLoadingState() {
  return (
    <section
      aria-busy="true"
      aria-live="polite"
      className="product-page__loading"
      role="status"
    >
      <div className="product-page__loading-copy">
        <p className="product-page__state-eyebrow">Live archive</p>
        <h1 className="product-page__state-title">Loading reference.</h1>
        <p className="product-page__state-copy">
          Syncing imagery, variants, and reserve details from the catalog.
        </p>
      </div>

      <div className="product-page__loading-layout">
        <div className="product-page__loading-visual">
          <div className="product-page__loading-glow product-page__loading-glow--left" />
          <div className="product-page__loading-glow product-page__loading-glow--right" />
          <div className="product-page__loading-grid" />

          <div className="product-page__loading-visual-meta product-page__loading-visual-meta--top">
            <span className="product-page__loading-pill product-page__loading-pill--wide" />
            <span className="product-page__loading-pill product-page__loading-pill--short" />
          </div>

          <div className="product-page__loading-media">
            <div className="product-page__loading-watch" />
            <div className="product-page__loading-halo" />
          </div>

          <div className="product-page__loading-visual-meta product-page__loading-visual-meta--bottom">
            <span className="product-page__loading-pill product-page__loading-pill--medium" />
            <span className="product-page__loading-pill product-page__loading-pill--wide" />
          </div>
        </div>

        <div className="product-page__loading-content">
          <div className="product-page__loading-panel">
            <div className="product-page__loading-stack">
              <span className="product-page__loading-line product-page__loading-line--title" />
              <span className="product-page__loading-line product-page__loading-line--body" />
              <span className="product-page__loading-line product-page__loading-line--body product-page__loading-line--body-short" />
            </div>

            <div className="product-page__loading-stat-grid">
              <div className="product-page__loading-stat-card">
                <span className="product-page__loading-line product-page__loading-line--label" />
                <span className="product-page__loading-line product-page__loading-line--metric" />
              </div>
              <div className="product-page__loading-stat-card">
                <span className="product-page__loading-line product-page__loading-line--label" />
                <span className="product-page__loading-line product-page__loading-line--metric" />
              </div>
            </div>

            <div className="product-page__loading-actions">
              <span className="product-page__loading-button product-page__loading-button--ghost" />
              <span className="product-page__loading-button product-page__loading-button--primary" />
            </div>
          </div>

          <div className="product-page__loading-panel">
            <div className="product-page__loading-stack">
              <span className="product-page__loading-line product-page__loading-line--section-label" />
              <span className="product-page__loading-line product-page__loading-line--body" />
            </div>

            <div className="product-page__loading-variants">
              {Array.from({ length: 3 }).map((_, index) => (
                <span key={index} className="product-page__loading-variant" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ProductPage() {
  const { confirm, notify } = useFeedback();
  const { productId } = useParams();
  const {
    addToCart,
    favorites,
    isAdmin,
    isAuthenticated,
    openAuthModal,
    toggleFavorite,
  } = useStorefront();
  const [product, setProduct] = useState<ProductRecord | null>(null); //important to take DB and upload to front-end
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    null,
  );
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [cartBusy, setCartBusy] = useState(false);
  const [reviewsData, setReviewsData] = useState<ProductReviewsResponse | null>(
    null,
  );
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewDraft, setReviewDraft] = useState({ comment: "", rating: 0 });

  useEffect(() => {
    let active = true;

    if (!productId) {
      setProduct(null);
      setSelectedVariant(null);
      setLoadError("The requested reference was not specified.");
      setLoading(false);

      return () => {
        active = false;
      };
    }

    setLoading(true);
    setLoadError(null);

    storefrontApi
      .getProduct(productId)
      .then((result) => {
        if (!active) {
          return;
        }

        setProduct(result);
        setSelectedVariant(result.variants[0] ?? null);
        setSelectedImageIndex(0);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        setProduct(null);
        setSelectedVariant(null);
        setSelectedImageIndex(0);
        setLoading(false);
        setLoadError(
          error instanceof Error
            ? error.message
            : "This reference could not be loaded from the live archive.",
        );
      });

    return () => {
      active = false;
    };
  }, [productId]);

  const activePrice = useMemo(() => {
    if (!selectedVariant) {
      return 0;
    }

    return selectedVariant.discountPrice ?? selectedVariant.price;
  }, [selectedVariant]);

  const galleryImages = useMemo(
    () => product?.images.filter((image) => image.trim().length > 0) ?? [],
    [product?.images],
  );
  const activeGalleryImage =
    galleryImages[selectedImageIndex] ?? galleryImages[0] ?? "";

  const inventoryTone = useMemo(() => {
    const stock = selectedVariant?.stockQuantity ?? 0;

    if (stock <= 0) {
      return { label: "Unavailable", tone: "soldout" as const };
    }

    if (stock <= 5) {
      return { label: "Low stock", tone: "limited" as const };
    }

    return { label: "Available", tone: "available" as const };
  }, [selectedVariant]);

  const isFavorite = useMemo(() => {
    if (!product) {
      return false;
    }

    return (
      favorites?.items.some((item) => item.productId === product.id) ?? false
    );
  }, [favorites?.items, product]);

  const canReview = isAuthenticated && !isAdmin;
  const reviewSummary = reviewsData?.summary ?? createEmptyReviewSummary();
  const viewerReview = reviewsData?.viewerReview ?? null;
  const publicReviews = reviewsData?.items ?? [];

  useEffect(() => {
    let active = true;

    if (!productId) {
      setReviewsData(null);
      setReviewsLoading(false);
      setReviewsError(null);
      return () => {
        active = false;
      };
    }

    setReviewsLoading(true);
    setReviewsError(null);

    Promise.all([
      storefrontApi.getProductReviews(productId),
      canReview
        ? storefrontApi.getMyProductReview(productId)
        : Promise.resolve(null),
    ])
      .then(([reviewBundle, myReview]) => {
        if (!active) {
          return;
        }

        setReviewsData({
          ...reviewBundle,
          viewerReview: myReview,
        });
        setReviewsLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        setReviewsLoading(false);
        setReviewsData(null);
        setReviewsError(
          error instanceof Error
            ? error.message
            : "Reviews could not be loaded right now.",
        );
      });

    return () => {
      active = false;
    };
  }, [canReview, productId]);

  useEffect(() => {
    if (!viewerReview) {
      setReviewDraft({ comment: "", rating: 0 });
      return;
    }

    setReviewDraft({
      comment: viewerReview.comment,
      rating: viewerReview.rating,
    });
  }, [viewerReview]);

  async function refreshReviews(targetProductId: string): Promise<void> {
    const [reviewBundle, myReview] = await Promise.all([
      storefrontApi.getProductReviews(targetProductId),
      canReview
        ? storefrontApi.getMyProductReview(targetProductId)
        : Promise.resolve(null),
    ]);

    setReviewsData({
      ...reviewBundle,
      viewerReview: myReview,
    });
    setReviewsError(null);
  }

  async function handleAddToCart(): Promise<void> {
    if (!isAuthenticated) {
      openAuthModal("sign-in");
      notify({
        description: "Sign in to add this reference to your reserve cart.",
        title: "Authentication required",
        tone: "info",
      });
      return;
    }

    if (!selectedVariant) {
      notify({
        description:
          "Select a reference variant before adding it to your reserve cart.",
        title: "Choose a variant first",
        tone: "error",
      });
      return;
    }

    if (selectedVariant.stockQuantity <= 0) {
      notify({
        description: "This reference is currently unavailable.",
        title: "Out of stock",
        tone: "error",
      });
      return;
    }

    setCartBusy(true);

    try {
      await addToCart(selectedVariant.id, 1);
      notify({
        description: "The selected piece is now staged in your reserve cart.",
        title: `${product?.name ?? "Watch"} added to cart`,
        tone: "success",
      });
    } catch (error) {
      notify({
        description:
          error instanceof Error
            ? error.message
            : "Unable to update your reserve cart right now.",
        title: "Cart update failed",
        tone: "error",
      });
    } finally {
      setCartBusy(false);
    }
  }

  async function handleToggleFavorite(): Promise<void> {
    if (!product) {
      return;
    }

    if (!isAuthenticated) {
      openAuthModal("sign-in");
      notify({
        description: "Sign in to save references to your favorites.",
        title: "Authentication required",
        tone: "info",
      });
      return;
    }

    setFavoriteBusy(true);

    try {
      await toggleFavorite(product.id);
      notify({
        description: isFavorite
          ? "The reference was removed from your saved desk."
          : "The reference was added to your saved desk.",
        title: isFavorite ? `${product.name} removed` : `${product.name} saved`,
        tone: "success",
      });
    } catch (error) {
      notify({
        description:
          error instanceof Error
            ? error.message
            : "Unable to update favorites right now.",
        title: "Favorites update failed",
        tone: "error",
      });
    } finally {
      setFavoriteBusy(false);
    }
  }

  async function handleReviewSubmit(): Promise<void> {
    if (!product) {
      return;
    }

    if (!isAuthenticated) {
      openAuthModal("sign-in");
      notify({
        description: "Sign in to publish a rating for this reference.",
        title: "Authentication required",
        tone: "info",
      });
      return;
    }

    if (isAdmin) {
      notify({
        description: "Admin accounts moderate reviews from Operations.",
        title: "Reviews are member-only",
        tone: "info",
      });
      return;
    }

    if (reviewDraft.rating < 1 || reviewDraft.rating > 5) {
      notify({
        description: "Choose a rating between one and five stars first.",
        title: "Rating required",
        tone: "error",
      });
      return;
    }

    setReviewBusy(true);

    try {
      await storefrontApi.upsertMyProductReview(product.id, {
        comment: reviewDraft.comment.trim() || undefined,
        rating: reviewDraft.rating,
      });
      await refreshReviews(product.id);
      notify({
        description: viewerReview
          ? "Your rating and note are now updated on the product page."
          : "Your rating is now live on the product page.",
        title: viewerReview ? "Review updated" : "Review published",
        tone: "success",
      });
    } catch (error) {
      notify({
        description:
          error instanceof Error
            ? error.message
            : "Unable to publish your review right now.",
        title: "Review update failed",
        tone: "error",
      });
    } finally {
      setReviewBusy(false);
    }
  }

  async function handleDeleteReview(): Promise<void> {
    if (!product || !viewerReview) {
      return;
    }

    const accepted = await confirm({
      confirmLabel: "Delete review",
      description:
        "This will remove your rating and comment from the public product page.",
      title: "Remove your review?",
      tone: "danger",
    });

    if (!accepted) {
      return;
    }

    setReviewBusy(true);

    try {
      await storefrontApi.deleteMyProductReview(product.id);
      await refreshReviews(product.id);
      notify({
        description: "Your review has been removed from this reference.",
        title: "Review deleted",
        tone: "success",
      });
    } catch (error) {
      notify({
        description:
          error instanceof Error
            ? error.message
            : "Unable to remove your review right now.",
        title: "Delete failed",
        tone: "error",
      });
    } finally {
      setReviewBusy(false);
    }
  }

  return (
    <div className="product-page">
      <div className="product-page__shell">
        <Link className="product-page__back-link" to="/collection">
          <ArrowLeft className="product-page__back-icon" />
          Back to collection
        </Link>

        {loading ? <ProductLoadingState /> : null}

        {!loading && !product ? (
          <div className="product-page__state-card">
            <p className="product-page__state-eyebrow">Live archive</p>
            <h1 className="product-page__state-title">
              Reference unavailable.
            </h1>
            <p className="product-page__state-copy">
              {loadError ??
                "This product is no longer available in the live Firestore catalog."}
            </p>
          </div>
        ) : null}

        {!loading && product ? (
          <>
            <div className="product-page__header">
              <div>
                <p className="product-page__eyebrow">{product.type}</p>
                <h1 className="product-page__title">{product.name}</h1>
              </div>
              <div className="product-page__hero-stats">
                <span
                  className={`product-page__availability product-page__availability--${inventoryTone.tone}`}
                >
                  {inventoryTone.label}
                </span>
                <span className="product-page__sku">
                  {selectedVariant?.sku ?? "Reference pending"}
                </span>
              </div>
            </div>

            <div className="product-page__layout">
              <motion.div
                className="product-page__visual"
                initial={{ opacity: 0, y: 26, scale: 0.97 }}
                transition={{ duration: 0.7 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
              >
                <div className="product-page__visual-glow product-page__visual-glow--left" />
                <div className="product-page__visual-glow product-page__visual-glow--right" />
                <div className="product-page__visual-grid" />
                <div className="product-page__visual-meta product-page__visual-meta--top">
                  <span>Limited to selected desks</span>
                  <span>
                    {formatProductSize(selectedVariant?.size, "42mm")}
                  </span>
                </div>
                <div className="product-page__media">
                  {activeGalleryImage ? (
                    <AnimatePresence mode="wait">
                      <motion.img
                        key={activeGalleryImage}
                        alt={`${product.name} view ${selectedImageIndex + 1}`}
                        animate={{ opacity: 1, scale: 1 }}
                        className="product-page__image"
                        exit={{ opacity: 0, scale: 0.985 }}
                        initial={{ opacity: 0, scale: 0.985 }}
                        src={activeGalleryImage}
                        transition={{ duration: 0.28 }}
                      />
                    </AnimatePresence>
                  ) : (
                    <div className="product-page__image-placeholder">
                      Campaign image pending
                    </div>
                  )}
                  <div className="product-page__image-halo" />
                </div>
                {galleryImages.length > 1 ? (
                  <div
                    aria-label="Product image gallery"
                    className="product-page__gallery-strip"
                  >
                    {galleryImages.map((image, index) => (
                      <button
                        key={`${image}-${index}`}
                        aria-label={`Show product image ${index + 1}`}
                        aria-pressed={selectedImageIndex === index}
                        className={`product-page__gallery-thumb${
                          selectedImageIndex === index
                            ? " product-page__gallery-thumb--active"
                            : ""
                        }`}
                        onClick={() => setSelectedImageIndex(index)}
                        type="button"
                      >
                        <img
                          alt=""
                          className="product-page__gallery-thumb-image"
                          src={image}
                        />
                        <span>{String(index + 1).padStart(2, "0")}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="product-page__visual-meta product-page__visual-meta--bottom">
                  <span>{selectedVariant?.color ?? "Signature tone"}</span>
                  <span>{product?.brandId ?? "Private Reserve"}</span>
                </div>
              </motion.div>

              <div className="product-page__content">
                <div className="product-page__intro">
                  <p className="product-page__description">
                    {product.description}
                  </p>
                  <div className="product-page__intro-rail">
                    <div className="product-page__intro-stat">
                      <span className="product-page__label">Live price</span>
                      <strong className="product-page__price">
                        ${activePrice.toFixed(0)}
                      </strong>
                    </div>
                    <div className="product-page__intro-stat">
                      <span className="product-page__label">Inventory</span>
                      <strong className="product-page__stock-value">
                        {selectedVariant?.stockQuantity ?? 0} pieces
                      </strong>
                    </div>
                  </div>
                  <div className="product-page__action-row">
                    <button
                      className={`product-page__secondary-action ${
                        isFavorite
                          ? "product-page__secondary-action--selected"
                          : ""
                      }`}
                      disabled={favoriteBusy}
                      onClick={() => {
                        void handleToggleFavorite();
                      }}
                      type="button"
                    >
                      {favoriteBusy ? (
                        <LoaderCircle className="product-page__button-icon product-page__button-icon--spinning" />
                      ) : (
                        <Heart className="product-page__button-icon" />
                      )}
                      {favoriteBusy
                        ? "Updating"
                        : !isAuthenticated
                          ? "Sign in to save"
                          : isFavorite
                            ? "Saved to favorites"
                            : "Add to favorites"}
                    </button>

                    <button
                      className="product-page__secondary-action product-page__secondary-action--primary"
                      disabled={cartBusy}
                      onClick={() => {
                        void handleAddToCart();
                      }}
                      type="button"
                    >
                      {cartBusy ? (
                        <LoaderCircle className="product-page__button-icon product-page__button-icon--spinning" />
                      ) : (
                        <ShoppingBag className="product-page__button-icon" />
                      )}
                      {cartBusy
                        ? "Adding"
                        : isAuthenticated
                          ? "Add to reserve cart"
                          : "Sign in for cart"}
                    </button>
                  </div>
                </div>

                <div className="product-page__variant-section">
                  <div className="product-page__section-head">
                    <p className="product-page__label">Select variant</p>
                    <span className="product-page__section-copy">
                      Choose the model tone you want the reserve to use.
                    </span>
                  </div>
                  <div className="product-page__variant-list">
                    {product.variants.map((variant) => (
                      <button
                        key={variant.id}
                        className={`product-page__variant-button ${
                          selectedVariant?.id === variant.id
                            ? "product-page__variant-button--active"
                            : "product-page__variant-button--inactive"
                        }`}
                        onClick={() => setSelectedVariant(variant)}
                        type="button"
                      >
                        <span className="product-page__variant-color">
                          {variant.color}
                        </span>
                        <span className="product-page__variant-size">
                          {formatProductSize(variant.size, "Size pending")}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <section className="product-page__reviews">
              <div className="product-page__reviews-head">
                <div>
                  <p className="product-page__label">Collector reviews</p>
                  <h2 className="product-page__reviews-title">
                    Ratings from the live reserve desk
                  </h2>
                </div>
                <p className="product-page__section-copy">
                  Guests can read the lounge. Members can leave one live rating
                  per reference.
                </p>
              </div>

              <div className="product-page__reviews-grid">
                <motion.section
                  className="product-page__review-summary"
                  initial={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.38 }}
                  viewport={{ amount: 0.2, once: true }}
                  whileInView={{ opacity: 1, y: 0 }}
                >
                  <p className="product-page__label">Average rating</p>
                  <div className="product-page__review-rating-line">
                    <strong>
                      {reviewSummary.reviewCount > 0
                        ? reviewSummary.averageRating.toFixed(1)
                        : "—"}
                    </strong>
                    <ReviewStars
                      rating={Math.round(reviewSummary.averageRating)}
                      readOnly
                    />
                  </div>
                  <p className="product-page__review-summary-copy">
                    {reviewSummary.reviewCount > 0
                      ? `${reviewSummary.reviewCount} collector review${
                          reviewSummary.reviewCount === 1 ? "" : "s"
                        } published so far.`
                      : "No ratings yet. The first member note will set the tone here."}
                  </p>

                  <div className="product-page__review-distribution">
                    {reviewSummary.distribution.map((entry) => {
                      const share =
                        reviewSummary.reviewCount === 0
                          ? 0
                          : (entry.count / reviewSummary.reviewCount) * 100;

                      return (
                        <div
                          key={entry.rating}
                          className="product-page__review-distribution-row"
                        >
                          <span>{entry.rating} star</span>
                          <div className="product-page__review-distribution-bar">
                            <div
                              className="product-page__review-distribution-fill"
                              style={{ width: `${share}%` }}
                            />
                          </div>
                          <strong>{entry.count}</strong>
                        </div>
                      );
                    })}
                  </div>
                </motion.section>

                <motion.section
                  className="product-page__review-composer"
                  initial={{ opacity: 0, y: 20 }}
                  transition={{ delay: 0.05, duration: 0.38 }}
                  viewport={{ amount: 0.2, once: true }}
                  whileInView={{ opacity: 1, y: 0 }}
                >
                  {canReview ? (
                    <>
                      <div className="product-page__review-composer-head">
                        <div>
                          <p className="product-page__label">
                            {viewerReview
                              ? "Your live review"
                              : "Rate this reference"}
                          </p>
                          <h3>
                            {viewerReview
                              ? "Adjust your score or note"
                              : "Publish your first impression"}
                          </h3>
                        </div>
                        <ReviewStars
                          onRate={(rating) =>
                            setReviewDraft((current) => ({
                              ...current,
                              rating,
                            }))
                          }
                          rating={reviewDraft.rating}
                        />
                      </div>

                      <textarea
                        className="product-page__textarea product-page__review-textarea"
                        onChange={(event) =>
                          setReviewDraft((current) => ({
                            ...current,
                            comment: event.target.value,
                          }))
                        }
                        placeholder="Optional note. Share how the dial, fit, or finishing feels in person."
                        rows={5}
                        value={reviewDraft.comment}
                      />

                      <div className="product-page__review-actions">
                        <button
                          className="product-page__secondary-action product-page__secondary-action--primary"
                          disabled={reviewBusy}
                          onClick={() => {
                            void handleReviewSubmit();
                          }}
                          type="button"
                        >
                          {reviewBusy ? (
                            <LoaderCircle className="product-page__button-icon product-page__button-icon--spinning" />
                          ) : (
                            <MessageSquareMore className="product-page__button-icon" />
                          )}
                          {viewerReview ? "Update review" : "Publish review"}
                        </button>
                        {viewerReview ? (
                          <button
                            className="product-page__secondary-action"
                            disabled={reviewBusy}
                            onClick={() => {
                              void handleDeleteReview();
                            }}
                            type="button"
                          >
                            <Trash2 className="product-page__button-icon" />
                            Delete review
                          </button>
                        ) : null}
                      </div>
                    </>
                  ) : isAdmin ? (
                    <div className="product-page__review-gate">
                      <p className="product-page__label">Admin visibility</p>
                      <h3>Public commentary is live here.</h3>
                      <p className="product-page__section-copy">
                        Reviews stay public for members and guests. Moderate or
                        remove any entry from the Operations desk.
                      </p>
                      <Link
                        className="product-page__secondary-action"
                        to="/operations"
                      >
                        Open Operations
                      </Link>
                    </div>
                  ) : (
                    <div className="product-page__review-gate">
                      <p className="product-page__label">Member rating</p>
                      <h3>Sign in to leave a star rating.</h3>
                      <p className="product-page__section-copy">
                        Guest browsing stays open, but rating and comment tools
                        are reserved for signed-in members.
                      </p>
                      <button
                        className="product-page__secondary-action product-page__secondary-action--primary"
                        onClick={() => {
                          openAuthModal("sign-in");
                          notify({
                            description:
                              "Sign in to publish a rating for this reference.",
                            title: "Authentication required",
                            tone: "info",
                          });
                        }}
                        type="button"
                      >
                        Sign in to rate
                      </button>
                    </div>
                  )}
                </motion.section>
              </div>

              {reviewsError ? (
                <p className="product-page__alert">{reviewsError}</p>
              ) : null}

              {reviewsLoading ? (
                <div className="product-page__review-stream product-page__review-stream--loading">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={index}
                      className="product-page__review-item product-page__review-item--skeleton"
                    >
                      <div className="product-page__review-avatar product-page__review-avatar--skeleton" />
                      <div className="product-page__review-copy">
                        <div className="product-page__review-line product-page__review-line--title" />
                        <div className="product-page__review-line product-page__review-line--meta" />
                        <div className="product-page__review-line product-page__review-line--body" />
                        <div className="product-page__review-line product-page__review-line--body product-page__review-line--body-short" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : publicReviews.length > 0 ? (
                <div className="product-page__review-stream">
                  {publicReviews.map((review) => (
                    <ReviewStreamItem key={review.id} review={review} />
                  ))}
                </div>
              ) : (
                <div className="product-page__review-empty">
                  No member notes yet. This lounge will fill as collectors start
                  rating the reference.
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
