import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
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
import { storefrontApi } from "../services/api";
import { formatProductSize } from "../shared";
import { useStorefront } from "../storefront/storefront-context";
import type {
  CartItemRecord,
  CheckoutDetailsInput,
  PaymentMethod,
  PrepareCheckoutPaymentResponse,
} from "../shared";
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
      return "Card";
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

function isStripeBackedMethod(
  method: PaymentMethod,
): method is Extract<PaymentMethod, "card" | "wallet"> {
  return method === "card" || method === "wallet";
}

const PAYMENT_METHODS: Array<{
  description: string;
  icon: typeof CreditCard;
  value: PaymentMethod;
}> = [
  {
    value: "card",
    icon: CreditCard,
    description:
      "Settle directly inside the checkout desk with a confirmed card payment.",
  },
  {
    value: "bank_transfer",
    icon: Landmark,
    description:
      "Place the reserve first, then complete payment through a quieter transfer desk.",
  },
  {
    value: "cash_on_delivery",
    icon: ShieldCheck,
    description:
      "Use cash on delivery for eligible routes and reserve summaries.",
  },
  {
    value: "wallet",
    icon: Wallet,
    description:
      "Use Apple Pay, Link, or other wallet methods surfaced by Stripe on this device.",
  },
];

const CHECKOUT_STEPS = [
  { key: "details", label: "Details" },
  { key: "payment", label: "Payment" },
  { key: "review", label: "Review" },
  { key: "done", label: "Done" },
] as const;

type CheckoutStep = (typeof CHECKOUT_STEPS)[number]["key"];
type CheckoutMode = "cart" | "checkout";

type CheckoutFieldErrors = Partial<
  Record<
    keyof Pick<
      CheckoutDetailsInput,
      "deliveryNotes" | "email" | "fullName" | "phoneNumber" | "shippingAddress"
    >,
    string
  >
>;

interface CheckoutPaymentController {
  confirmPayment: () => Promise<string>;
  submitForReview: () => Promise<void>;
}

interface PreparedStripePayment extends PrepareCheckoutPaymentResponse {
  paymentMethod: Extract<PaymentMethod, "card" | "wallet">;
}

const STRIPE_PUBLISHABLE_KEY =
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY?.trim() ?? "";
const stripePromise = STRIPE_PUBLISHABLE_KEY
  ? loadStripe(STRIPE_PUBLISHABLE_KEY)
  : null;

const stripeAppearance = {
  labels: "floating" as const,
  theme: "night" as const,
  variables: {
    colorBackground: "#0f1118",
    colorDanger: "#f0b0b0",
    colorPrimary: "#d9b58b",
    colorText: "#f4ece4",
    colorTextPlaceholder: "rgba(244, 236, 228, 0.42)",
    fontFamily: "var(--font-body)",
  },
};

function renderVariantLabel(item: CartItemRecord): string {
  return [item.variantColor, formatProductSize(item.variantSize)]
    .filter(Boolean)
    .join(" / ");
}

function createCheckoutDetails(
  user: {
    address?: string;
    email?: string;
    fullName?: string;
    phoneNumber?: string;
  } | null,
): CheckoutDetailsInput {
  return {
    deliveryNotes: "",
    email: user?.email ?? "",
    fullName: user?.fullName ?? "",
    phoneNumber: user?.phoneNumber ?? "",
    saveToAccount: false,
    shippingAddress: user?.address ?? "",
  };
}

