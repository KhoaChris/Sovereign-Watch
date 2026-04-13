import { useEffect, useMemo, useState } from "react";

import { motion } from "framer-motion";
import { ArrowLeft, Heart, LoaderCircle, ShoppingBag } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { useFeedback } from "../feedback/feedback-context";
import { storefrontApi } from "../services/api";
import type { ProductRecord, ProductVariant } from "../shared";
import { useStorefront } from "../storefront/storefront-context";
import "../styles/pages/product-page.css";

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
                <span
                  key={index}
                  className="product-page__loading-variant"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ProductPage() {
  const { notify } = useFeedback();
  const { productId } = useParams();
  const {
    addToCart,
    favorites,
    isAuthenticated,
    openAuthModal,
    toggleFavorite,
  } = useStorefront();
  const [product, setProduct] = useState<ProductRecord | null>(null); //important to take DB and upload to front-end
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [cartBusy, setCartBusy] = useState(false);

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
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        setProduct(null);
        setSelectedVariant(null);
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
        title: isFavorite
          ? `${product.name} removed`
          : `${product.name} saved`,
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
                  <span>{selectedVariant?.size ?? "42mm"}</span>
                </div>
                <div className="product-page__media">
                  {product.images[0] ? (
                    <img
                      alt={product.name}
                      className="product-page__image"
                      src={product.images[0]}
                    />
                  ) : (
                    <div className="product-page__image-placeholder">
                      Campaign image pending
                    </div>
                  )}
                  <div className="product-page__image-halo" />
                </div>
                <div className="product-page__visual-meta product-page__visual-meta--bottom">
                  <span>{selectedVariant?.color ?? "Signature tone"}</span>
                  <span>Private reserve available</span>
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
                          {variant.size}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
