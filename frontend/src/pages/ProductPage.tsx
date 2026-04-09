import { useEffect, useMemo, useState } from "react";

import { motion } from "framer-motion";
import { ArrowLeft, Heart, LoaderCircle, ShoppingBag } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { storefrontApi } from "../services/api";
import type { ProductRecord, ProductVariant } from "../shared";
import { useStorefront } from "../storefront/storefront-context";
import "../styles/pages/product-page.css";

export function ProductPage() {
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
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"neutral" | "success" | "error">(
    "neutral",
  );

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
      setStatusMessage("Sign in to add this reference to your reserve cart.");
      setStatusTone("neutral");
      return;
    }

    if (!selectedVariant) {
      setStatusMessage(
        "Select a reference variant before adding it to your reserve cart.",
      );
      setStatusTone("error");
      return;
    }

    if (selectedVariant.stockQuantity <= 0) {
      setStatusMessage("This reference is currently unavailable.");
      setStatusTone("error");
      return;
    }

    setCartBusy(true);

    try {
      await addToCart(selectedVariant.id, 1);
      setStatusMessage(
        `${product?.name ?? "Watch"} added to your reserve cart.`,
      );
      setStatusTone("success");
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Unable to update your reserve cart right now.",
      );
      setStatusTone("error");
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
      setStatusMessage("Sign in to save references to your favorites.");
      setStatusTone("neutral");
      return;
    }

    setFavoriteBusy(true);

    try {
      await toggleFavorite(product.id);
      setStatusMessage(
        isFavorite
          ? `${product.name} removed from your favorites.`
          : `${product.name} saved to your favorites.`,
      );
      setStatusTone("success");
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Unable to update favorites right now.",
      );
      setStatusTone("error");
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

        {loading ? (
          <div className="product-page__state-card" role="status">
            <p className="product-page__state-eyebrow">Live archive</p>
            <h1 className="product-page__state-title">Loading reference.</h1>
            <p className="product-page__state-copy">
              Pulling the latest product record from the collection service.
            </p>
          </div>
        ) : null}

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
                  {statusMessage ? (
                    <p
                      className={`product-page__status product-page__status--${statusTone}`}
                    >
                      {statusMessage}
                    </p>
                  ) : null}
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