function validateCheckoutDetails(
  details: CheckoutDetailsInput,
): CheckoutFieldErrors {
  const errors: CheckoutFieldErrors = {};

  if (details.fullName.trim().length < 2) {
    errors.fullName = "Enter the recipient's full name.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (details.phoneNumber.trim().length < 6) {
    errors.phoneNumber = "Enter a phone number the courier can reach.";
  }

  if (details.shippingAddress.trim().length < 10) {
    errors.shippingAddress =
      "Enter a fuller shipping address for delivery routing.";
  }

  if (details.deliveryNotes && details.deliveryNotes.trim().length > 240) {
    errors.deliveryNotes = "Delivery notes should stay under 240 characters.";
  }

  return errors;
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

function CheckoutProgress({ currentStep }: { currentStep: CheckoutStep }) {
  const activeIndex = CHECKOUT_STEPS.findIndex(
    (step) => step.key === currentStep,
  );

  return (
    <div className="cart-page__progress" aria-label="Checkout progress">
      {CHECKOUT_STEPS.map((step, index) => {
        const state =
          index < activeIndex
            ? "complete"
            : index === activeIndex
              ? "active"
              : "idle";

        return (
          <div
            key={step.key}
            className={`cart-page__progress-step cart-page__progress-step--${state}`}
          >
            <div className="cart-page__progress-badge">{index + 1}</div>
            <div className="cart-page__progress-copy">
              <span>{step.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmbeddedPaymentTray({
  clientSecret,
  onControllerChange,
  paymentMethod,
}: {
  clientSecret: string;
  onControllerChange: (controller: CheckoutPaymentController | null) => void;
  paymentMethod: Extract<PaymentMethod, "card" | "wallet">;
}) {
  const stripe = useStripe();
  const elements = useElements();

  useEffect(() => {
    if (!stripe || !elements) {
      onControllerChange(null);
      return;
    }

    const controller: CheckoutPaymentController = {
      async submitForReview() {
        const result = await elements.submit();

        if (result.error) {
          throw new Error(
            result.error.message ||
              "Stripe needs a little more payment information before you continue.",
          );
        }
      },
      async confirmPayment() {
        const result = await stripe.confirmPayment({
          clientSecret,
          elements,
          redirect: "if_required",
        });

        if (result.error) {
          throw new Error(
            result.error.message ||
              "Stripe could not confirm this payment right now.",
          );
        }

        if (!result.paymentIntent?.id) {
          throw new Error(
            "Stripe did not return a confirmed payment reference.",
          );
        }

        return result.paymentIntent.id;
      },
    };

    onControllerChange(controller);
  }, [clientSecret, elements, onControllerChange, stripe]);

  return (
    <div className="cart-page__payment-tray-copy">
      <p className="cart-page__payment-tray-label">
        {paymentMethod === "wallet" ? "Wallet checkout" : "Card checkout"}
      </p>
      <p className="cart-page__payment-tray-support">
        Stripe will surface the available secure methods for this device and
        region inside the payment desk below.
      </p>
      <PaymentElement
        options={{
          business: { name: "Sovereign" },
          layout: "tabs",
          wallets: { applePay: "auto", googlePay: "auto" },
        }}
      />
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
    refreshSession,
    removeCartItem,
    updateCartQuantity,
    user,
  } = useStorefront();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const redirectTimerRef = useRef<number | null>(null);
  const paymentControllerRef = useRef<CheckoutPaymentController | null>(null);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [checkoutMode, setCheckoutMode] = useState<CheckoutMode>("cart");
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>("details");
  const [checkoutDetails, setCheckoutDetails] = useState<CheckoutDetailsInput>(
    createCheckoutDetails(user),
  );
  const [detailErrors, setDetailErrors] = useState<CheckoutFieldErrors>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [preparedStripePayment, setPreparedStripePayment] =
    useState<PreparedStripePayment | null>(null);
  const [paymentPreparePending, setPaymentPreparePending] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentController, setPaymentController] =
    useState<CheckoutPaymentController | null>(null);
  const [doneOrder, setDoneOrder] = useState<{
    id: string;
    orderNumber: string;
  } | null>(null);
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  const setActivePaymentController = useCallback((
    controller: CheckoutPaymentController | null,
  ): void => {
    paymentControllerRef.current = controller;
    setPaymentController(controller);
  }, []);

  useEffect(() => {
    if (checkoutMode === "cart") {
      setCheckoutDetails(createCheckoutDetails(user));
      setDetailErrors({});
    }
  }, [checkoutMode, user]);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (
      checkoutMode !== "checkout" ||
      !isStripeBackedMethod(paymentMethod)
    ) {
      setActivePaymentController(null);
      return;
    }

    if (checkoutStep !== "payment") {
      return;
    }

    if (!stripePromise) {
      setPaymentError(
        "Stripe publishable key is missing in frontend/.env, so embedded payment cannot open yet.",
      );
      return;
    }

    if (preparedStripePayment?.paymentMethod === paymentMethod) {
      return;
    }

    let active = true;
    setPaymentPreparePending(true);
    setPaymentError(null);

    storefrontApi
      .prepareCheckoutPayment({ paymentMethod })
      .then((result) => {
        if (!active) {
          return;
        }

        setPreparedStripePayment({
          ...result,
          paymentMethod,
        });
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        setPreparedStripePayment(null);
        setPaymentError(
          error instanceof Error
            ? error.message
            : "Stripe checkout could not be prepared right now.",
        );
      })
      .finally(() => {
        if (!active) {
          return;
        }

        setPaymentPreparePending(false);
      });

    return () => {
      active = false;
    };
  }, [
    checkoutMode,
    checkoutStep,
    paymentMethod,
    preparedStripePayment,
    setActivePaymentController,
  ]);

  const items = cart?.items ?? [];
  const itemCount = cart?.itemCount ?? 0;
  const subtotal = cart?.totalAmount ?? 0;
  const revealProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.2 },
        transition: { duration: 0.45 },
      };
  const summaryItems = items.slice(0, 3);
  const isStripeMethod = isStripeBackedMethod(paymentMethod);
  const shouldKeepStripeDeskMounted =
    checkoutStep === "review" && isStripeMethod;
  const canOpenCheckout = items.length > 0 && !checkoutPending;
  const detailCompletion = useMemo(
    () =>
      [
        checkoutDetails.fullName,
        checkoutDetails.email,
        checkoutDetails.phoneNumber,
        checkoutDetails.shippingAddress,
      ].filter((value) => value.trim().length > 0).length,
    [checkoutDetails],
  );
  const summaryLabel =
    checkoutMode === "cart"
      ? "Reserve summary"
      : checkoutStep === "done"
        ? "Checkout complete"
        : "Checkout summary";

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

  function enterCheckout(): void {
    if (!canOpenCheckout) {
      return;
    }

    setCheckoutMode("checkout");
    setCheckoutStep("details");
    setCheckoutError(null);
    setPaymentError(null);
    setPreparedStripePayment(null);
    setActivePaymentController(null);
    setDoneOrder(null);
  }

  function returnToCart(): void {
    setCheckoutMode("cart");
    setCheckoutStep("details");
    setCheckoutError(null);
    setPaymentError(null);
    setPreparedStripePayment(null);
    setActivePaymentController(null);
    setDoneOrder(null);
  }

  function updateCheckoutField<K extends keyof CheckoutDetailsInput>(
    field: K,
    value: CheckoutDetailsInput[K],
  ): void {
    setCheckoutDetails((current) => ({
      ...current,
      [field]: value,
    }));

    if (field !== "saveToAccount") {
      setDetailErrors((current) => ({
        ...current,
        [field]: undefined,
      }));
    }
  }

  function moveToPayment(): void {
    const nextErrors = validateCheckoutDetails(checkoutDetails);

    setDetailErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setCheckoutError("Complete the shipping details before continuing.");
      return;
    }

    setCheckoutError(null);
    setCheckoutStep("payment");
  }

  async function moveToReview(): Promise<void> {
    setCheckoutError(null);
    setPaymentError(null);

    if (!isStripeMethod) {
      setCheckoutStep("review");
      return;
    }

    if (!stripePromise) {
      setPaymentError(
        "Stripe publishable key is missing in frontend/.env, so embedded payment cannot open yet.",
      );
      return;
    }

    if (!preparedStripePayment) {
      setPaymentError("Stripe is still preparing the secure payment desk.");
      return;
    }

    const activePaymentController =
      paymentController ?? paymentControllerRef.current;

    if (!activePaymentController) {
      setPaymentError(
        "Payment details are still loading. Wait a moment and try again.",
      );
      return;
    }

    try {
      await activePaymentController.submitForReview();
      setCheckoutStep("review");
    } catch (error) {
      setPaymentError(
        error instanceof Error
          ? error.message
          : "Payment details need another look before you continue.",
      );
    }
  }

  async function finalizeReserve(): Promise<void> {
    setCheckoutPending(true);
    setCheckoutError(null);
    setPaymentError(null);

    try {
      let paymentIntentId: string | undefined;

      if (isStripeMethod) {
        const activePaymentController =
          paymentController ?? paymentControllerRef.current;

        if (!activePaymentController || !preparedStripePayment) {
          throw new Error("Stripe payment details are not ready yet.");
        }

        paymentIntentId = await activePaymentController.confirmPayment();
      }

      const result = await checkoutCart({
        details: checkoutDetails,
        paymentIntentId,
        paymentMethod,
      });

      if (checkoutDetails.saveToAccount) {
        await refreshSession();
      }

      setDoneOrder({
        id: result.order.id,
        orderNumber: result.order.orderNumber,
      });
      setActivePaymentController(null);
      setCheckoutStep("done");
      notify({
        title: "Reserve placed",
        description: `Order ${result.order.orderNumber} is now live in your member orders desk.`,
        tone: "success",
      });

      redirectTimerRef.current = window.setTimeout(() => {
        navigate("/orders", {
          state: {
            cartCheckoutMessage: `Reserve ${result.order.orderNumber} was created from your checkout.`,
            highlightedOrderId: result.order.id,
          },
        });
      }, 1500);
    } catch (error) {
      const nextMessage =
        error instanceof Error
          ? error.message
          : "Unable to complete your reserve right now.";

      if (isStripeMethod) {
        setCheckoutStep("payment");
        setPaymentError(nextMessage);
      } else {
        setCheckoutError(nextMessage);
      }
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
            <h1 className="cart-page__title">
              {checkoutMode === "cart"
                ? "Your reserve cart"
                : "Checkout your reserve"}
            </h1>
            <p className="cart-page__copy">
              {checkoutMode === "cart"
                ? "Review saved pieces before moving into a guided checkout flow."
                : "Move through details, payment, review, and confirmation from one quieter editorial checkout surface."}
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
              <p className="cart-page__state-copy">
                Your reserve cart is empty
              </p>
            </div>
            <p className="cart-page__state-support">
              Nothing is staged right now. Open the marketplace or pull a saved
              reference from favorites to start a calmer checkout flow.
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
        ) : checkoutMode === "cart" ? (
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
                                disabled={isPending}
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
                                disabled={isPending}
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
                            disabled={isPending}
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
              </motion.div>

              <motion.aside className="cart-page__summary" {...revealProps}>
                <div className="cart-page__summary-head">
                  <p className="cart-page__section-label">Reserve summary</p>
                  <h2 className="cart-page__summary-title">
                    One last pass before the guided checkout opens.
                  </h2>
                </div>

                <div className="cart-page__summary-metrics">
                  <div className="cart-page__summary-row">
                    <span>Pieces in cart</span>
                    <strong>{itemCount}</strong>
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
                  Proceed to checkout when you satisfied.
                </p>

                <div className="cart-page__summary-actions">
                  <button
                    className="cart-page__button cart-page__button--primary"
                    disabled={!canOpenCheckout || authBusy}
                    onClick={enterCheckout}
                    type="button"
                  >
                    Proceed to checkout
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
                disabled={!canOpenCheckout || authBusy}
                onClick={enterCheckout}
                type="button"
              >
                Checkout
              </button>
            </div>
          </>
        ) : (
          <div className="cart-page__workspace cart-page__workspace--checkout">
            <motion.div className="cart-page__desk" {...revealProps}>
              <section className="cart-page__panel cart-page__panel--checkout">
                <div className="cart-page__checkout-head">
                  <button
                    className="cart-page__back-to-cart"
                    onClick={returnToCart}
                    type="button"
                  >
                    <ChevronLeft className="cart-page__back-icon" />
                    Back to cart
                  </button>
                  <CheckoutProgress currentStep={checkoutStep} />
                </div>

                <AnimatePresence initial={false}>
                  {checkoutStep === "details" ? (
                    <motion.div
                      key="details"
                      animate={{ opacity: 1, y: 0 }}
                      className="cart-page__checkout-step"
                      exit={{ opacity: 0, y: -14 }}
                      initial={{ opacity: 0, y: 14 }}
                      transition={{ duration: 0.28 }}
                    >
                      <div className="cart-page__panel-head">
                        <div>
                          <p className="cart-page__section-label">01 Details</p>
                          <h2 className="cart-page__section-title">
                            Confirm the delivery contact.
                          </h2>
                        </div>
                        <p className="cart-page__panel-note">
                          Pulled from your account first, then editable for this
                          reserve.
                        </p>
                      </div>

                      <div className="cart-page__checkout-grid">
                        <label className="cart-page__field">
                          <span>Full name</span>
                          <input
                            className="cart-page__input"
                            onChange={(event) =>
                              updateCheckoutField(
                                "fullName",
                                event.target.value,
                              )
                            }
                            value={checkoutDetails.fullName}
                          />
                          {detailErrors.fullName ? (
                            <p className="cart-page__inline-error">
                              {detailErrors.fullName}
                            </p>
                          ) : null}
                        </label>

                        <label className="cart-page__field">
                          <span>Email</span>
                          <input
                            className="cart-page__input"
                            onChange={(event) =>
                              updateCheckoutField("email", event.target.value)
                            }
                            value={checkoutDetails.email}
                          />
                          {detailErrors.email ? (
                            <p className="cart-page__inline-error">
                              {detailErrors.email}
                            </p>
                          ) : null}
                        </label>

                        <label className="cart-page__field">
                          <span>Phone number</span>
                          <input
                            className="cart-page__input"
                            onChange={(event) =>
                              updateCheckoutField(
                                "phoneNumber",
                                event.target.value,
                              )
                            }
                            value={checkoutDetails.phoneNumber}
                          />
                          {detailErrors.phoneNumber ? (
                            <p className="cart-page__inline-error">
                              {detailErrors.phoneNumber}
                            </p>
                          ) : null}
                        </label>

                        <div className="cart-page__field cart-page__field--compact">
                          <span>Profile sync</span>
                          <label className="cart-page__toggle">
                            <input
                              checked={Boolean(checkoutDetails.saveToAccount)}
                              onChange={(event) =>
                                updateCheckoutField(
                                  "saveToAccount",
                                  event.target.checked,
                                )
                              }
                              type="checkbox"
                            />
                            <span className="cart-page__toggle-track" />
                            <span className="cart-page__toggle-copy">
                              Save these details back to Account after checkout
                            </span>
                          </label>
                        </div>

                        <label className="cart-page__field cart-page__field--wide">
                          <span>Shipping address</span>
                          <textarea
                            className="cart-page__textarea"
                            onChange={(event) =>
                              updateCheckoutField(
                                "shippingAddress",
                                event.target.value,
                              )
                            }
                            placeholder="Street, district, city, postal code, and any delivery details."
                            rows={4}
                            value={checkoutDetails.shippingAddress}
                          />
                          {detailErrors.shippingAddress ? (
                            <p className="cart-page__inline-error">
                              {detailErrors.shippingAddress}
                            </p>
                          ) : null}
                        </label>

                        <label className="cart-page__field cart-page__field--wide">
                          <span>Delivery notes</span>
                          <textarea
                            className="cart-page__textarea"
                            onChange={(event) =>
                              updateCheckoutField(
                                "deliveryNotes",
                                event.target.value,
                              )
                            }
                            placeholder="Gate code, landmark, preferred arrival window, or collector notes."
                            rows={3}
                            value={checkoutDetails.deliveryNotes ?? ""}
                          />
                          {detailErrors.deliveryNotes ? (
                            <p className="cart-page__inline-error">
                              {detailErrors.deliveryNotes}
                            </p>
                          ) : null}
                        </label>
                      </div>

                      {checkoutError ? (
                        <p className="cart-page__inline-error cart-page__inline-error--summary">
                          {checkoutError}
                        </p>
                      ) : null}

                      <div className="cart-page__checkout-actions">
                        <button
                          className="cart-page__button"
                          onClick={returnToCart}
                          type="button"
                        >
                          Edit cart
                        </button>
                        <button
                          className="cart-page__button cart-page__button--primary"
                          onClick={moveToPayment}
                          type="button"
                        >
                          Continue to payment
                        </button>
                      </div>
                    </motion.div>
                  ) : null}

                  {checkoutStep === "payment" || shouldKeepStripeDeskMounted ? (
                    <motion.div
                      key="payment"
                      animate={
                        shouldKeepStripeDeskMounted
                          ? { opacity: 0, y: 0 }
                          : { opacity: 1, y: 0 }
                      }
                      aria-hidden={shouldKeepStripeDeskMounted}
                      className={`cart-page__checkout-step${
                        shouldKeepStripeDeskMounted
                          ? " cart-page__checkout-step--stripe-keepalive"
                          : ""
                      }`}
                      exit={{ opacity: 0, y: -14 }}
                      initial={{ opacity: 0, y: 14 }}
                      transition={{ duration: 0.28 }}
                    >
                      <div className="cart-page__panel-head">
                        <div>
                          <p className="cart-page__section-label">02 Payment</p>
                          <h2 className="cart-page__section-title">
                            Choose how this reserve will be settled.
                          </h2>
                        </div>
                        <p className="cart-page__panel-note">
                          Card and wallet methods open a secure Stripe tray
                          inside the page.
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
                              onClick={() => {
                                setPaymentMethod(method.value);
                                setPaymentError(null);
                                if (!isStripeBackedMethod(method.value)) {
                                  setPreparedStripePayment(null);
                                  setActivePaymentController(null);
                                } else {
                                  setPreparedStripePayment(null);
                                  setActivePaymentController(null);
                                }
                              }}
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

                      <AnimatePresence initial={false}>
                        {isStripeMethod ? (
                          <motion.div
                            key={paymentMethod}
                            animate={{ height: "auto", opacity: 1, y: 0 }}
                            className="cart-page__payment-tray"
                            exit={{ height: 0, opacity: 0, y: -12 }}
                            initial={{ height: 0, opacity: 0, y: -12 }}
                            transition={{
                              duration: 0.3,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                          >
                            {paymentPreparePending ? (
                              <div className="cart-page__payment-tray-loading">
                                <LoaderCircle className="cart-page__button-icon cart-page__button-icon--spinning" />
                                Preparing Stripe checkout desk...
                              </div>
                            ) : preparedStripePayment && stripePromise ? (
                              <Elements
                                key={`${paymentMethod}:${preparedStripePayment.paymentIntentId}`}
                                options={{
                                  appearance: stripeAppearance,
                                  clientSecret:
                                    preparedStripePayment.clientSecret,
                                }}
                                stripe={stripePromise}
                              >
                                <EmbeddedPaymentTray
                                  clientSecret={
                                    preparedStripePayment.clientSecret
                                  }
                                  onControllerChange={setActivePaymentController}
                                  paymentMethod={paymentMethod}
                                />
                              </Elements>
                            ) : (
                              <div className="cart-page__payment-tray-copy">
                                <p className="cart-page__payment-tray-label">
                                  Secure payment desk
                                </p>
                                <p className="cart-page__payment-tray-support">
                                  Stripe could not be prepared yet. Check your
                                  publishable key and try again.
                                </p>
                              </div>
                            )}
                          </motion.div>
                        ) : null}
                      </AnimatePresence>

                      {paymentError ? (
                        <p className="cart-page__inline-error cart-page__inline-error--summary">
                          {paymentError}
                        </p>
                      ) : null}

                      <div className="cart-page__checkout-actions">
                        <button
                          className="cart-page__button"
                          onClick={() => setCheckoutStep("details")}
                          type="button"
                        >
                          Back to details
                        </button>
                        <button
                          className="cart-page__button cart-page__button--primary"
                          disabled={paymentPreparePending}
                          onClick={() => {
                            void moveToReview();
                          }}
                          type="button"
                        >
                          Continue to review
                        </button>
                      </div>
                    </motion.div>
                  ) : null}

                  {checkoutStep === "review" ? (
                    <motion.div
                      key="review"
                      animate={{ opacity: 1, y: 0 }}
                      className="cart-page__checkout-step"
                      exit={{ opacity: 0, y: -14 }}
                      initial={{ opacity: 0, y: 14 }}
                      transition={{ duration: 0.28 }}
                    >
                      <div className="cart-page__panel-head">
                        <div>
                          <p className="cart-page__section-label">03 Review</p>
                          <h2 className="cart-page__section-title">
                            Confirm the reserve before it goes live.
                          </h2>
                        </div>
                        <p className="cart-page__panel-note">
                          This is the final read for delivery details, payment
                          method, and the pieces you are staging.
                        </p>
                      </div>

                      <div className="cart-page__review-grid">
                        <div className="cart-page__review-block">
                          <span>Recipient</span>
                          <strong>{checkoutDetails.fullName}</strong>
                          <p>{checkoutDetails.email}</p>
                          <p>{checkoutDetails.phoneNumber}</p>
                        </div>

                        <div className="cart-page__review-block">
                          <span>Payment</span>
                          <strong>{paymentMethodLabel(paymentMethod)}</strong>
                          <p>
                            {isStripeMethod
                              ? "Stripe-backed payment will be confirmed on the final action."
                              : "The order will be created immediately with payment pending."}
                          </p>
                        </div>

                        <div className="cart-page__review-block cart-page__review-block--wide">
                          <span>Shipping address</span>
                          <strong>{checkoutDetails.shippingAddress}</strong>
                          {checkoutDetails.deliveryNotes?.trim() ? (
                            <p>Notes: {checkoutDetails.deliveryNotes.trim()}</p>
                          ) : null}
                        </div>
                      </div>

                      {checkoutError ? (
                        <p className="cart-page__inline-error cart-page__inline-error--summary">
                          {checkoutError}
                        </p>
                      ) : null}

                      <div className="cart-page__checkout-actions">
                        <button
                          className="cart-page__button"
                          onClick={() => setCheckoutStep("payment")}
                          type="button"
                        >
                          Back to payment
                        </button>
                        <button
                          className="cart-page__button cart-page__button--primary"
                          disabled={checkoutPending || authBusy}
                          onClick={() => {
                            void finalizeReserve();
                          }}
                          type="button"
                        >
                          {checkoutPending ? (
                            <>
                              <LoaderCircle className="cart-page__button-icon cart-page__button-icon--spinning" />
                              Finalizing reserve
                            </>
                          ) : (
                            "Place reserve"
                          )}
                        </button>
                      </div>
                    </motion.div>
                  ) : null}

                  {checkoutStep === "done" ? (
                    <motion.div
                      key="done"
                      animate={{ opacity: 1, y: 0 }}
                      className="cart-page__checkout-step cart-page__checkout-step--done"
                      exit={{ opacity: 0, y: -14 }}
                      initial={{ opacity: 0, y: 14 }}
                      transition={{ duration: 0.28 }}
                    >
                      <p className="cart-page__section-label">04 Done</p>
                      <h2 className="cart-page__section-title">
                        Reserve confirmed.
                      </h2>
                      <p className="cart-page__summary-copy">
                        {doneOrder
                          ? `${doneOrder.orderNumber} has been placed. We are sending you to your orders desk now.`
                          : "Your reserve has been placed. Redirecting to the member ledger now."}
                      </p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </section>
            </motion.div>

            <motion.aside
              className="cart-page__summary cart-page__summary--checkout"
              {...revealProps}
            >
              <div className="cart-page__summary-head">
                <p className="cart-page__section-label">{summaryLabel}</p>
                <h2 className="cart-page__summary-title">
                  {checkoutStep === "done"
                    ? "Your order is moving to the member ledger."
                    : "Keep the reserve in view while you move through each step."}
                </h2>
              </div>

              <button
                className="cart-page__summary-toggle"
                onClick={() => setSummaryExpanded((current) => !current)}
                type="button"
              >
                <span>
                  {summaryExpanded
                    ? "Hide order summary"
                    : "Show order summary"}
                </span>
                <ChevronDown
                  className={`cart-page__summary-toggle-icon${
                    summaryExpanded
                      ? " cart-page__summary-toggle-icon--open"
                      : ""
                  }`}
                />
              </button>

              <div
                className={`cart-page__summary-body${
                  summaryExpanded ? " cart-page__summary-body--open" : ""
                }`}
              >
                <div className="cart-page__summary-metrics">
                  <div className="cart-page__summary-row">
                    <span>Current step</span>
                    <strong>
                      {
                        CHECKOUT_STEPS.find((step) => step.key === checkoutStep)
                          ?.label
                      }
                    </strong>
                  </div>
                  <div className="cart-page__summary-row">
                    <span>Details ready</span>
                    <strong>{detailCompletion}/4</strong>
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
              </div>
            </motion.aside>
          </div>
        )}
      </div>
    </div>
  );
}
