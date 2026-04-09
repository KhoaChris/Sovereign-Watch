import { useState } from "react";
import { Heart, LoaderCircle } from "lucide-react";
import { Link } from "react-router-dom";

import { useStorefront } from "../storefront/storefront-context";
import type { ProductRecord } from "../shared";
import "../styles/pages/favorites-page.css";

function getStartingPrice(product: ProductRecord): number {
  return product.variants.reduce((lowest, variant) => {
    const candidate = variant.discountPrice ?? variant.price;
    return Math.min(lowest, candidate);
  }, Number.POSITIVE_INFINITY);
}

function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  });
}

export function FavoritesPage() {
  const {
    authLoading,
    commerceLoading,
    favorites,
    isAuthenticated,
    openAuthModal,
    toggleFavorite,
    user,
  } = useStorefront();
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);

  const favoriteItems = favorites?.items.filter((item) => item.product) ?? [];

  async function handleRemove(productId: string): Promise<void> {
    setPendingProductId(productId);

    try {
      await toggleFavorite(productId);
    } finally {
      setPendingProductId(null);
    }
  }

  if (authLoading && !user) {
    return (
      <div className="favorites-page">
        <div className="favorites-page__shell">
          <div className="favorites-page__empty-state">Loading saved references.</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="favorites-page">
        <div className="favorites-page__shell">
          <div className="favorites-page__empty-state favorites-page__empty-state--gate">
            <p className="favorites-page__eyebrow">Favorites</p>
            <h1 className="favorites-page__title">Sign in to build a private shortlist.</h1>
            <p className="favorites-page__copy">
              Keep the references you are comparing in one place, then return to them from any device with the same Firebase account.
            </p>
            <div className="favorites-page__actions">
              <button className="favorites-page__button favorites-page__button--primary" onClick={() => openAuthModal("sign-in")} type="button">
                Sign in
              </button>
              <Link className="favorites-page__button" to="/collection">
                Explore collection
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="favorites-page">
      <div className="favorites-page__shell">
        <header className="favorites-page__header">
          <div>
            <p className="favorites-page__eyebrow">Favorites</p>
            <h1 className="favorites-page__title">Collector references you want to return to.</h1>
            <p className="favorites-page__copy">
              These picks are synced to Firestore, so your shortlist stays attached to your account instead of a single browser session.
            </p>
          </div>

          <div className="favorites-page__hero-stat">
            <span>Saved pieces</span>
            <strong>{favoriteItems.length}</strong>
          </div>
        </header>

        {commerceLoading && !favorites ? (
          <div className="favorites-page__empty-state">Restoring your saved references.</div>
        ) : favoriteItems.length === 0 ? (
          <div className="favorites-page__empty-state">
            No favorites yet. Heart a watch from the product page and it will appear here.
          </div>
        ) : (
          <div className="favorites-page__grid">
            {favoriteItems.map((item) => {
              const product = item.product;

              if (!product) {
                return null;
              }

              const startingPrice = getStartingPrice(product);
              const isPending = pendingProductId === product.id;

              return (
                <article key={item.id} className="favorites-page__card">
                  <Link className="favorites-page__media" to={`/collection/${product.id}`}>
                    <img alt={product.name} className="favorites-page__image" src={product.images[0]} />
                  </Link>

                  <div className="favorites-page__card-copy">
                    <p className="favorites-page__type">{product.type}</p>
                    <Link className="favorites-page__name" to={`/collection/${product.id}`}>
                      {product.name}
                    </Link>
                    <p className="favorites-page__description">{product.description}</p>
                  </div>

                  <div className="favorites-page__card-footer">
                    <div>
                      <p className="favorites-page__price-label">Starting from</p>
                      <strong className="favorites-page__price">{formatCurrency(startingPrice)}</strong>
                    </div>

                    <div className="favorites-page__actions">
                      <Link className="favorites-page__button favorites-page__button--primary" to={`/collection/${product.id}`}>
                        View piece
                      </Link>
                      <button
                        className="favorites-page__button"
                        disabled={isPending}
                        onClick={() => {
                          void handleRemove(product.id);
                        }}
                        type="button"
                      >
                        {isPending ? <LoaderCircle className="favorites-page__button-icon favorites-page__button-icon--spinning" /> : <Heart className="favorites-page__button-icon" />}
                        {isPending ? "Updating" : "Remove"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
