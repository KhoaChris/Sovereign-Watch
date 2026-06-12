import {
  formatProductSize,
  normalizeProductSizeValue,
} from "../shared";
import type {
  AiConciergeResponse,
  AuthUserProfile,
  OrderRecord,
  ProductFacetOption,
  ProductRecord,
  SupportChatProductSuggestion,
} from "../shared";
import { listOrders, listOrdersByCustomer } from "./order-service";
import { getProductDiscovery } from "./product-service";

type ConciergeOccasion = "collector" | "daily" | "formal" | "sport" | null;

interface ConciergeIntent {
  budgetMax?: number;
  budgetMin?: number;
  occasion: ConciergeOccasion;
  size?: string;
  wantsAvailableOnly: boolean;
}

interface ProductMatchResult {
  intent: ConciergeIntent;
  label: string;
  products: ProductRecord[];
  searchTerm: string;
  wasExactMatch: boolean;
}

type ConciergeIntentLabel =
  | "authenticity"
  | "contact"
  | "greeting"
  | "order"
  | "payment"
  | "product"
  | "shipping"
  | "warranty"
  | "general";

const PRODUCT_KEYWORDS = [
  "available",
  "co hang",
  "dong ho",
  "find",
  "kiem",
  "mau",
  "product",
  "reference",
  "rolex",
  "search",
  "san pham",
  "tim",
  "watch",
];
const PRICE_KEYWORDS = ["bao gia", "bao nhieu", "budget", "cost", "gia", "price", "under"];
const SHIPPING_KEYWORDS = ["delivery", "giao", "return", "shipping", "ship", "tra hang", "van chuyen"];
const PAYMENT_KEYWORDS = ["bank", "card", "cod", "payment", "stripe", "thanh toan", "transfer", "wallet"];
const ORDER_KEYWORDS = ["don hang", "ma don", "order", "status", "tracking"];
const WARRANTY_KEYWORDS = ["bao hanh", "service", "sua", "warranty"];
const AUTHENTICITY_KEYWORDS = ["auth", "authentic", "chinh hang", "giay to", "kiem dinh", "legit", "original", "zin"];
const CONTACT_KEYWORDS = ["admin", "contact", "gap nguoi", "hotline", "lien he", "nhan vien", "support", "tu van"];
const GREETING_KEYWORDS = ["alo", "chao", "hello", "hi", "xin chao"];
const SIZE_KEYWORDS = ["36mm", "38mm", "40mm", "41mm", "42mm", "size", "wrist"];
const DRESS_WATCH_KEYWORDS = ["dress", "dress watch", "formal", "lich su"];
const DAILY_WATCH_KEYWORDS = ["daily", "everyday", "hang ngay", "wear daily"];
const SPORT_WATCH_KEYWORDS = ["chrono", "chronograph", "rubber", "sport", "sports"];
const COLLECTOR_WATCH_KEYWORDS = ["allocation", "collector", "investment", "limited", "rare", "suu tam"];
const AVAILABLE_ONLY_KEYWORDS = [
  "available",
  "available now",
  "co hang",
  "in stock",
  "ready",
  "san hang",
];

const SEARCH_STOP_WORDS = [
  "available",
  "bao",
  "bao gia",
  "bao nhieu",
  "cho",
  "co",
  "cost",
  "dong ho",
  "find",
  "gia",
  "giup",
  "kiem",
  "mau",
  "minh",
  "price",
  "product",
  "reference",
  "search",
  "san pham",
  "tim",
  "toi",
  "watch",
  "xin",
];

function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function includesAnyKeyword(value: string, keywords: string[]): boolean {
  const normalized = normalizeForSearch(value);
  return keywords.some((keyword) => normalized.includes(normalizeForSearch(keyword)));
}

function getLowestProductPrice(product: ProductRecord): number | null {
  const prices = product.variants
    .map((variant) => variant.discountPrice ?? variant.price)
    .filter((price) => Number.isFinite(price) && price > 0);

  if (prices.length === 0) {
    return null;
  }

  return Math.min(...prices);
}

