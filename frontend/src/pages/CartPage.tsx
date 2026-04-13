import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  CreditCard,
  Landmark,
  LoaderCircle,
  Minus,
  Plus,
  ShieldCheck,
  Trash2,
  Wallet,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { useFeedback } from "../feedback/feedback-context";
import { useStorefront } from "../storefront/storefront-context";
import type { CartItemRecord, PaymentMethod } from "../shared";
import "../styles/pages/cart-page.css";

function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  });
}

function paymentMethodLabel(method: PaymentMethod): string {
  switch (method) {
    case "card":
      return "Card on confirmation";
    case "bank_transfer":
      return "Bank transfer";
    case "cash_on_delivery":
      return "Cash on delivery";
    case "wallet":
      return "Digital wallet";
    default:
      return method;
  }
}

const PAYMENT_METHODS: Array<{
  description: string;
  icon: typeof CreditCard;
  value: PaymentMethod;
}> = [
  {
    value: "card",
    icon: CreditCard,
    description: "Secure the reserve now and confirm payment after review.",
  },
  {
    value: "bank_transfer",
    icon: Landmark,
    description:
      "Settle through a quieter transfer desk once the order is confirmed.",
  },
  {
    value: "cash_on_delivery",
    icon: ShieldCheck,
    description: "Pay on arrival for eligible courier routes.",
  },
  {
    value: "wallet",
    icon: Wallet,
    description:
      "Use your preferred digital wallet for the final confirmation.",
  },
];

function renderVariantLabel(item: CartItemRecord): string {
  return [item.variantColor, item.variantSize].filter(Boolean).join(" / ");
}

function CartSkeleton() {
  return (
    <div className="cart-page__workspace cart-page__workspace--skeleton">
      <div className="cart-page__desk">
        <section className="cart-page__panel">
          <div className="cart-page__skeleton cart-page__skeleton--headline" />
          <div className="cart-page__skeleton cart-page__skeleton--row" />
          <div className="cart-page__skeleton cart-page__skeleton--row" />
          <div className="cart-page__skeleton cart-page__skeleton--row" />
        </section>
        <section className="cart-page__panel cart-page__panel--form">
          <div className="cart-page__skeleton cart-page__skeleton--label" />
          <div className="cart-page__skeleton cart-page__skeleton--field" />
          <div className="cart-page__skeleton cart-page__skeleton--field" />
        </section>
      </div>
      <aside className="cart-page__summary">
        <div className="cart-page__skeleton cart-page__skeleton--headline" />
        <div className="cart-page__skeleton cart-page__skeleton--field" />
        <div className="cart-page__skeleton cart-page__skeleton--field" />
        <div className="cart-page__skeleton cart-page__skeleton--button" />
      </aside>
    </div>
  );
}

