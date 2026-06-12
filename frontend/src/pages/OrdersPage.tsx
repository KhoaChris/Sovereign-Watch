import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { Link, Navigate, useLocation } from "react-router-dom";

import { storefrontApi } from "../services/api";
import { useStorefront } from "../storefront/storefront-context";
import {
  formatProductSize,
  type OrderRecord,
  type PaymentMethod,
  type ProductRecord,
  type ProductVariant,
} from "../shared";
import "../styles/pages/orders-page.css";

interface OrdersLocationState {
  cartCheckoutMessage?: string;
  highlightedOrderId?: string;
}

interface VariantLookupEntry {
  productImage: string;
  productName: string;
  productType: string;
  sku: string;
  variant: ProductVariant;
}

type MemberOrderStageTone = "active" | "complete" | "issue" | "waiting";

interface MemberOrderStage {
  detail: string;
  label: string;
  tone: MemberOrderStageTone;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatStatusLabel(value: string | undefined): string {
  if (!value) {
    return "Pending";
  }

  return value
    .split(/[_\s-]+/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function paymentMethodLabel(method: PaymentMethod | undefined): string {
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
      return "Awaiting selection";
  }
}

function normalizeMemberMeta(
  value: string | null | undefined,
  fallback: string,
): string {
  if (!value) {
    return fallback;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return fallback;
  }

  const normalizedValue = trimmedValue.toLowerCase();

  if (
    normalizedValue === "pending" ||
    normalizedValue === "pending assignment"
  ) {
    return fallback;
  }

  return trimmedValue;
}

function splitShippingAddress(value: string): {
  detail: string;
  recipient: string;
} {
  const [recipient, ...detailParts] = value
    .split("·")
    .map((segment) => segment.trim())
    .filter(Boolean);

  return {
    detail: detailParts.join(" · ") || "Delivery details pending",
    recipient: recipient || "Reserve client",
  };
}

function buildVariantLookup(
  products: ProductRecord[],
): Map<string, VariantLookupEntry> {
  const lookup = new Map<string, VariantLookupEntry>();

  products.forEach((product) => {
    product.variants.forEach((variant) => {
      lookup.set(variant.id, {
        productImage: product.images[0] ?? "",
        productName: product.name,
        productType: product.type,
        sku: variant.sku,
        variant,
      });
    });
  });

  return lookup;
}

function buildMemberOrderStages(order: OrderRecord): MemberOrderStage[] {
  const paymentStatus = order.payment?.status;
  const shippingStatus = order.shipping?.status;

  const reserveStage: MemberOrderStage =
    order.status === "cancelled"
      ? {
          detail: "Cancelled",
          label: "Reserve",
          tone: "issue",
        }
      : order.status === "pending"
        ? {
            detail: "Awaiting review",
            label: "Reserve",
            tone: "active",
          }
        : {
            detail: "Reserve placed",
            label: "Reserve",
            tone: "complete",
          };

  const paymentStage: MemberOrderStage =
    paymentStatus === "failed" || paymentStatus === "refunded"
      ? {
          detail: formatStatusLabel(paymentStatus),
          label: "Payment",
          tone: "issue",
        }
      : paymentStatus === "paid" || order.status === "delivered"
        ? {
            detail: "Paid",
            label: "Payment",
            tone: "complete",
          }
        : paymentStatus === "authorized" || paymentStatus === "pending"
          ? {
              detail: formatStatusLabel(paymentStatus),
              label: "Payment",
              tone: "active",
            }
          : ["confirmed", "paid", "processing", "shipped"].includes(
                order.status,
              )
            ? {
                detail: "Queued",
                label: "Payment",
                tone: "active",
              }
            : {
                detail: "Awaiting capture",
                label: "Payment",
                tone: "waiting",
              };

  const deliveryStage: MemberOrderStage =
    order.status === "cancelled" || shippingStatus === "returned"
      ? {
          detail:
            shippingStatus === "returned" ? "Returned" : "Delivery halted",
          label: "Delivery",
          tone: "issue",
        }
      : shippingStatus === "delivered" || order.status === "delivered"
        ? {
            detail: "Delivered",
            label: "Delivery",
            tone: "complete",
          }
        : shippingStatus === "in_transit" || order.status === "shipped"
          ? {
              detail: "In transit",
              label: "Delivery",
              tone: "active",
            }
          : shippingStatus === "packed" || order.status === "processing"
            ? {
                detail: "Preparing route",
                label: "Delivery",
                tone: "active",
              }
            : {
                detail: "Queued",
                label: "Delivery",
                tone: "waiting",
              };

  return [reserveStage, paymentStage, deliveryStage];
}

function getRevealProps(prefersReducedMotion: boolean, delay = 0) {
  if (prefersReducedMotion) {
    return {};
  }

  return {
    initial: { opacity: 0, y: 20 },
    transition: {
      delay,
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1] as const,
    },
    viewport: { once: true, amount: 0.2 },
    whileInView: { opacity: 1, y: 0 },
  };
}

function MemberOrdersHero({
  copy,
  prefersReducedMotion,
  signals,
  title,
}: {
  copy: string;
  prefersReducedMotion: boolean;
  signals: Array<{ label: string; value: string }>;
  title: string;
}) {
  return (
    <motion.section
      className="member-orders__hero"
      {...getRevealProps(prefersReducedMotion)}
    >
      <Link className="member-orders__back-link" to="/collection">
        <ArrowLeft className="member-orders__back-icon" />
        Back to marketplace
      </Link>

      <div className="member-orders__hero-copy">
        <p className="orders-page__eyebrow">Reserve desk</p>
        <h1 className="orders-page__title">{title}</h1>
        <p className="orders-page__copy">{copy}</p>
      </div>

      <div className="member-orders__hero-signal">
        {signals.map((signal) => (
          <div key={signal.label} className="member-orders__signal-item">
            <span>{signal.label}</span>
            <strong>{signal.value}</strong>
          </div>
        ))}
      </div>
    </motion.section>
  );
}

function MemberOrdersStatePanel({
  actions,
  copy,
  prefersReducedMotion,
  title,
}: {
  actions?: ReactNode;
  copy: string;
  prefersReducedMotion: boolean;
  title: string;
}) {
  return (
    <motion.section
      className="member-orders__state"
      {...getRevealProps(prefersReducedMotion, 0.06)}
    >
      <div className="member-orders__state-head">
        <p className="member-orders__state-copy">{title}</p>
      </div>
      <p className="member-orders__state-support">{copy}</p>
      {actions ? <div className="member-orders__actions">{actions}</div> : null}
    </motion.section>
  );
}

function MemberOrdersSkeleton({
  prefersReducedMotion,
}: {
  prefersReducedMotion: boolean;
}) {
  return (
    <div className="member-orders__list member-orders__list--loading">
      {[0, 1].map((index) => (
        <motion.article
          key={index}
          className="member-orders__skeleton-card"
          {...getRevealProps(prefersReducedMotion, index * 0.05)}
        >
          <div className="member-orders__skeleton-line member-orders__skeleton-line--eyebrow" />
          <div className="member-orders__skeleton-line member-orders__skeleton-line--title" />
          <div className="member-orders__skeleton-line member-orders__skeleton-line--meta" />
          <div className="member-orders__skeleton-rail">
            <div className="member-orders__skeleton-pill" />
            <div className="member-orders__skeleton-pill" />
            <div className="member-orders__skeleton-pill" />
          </div>
          <div className="member-orders__skeleton-grid">
            <div className="member-orders__skeleton-block" />
            <div className="member-orders__skeleton-block" />
            <div className="member-orders__skeleton-block" />
            <div className="member-orders__skeleton-block" />
          </div>
        </motion.article>
      ))}
    </div>
  );
}

function MemberOrderCard({
  highlighted = false,
  order,
  prefersReducedMotion,
  variantLookup,
}: {
  highlighted?: boolean;
  order: OrderRecord;
  prefersReducedMotion: boolean;
  variantLookup: Map<string, VariantLookupEntry>;
}) {
  const [itemsOpen, setItemsOpen] = useState(false);
  const stages = buildMemberOrderStages(order);
  const paymentStatusLabel =
    order.payment?.status !== undefined
      ? formatStatusLabel(order.payment.status)
      : "Awaiting capture";
  const shippingStatusLabel =
    order.shipping?.status !== undefined
      ? formatStatusLabel(order.shipping.status)
      : "Queued";
  const courierLabel = normalizeMemberMeta(
    order.shipping?.courierName,
    "Awaiting courier",
  );
  const trackingLabel = normalizeMemberMeta(
    order.shipping?.trackingNumber,
    "Pending dispatch",
  );
  const shippingSummary = splitShippingAddress(order.shippingAddress);
  const itemCountLabel = `${order.items.length} piece${
    order.items.length === 1 ? "" : "s"
  }`;
  const itemDetails = order.items.map((item) => {
    const lookup = variantLookup.get(item.productVariantId);
    const variant = lookup?.variant;
    const sizeLabel = variant?.size ? formatProductSize(variant.size) : "";
    const lineTotal = item.quantity * item.pricePerUnit - item.discountAmount;

    return {
      color: variant?.color ?? "",
      discountAmount: item.discountAmount,
      id: item.id,
      image: lookup?.productImage ?? "",
      lineTotal,
      pricePerUnit: item.pricePerUnit,
      productName:
        lookup?.productName ??
        `Variant ${item.productVariantId.slice(0, 6).toUpperCase()}`,
      productType: lookup?.productType ?? "Reserved piece",
      quantity: item.quantity,
      sizeLabel,
      sku: lookup?.sku ?? item.productVariantId.slice(0, 8).toUpperCase(),
    };
  });
  const itemsPanelId = `member-order-items-${order.id}`;

  return (
    <motion.article
      className={`member-orders__card${
        highlighted ? " member-orders__card--highlighted" : ""
      }`}
      {...getRevealProps(prefersReducedMotion)}
    >
      <div className="member-orders__card-head">
        <div className="member-orders__card-copy">
          <div className="member-orders__card-topline">
            <p className="orders-page__eyebrow">Reserve record</p>
            <strong
              className={`member-orders__pill member-orders__pill--${order.status}`}
            >
              {formatStatusLabel(order.status)}
            </strong>
          </div>
          <h2 className="member-orders__card-title">{order.orderNumber}</h2>
          <p className="member-orders__card-date">
            {formatDateTime(order.createdAt)}
          </p>
        </div>
        <div className="member-orders__price-block">
          <span>Total reserved</span>
          <strong>{formatCurrency(order.totalAmount)}</strong>
        </div>
      </div>

      <div className="member-orders__timeline" aria-label="Reserve timeline">
        {stages.map((stage) => (
          <div
            key={stage.label}
            className={`member-orders__timeline-step member-orders__timeline-step--${stage.tone}`}
          >
            <span className="member-orders__timeline-marker" aria-hidden="true">
              <span />
            </span>
            <div>
              <span className="member-orders__timeline-label">
                {stage.label}
              </span>
              <strong>{stage.detail}</strong>
            </div>
          </div>
        ))}
      </div>

      <div className="member-orders__ledger">
        <div className="member-orders__meta-grid">
          <div className="member-orders__meta-item">
            <span>Payment method</span>
            <strong>{paymentMethodLabel(order.payment?.method)}</strong>
          </div>
          <div className="member-orders__meta-item">
            <span>Payment status</span>
            <strong>{paymentStatusLabel}</strong>
          </div>
          <div className="member-orders__meta-item">
            <span>Shipping status</span>
            <strong>{shippingStatusLabel}</strong>
          </div>
          <div className="member-orders__meta-item">
            <span>Items in reserve</span>
            <strong>{itemCountLabel}</strong>
          </div>
          <div className="member-orders__meta-item">
            <span>Courier</span>
            <strong>{courierLabel}</strong>
          </div>
          <div className="member-orders__meta-item">
            <span>Tracking</span>
            <strong>{trackingLabel}</strong>
          </div>
        </div>

        <div className="member-orders__address">
          <span>Delivery address</span>
          <strong>{shippingSummary.recipient}</strong>
          <p>{shippingSummary.detail}</p>
        </div>
      </div>

      <div
        className={`member-orders__items${
          itemsOpen ? " member-orders__items--open" : ""
        }`}
      >
        <button
          aria-controls={itemsPanelId}
          aria-expanded={itemsOpen}
          className="member-orders__items-toggle"
          onClick={() => setItemsOpen((current) => !current)}
          type="button"
        >
          <span className="member-orders__items-toggle-copy">
            <span className="orders-page__eyebrow">Reserved pieces</span>
            <strong>View item details · {itemCountLabel}</strong>
          </span>
          <ChevronDown
            aria-hidden="true"
            className="member-orders__items-toggle-icon"
          />
        </button>

        {itemsOpen ? (
          <ul
            className="member-orders__items-list"
            id={itemsPanelId}
            role="list"
          >
            {itemDetails.map((entry) => {
              const variantLine = [entry.sizeLabel, entry.color]
                .filter(Boolean)
                .join(" · ");

              return (
                <li className="member-orders__item" key={entry.id}>
                  <div className="member-orders__item-media" aria-hidden="true">
                    {entry.image ? (
                      <img alt="" loading="lazy" src={entry.image} />
                    ) : (
                      <span className="member-orders__item-media-fallback">
                        {entry.productName.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="member-orders__item-body">
                    <p className="member-orders__item-type">
                      {entry.productType}
                    </p>
                    <strong className="member-orders__item-name">
                      {entry.productName}
                    </strong>
                    <p className="member-orders__item-meta">
                      <span>SKU {entry.sku}</span>
                      {variantLine ? <span>{variantLine}</span> : null}
                      <span>Qty {entry.quantity}</span>
                    </p>
                  </div>
                  <div className="member-orders__item-price">
                    <span>Unit · {formatCurrency(entry.pricePerUnit)}</span>
                    {entry.discountAmount > 0 ? (
                      <span className="member-orders__item-discount">
                        Discount -{formatCurrency(entry.discountAmount)}
                      </span>
                    ) : null}
                    <strong>{formatCurrency(entry.lineTotal)}</strong>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </motion.article>
  );
}

export function OrdersPage({
  fallbackOrders = [],
}: {
  fallbackOrders?: OrderRecord[];
}) {
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const { authLoading, isAdmin, isAuthenticated, openAuthModal, user } =
    useStorefront();
  const [orders, setOrders] = useState<OrderRecord[]>(fallbackOrders);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [resolvedRequestKey, setResolvedRequestKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  const checkoutNotice =
    (location.state as OrdersLocationState | null)?.cartCheckoutMessage ?? null;
  const trackedOrderId =
    new URLSearchParams(location.search).get("orderId")?.trim() ?? null;
  const highlightedOrderId =
    (location.state as OrdersLocationState | null)?.highlightedOrderId ??
    trackedOrderId;
  const ordersRequestKey =
    isAuthenticated && !isAdmin ? (user?.id ?? "member") : "";
  const loading = Boolean(ordersRequestKey) && resolvedRequestKey !== ordersRequestKey;
  const activeError = resolvedRequestKey === ordersRequestKey ? error : null;

  useEffect(() => {
    let active = true;

    if (!ordersRequestKey) {
      return () => {
        active = false;
      };
    }

    Promise.all([storefrontApi.getOrders(), storefrontApi.getProducts()])
      .then(([nextOrders, nextProducts]) => {
        if (!active) {
          return;
        }

        setOrders(nextOrders);
        setProducts(nextProducts);
        setError(null);
        setResolvedRequestKey(ordersRequestKey);
      })
      .catch((err: unknown) => {
        if (!active) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load your orders right now.",
        );
        setResolvedRequestKey(ordersRequestKey);
      });

    return () => {
      active = false;
    };
  }, [ordersRequestKey]);

  const sortedOrders = useMemo(() => {
    return [...orders].sort((left, right) => {
      return (
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      );
    });
  }, [orders]);
  const latestOrder = sortedOrders[0];
  const capturedRevenue = useMemo(
    () =>
      orders.reduce((sum, order) => {
        return order.payment?.status === "paid" ? sum + order.totalAmount : sum;
      }, 0),
    [orders],
  );
  const variantLookup = useMemo(() => buildVariantLookup(products), [products]);
  const memberHeroSignals = [
    {
      label: "Orders tracked",
      value: loading ? "..." : String(orders.length),
    },
    {
      label: "Latest reserve",
      value: latestOrder?.orderNumber ?? "No reserve yet",
    },
    {
      label: "Captured paid",
      value: formatCurrency(capturedRevenue),
    },
  ];

  if (authLoading && !user) {
    return (
      <div className="orders-page">
        <div className="orders-page__ambient" />
        <div className="orders-page__shell">
          <MemberOrdersStatePanel
            copy="Restoring your reserve ledger and syncing the latest order activity."
            prefersReducedMotion={prefersReducedMotion}
            title="Loading your order desk"
          />
        </div>
      </div>
    );
  }

  if (isAuthenticated && isAdmin) {
    return <Navigate replace to="/operations" />;
  }

  if (!isAuthenticated) {
    return (
      <div className="orders-page">
        <div className="orders-page__ambient" />
        <div className="orders-page__shell">
          <MemberOrdersHero
            copy="Sign in once to keep reserve confirmations, payment follow-up, and delivery updates attached to your member profile."
            prefersReducedMotion={prefersReducedMotion}
            signals={[
              { label: "Access", value: "Guest" },
              { label: "Unlocks", value: "Orders + tracking" },
            ]}
            title="A quieter desk for every reserve you place."
          />

          <MemberOrdersStatePanel
            actions={
              <>
                <button
                  className="orders-page__button orders-page__button--primary"
                  onClick={() => openAuthModal("sign-in")}
                  type="button"
                >
                  Sign in
                </button>
                <Link className="orders-page__button" to="/collection">
                  Browse collection
                </Link>
              </>
            }
            copy="Guest browsing stays open, but order history, checkout follow-up, and reserve notices live inside your private member desk."
            prefersReducedMotion={prefersReducedMotion}
            title="Member access unlocks the full reserve timeline"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="orders-page">
      <div className="orders-page__ambient" />
      <div className="orders-page__shell">
        <MemberOrdersHero
          copy="Follow each reserve through confirmation, payment, and delivery from one calmer storefront ledger."
          prefersReducedMotion={prefersReducedMotion}
          signals={memberHeroSignals}
          title="Your private reserve timeline"
        />

        {checkoutNotice ? (
          <p className="orders-page__notice">{checkoutNotice}</p>
        ) : null}
        {activeError ? (
          <p className="orders-page__error">{activeError}</p>
        ) : null}

        {loading ? (
          <MemberOrdersSkeleton prefersReducedMotion={prefersReducedMotion} />
        ) : null}

        {!loading && sortedOrders.length === 0 ? (
          <MemberOrdersStatePanel
            actions={
              <>
                <Link
                  className="orders-page__button orders-page__button--primary"
                  to="/collection"
                >
                  Browse marketplace
                </Link>
                <Link className="orders-page__button" to="/favorites">
                  Open favorites
                </Link>
              </>
            }
            copy="No reserves are sitting in your ledger yet. Browse the collection or pull a saved piece from favorites when you are ready to stage the next order."
            prefersReducedMotion={prefersReducedMotion}
            title="Your reserve desk is empty"
          />
        ) : null}

        {!loading && sortedOrders.length > 0 ? (
          <div className="member-orders__list">
            {sortedOrders.map((order) => (
              <MemberOrderCard
                key={order.id}
                highlighted={order.id === highlightedOrderId}
                order={order}
                prefersReducedMotion={prefersReducedMotion}
                variantLookup={variantLookup}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