function formatPrice(value: number | null): string {
  if (!value) {
    return "Contact for price";
  }

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function getTotalProductStock(product: ProductRecord): number {
  return product.variants.reduce(
    (total, variant) => total + Math.max(0, variant.stockQuantity),
    0,
  );
}

function getProductStockLabel(product: ProductRecord): string {
  const stock = getTotalProductStock(product);

  if (stock <= 0) {
    return "Sold out";
  }

  if (stock <= 2) {
    return `${stock} left`;
  }

  return `${stock} in stock`;
}

function productToSuggestion(product: ProductRecord): SupportChatProductSuggestion {
  return {
    href: `/collection/${product.id}`,
    image: product.images[0] ?? "",
    name: product.name,
    priceLabel: `${formatPrice(getLowestProductPrice(product))} - ${getProductStockLabel(product)}`,
    productId: product.id,
    type: product.type,
  };
}

function pageSuggestion({
  href,
  name,
  priceLabel,
  productId,
}: {
  href: string;
  name: string;
  priceLabel: string;
  productId: string;
}): SupportChatProductSuggestion {
  return {
    href,
    image: "",
    name,
    priceLabel,
    productId,
    type: "Guide",
  };
}

function getProductPriceRange(products: ProductRecord[]): string {
  const prices = products
    .map(getLowestProductPrice)
    .filter((price): price is number => price !== null);

  if (prices.length === 0) {
    return "Contact for price";
  }

  const min = Math.min(...prices);
  const max = Math.max(...prices);

  return min === max ? formatPrice(min) : `${formatPrice(min)} - ${formatPrice(max)}`;
}

function describeInventory(products: ProductRecord[]): string {
  const availableCount = products.filter((product) => getTotalProductStock(product) > 0).length;

  if (products.length === 0) {
    return "no matching inventory";
  }

  if (availableCount === products.length) {
    return "currently in stock";
  }

  if (availableCount > 0) {
    return `${availableCount}/${products.length} pieces are available`;
  }

  return "currently sold out";
}

function findFacetMatch(
  term: string,
  facets: ProductFacetOption[],
): { id: string; label: string } | null {
  const normalizedTerm = normalizeForSearch(term);

  if (!normalizedTerm) {
    return null;
  }

  return (
    facets.find((facet) => {
      const id = normalizeForSearch(facet.id);
      const label = normalizeForSearch(facet.label);

      return (
        normalizedTerm === id ||
        normalizedTerm === label ||
        normalizedTerm.includes(id) ||
        normalizedTerm.includes(label) ||
        id.includes(normalizedTerm) ||
        label.includes(normalizedTerm)
      );
    }) ?? null
  );
}

function extractSearchTerm(body: string): string {
  let normalized = normalizeForSearch(body);

  for (const word of SEARCH_STOP_WORDS) {
    const escapedWord = normalizeForSearch(word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    normalized = normalized.replace(new RegExp(`\\b${escapedWord}\\b`, "g"), " ");
  }

  return normalized
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMoneyAmount(rawAmount: string, suffix = ""): number | null {
  const amount = Number(rawAmount.replace(/,/g, "").trim());

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  if (/k|thousand/i.test(suffix) || amount < 1_000) {
    return Math.round(amount * 1_000);
  }

  return Math.round(amount);
}

function extractBudgetIntent(body: string): Pick<ConciergeIntent, "budgetMax" | "budgetMin"> {
  const text = normalizeForSearch(body);
  const amountPattern = "(\\d+(?:[,.]\\d{3})*|\\d+(?:\\.\\d+)?)\\s*(k|thousand)?";
  const rangeMatch = text.match(
    new RegExp(`(?:between|from|tu)\\s+${amountPattern}\\s*(?:-|to|and|den)\\s*${amountPattern}(?!\\s*mm)`, "i"),
  );

  if (rangeMatch) {
    const first = parseMoneyAmount(rangeMatch[1], rangeMatch[2]);
    const second = parseMoneyAmount(rangeMatch[3], rangeMatch[4]);

    if (first && second) {
      return {
        budgetMax: Math.max(first, second),
        budgetMin: Math.min(first, second),
      };
    }
  }

  const maxMatch = text.match(
    new RegExp(`(?:under|below|less than|up to|max|budget|duoi)\\s*(?:usd|\\$)?\\s*${amountPattern}(?!\\s*mm)`, "i"),
  );
  const minMatch = text.match(
    new RegExp(`(?:over|above|from|min|tren)\\s*(?:usd|\\$)?\\s*${amountPattern}(?!\\s*mm)`, "i"),
  );
  const budgetMax = maxMatch ? parseMoneyAmount(maxMatch[1], maxMatch[2]) : null;
  const budgetMin = minMatch ? parseMoneyAmount(minMatch[1], minMatch[2]) : null;

  return {
    ...(budgetMax ? { budgetMax } : {}),
    ...(budgetMin ? { budgetMin } : {}),
  };
}

function extractSizeIntent(body: string): string | undefined {
  const match = normalizeForSearch(body).match(/\b(2[8-9]|3[0-9]|4[0-9]|5[0-2])\s*mm\b/);

  return match ? `${match[1]}mm` : undefined;
}

function extractOccasionIntent(body: string): ConciergeOccasion {
  if (includesAnyKeyword(body, DRESS_WATCH_KEYWORDS)) {
    return "formal";
  }

  if (includesAnyKeyword(body, SPORT_WATCH_KEYWORDS)) {
    return "sport";
  }

  if (includesAnyKeyword(body, COLLECTOR_WATCH_KEYWORDS)) {
    return "collector";
  }

  if (includesAnyKeyword(body, DAILY_WATCH_KEYWORDS)) {
    return "daily";
  }

  return null;
}

function buildConciergeIntent(body: string): ConciergeIntent {
  return {
    ...extractBudgetIntent(body),
    occasion: extractOccasionIntent(body),
    size: extractSizeIntent(body),
    wantsAvailableOnly: includesAnyKeyword(body, AVAILABLE_ONLY_KEYWORDS),
  };
}

function buildConciergeQueryLabel(intent: ConciergeIntent, fallback: string): string {
  const details = [
    intent.occasion ? `${intent.occasion} use` : null,
    intent.size ? intent.size : null,
    intent.budgetMin && intent.budgetMax
      ? `${formatPrice(intent.budgetMin)}-${formatPrice(intent.budgetMax)}`
      : intent.budgetMax
        ? `under ${formatPrice(intent.budgetMax)}`
        : intent.budgetMin
          ? `from ${formatPrice(intent.budgetMin)}`
          : null,
    intent.wantsAvailableOnly ? "available inventory" : null,
  ].filter(Boolean);

  return details.length > 0 ? details.join(", ") : fallback;
}

function productMatchesOccasion(product: ProductRecord, occasion: ConciergeOccasion): boolean {
  if (!occasion) {
    return false;
  }

  const haystack = normalizeForSearch(
    `${product.name} ${product.description} ${product.type} ${product.brandId} ${product.categoryId}`,
  );

  if (occasion === "formal") {
    return ["dress", "heritage", "classic", "luxury", "oyster"].some((keyword) =>
      haystack.includes(keyword),
    );
  }

  if (occasion === "sport") {
    return ["sport", "chrono", "chronograph", "rubber", "hublot", "daytona"].some((keyword) =>
      haystack.includes(keyword),
    );
  }

  if (occasion === "collector") {
    return ["limited", "rare", "heritage", "rolex", "hublot"].some((keyword) =>
      haystack.includes(keyword),
    );
  }

  return ["daily", "classic", "luxury", "oyster", "sport"].some((keyword) =>
    haystack.includes(keyword),
  );
}

function productHasSize(product: ProductRecord, size: string | undefined): boolean {
  if (!size) {
    return false;
  }

  const normalizedSize = normalizeProductSizeValue(size) || size;

  return product.variants.some((variant) => {
    const variantSize = normalizeProductSizeValue(variant.size) || variant.size;
    return normalizeForSearch(variantSize) === normalizeForSearch(normalizedSize);
  });
}

function scoreConciergeProduct(product: ProductRecord, intent: ConciergeIntent): number {
  const price = getLowestProductPrice(product);
  let score = 0;

  if (getTotalProductStock(product) > 0) {
    score += 35;
  } else if (intent.wantsAvailableOnly) {
    score -= 80;
  }

  if (price !== null) {
    if (intent.budgetMin !== undefined && price >= intent.budgetMin) {
      score += 12;
    }

    if (intent.budgetMax !== undefined && price <= intent.budgetMax) {
      score += 18;
    }

    if (intent.budgetMax !== undefined && price > intent.budgetMax) {
      score -= 20;
    }
  }

  if (productHasSize(product, intent.size)) {
    score += 18;
  }

  if (productMatchesOccasion(product, intent.occasion)) {
    score += 16;
  }

  return score;
}

async function getProductMatches(body: string): Promise<ProductMatchResult> {
  const searchTerm = extractSearchTerm(body);
  const intent = buildConciergeIntent(body);
  const sort = includesAnyKeyword(body, PRICE_KEYWORDS) ? "price-asc" : "newest";
  const initialDiscovery = await getProductDiscovery({
    availability: "all",
    priceMax: intent.budgetMax,
    priceMin: intent.budgetMin,
    search: searchTerm || undefined,
    size: intent.size,
    sort,
  });

  if (initialDiscovery.items.length > 0) {
    return {
      intent,
      label: buildConciergeQueryLabel(intent, searchTerm || "your request"),
      products: [...initialDiscovery.items].sort(
        (left, right) => scoreConciergeProduct(right, intent) - scoreConciergeProduct(left, intent),
      ),
      searchTerm,
      wasExactMatch: true,
    };
  }

  const brandMatch = findFacetMatch(searchTerm || body, initialDiscovery.facets.brands);

  if (brandMatch) {
    const brandDiscovery = await getProductDiscovery({
      availability: "all",
      brand: brandMatch.id,
      priceMax: intent.budgetMax,
      priceMin: intent.budgetMin,
      size: intent.size,
      sort,
    });

    return {
      intent,
      label: brandMatch.label,
      products: [...brandDiscovery.items].sort(
        (left, right) => scoreConciergeProduct(right, intent) - scoreConciergeProduct(left, intent),
      ),
      searchTerm,
      wasExactMatch: brandDiscovery.items.length > 0,
    };
  }

  const categoryMatch = findFacetMatch(searchTerm || body, initialDiscovery.facets.categories);

  if (categoryMatch) {
    const categoryDiscovery = await getProductDiscovery({
      availability: "all",
      category: categoryMatch.id,
      priceMax: intent.budgetMax,
      priceMin: intent.budgetMin,
      size: intent.size,
      sort,
    });

    return {
      intent,
      label: categoryMatch.label,
      products: [...categoryDiscovery.items].sort(
        (left, right) => scoreConciergeProduct(right, intent) - scoreConciergeProduct(left, intent),
      ),
      searchTerm,
      wasExactMatch: categoryDiscovery.items.length > 0,
    };
  }

  if (includesAnyKeyword(body, DRESS_WATCH_KEYWORDS)) {
    const allDiscovery = await getProductDiscovery({
      availability: "all",
      priceMax: intent.budgetMax,
      priceMin: intent.budgetMin,
      size: intent.size,
      sort: "price-asc",
    });
    const dressLikeProducts = allDiscovery.items.filter((product) =>
      productMatchesOccasion(product, "formal"),
    );

    return {
      intent,
      label: "dress watch",
      products: [...(dressLikeProducts.length > 0 ? dressLikeProducts : allDiscovery.items)].sort(
        (left, right) => scoreConciergeProduct(right, intent) - scoreConciergeProduct(left, intent),
      ),
      searchTerm,
      wasExactMatch: dressLikeProducts.length > 0,
    };
  }

  if (
    intent.occasion ||
    intent.size ||
    intent.budgetMax !== undefined ||
    intent.budgetMin !== undefined
  ) {
    const discovery = await getProductDiscovery({
      availability: "all",
      priceMax: intent.budgetMax,
      priceMin: intent.budgetMin,
      size: intent.size,
      sort,
    });
    const occasionProducts = intent.occasion
      ? discovery.items.filter((product) => productMatchesOccasion(product, intent.occasion))
      : discovery.items;
    const products = occasionProducts.length > 0 ? occasionProducts : discovery.items;

    return {
      intent,
      label: buildConciergeQueryLabel(intent, searchTerm || "your request"),
      products: [...products].sort(
        (left, right) => scoreConciergeProduct(right, intent) - scoreConciergeProduct(left, intent),
      ),
      searchTerm,
      wasExactMatch: occasionProducts.length > 0 || discovery.items.length > 0,
    };
  }

  return {
    intent,
    label: searchTerm || "your request",
    products: [],
    searchTerm,
    wasExactMatch: false,
  };
}

function orderStatusLine(order: OrderRecord): string {
  const paymentStatus = order.payment?.status ?? "pending";
  const shippingStatus = order.shipping?.status ?? "pending";
  const trackingNumber = order.shipping?.trackingNumber;
  const courierName = order.shipping?.courierName;
  const trackingLine =
    trackingNumber && trackingNumber !== "Pending"
      ? ` Tracking: ${trackingNumber}${courierName ? ` via ${courierName}` : ""}.`
      : "";

  return `Order ${order.orderNumber} is ${order.status}. Payment is ${paymentStatus}; shipping is ${shippingStatus}.${trackingLine}`;
}

function extractOrderToken(message: string): string {
  const match = message.match(/\bWS[-\s]?[A-Z0-9-]{6,}\b/i);
  return match ? normalizeForSearch(match[0]).replace(/\s+/g, "-") : "";
}

function findRequestedOrder(orders: OrderRecord[], message: string): OrderRecord | null {
  const token = extractOrderToken(message);

  if (!token) {
    return null;
  }

  return (
    orders.find((order) => normalizeForSearch(order.orderNumber).includes(token)) ?? null
  );
}

async function getRecentOrders(profile: AuthUserProfile): Promise<OrderRecord[]> {
  const orders = profile.role === "admin"
    ? await listOrders()
    : await listOrdersByCustomer(profile.id);

  return orders.slice(0, 5);
}

function buildOrderReply(message: string, orders: OrderRecord[]): AiConciergeResponse {
  const requestedOrder = findRequestedOrder(orders, message);
  const targetOrder = requestedOrder ?? orders[0] ?? null;

  if (!targetOrder) {
    return {
      body: "I do not see an active order on this account yet. Once you reserve a watch, Orders will show payment, shipping, and tracking updates in one place.",
      context: {
        intent: "order",
        matchedProducts: 0,
        recentOrders: 0,
      },
      source: "backend_context",
      suggestions: [
        pageSuggestion({
          href: "/collection",
          name: "Collection",
          priceLabel: "Browse watches",
          productId: "collection",
        }),
        pageSuggestion({
          href: "/orders",
          name: "Orders",
          priceLabel: "Order ledger",
          productId: "orders",
        }),
      ],
    };
  }

  return {
    body: `${orderStatusLine(targetOrder)} I checked this against your live order ledger, so it is safer than a generic chatbot answer. For address changes or delivery holds, ask the live desk before the order moves to in transit.`,
    context: {
      intent: "order",
      matchedProducts: 0,
      recentOrders: orders.length,
    },
    source: "backend_context",
    suggestions: [
      pageSuggestion({
        href: "/orders",
        name: "Orders",
        priceLabel: "Track status",
        productId: "orders",
      }),
      pageSuggestion({
        href: "/shipping-returns",
        name: "Shipping & Returns",
        priceLabel: "Delivery policy",
        productId: "shipping-returns",
      }),
    ],
  };
}

async function buildProductReply(message: string): Promise<AiConciergeResponse> {
  const result = await getProductMatches(message);
  const visibleProducts = result.intent.wantsAvailableOnly
    ? result.products.filter((product) => getTotalProductStock(product) > 0)
    : result.products;
  const suggestions = visibleProducts.slice(0, 3).map(productToSuggestion);

  if (suggestions.length === 0) {
    return {
      body: "I could not find a clean match in live inventory. Send a brand, reference, case size, budget, or use case like daily, formal, sport, or collector and I will narrow it again.",
      context: {
        intent: "product",
        matchedProducts: 0,
        recentOrders: 0,
      },
      source: "backend_context",
      suggestions: [
        pageSuggestion({
          href: "/collection",
          name: "Collection",
          priceLabel: "Browse all",
          productId: "collection",
        }),
      ],
    };
  }

  const priceRange = getProductPriceRange(visibleProducts);
  const inventory = describeInventory(visibleProducts);
  const brief = buildConciergeQueryLabel(result.intent, result.label);
  const lead = result.wasExactMatch
    ? `I found ${visibleProducts.length} option${visibleProducts.length === 1 ? "" : "s"} for ${brief}`
    : `I did not find an exact match for "${result.searchTerm || message}", but these are the closest options`;

  return {
    body: includesAnyKeyword(message, PRICE_KEYWORDS)
      ? `${lead}. Indicative range: ${priceRange}. Inventory: ${inventory}. Final allocation can still be confirmed by the desk.`
      : `${lead}. I ranked them by availability, budget fit, ${result.intent.size ? formatProductSize(result.intent.size, result.intent.size) : "case size"}, and use case, then attached the strongest matches below.`,
    context: {
      intent: "product",
      matchedProducts: visibleProducts.length,
      recentOrders: 0,
    },
    source: "backend_context",
    suggestions,
  };
}

function detectIntent(message: string): ConciergeIntentLabel {
  if (includesAnyKeyword(message, SHIPPING_KEYWORDS)) {
    return "shipping";
  }

  if (includesAnyKeyword(message, PAYMENT_KEYWORDS)) {
    return "payment";
  }

  if (includesAnyKeyword(message, ORDER_KEYWORDS)) {
    return "order";
  }

  if (includesAnyKeyword(message, AUTHENTICITY_KEYWORDS)) {
    return "authenticity";
  }

  if (includesAnyKeyword(message, WARRANTY_KEYWORDS)) {
    return "warranty";
  }

  if (includesAnyKeyword(message, CONTACT_KEYWORDS)) {
    return "contact";
  }

  if (includesAnyKeyword(message, GREETING_KEYWORDS)) {
    return "greeting";
  }

  if (
    includesAnyKeyword(message, PRODUCT_KEYWORDS) ||
    includesAnyKeyword(message, PRICE_KEYWORDS) ||
    includesAnyKeyword(message, DRESS_WATCH_KEYWORDS) ||
    includesAnyKeyword(message, SIZE_KEYWORDS)
  ) {
    return "product";
  }

  return "general";
}

function policyReply(intent: ConciergeIntentLabel, message: string): AiConciergeResponse | null {
  if (intent === "shipping") {
    const asksAboutAuthenticity = includesAnyKeyword(message, AUTHENTICITY_KEYWORDS);

    return {
      body: asksAboutAuthenticity
        ? "Delivery and documentation are reviewed together. Shipping is confirmed from the order address and live order status, while authentication is checked through serial details, card, box, condition photos, and service history."
        : "Shipping is confirmed from the order address and live order status. Once a courier and tracking number are assigned, Orders is the fastest place to review movement. For delivery holds or address changes, use the live desk before the parcel is in transit.",
      context: {
        intent,
        matchedProducts: 0,
        recentOrders: 0,
      },
      source: "backend_context",
      suggestions: [
        pageSuggestion({
          href: "/shipping-returns",
          name: "Shipping & Returns",
          priceLabel: "Delivery policy",
          productId: "shipping-returns",
        }),
        pageSuggestion({
          href: "/orders",
          name: "Orders",
          priceLabel: "Track status",
          productId: "orders",
        }),
        ...(asksAboutAuthenticity
          ? [
              pageSuggestion({
                href: "/client-services",
                name: "Client Services",
                priceLabel: "Authentication",
                productId: "client-services",
              }),
            ]
          : []),
      ],
    };
  }

  if (intent === "payment") {
    return {
      body: "Card and wallet payments are handled by Stripe and sync back to the order ledger after payment confirmation. COD remains available for selected cases. Bank transfer is intentionally locked until reconciliation is fully handled.",
      context: {
        intent,
        matchedProducts: 0,
        recentOrders: 0,
      },
      source: "backend_context",
      suggestions: [
        pageSuggestion({
          href: "/cart",
          name: "Reserve Cart",
          priceLabel: "Secure checkout",
          productId: "cart",
        }),
      ],
    };
  }

  if (intent === "authenticity" || intent === "warranty") {
    return {
      body: intent === "authenticity"
        ? "Authentication is reviewed through serial details, card, box, condition photos, and service history. Send a model or reference and I can narrow comparable inventory before the live desk reviews it."
        : "Warranty and service scope depend on the exact watch, condition, and handover record. Send the model, reference, or order number so the desk can confirm the available support path.",
      context: {
        intent,
        matchedProducts: 0,
        recentOrders: 0,
      },
      source: "backend_context",
      suggestions: [
        pageSuggestion({
          href: "/client-services",
          name: "Client Services",
          priceLabel: "Aftercare",
          productId: "client-services",
        }),
        pageSuggestion({
          href: "/contact",
          name: "Contact Desk",
          priceLabel: "Admin support",
          productId: "contact",
        }),
      ],
    };
  }

  if (intent === "contact") {
    return {
      body: "I noted that you would like desk support. When an admin is online, switch to Admin Desk; otherwise leave a phone number, order number, or watch reference here so the handoff has context.",
      context: {
        intent,
        matchedProducts: 0,
        recentOrders: 0,
      },
      source: "backend_context",
      suggestions: [
        pageSuggestion({
          href: "/contact",
          name: "Contact Desk",
          priceLabel: "Human support",
          productId: "contact",
        }),
      ],
    };
  }

  if (intent === "greeting") {
    return {
      body: "Hello, I am the Sovereign AI Concierge. I can narrow watches by budget, size, occasion, availability, and order context before the live desk joins.",
      context: {
        intent,
        matchedProducts: 0,
        recentOrders: 0,
      },
      source: "backend_context",
      suggestions: [
        pageSuggestion({
          href: "/collection",
          name: "Collection",
          priceLabel: "Find watches",
          productId: "collection",
        }),
        pageSuggestion({
          href: "/shipping-returns",
          name: "Shipping & Returns",
          priceLabel: "Delivery",
          productId: "shipping-returns",
        }),
      ],
    };
  }

  return null;
}

export async function buildAiConciergeReply(
  profile: AuthUserProfile,
  message: string,
): Promise<AiConciergeResponse> {
  const intent = detectIntent(message);

  if (intent === "product") {
    return buildProductReply(message);
  }

  if (intent === "order") {
    return buildOrderReply(message, await getRecentOrders(profile));
  }

  const reply = policyReply(intent, message);

  if (reply) {
    return reply;
  }

  return {
    body: "I have noted your message. For a sharper concierge answer, send a brand, reference, case size, budget, use case, order number, payment question, or shipping question.",
    context: {
      intent: "general",
      matchedProducts: 0,
      recentOrders: 0,
    },
    source: "backend_context",
    suggestions: [
      pageSuggestion({
        href: "/collection",
        name: "Collection",
        priceLabel: "Browse watches",
        productId: "collection",
      }),
    ],
  };
}