export function CartPage() {
  const { confirm, notify } = useFeedback();
  const {
    authBusy,
    authLoading,
    cart,
    checkoutCart,
    commerceLoading,
    isAuthenticated,
    openAuthModal,
    removeCartItem,
    updateCartQuantity,
    user,
  } = useStorefront();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [shippingAddress, setShippingAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [checkoutPending, setCheckoutPending] = useState(false);

  useEffect(() => {
    setShippingAddress(user?.address ?? "");
  }, [user?.address, user?.id]);

  const items = cart?.items ?? [];
  const itemCount = cart?.itemCount ?? 0;
  const subtotal = cart?.totalAmount ?? 0;
  const readyToSubmit =
    items.length > 0 && shippingAddress.trim().length >= 10 && !checkoutPending;

  const revealProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.2 },
        transition: { duration: 0.45 },
      };
  const summaryItems = items.slice(0, 3);

  async function changeQuantity(
    item: CartItemRecord,
    quantity: number,
  ): Promise<void> {
    setPendingItemId(item.id);
    setCheckoutError(null);

    try {
      await updateCartQuantity(item.id, quantity);
    } finally {
      setPendingItemId(null);
    }
  }

  async function handleRemove(item: CartItemRecord): Promise<void> {
    const accepted = await confirm({
      confirmLabel: "Remove item",
      description: `${item.productName} will be removed from your reserve cart.`,
      title: "Remove this cart item?",
      tone: "default",
    });

    if (!accepted) {
      return;
    }

    setPendingItemId(item.id);
    setCheckoutError(null);

    try {
      await removeCartItem(item.id);
      notify({
        description: "The piece was removed from your reserve cart.",
        title: `${item.productName} removed`,
        tone: "success",
      });
    } catch (error) {
      notify({
        description:
          error instanceof Error
            ? error.message
            : "Unable to update your cart right now.",
        title: "Cart update failed",
        tone: "error",
      });
    } finally {
      setPendingItemId(null);
    }
  }

  async function handleCheckout(): Promise<void> {
    const normalizedShippingAddress = shippingAddress.trim();

    if (items.length === 0) {
      setCheckoutError("Your reserve cart is empty.");
      return;
    }

    if (normalizedShippingAddress.length < 10) {
      setShippingError(
        "Enter a fuller shipping address so the reserve desk can route delivery.",
      );
      return;
    }

    setShippingError(null);
    setCheckoutError(null);
    setCheckoutPending(true);

    try {
      const result = await checkoutCart({
        paymentMethod,
        shippingAddress: normalizedShippingAddress,
      });

      navigate("/orders", {
        state: {
          cartCheckoutMessage: `Reserve ${result.order.orderNumber} was created from your cart.`,
        },
      });
    } catch (error) {
      setCheckoutError(
        error instanceof Error
          ? error.message
          : "Unable to create your reserve right now.",
      );
    } finally {
      setCheckoutPending(false);
    }
  }

  if (authLoading && !user) {
    return (
      <div className="cart-page">
        <div className="cart-page__ambient" />
        <div className="cart-page__shell">
          <div className="cart-page__state">Loading your reserve desk.</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="cart-page">
        <div className="cart-page__ambient" />
        <div className="cart-page__shell">
          <section className="cart-page__hero">
            <p className="cart-page__eyebrow">Checkout desk</p>
            <h1 className="cart-page__title">
              Sign in to keep your reserve cart in sync.
            </h1>
            <p className="cart-page__copy">
              Saved references, shipping details, and reserve totals stay
              attached to your member profile so the cart can reopen quietly on
              any device.
            </p>
          </section>

          <div className="cart-page__state cart-page__state--gate">
            <p className="cart-page__state-copy">
              Member access unlocks the full reserve flow: cart editing,
              shipping details, payment selection, and order creation from a
              single surface.
            </p>
            <div className="cart-page__actions">
              <button
                className="cart-page__button cart-page__button--primary"
                onClick={() => openAuthModal("sign-in")}
                type="button"
              >
                Sign in
              </button>
              <Link className="cart-page__button" to="/collection">
                Return to marketplace
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <div className="cart-page__ambient" />
      <div className="cart-page__shell">
        <motion.section className="cart-page__hero" {...revealProps}>
          <Link className="cart-page__back-link" to="/collection">
            <ArrowLeft className="cart-page__back-icon" />
            Back to marketplace
          </Link>

          <div className="cart-page__hero-copy">
            <p className="cart-page__eyebrow">Checkout desk</p>
            <h1 className="cart-page__title">Your reserve cart</h1>
            <p className="cart-page__copy">
              Review saved pieces, confirm delivery details, and stage payment
              from one quieter editorial checkout surface.
            </p>
          </div>

          <div className="cart-page__hero-signal">
            <div className="cart-page__signal-item">
              <span>Pieces in cart</span>
              <strong>{itemCount}</strong>
            </div>
            <div className="cart-page__signal-item">
              <span>Subtotal</span>
              <strong>{formatCurrency(subtotal)}</strong>
            </div>
          </div>
        </motion.section>

        {commerceLoading && !cart ? (
          <CartSkeleton />
        ) : items.length === 0 ? (
          <motion.section className="cart-page__state" {...revealProps}>
            <div className="cart-page__state-head">
              <p className="cart-page__state-copy">Your reserve cart is empty</p>
            </div>
            <p className="cart-page__state-support">
              Nothing is staged right now. Open the marketplace or pull a saved reference from favorites to start a calmer checkout flow.
            </p>
            <div className="cart-page__actions">
              <Link
                className="cart-page__button cart-page__button--primary"
                to="/collection"
              >
                Browse marketplace
              </Link>
              <Link className="cart-page__button" to="/favorites">
                Open favorites
              </Link>
            </div>
          </motion.section>
        ) : (
          <>
            <div className="cart-page__workspace">
              <motion.div className="cart-page__desk" {...revealProps}>
                <section className="cart-page__panel cart-page__panel--items">
                  <div className="cart-page__panel-head">
                    <div>
                      <p className="cart-page__section-label">Cart items</p>
                    </div>
                  </div>

                  <div
                    className="cart-page__column-headings"
                    aria-hidden="true"
                  >
                    <span>Reference</span>
                    <span>Unit</span>
                    <span>Quantity</span>
                    <span>Total</span>
                  </div>

                  <div className="cart-page__rows">
                    {items.map((item, index) => {
                      const isPending = pendingItemId === item.id;

                      return (
                        <motion.article
                          key={item.id}
                          className="cart-page__row"
                          initial={
                            prefersReducedMotion ? false : { opacity: 0, y: 16 }
                          }
                          transition={{ duration: 0.35, delay: index * 0.05 }}
                          viewport={{ once: true, amount: 0.2 }}
                          whileInView={
                            prefersReducedMotion
                              ? undefined
                              : { opacity: 1, y: 0 }
                          }
                        >
                          <div className="cart-page__row-reference">
                            <Link
                              className="cart-page__thumb"
                              to={`/collection/${item.productId}`}
                            >
                              <img
                                alt={item.productName}
                                className="cart-page__thumb-image"
                                src={item.productImage}
                              />
                            </Link>

                            <div className="cart-page__row-copy">
                              <p className="cart-page__row-type">
                                {item.productType}
                              </p>
                              <Link
                                className="cart-page__row-name"
                                to={`/collection/${item.productId}`}
                              >
                                {item.productName}
                              </Link>
                              <p className="cart-page__row-variant">
                                {renderVariantLabel(item)}
                              </p>
                            </div>
                          </div>

                          <div className="cart-page__row-unit">
                            <span className="cart-page__mobile-label">
                              Unit
                            </span>
                            <strong>{formatCurrency(item.pricePerUnit)}</strong>
                          </div>

                          <div className="cart-page__row-quantity">
                            <span className="cart-page__mobile-label">
                              Quantity
                            </span>
                            <div className="cart-page__stepper">
                              <button
                                aria-label={`Decrease quantity for ${item.productName}`}
                                className="cart-page__stepper-button"
                                disabled={isPending || checkoutPending}
                                onClick={() => {
                                  void changeQuantity(item, item.quantity - 1);
                                }}
                                type="button"
                              >
                                <Minus className="cart-page__stepper-icon" />
                              </button>
                              <span className="cart-page__quantity">
                                {item.quantity}
                              </span>
                              <button
                                aria-label={`Increase quantity for ${item.productName}`}
                                className="cart-page__stepper-button"
                                disabled={isPending || checkoutPending}
                                onClick={() => {
                                  void changeQuantity(item, item.quantity + 1);
                                }}
                                type="button"
                              >
                                <Plus className="cart-page__stepper-icon" />
                              </button>
                            </div>
                          </div>

                          <div className="cart-page__row-total">
                            <span className="cart-page__mobile-label">
                              Line total
                            </span>
                            <strong>{formatCurrency(item.lineTotal)}</strong>
                          </div>

                          <button
                            className="cart-page__remove"
                            disabled={isPending || checkoutPending}
                            onClick={() => {
                              void handleRemove(item);
                            }}
                            type="button"
                          >
                            {isPending ? (
                              <LoaderCircle className="cart-page__remove-icon cart-page__remove-icon--spinning" />
                            ) : (
                              <Trash2 className="cart-page__remove-icon" />
                            )}
                            <span>Remove</span>
                          </button>
                        </motion.article>
                      );
                    })}
                  </div>
                </section>

                <motion.section
                  className="cart-page__panel cart-page__panel--form"
                  {...revealProps}
                >
                  <div className="cart-page__form-section">
                    <div className="cart-page__panel-head">
                      <div>
                        <p className="cart-page__section-label">01 Shipping</p>
                        <h2 className="cart-page__section-title">
                          Set the delivery line before reserve.
                        </h2>
                      </div>
                      <p className="cart-page__panel-note">
                        Pulled from your profile when available, then editable
                        here before checkout.
                      </p>
                    </div>

                    <label className="cart-page__field">
                      <span>Shipping address</span>
                      <textarea
                        className="cart-page__textarea"
                        onChange={(event) => {
                          setShippingAddress(event.target.value);
                          if (shippingError) {
                            setShippingError(null);
                          }
                        }}
                        placeholder="Street, district, city, postal code, and any delivery details."
                        rows={4}
                        value={shippingAddress}
                      />
                    </label>
                    {shippingError ? (
                      <p className="cart-page__inline-error">{shippingError}</p>
                    ) : null}
                  </div>

                  <div className="cart-page__form-section">
                    <div className="cart-page__panel-head">
                      <div>
                        <p className="cart-page__section-label">02 Payment</p>
                        <h2 className="cart-page__section-title">
                          Choose how the reserve will be settled.
                        </h2>
                      </div>
                      <p className="cart-page__panel-note">
                        Select the method you expect to use once the reserve
                        desk confirms the order.
                      </p>
                    </div>

                    <div
                      className="cart-page__payment-grid"
                      role="radiogroup"
                      aria-label="Payment method"
                    >
                      {PAYMENT_METHODS.map((method) => {
                        const Icon = method.icon;
                        const isActive = paymentMethod === method.value;

                        return (
                          <button
                            key={method.value}
                            aria-checked={isActive}
                            className={`cart-page__payment-option${isActive ? " cart-page__payment-option--active" : ""}`}
                            onClick={() => setPaymentMethod(method.value)}
                            type="button"
                          >
                            <span className="cart-page__payment-icon-wrap">
                              <Icon className="cart-page__payment-icon" />
                            </span>
                            <span className="cart-page__payment-copy">
                              <strong>
                                {paymentMethodLabel(method.value)}
                              </strong>
                              <span>{method.description}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </motion.section>
              </motion.div>

              <motion.aside className="cart-page__summary" {...revealProps}>
                <div className="cart-page__summary-head">
                  <p className="cart-page__section-label">Reserve summary</p>
                  <h2 className="cart-page__summary-title">
                    A final read before the desk creates your order.
                  </h2>
                </div>

                <div className="cart-page__summary-metrics">
                  <div className="cart-page__summary-row">
                    <span>Pieces in cart</span>
                    <strong>{itemCount}</strong>
                  </div>
                  <div className="cart-page__summary-row">
                    <span>Payment method</span>
                    <strong>{paymentMethodLabel(paymentMethod)}</strong>
                  </div>
                  <div className="cart-page__summary-row">
                    <span>Reserve subtotal</span>
                    <strong>{formatCurrency(subtotal)}</strong>
                  </div>
                </div>

                <div className="cart-page__summary-divider" />

                <div className="cart-page__summary-items">
                  {summaryItems.map((item) => (
                    <div key={item.id} className="cart-page__summary-item">
                      <img
                        alt={item.productName}
                        className="cart-page__summary-thumb"
                        src={item.productImage}
                      />
                      <div>
                        <p className="cart-page__summary-item-name">
                          {item.productName}
                        </p>
                        <p className="cart-page__summary-item-meta">
                          {renderVariantLabel(item)} · Qty {item.quantity}
                        </p>
                      </div>
                      <strong>{formatCurrency(item.lineTotal)}</strong>
                    </div>
                  ))}
                </div>

                <p className="cart-page__summary-copy">
                  Shipping is confirmed after the reserve is placed. The final
                  courier assignment appears on your orders desk right away.
                </p>

                {checkoutError ? (
                  <p className="cart-page__inline-error cart-page__inline-error--summary">
                    {checkoutError}
                  </p>
                ) : null}

                <div className="cart-page__summary-actions">
                  <button
                    className="cart-page__button cart-page__button--primary"
                    disabled={!readyToSubmit || authBusy}
                    onClick={() => {
                      void handleCheckout();
                    }}
                    type="button"
                  >
                    {checkoutPending ? (
                      <>
                        <LoaderCircle className="cart-page__button-icon cart-page__button-icon--spinning" />
                        Creating reserve
                      </>
                    ) : (
                      "Proceed to checkout"
                    )}
                  </button>

                  <Link className="cart-page__button" to="/collection">
                    Continue shopping
                  </Link>
                </div>
              </motion.aside>
            </div>

            <div className="cart-page__mobile-bar">
              <div>
                <span className="cart-page__mobile-bar-label">
                  Reserve total
                </span>
                <strong>{formatCurrency(subtotal)}</strong>
              </div>
              <button
                className="cart-page__button cart-page__button--primary"
                disabled={!readyToSubmit || authBusy}
                onClick={() => {
                  void handleCheckout();
                }}
                type="button"
              >
                {checkoutPending ? "Processing..." : "Checkout"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
