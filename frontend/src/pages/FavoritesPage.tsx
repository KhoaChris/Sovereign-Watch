import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Heart, LoaderCircle } from "lucide-react";
import { Link } from "react-router-dom";

import { useFeedback } from "../feedback/feedback-context";
import { useStorefront } from "../storefront/storefront-context";
import type { ProductRecord } from "../shared";
import "../styles/pages/favorites-page.css";

type FavoritesHeroMode = "guest" | "empty" | "saved";

interface FavoritesHeroContent {
  eyebrow: string;
  title: string;
  copy: string;
}

function getStartingPrice(product: ProductRecord): number {
  return product.variants.reduce((lowest, variant) => {
    const candidate = variant.discountPrice ?? variant.price;
    return Math.min(lowest, candidate);
  }, Number.POSITIVE_INFINITY);
}

function getAvailableStock(product: ProductRecord): number {
  return product.variants.reduce(
    (total, variant) => total + Math.max(variant.stockQuantity, 0),
    0,
  );
}

function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  });
}

function formatDeskValue(value: number): string {
  if (value <= 0) {
    return "$0";
  }

  return formatCurrency(value);
}

function getHeroContent(mode: FavoritesHeroMode): FavoritesHeroContent {
  if (mode === "saved") {
    return {
      eyebrow: "Favorites desk",
      title: "Your saved pieces",
      copy: "Your shortlist stays synced and ready to revisit.",
    };
  }

  if (mode === "empty") {
    return {
      eyebrow: "Favorites desk",
      title: "Your saved pieces",
      copy: "Heart a watch in the collection and it lands here for later.",
    };
  }

  return {
    eyebrow: "Favorites desk",
    title: "Your saved pieces",
    copy: "Sign in once and your saved desk follows you across devices.",
  };
}

export function FavoritesPage() {
  const { notify } = useFeedback();
  const {
    authLoading,
    commerceLoading,
    favorites,
    isAuthenticated,
    toggleFavorite,
    user,
  } = useStorefront();
  const prefersReducedMotion = useReducedMotion();
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);

  const favoriteItems = favorites?.items.filter((item) => item.product) ?? [];
  const favoriteProducts = favoriteItems
    .map((item) => item.product)
    .filter((product): product is ProductRecord => Boolean(product));
  const favoriteCount = favoriteProducts.length;
  const favoriteDeskValue = favoriteProducts.reduce(
    (total, product) => total + getStartingPrice(product),
    0,
  );
  const heroMode: FavoritesHeroMode = !isAuthenticated
    ? "guest"
    : favoriteCount > 0
      ? "saved"
      : "empty";
  const heroContent = getHeroContent(heroMode);

  const revealProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.2 },
        transition: { duration: 0.45 },
      };

  async function handleRemove(product: ProductRecord): Promise<void> {
    setPendingProductId(product.id);

    try {
      await toggleFavorite(product.id);
      notify({
        description: "The reference was removed from your saved desk.",
        title: `${product.name} removed`,
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
      setPendingProductId(null);
    }
  }

  if (authLoading && !user) {
    return (
      <div className="favorites-page">
        <div className="favorites-page__shell">
          <div className="favorites-page__empty-state">
            Loading saved references.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="favorites-page">
      <div className="favorites-page__shell">
        <motion.section className="favorites-page__hero" {...revealProps}>
          <Link className="favorites-page__back-link" to="/collection">
            <ArrowLeft className="favorites-page__back-icon" />
            Back to marketplace
          </Link>

          <div className="favorites-page__hero-copy">
            <p className="favorites-page__eyebrow">{heroContent.eyebrow}</p>
            <h1 className="favorites-page__title">{heroContent.title}</h1>
            <p className="favorites-page__copy">{heroContent.copy}</p>
          </div>

          <div className="favorites-page__hero-signal">
            <div className="favorites-page__signal-item">
              <span>Saved pieces</span>
              <strong>{favoriteCount}</strong>
            </div>
            <div className="favorites-page__signal-item">
              <span>Starting total</span>
              <strong>{formatDeskValue(favoriteDeskValue)}</strong>
            </div>
          </div>

          <div className="favorites-page__flow" aria-label="Favorites workflow">
            <div className="favorites-page__flow-item">
              <span>01</span>
              <strong>Discover</strong>
              <p>Heart references while browsing the marketplace.</p>
            </div>
            <div className="favorites-page__flow-item">
              <span>02</span>
              <strong>Review</strong>
              <p>
                {favoriteCount > 0
                  ? `${favoriteCount} saved reference${favoriteCount === 1 ? "" : "s"} ready.`
                  : "Build a calm shortlist before checkout."}
              </p>
            </div>
            <div className="favorites-page__flow-item">
              <span>03</span>
              <strong>Reserve</strong>
              <p>Open a piece, then stage the right variant in cart.</p>
            </div>
          </div>
        </motion.section>

        {!isAuthenticated ? (
          <motion.section
            className="favorites-page__state favorites-page__state--gate"
            {...revealProps}
          >
            <span className="favorites-page__state-mark" aria-hidden="true">
              <Heart className="favorites-page__state-icon" />
            </span>
            <div className="favorites-page__state-head">
              <p className="favorites-page__state-copy">
                Save references after signing in
              </p>
            </div>
            <p className="favorites-page__state-support">
              Your private shortlist can sync across devices once your account
              is active.
            </p>
            <div className="favorites-page__actions favorites-page__state-actions">
              <Link
                className="favorites-page__button favorites-page__button--primary"
                to="/collection"
              >
                Browse marketplace
              </Link>
            </div>
          </motion.section>
        ) : commerceLoading && !favorites ? (
          <div className="favorites-page__empty-state">
            Restoring your saved desk.
          </div>
        ) : favoriteItems.length === 0 ? (
          <motion.section className="favorites-page__state" {...revealProps}>
            <span className="favorites-page__state-mark" aria-hidden="true">
              <Heart className="favorites-page__state-icon" />
            </span>
            <div className="favorites-page__state-head">
              <p className="favorites-page__state-copy">
                Your favorites desk is empty
              </p>
            </div>
            <p className="favorites-page__state-support">
              Nothing is saved right now. Open the marketplace and heart a piece
              to keep it within easy reach.
            </p>
            <div className="favorites-page__state-steps">
              <span>Browse the collection</span>
              <span>Heart a reference</span>
              <span>Return here to compare</span>
            </div>
            <div className="favorites-page__actions favorites-page__state-actions">
              <Link
                className="favorites-page__button favorites-page__button--primary"
                to="/collection"
              >
                Browse marketplace
              </Link>
              <Link className="favorites-page__button" to="/cart">
                Open reserve cart
              </Link>
            </div>
          </motion.section>
        ) : (
          <motion.section
            className="favorites-page__collection"
            {...revealProps}
          >
            <div className="favorites-page__collection-head">
              <div>
                <p className="favorites-page__eyebrow">Shortlist</p>
                <h2 className="favorites-page__section-title">
                  Saved references ready for review.
                </h2>
              </div>
              <Link
                className="favorites-page__button favorites-page__button--compact"
                to="/collection"
              >
                Continue browsing
                <ArrowRight className="favorites-page__button-icon" />
              </Link>
            </div>

            <div className="favorites-page__grid">
              {favoriteItems.map((item) => {
                const product = item.product;

                if (!product) {
                  return null;
                }

                const startingPrice = getStartingPrice(product);
                const isPending = pendingProductId === product.id;
                const availableStock = getAvailableStock(product);

                return (
                  <article key={item.id} className="favorites-page__card">
                    <Link
                      className="favorites-page__media"
                      to={`/collection/${product.id}`}
                    >
                      <img
                        alt={product.name}
                        className="favorites-page__image"
                        src={product.images[0]}
                      />
                    </Link>

                    <div className="favorites-page__card-copy">
                      <p className="favorites-page__type">{product.type}</p>
                      <Link
                        className="favorites-page__name"
                        to={`/collection/${product.id}`}
                      >
                        {product.name}
                      </Link>
                      <p className="favorites-page__meta">
                        <span>{product.brand?.name ?? product.brandId}</span>
                        <span>{product.category?.name ?? product.type}</span>
                        <span>
                          {product.variants.length} variant
                          {product.variants.length === 1 ? "" : "s"}
                        </span>
                      </p>
                      <p className="favorites-page__description">
                        {product.description}
                      </p>
                    </div>

                    <div className="favorites-page__card-footer">
                      <div>
                        <p className="favorites-page__price-label">
                          Starting from
                        </p>
                        <strong className="favorites-page__price">
                          {formatCurrency(startingPrice)}
                        </strong>
                      </div>

                      <div className="favorites-page__availability">
                        <span>{availableStock}</span>
                        in stock
                      </div>

                      <div className="favorites-page__actions">
                        <Link
                          className="favorites-page__button favorites-page__button--primary"
                          to={`/collection/${product.id}`}
                        >
                          View piece
                        </Link>
                        <button
                          className="favorites-page__button"
                          disabled={isPending}
                          onClick={() => {
                            void handleRemove(product);
                          }}
                          type="button"
                        >
                          {isPending ? (
                            <LoaderCircle className="favorites-page__button-icon favorites-page__button-icon--spinning" />
                          ) : (
                            <Heart className="favorites-page__button-icon" />
                          )}
                          {isPending ? "Updating" : "Remove"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </motion.section>
        )}
      </div>
    </div>
  );
}
