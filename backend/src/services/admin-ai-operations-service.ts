import type {
  AdminAiCatalogDraft,
  AdminAiOperationsIntent,
  AdminAiOperationsMemoryMessage,
  AdminAiOperationsMetric,
  AdminAiOperationsResponse,
  AuthUserProfile,
  OrderRecord,
  ProductRecord,
  ProductVariant,
  SupportChatProductSuggestion,
} from "../shared";
import { listOrders } from "./order-service";
import { listProducts } from "./product-service";

interface OperationsContext {
  activeProducts: ProductRecord[];
  orders: OrderRecord[];
  products: ProductRecord[];
}

interface InventoryLine {
  lowestPrice: number | null;
  product: ProductRecord;
  stock: number;
}

type Timeframe = "all" | "today" | "week" | "month";
type CatalogDraftCandidate = AdminAiCatalogDraft;

const LOW_STOCK_THRESHOLD = 5;
const DEFAULT_CATALOG_DRAFT_COUNT = 6;
const MAX_CATALOG_DRAFT_COUNT = 10;

const GREETING_KEYWORDS = ["hello", "hi", "hey", "chao", "xin chao"];
const HELP_KEYWORDS = ["commands", "guide", "help", "huong dan", "what can you do"];
const REVENUE_COMPARE_KEYWORDS = [
  "compare revenue",
  "comparison",
  "last month",
  "month over month",
  "mom",
  "previous month",
  "revenue compare",
  "so sanh doanh thu",
  "vs last month",
];
const REVENUE_KEYWORDS = [
  "aov",
  "cash",
  "gross",
  "income",
  "kpi",
  "money",
  "paid",
  "profit",
  "revenue",
  "sales",
  "sold",
  "stripe",
  "turnover",
  "doanh thu",
  "tai chinh",
];
const INVENTORY_KEYWORDS = [
  "catalog",
  "find",
  "inventory",
  "lookup",
  "low stock",
  "out of stock",
  "product",
  "products",
  "search",
  "show",
  "sku",
  "stock",
  "variant",
  "ton kho",
  "san pham",
];
const FULFILLMENT_KEYWORDS = [
  "delivery",
  "deliveries",
  "delivered",
  "fulfillment",
  "fulfilment",
  "order",
  "orders",
  "paid not shipped",
  "pending",
  "ship",
  "shipment",
  "shipments",
  "shipped",
  "shipping",
  "tracking",
  "unpaid",
  "xu ly don",
  "don hang",
];
const RISK_KEYWORDS = [
  "attention",
  "issue",
  "priority",
  "risk",
  "todo",
  "warning",
  "what should i do",
  "can lam gi",
];
const STRATEGY_KEYWORDS = [
  "action plan",
  "business plan",
  "chien luoc",
  "de xuat",
  "goi y chien luoc",
  "growth",
  "improve",
  "next move",
  "recommend",
  "recommend action",
  "recommendation",
  "strategy",
  "suggest strategy",
];
const CATALOG_DRAFT_KEYWORDS = [
  "add product",
  "add products",
  "add catalog",
  "catalog ideas",
  "catalog draft",
  "catalog manager",
  "de xuat san pham",
  "de xuat them san pham",
  "draft product",
  "generate product",
  "goi y san pham",
  "goi y them san pham",
  "image search",
  "import product",
  "import products",
  "new catalog",
  "new product idea",
  "product ideas",
  "product draft",
  "source image",
  "suggest additions",
  "suggest more products",
  "suggest product",
  "suggest products",
  "suggest new product",
  "them san pham",
];

const CATALOG_DRAFT_CANDIDATES: CatalogDraftCandidate[] = [
  {
    brandId: "Rolex",
    categoryId: "Chronograph",
    description:
      "Rolex Cosmograph Daytona reference 126500LN in Oystersteel, 40 mm, with a black dial, black Cerachrom tachymetric bezel, Oyster bracelet, and Rolex calibre 4131 chronograph movement.",
    imageUrl: "/editorial/rolex5-linitedBlack.png",
    name: "Rolex Cosmograph Daytona 126500LN",
    reference: "126500LN",
    sourceUrl:
      "https://www.rolex.com/en-us/watches/cosmograph-daytona/m126500ln-0002",
    strategyNote:
      "Steel Daytona demand anchor; use as a premium chronograph listing.",
    type: "Cosmograph Daytona",
    variants: [
      {
        color: "Black dial",
        discountPrice: null,
        price: 16100,
        size: "40",
        sku: "ROLE-DAYTN-BLA-40-01",
        stockQuantity: 2,
      },
    ],
  },
  {
    brandId: "Rolex",
    categoryId: "Chronograph",
    description:
      "Rolex Cosmograph Daytona reference 126518LN in 18 kt yellow gold, 40 mm, with a black dial, black Cerachrom bezel, and black Oysterflex bracelet.",
    imageUrl: "/editorial/rolex3.png",
    name: "Rolex Cosmograph Daytona 126518LN",
    reference: "126518LN",
    sourceUrl:
      "https://www.rolex.com/en-us/watches/cosmograph-daytona/m126518ln-0010",
    strategyNote:
      "Gold Oysterflex Daytona gives the catalog a louder collector option.",
    type: "Cosmograph Daytona",
    variants: [
      {
        color: "Black dial / Oysterflex",
        discountPrice: null,
        price: 33000,
        size: "40",
        sku: "ROLE-DAYTN-GOL-40-01",
        stockQuantity: 1,
      },
    ],
  },
  {
    brandId: "Rolex",
    categoryId: "Chronograph",
    description:
      "Rolex Cosmograph Daytona reference 126506 in platinum, 40 mm, with an ice-blue dial, chestnut-brown Cerachrom bezel, and Oyster bracelet.",
    imageUrl: "/editorial/rolex4.png",
    name: "Rolex Cosmograph Daytona 126506",
    reference: "126506",
    sourceUrl:
      "https://www.rolex.com/en-us/watches/cosmograph-daytona/m126506-0001",
    strategyNote:
      "Ultra-premium Daytona reference for high-ticket showcase moments.",
    type: "Cosmograph Daytona",
    variants: [
      {
        color: "Ice blue dial",
        discountPrice: null,
        price: 82500,
        size: "40",
        sku: "ROLE-DAYTN-ICE-40-01",
        stockQuantity: 1,
      },
    ],
  },
  {
    brandId: "Rolex",
    categoryId: "Heritage",
    description:
      "Rolex Datejust 41 reference 126334 in Oystersteel and white gold, 41 mm, with a silver dial, fluted bezel, and Jubilee bracelet.",
    imageUrl: "/editorial/rolex1.png",
    name: "Rolex Datejust 41 126334 Silver Dial",
    reference: "126334",
    sourceUrl: "https://www.rolex.com/en-us/watches/datejust/m126334-0001",
    strategyNote:
      "Classic Datejust 41 broadens daily luxury beyond sport chronographs.",
    type: "Datejust 41",
    variants: [
      {
        color: "Silver dial / Jubilee",
        discountPrice: null,
        price: 10600,
        size: "41",
        sku: "ROLE-DATEJ-SIL-41-01",
        stockQuantity: 3,
      },
    ],
  },
  {
    brandId: "Rolex",
    categoryId: "Heritage",
    description:
      "Rolex Datejust 41 reference 126334 in Oystersteel and white gold, 41 mm, with a bright dial, fluted bezel, and Jubilee bracelet.",
    imageUrl: "/editorial/rolex2.png",
    name: "Rolex Datejust 41 126334 Bright Dial",
    reference: "126334",
    sourceUrl: "https://www.rolex.com/en-us/watches/datejust/m126334-0002",
    strategyNote:
      "Second Datejust colorway supports variant breadth without duplicating SKU.",
    type: "Datejust 41",
    variants: [
      {
        color: "Bright dial / Jubilee",
        discountPrice: null,
        price: 10600,
        size: "41",
        sku: "ROLE-DATEJ-BRI-41-01",
        stockQuantity: 2,
      },
    ],
  },
  {
    brandId: "Rolex",
    categoryId: "Sport",
    description:
      "Rolex Submariner Date reference 126619LB in 18 kt white gold, 41 mm, with a black dial, blue Cerachrom bezel, and Oyster bracelet.",
    imageUrl: "/editorial/rolex5-linitedBlue.png",
    name: "Rolex Submariner Date 126619LB",
    reference: "126619LB",
    sourceUrl: "https://www.rolex.com/en-us/watches/submariner/m126619lb-0003",
    strategyNote:
      "Blue-bezel Submariner adds high-value sport depth and visual contrast.",
    type: "Submariner Date",
    variants: [
      {
        color: "Blue bezel / black dial",
        discountPrice: null,
        price: 45500,
        size: "41",
        sku: "ROLE-SUBMA-BLU-41-01",
        stockQuantity: 1,
      },
    ],
  },
  {
    brandId: "Rolex",
    categoryId: "Chronograph",
    description:
      "Rolex Cosmograph Daytona reference 126519LN in 18 kt white gold, 40 mm, with a bright black and steel dial, black Cerachrom bezel, and Oysterflex bracelet.",
    imageUrl: "/editorial/rolex5-linitedWhite.png",
    name: "Rolex Cosmograph Daytona 126519LN",
    reference: "126519LN",
    sourceUrl:
      "https://www.rolex.com/en-us/watches/cosmograph-daytona/m126519ln-0006",
    strategyNote:
      "White-gold Oysterflex Daytona adds a light strap contrast to the shelf.",
    type: "Cosmograph Daytona",
    variants: [
      {
        color: "Bright black dial / Oysterflex",
        discountPrice: null,
        price: 33000,
        size: "40",
        sku: "ROLE-DAYTN-WHG-40-01",
        stockQuantity: 1,
      },
    ],
  },
  {
    brandId: "Hublot",
    categoryId: "Luxury",
    description:
      "Hublot Big Bang Sang Bleu II King Gold Blue reference 418.OX.5108.RX.MXM21, 45 mm, with King Gold case architecture, blue geometric dial language, and rubber strap.",
    imageUrl: "/editorial/hublot1.png",
    name: "Hublot Big Bang Sang Bleu II King Gold Blue",
    reference: "418.OX.5108.RX.MXM21",
    sourceUrl:
      "https://www.hublot.com/en-us/watches/big-bang/big-bang-sang-bleu-ii-king-gold-blue-45-mm",
    strategyNote:
      "Angular Hublot design piece gives the catalog a stronger art-watch lane.",
    type: "Big Bang Sang Bleu II",
    variants: [
      {
        color: "King Gold / blue",
        discountPrice: null,
        price: 47500,
        size: "45",
        sku: "HUBL-SANGB-BLU-45-01",
        stockQuantity: 1,
      },
    ],
  },
  {
    brandId: "Hublot",
    categoryId: "Luxury",
    description:
      "Hublot Big Bang Unico Black Magic reference 441.CI.1171.RX, 42 mm, with black ceramic case, skeleton dial, and black structured rubber strap.",
    imageUrl: "/editorial/HublotBB2.png",
    name: "Hublot Big Bang Unico Black Magic 42mm",
    reference: "441.CI.1171.RX",
    sourceUrl:
      "https://www.hublot.com/en-us/watches/big-bang/big-bang-unico-black-magic-42-mm",
    strategyNote:
      "Black ceramic Hublot fills the stealth sport-luxury slot.",
    type: "Big Bang Unico",
    variants: [
      {
        color: "Black ceramic",
        discountPrice: null,
        price: 19700,
        size: "42",
        sku: "HUBL-UNICO-BLA-42-01",
        stockQuantity: 2,
      },
    ],
  },
  {
    brandId: "Hublot",
    categoryId: "Luxury",
    description:
      "Hublot Big Bang Unico King Gold Ceramic reference 441.OM.1180.RX, 42 mm, with King Gold case, black ceramic bezel, skeleton dial, and rubber strap.",
    imageUrl: "/editorial/3.png",
    name: "Hublot Big Bang Unico King Gold Ceramic 42mm",
    reference: "441.OM.1180.RX",
    sourceUrl:
      "https://www.hublot.com/en-us/watches/big-bang/big-bang-unico-king-gold-ceramic-42-mm",
    strategyNote:
      "King Gold Hublot rounds out the high-impact rubber-strap assortment.",
    type: "Big Bang Unico",
    variants: [
      {
        color: "King Gold / black ceramic",
        discountPrice: null,
        price: 36300,
        size: "42",
        sku: "HUBL-UNICO-KIN-42-01",
        stockQuantity: 1,
      },
    ],
  },
];

function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s$.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAnyKeyword(value: string, keywords: string[]): boolean {
  const normalized = normalizeForSearch(value);

  return keywords.some((keyword) => {
    const normalizedKeyword = normalizeForSearch(keyword);

    if (!normalizedKeyword) {
      return false;
    }

    const escapedKeyword = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|\\s)${escapedKeyword}(?:\\s|$)`).test(normalized);
  });
}

function isCatalogDraftRequest(value: string): boolean {
  const normalized = normalizeForSearch(value);

  return (
    includesAnyKeyword(value, CATALOG_DRAFT_KEYWORDS) ||
    /\b(add|create|draft|generate|import|make|tao|them)\b.*\b(catalog|product|products|watch|watches|san pham|dong ho)\b/.test(
      normalized,
    )
  );
}

function getRequestedCatalogDraftAmount(message: string): number {
  const normalized = normalizeForSearch(message);
  const match = normalized.match(/\b(\d{1,5})\b/);
  const requested = match ? Number(match[1]) : DEFAULT_CATALOG_DRAFT_COUNT;

  if (!Number.isFinite(requested) || requested <= 0) {
    return DEFAULT_CATALOG_DRAFT_COUNT;
  }

  return Math.max(1, Math.floor(requested));
}

function getRequestedCatalogDraftCount(message: string): number {
  return Math.min(
    MAX_CATALOG_DRAFT_COUNT,
    getRequestedCatalogDraftAmount(message),
  );
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    style: "percent",
  }).format(value);
}

function formatStatus(value?: string | null): string {
  if (!value) {
    return "Pending";
  }

  return value
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function getVariantPrice(variant: ProductVariant): number {
  return variant.discountPrice ?? variant.price;
}

function getLowestProductPrice(product: ProductRecord): number | null {
  const prices = product.variants
    .map(getVariantPrice)
    .filter((price) => Number.isFinite(price) && price > 0);

  return prices.length > 0 ? Math.min(...prices) : null;
}

function getProductStock(product: ProductRecord): number {
  return product.variants.reduce(
    (stock, variant) => stock + Math.max(0, variant.stockQuantity),
    0,
  );
}

function getProductVariantSummary(product: ProductRecord): string {
  return product.variants
    .slice(0, 3)
    .map((variant) => `${variant.sku} ${variant.size}/${variant.color}: ${variant.stockQuantity}`)
    .join("; ");
}

function getProductLabel(product: ProductRecord): string {
  return [
    product.name,
    product.brand?.name ?? product.brandId,
    product.category?.name ?? product.categoryId,
  ]
    .filter(Boolean)
    .join(" · ");
}

function getInventoryLines(products: ProductRecord[]): InventoryLine[] {
  return products
    .map((product) => ({
      lowestPrice: getLowestProductPrice(product),
      product,
      stock: getProductStock(product),
    }))
    .sort((left, right) => left.stock - right.stock);
}

function productToSuggestion(product: ProductRecord): SupportChatProductSuggestion {
  const price = getLowestProductPrice(product);
  const stock = getProductStock(product);

  return {
    href: `/collection/${product.id}`,
    image: product.images[0] ?? "",
    name: product.name,
    priceLabel: `${price !== null ? formatPrice(price) : "Contact for price"} · ${stock} in stock`,
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
    type: "operations",
  };
}

function getTimeframe(message: string): Timeframe {
  const normalized = normalizeForSearch(message);

  if (/\b(today|hom nay)\b/.test(normalized)) {
    return "today";
  }

  if (/\b(this week|week|tuan nay)\b/.test(normalized)) {
    return "week";
  }

  if (/\b(this month|month|thang nay)\b/.test(normalized)) {
    return "month";
  }

  return "all";
}

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function filterOrdersByTimeframe(orders: OrderRecord[], timeframe: Timeframe): OrderRecord[] {
  if (timeframe === "all") {
    return orders;
  }

  const now = new Date();
  let start: Date;

  if (timeframe === "today") {
    start = startOfDay(now);
  } else if (timeframe === "week") {
    start = startOfDay(now);
    start.setDate(start.getDate() - 6);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return orders.filter((order) => new Date(order.createdAt).getTime() >= start.getTime());
}

function getTimeframeLabel(timeframe: Timeframe): string {
  if (timeframe === "today") {
    return "today";
  }

  if (timeframe === "week") {
    return "the last 7 days";
  }

  if (timeframe === "month") {
    return "this month";
  }

  return "all time";
}

function getGrossRevenue(orders: OrderRecord[]): number {
  return orders.reduce((sum, order) => sum + order.totalAmount, 0);
}

function getCapturedRevenue(orders: OrderRecord[]): number {
  return orders
    .filter((order) => order.payment?.status === "paid")
    .reduce((sum, order) => sum + order.totalAmount, 0);
}

function monthKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function getCurrentAndPreviousMonthKeys(): { current: string; previous: string } {
  const now = new Date();
  const previousDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  return {
    current: monthKey(now),
    previous: monthKey(previousDate),
  };
}

function getOrdersByMonth(orders: OrderRecord[], targetMonthKey: string): OrderRecord[] {
  return orders.filter((order) => monthKey(new Date(order.createdAt)) === targetMonthKey);
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }

  return (current - previous) / previous;
}

function formatSignedDelta(value: number): string {
  if (value === 0) {
    return "$0";
  }

  const prefix = value > 0 ? "+" : "-";
  return `${prefix}${formatPrice(Math.abs(value))}`;
}

function formatChangeLabel(value: number | null): string {
  if (value === null) {
    return "new activity";
  }

  if (value === 0) {
    return "flat";
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatPercent(value)}`;
}

function isPendingFulfillment(order: OrderRecord): boolean {
  return !["cancelled", "delivered"].includes(order.status);
}

function getPendingFulfillmentOrders(orders: OrderRecord[]): OrderRecord[] {
  return orders.filter(isPendingFulfillment);
}

function getPaidNotShippedOrders(orders: OrderRecord[]): OrderRecord[] {
  return orders.filter(
    (order) =>
      order.payment?.status === "paid" &&
      !["in_transit", "delivered"].includes(order.shipping?.status ?? "pending") &&
      !["cancelled", "delivered"].includes(order.status),
  );
}

function getUnpaidOrders(orders: OrderRecord[]): OrderRecord[] {
  return orders.filter((order) =>
    ["authorized", "pending"].includes(order.payment?.status ?? "pending"),
  );
}

function getFailedPaymentOrders(orders: OrderRecord[]): OrderRecord[] {
  return orders.filter((order) => order.payment?.status === "failed");
}

function buildContext(
  intent: AdminAiOperationsIntent,
  context: OperationsContext,
): AdminAiOperationsResponse["context"] {
  const inventoryLines = getInventoryLines(context.activeProducts);

  return {
    activeProducts: context.activeProducts.length,
    grossRevenue: getGrossRevenue(context.orders),
    intent,
    lowStockProducts: inventoryLines.filter((line) => line.stock <= LOW_STOCK_THRESHOLD).length,
    orders: context.orders.length,
    pendingFulfillment: getPendingFulfillmentOrders(context.orders).length,
  };
}

function buildResponse({
  body,
  catalogDrafts = [],
  context,
  intent,
  metrics = [],
  suggestions = [],
}: {
  body: string;
  catalogDrafts?: AdminAiCatalogDraft[];
  context: OperationsContext;
  intent: AdminAiOperationsIntent;
  metrics?: AdminAiOperationsMetric[];
  suggestions?: SupportChatProductSuggestion[];
}): AdminAiOperationsResponse {
  return {
    body,
    catalogDrafts: catalogDrafts.slice(0, MAX_CATALOG_DRAFT_COUNT),
    context: buildContext(intent, context),
    metrics,
    source: "backend_operations",
    suggestions: suggestions.slice(0, 4),
  };
}

function detectIntent(message: string): AdminAiOperationsIntent {
  if (isCatalogDraftRequest(message)) {
    return "catalog_draft";
  }

  if (includesAnyKeyword(message, STRATEGY_KEYWORDS)) {
    return "strategy";
  }

  if (includesAnyKeyword(message, REVENUE_COMPARE_KEYWORDS)) {
    return "revenue_compare";
  }

  if (includesAnyKeyword(message, RISK_KEYWORDS)) {
    return "risk";
  }

  if (includesAnyKeyword(message, FULFILLMENT_KEYWORDS)) {
    return "fulfillment";
  }

  if (includesAnyKeyword(message, REVENUE_KEYWORDS)) {
    return "revenue";
  }

  if (includesAnyKeyword(message, INVENTORY_KEYWORDS)) {
    return "inventory";
  }

  if (includesAnyKeyword(message, HELP_KEYWORDS)) {
    return "help";
  }

  if (includesAnyKeyword(message, GREETING_KEYWORDS)) {
    return "greeting";
  }

  return "summary";
}

function buildGreetingReply(context: OperationsContext, profile: AuthUserProfile) {
  return buildResponse({
    body: `Hi ${profile.fullName || "Admin"}, I am the Sovereign Operations AI. I can read the live order ledger and catalog context to summarize revenue, fulfillment pressure, low-stock pieces, and product lookup. I will not mutate store data automatically, so product and order changes still stay under your Operations controls.`,
    context,
    intent: "greeting",
    metrics: buildSummaryMetrics(context),
    suggestions: [
      pageSuggestion({
        href: "/operations",
        name: "Operations",
        priceLabel: "Open admin control surface",
        productId: "operations",
      }),
    ],
  });
}

function buildHelpReply(context: OperationsContext) {
  return buildResponse({
    body: "Try: \"revenue this month\", \"compare revenue vs last month\", \"suggest strategy\", \"add 10 more new products\", \"orders pending shipment\", \"low stock products\", or \"find Daytona\". I answer from current product and order data, then point you back to Operations for every write action.",
    context,
    intent: "help",
    metrics: buildSummaryMetrics(context),
    suggestions: [
      pageSuggestion({
        href: "/operations",
        name: "Operations",
        priceLabel: "Manage ledger and catalog",
        productId: "operations",
      }),
    ],
  });
}

function buildSummaryMetrics(context: OperationsContext): AdminAiOperationsMetric[] {
  const grossRevenue = getGrossRevenue(context.orders);
  const capturedRevenue = getCapturedRevenue(context.orders);
  const pendingFulfillment = getPendingFulfillmentOrders(context.orders).length;
  const lowStock = getInventoryLines(context.activeProducts).filter(
    (line) => line.stock <= LOW_STOCK_THRESHOLD,
  ).length;

  return [
    {
      label: "Gross revenue",
      tone: grossRevenue > 0 ? "positive" : "default",
      value: formatPrice(grossRevenue),
    },
    {
      label: "Captured revenue",
      tone: capturedRevenue > 0 ? "positive" : "default",
      value: formatPrice(capturedRevenue),
    },
    {
      label: "Pending fulfillment",
      tone: pendingFulfillment > 0 ? "warning" : "positive",
      value: String(pendingFulfillment),
    },
    {
      label: "Low stock",
      tone: lowStock > 0 ? "warning" : "positive",
      value: String(lowStock),
    },
  ];
}

function buildSummaryReply(context: OperationsContext): AdminAiOperationsResponse {
  const grossRevenue = getGrossRevenue(context.orders);
  const capturedRevenue = getCapturedRevenue(context.orders);
  const captureRate = grossRevenue > 0 ? capturedRevenue / grossRevenue : 0;
  const pendingFulfillment = getPendingFulfillmentOrders(context.orders);
  const lowStock = getInventoryLines(context.activeProducts).filter(
    (line) => line.stock <= LOW_STOCK_THRESHOLD,
  );
  const riskNote =
    pendingFulfillment.length > 0 || lowStock.length > 0
      ? `Priority: review ${pendingFulfillment.length} fulfillment case${pendingFulfillment.length === 1 ? "" : "s"} and ${lowStock.length} low-stock product${lowStock.length === 1 ? "" : "s"}.`
      : "Priority: operations look calm; keep monitoring new paid orders and stock movement.";

  return buildResponse({
    body: `Operations snapshot: ${context.orders.length} orders, ${context.activeProducts.length} active products, ${formatPrice(grossRevenue)} gross revenue, and ${formatPercent(captureRate)} captured payment rate. ${riskNote}`,
    context,
    intent: "summary",
    metrics: buildSummaryMetrics(context),
    suggestions: [
      pageSuggestion({
        href: "/operations",
        name: "Operations",
        priceLabel: "Review live dashboard",
        productId: "operations",
      }),
      ...lowStock.slice(0, 3).map((line) => productToSuggestion(line.product)),
    ],
  });
}

function buildRevenueReply(message: string, context: OperationsContext): AdminAiOperationsResponse {
  const timeframe = getTimeframe(message);
  const orders = filterOrdersByTimeframe(context.orders, timeframe);
  const grossRevenue = getGrossRevenue(orders);
  const capturedRevenue = getCapturedRevenue(orders);
  const pendingRevenue = grossRevenue - capturedRevenue;
  const paidOrders = orders.filter((order) => order.payment?.status === "paid");
  const averageTicket = orders.length > 0 ? grossRevenue / orders.length : 0;

  return buildResponse({
    body: `Revenue ${getTimeframeLabel(timeframe)}: ${formatPrice(grossRevenue)} gross across ${orders.length} order${orders.length === 1 ? "" : "s"}. Captured revenue is ${formatPrice(capturedRevenue)} from ${paidOrders.length} paid order${paidOrders.length === 1 ? "" : "s"}; ${formatPrice(pendingRevenue)} is still pending or not captured. Average ticket is ${formatPrice(averageTicket)}.`,
    context,
    intent: "revenue",
    metrics: [
      {
        label: "Gross",
        tone: grossRevenue > 0 ? "positive" : "default",
        value: formatPrice(grossRevenue),
      },
      {
        label: "Captured",
        tone: capturedRevenue > 0 ? "positive" : "default",
        value: formatPrice(capturedRevenue),
      },
      {
        label: "Pending",
        tone: pendingRevenue > 0 ? "warning" : "positive",
        value: formatPrice(pendingRevenue),
      },
      {
        label: "AOV",
        tone: averageTicket > 0 ? "default" : "default",
        value: formatPrice(averageTicket),
      },
    ],
    suggestions: [
      pageSuggestion({
        href: "/operations",
        name: "Sales Ledger",
        priceLabel: "Open revenue controls",
        productId: "sales-ledger",
      }),
    ],
  });
}

function buildRevenueComparisonReply(context: OperationsContext): AdminAiOperationsResponse {
  const { current, previous } = getCurrentAndPreviousMonthKeys();
  const currentOrders = getOrdersByMonth(context.orders, current);
  const previousOrders = getOrdersByMonth(context.orders, previous);
  const currentGross = getGrossRevenue(currentOrders);
  const previousGross = getGrossRevenue(previousOrders);
  const currentCaptured = getCapturedRevenue(currentOrders);
  const previousCaptured = getCapturedRevenue(previousOrders);
  const currentAov = currentOrders.length > 0 ? currentGross / currentOrders.length : 0;
  const previousAov = previousOrders.length > 0 ? previousGross / previousOrders.length : 0;
  const grossChange = percentChange(currentGross, previousGross);
  const capturedChange = percentChange(currentCaptured, previousCaptured);
  const orderChange = percentChange(currentOrders.length, previousOrders.length);
  const aovChange = percentChange(currentAov, previousAov);
  const direction =
    grossChange === null
      ? "new revenue activity"
      : grossChange > 0
        ? "revenue is expanding"
        : grossChange < 0
          ? "revenue is contracting"
          : "revenue is flat";

  return buildResponse({
    body: `Revenue comparison ${current} vs ${previous}: current gross is ${formatPrice(currentGross)} from ${currentOrders.length} order${currentOrders.length === 1 ? "" : "s"}, versus ${formatPrice(previousGross)} from ${previousOrders.length} order${previousOrders.length === 1 ? "" : "s"}. Gross movement is ${formatSignedDelta(currentGross - previousGross)} (${formatChangeLabel(grossChange)}); captured revenue movement is ${formatSignedDelta(currentCaptured - previousCaptured)} (${formatChangeLabel(capturedChange)}). AOV is ${formatPrice(currentAov)} vs ${formatPrice(previousAov)} (${formatChangeLabel(aovChange)}), so ${direction}.`,
    context,
    intent: "revenue_compare",
    metrics: [
      {
        label: "Gross delta",
        tone: grossChange === null || grossChange >= 0 ? "positive" : "critical",
        value: formatChangeLabel(grossChange),
      },
      {
        label: "Captured delta",
        tone: capturedChange === null || capturedChange >= 0 ? "positive" : "warning",
        value: formatChangeLabel(capturedChange),
      },
      {
        label: "Order delta",
        tone: orderChange === null || orderChange >= 0 ? "positive" : "warning",
        value: formatChangeLabel(orderChange),
      },
      {
        label: "AOV delta",
        tone: aovChange === null || aovChange >= 0 ? "positive" : "warning",
        value: formatChangeLabel(aovChange),
      },
    ],
    suggestions: [
      pageSuggestion({
        href: "/operations",
        name: "Revenue Momentum",
        priceLabel: "Review month-over-month ledger",
        productId: "revenue-momentum",
      }),
    ],
  });
}

function getProductDemandLines(context: OperationsContext): InventoryLine[] {
  const variantToProduct = new Map<string, ProductRecord>();
  const demandByProductId = new Map<string, number>();

  for (const product of context.activeProducts) {
    for (const variant of product.variants) {
      variantToProduct.set(variant.id, product);
    }
  }

  for (const order of context.orders) {
    if (order.status === "cancelled") {
      continue;
    }

    for (const item of order.items) {
      const product = variantToProduct.get(item.productVariantId);

      if (!product) {
        continue;
      }

      demandByProductId.set(
        product.id,
        (demandByProductId.get(product.id) ?? 0) + item.quantity,
      );
    }
  }

  return [...demandByProductId.entries()]
    .map(([productId, soldUnits]) => {
      const product = context.activeProducts.find((entry) => entry.id === productId);

      if (!product) {
        return null;
      }

      return {
        lowestPrice: getLowestProductPrice(product),
        product,
        stock: soldUnits,
      };
    })
    .filter((line): line is InventoryLine => Boolean(line))
    .sort((left, right) => right.stock - left.stock);
}

function normalizeCatalogIdentity(value: string): string {
  return normalizeForSearch(value).replace(/\s+/g, "");
}

function getExistingCatalogIdentities(context: OperationsContext): Set<string> {
  const identities = new Set<string>();

  for (const product of context.activeProducts) {
    identities.add(normalizeCatalogIdentity(product.name));

    for (const variant of product.variants) {
      identities.add(normalizeCatalogIdentity(variant.sku));
    }
  }

  return identities;
}

function draftCollidesWithCatalog(
  draft: AdminAiCatalogDraft,
  identities: Set<string>,
): boolean {
  if (identities.has(normalizeCatalogIdentity(draft.name))) {
    return true;
  }

  if (identities.has(normalizeCatalogIdentity(draft.reference))) {
    return true;
  }

  return draft.variants.some((variant) =>
    identities.has(normalizeCatalogIdentity(variant.sku)),
  );
}

function buildCatalogDraftBatch(
  context: OperationsContext,
  requestedCount: number,
): AdminAiCatalogDraft[] {
  const identities = getExistingCatalogIdentities(context);
  const selected: AdminAiCatalogDraft[] = [];

  for (const draft of CATALOG_DRAFT_CANDIDATES) {
    if (selected.length >= requestedCount) {
      break;
    }

    if (draftCollidesWithCatalog(draft, identities)) {
      continue;
    }

    selected.push(draft);
    identities.add(normalizeCatalogIdentity(draft.name));
    identities.add(normalizeCatalogIdentity(draft.reference));

    for (const variant of draft.variants) {
      identities.add(normalizeCatalogIdentity(variant.sku));
    }
  }

  return selected;
}

function buildStrategyReply(context: OperationsContext): AdminAiOperationsResponse {
  const lowStock = getInventoryLines(context.activeProducts).filter(
    (line) => line.stock <= LOW_STOCK_THRESHOLD,
  );
  const paidNotShipped = getPaidNotShippedOrders(context.orders);
  const failedPayments = getFailedPaymentOrders(context.orders);
  const demandLines = getProductDemandLines(context);
  const topDemand = demandLines[0];
  const catalogGap =
    lowStock.length > 0
      ? `Restock or source alternatives for ${lowStock.slice(0, 2).map((line) => line.product.name).join(" and ")} before demand leaks.`
      : "Catalog stock depth is acceptable; use new arrivals to widen brand/category coverage.";
  const fulfillmentMove =
    paidNotShipped.length > 0
      ? `Move ${paidNotShipped.length} paid-not-shipped order${paidNotShipped.length === 1 ? "" : "s"} first because paid clients expect operational certainty.`
      : "Fulfillment pressure is calm, so prioritize merchandising and conversion.";
  const revenueMove =
    topDemand
      ? `Lean homepage and marketplace exposure toward ${topDemand.product.name}, your strongest visible demand signal with ${topDemand.stock} unit${topDemand.stock === 1 ? "" : "s"} sold.`
      : "No clear demand leader yet; seed the catalog with balanced dress, sport, and daily references.";
  const paymentMove =
    failedPayments.length > 0
      ? `Follow up ${failedPayments.length} failed payment case${failedPayments.length === 1 ? "" : "s"} before adding more checkout friction.`
      : "Payment flow is stable; keep Stripe-card/wallet messaging clear and leave bank transfer locked until reconciliation is ready.";

  return buildResponse({
    body: `Recommended operating strategy: 1. ${fulfillmentMove} 2. ${catalogGap} 3. ${revenueMove} 4. ${paymentMove} For Catalog Manager, keep each imported watch tied to its real brand, reference, variant, SKU, and matching product image before publishing.`,
    context,
    intent: "strategy",
    metrics: [
      {
        label: "Paid not shipped",
        tone: paidNotShipped.length > 0 ? "warning" : "positive",
        value: String(paidNotShipped.length),
      },
      {
        label: "Low stock",
        tone: lowStock.length > 0 ? "warning" : "positive",
        value: String(lowStock.length),
      },
      {
        label: "Failed payments",
        tone: failedPayments.length > 0 ? "critical" : "positive",
        value: String(failedPayments.length),
      },
    ],
    suggestions: [
      pageSuggestion({
        href: "/operations#operations-products",
        name: "Catalog Manager",
        priceLabel: "Build the next product draft",
        productId: "catalog-manager",
      }),
      ...lowStock.slice(0, 3).map((line) => productToSuggestion(line.product)),
    ],
  });
}

function buildCatalogDraftReply(
  message: string,
  context: OperationsContext,
): AdminAiOperationsResponse {
  const requestedAmount = getRequestedCatalogDraftAmount(message);
  const requestedCount = getRequestedCatalogDraftCount(message);
  const catalogDrafts = buildCatalogDraftBatch(context, requestedCount);
  const lowStock = getInventoryLines(context.activeProducts).filter(
    (line) => line.stock <= LOW_STOCK_THRESHOLD,
  );
  const gapLabel =
    lowStock.length > 0
      ? `${lowStock[0].product.brand?.name ?? lowStock[0].product.brandId} / ${lowStock[0].product.category?.name ?? lowStock[0].product.categoryId}`
      : "sport-luxury chronograph and dress watch coverage";
  const draftCountLabel =
    catalogDrafts.length === requestedCount
      ? `${catalogDrafts.length}`
      : `${catalogDrafts.length} of ${requestedCount}`;
  const batchCapNote =
    requestedAmount > MAX_CATALOG_DRAFT_COUNT
      ? ` I capped this batch at ${MAX_CATALOG_DRAFT_COUNT} drafts so the admin can review, paginate, and publish safely instead of flooding the catalog. Ask for another batch after saving or removing drafts.`
      : "";

  return buildResponse({
    body:
      catalogDrafts.length > 0
        ? `Created ${draftCountLabel} Catalog Manager draft${catalogDrafts.length === 1 ? "" : "s"} around ${gapLabel}. Each draft includes brand, exact reference, variant SKU, price, stock, and a portrait product image candidate. Review the source reference and image match before saving through the normal product endpoint.${batchCapNote}`
        : "I could not create a fresh catalog draft because every available draft candidate collides with an existing product name, reference, or SKU. Add more source candidates before importing another batch.",
    catalogDrafts,
    context,
    intent: "catalog_draft",
    metrics: [
      {
        label: "Active products",
        tone: "default",
        value: String(context.activeProducts.length),
      },
      {
        label: "Low stock gaps",
        tone: lowStock.length > 0 ? "warning" : "positive",
        value: String(lowStock.length),
      },
    ],
    suggestions: [
      pageSuggestion({
        href: "/operations#operations-products",
        name: "Catalog Drafts",
        priceLabel: "Prefill product editor",
        productId: "catalog-drafts",
      }),
      ...lowStock.slice(0, 3).map((line) => productToSuggestion(line.product)),
    ],
  });
}

function buildInventoryReply(context: OperationsContext): AdminAiOperationsResponse {
  const inventoryLines = getInventoryLines(context.activeProducts);
  const lowStock = inventoryLines.filter((line) => line.stock > 0 && line.stock <= LOW_STOCK_THRESHOLD);
  const soldOut = inventoryLines.filter((line) => line.stock <= 0);
  const totalUnits = inventoryLines.reduce((sum, line) => sum + line.stock, 0);
  const inventoryValue = inventoryLines.reduce(
    (sum, line) => sum + (line.lowestPrice ?? 0) * line.stock,
    0,
  );
  const topRisk = [...soldOut, ...lowStock].slice(0, 3);
  const riskLine =
    topRisk.length > 0
      ? `Watch closely: ${topRisk.map((line) => `${line.product.name} (${line.stock})`).join(", ")}.`
      : "No product is currently inside the low-stock threshold.";

  return buildResponse({
    body: `Catalog inventory: ${context.activeProducts.length} active products, ${totalUnits} total units, and about ${formatPrice(inventoryValue)} in floor-value exposure using lowest variant price. ${lowStock.length} products are low stock and ${soldOut.length} are sold out. ${riskLine}`,
    context,
    intent: "inventory",
    metrics: [
      {
        label: "Active products",
        tone: "default",
        value: String(context.activeProducts.length),
      },
      {
        label: "Units",
        tone: totalUnits > 0 ? "positive" : "critical",
        value: String(totalUnits),
      },
      {
        label: "Low stock",
        tone: lowStock.length > 0 ? "warning" : "positive",
        value: String(lowStock.length),
      },
      {
        label: "Sold out",
        tone: soldOut.length > 0 ? "critical" : "positive",
        value: String(soldOut.length),
      },
    ],
    suggestions: topRisk.length > 0
      ? topRisk.map((line) => productToSuggestion(line.product))
      : [
          pageSuggestion({
            href: "/operations",
            name: "Catalog Shelf",
            priceLabel: "Manage inventory",
            productId: "catalog-shelf",
          }),
        ],
  });
}

function buildFulfillmentReply(context: OperationsContext): AdminAiOperationsResponse {
  const pendingFulfillment = getPendingFulfillmentOrders(context.orders);
  const paidNotShipped = getPaidNotShippedOrders(context.orders);
  const unpaid = getUnpaidOrders(context.orders);
  const failedPayments = getFailedPaymentOrders(context.orders);
  const topOrders = pendingFulfillment.slice(0, 3).map(
    (order) =>
      `${order.orderNumber} · ${formatStatus(order.status)} · payment ${formatStatus(order.payment?.status)} · shipping ${formatStatus(order.shipping?.status)}`,
  );
  const queueLine =
    topOrders.length > 0
      ? `Top queue: ${topOrders.join("; ")}.`
      : "No active fulfillment cases are waiting right now.";

  return buildResponse({
    body: `Fulfillment queue: ${pendingFulfillment.length} active order${pendingFulfillment.length === 1 ? "" : "s"}, ${paidNotShipped.length} paid-not-shipped case${paidNotShipped.length === 1 ? "" : "s"}, ${unpaid.length} unpaid order${unpaid.length === 1 ? "" : "s"}, and ${failedPayments.length} failed payment case${failedPayments.length === 1 ? "" : "s"}. ${queueLine}`,
    context,
    intent: "fulfillment",
    metrics: [
      {
        label: "Active queue",
        tone: pendingFulfillment.length > 0 ? "warning" : "positive",
        value: String(pendingFulfillment.length),
      },
      {
        label: "Paid not shipped",
        tone: paidNotShipped.length > 0 ? "warning" : "positive",
        value: String(paidNotShipped.length),
      },
      {
        label: "Unpaid",
        tone: unpaid.length > 0 ? "warning" : "positive",
        value: String(unpaid.length),
      },
      {
        label: "Failed",
        tone: failedPayments.length > 0 ? "critical" : "positive",
        value: String(failedPayments.length),
      },
    ],
    suggestions: [
      pageSuggestion({
        href: "/operations",
        name: "Sales Ledger",
        priceLabel: "Review fulfillment updates",
        productId: "sales-ledger",
      }),
    ],
  });
}

function extractProductLookupTerm(message: string): string {
  const normalized = normalizeForSearch(message);
  const stopWords = [
    "catalog",
    "find",
    "inventory",
    "lookup",
    "product",
    "search",
    "show",
    "sku",
    "stock",
    "variant",
    "san pham",
    "ton kho",
  ];

  return stopWords
    .reduce((term, word) => term.replace(new RegExp(`\\b${word}\\b`, "g"), " "), normalized)
    .replace(/\s+/g, " ")
    .trim();
}

function productMatchesTerm(product: ProductRecord, term: string): boolean {
  if (!term) {
    return false;
  }

  const tokens = term.split(/\s+/).filter((token) => token.length >= 2);
  const haystack = normalizeForSearch(
    `${getProductLabel(product)} ${product.type} ${product.description} ${product.variants
      .map((variant) => `${variant.sku} ${variant.color} ${variant.size}`)
      .join(" ")}`,
  );

  return tokens.every((token) => haystack.includes(token));
}

function getMemoryProductIds(memory: AdminAiOperationsMemoryMessage[]): string[] {
  return [
    ...new Set(
      memory
        .flatMap((message) => message.suggestions)
        .map((suggestion) => suggestion.productId)
        .filter((productId) => productId && !["operations", "sales-ledger", "catalog-shelf"].includes(productId)),
    ),
  ];
}

function buildProductLookupReply(
  message: string,
  memory: AdminAiOperationsMemoryMessage[],
  context: OperationsContext,
): AdminAiOperationsResponse {
  const term = extractProductLookupTerm(message);
  const memoryProductIds = getMemoryProductIds(memory);
  const memoryMatches = context.activeProducts.filter((product) =>
    memoryProductIds.includes(product.id),
  );
  const termMatches = context.activeProducts.filter((product) => productMatchesTerm(product, term));
  const matches = termMatches.length > 0 ? termMatches : memoryMatches;

  if (matches.length === 0) {
    return buildResponse({
      body: term
        ? `I could not match "${term}" in the active catalog. Try a model name, brand, SKU, size, or ask for "low stock products" to inspect the inventory queue.`
        : "Send a product name, brand, SKU, case size, or stock condition and I will inspect the catalog. Example: \"find Daytona\", \"low stock Rolex\", or \"SKU ROLE\".",
      context,
      intent: "product_lookup",
      metrics: buildSummaryMetrics(context),
      suggestions: [
        pageSuggestion({
          href: "/operations",
          name: "Catalog Shelf",
          priceLabel: "Search and edit products",
          productId: "catalog-shelf",
        }),
      ],
    });
  }

  const lines = matches.slice(0, 3).map((product) => {
    const stock = getProductStock(product);
    const price = getLowestProductPrice(product);

    return `${product.name}: ${stock} in stock, ${price !== null ? `from ${formatPrice(price)}` : "price unavailable"}${product.variants.length > 0 ? `, variants ${getProductVariantSummary(product)}` : ""}`;
  });

  return buildResponse({
    body: `Catalog match${matches.length === 1 ? "" : "es"}: ${lines.join(" | ")}. Use Operations to adjust copy, images, variants, pricing, or stock after confirming the exact reference.`,
    context,
    intent: "product_lookup",
    metrics: [
      {
        label: "Matches",
        tone: "default",
        value: String(matches.length),
      },
      {
        label: "First stock",
        tone: getProductStock(matches[0]) > LOW_STOCK_THRESHOLD ? "positive" : "warning",
        value: String(getProductStock(matches[0])),
      },
      {
        label: "Variants",
        tone: "default",
        value: String(matches[0].variants.length),
      },
    ],
    suggestions: matches.slice(0, 4).map(productToSuggestion),
  });
}

function buildRiskReply(context: OperationsContext): AdminAiOperationsResponse {
  const lowStock = getInventoryLines(context.activeProducts).filter(
    (line) => line.stock <= LOW_STOCK_THRESHOLD,
  );
  const paidNotShipped = getPaidNotShippedOrders(context.orders);
  const failedPayments = getFailedPaymentOrders(context.orders);
  const unpaid = getUnpaidOrders(context.orders);
  const priorities = [
    paidNotShipped.length > 0
      ? `${paidNotShipped.length} paid order${paidNotShipped.length === 1 ? "" : "s"} still need shipment movement`
      : null,
    failedPayments.length > 0
      ? `${failedPayments.length} payment failure${failedPayments.length === 1 ? "" : "s"} need customer follow-up`
      : null,
    lowStock.length > 0
      ? `${lowStock.length} product${lowStock.length === 1 ? "" : "s"} are low or sold out`
      : null,
    unpaid.length > 0
      ? `${unpaid.length} unpaid order${unpaid.length === 1 ? "" : "s"} should be reviewed before fulfillment`
      : null,
  ].filter(Boolean);

  return buildResponse({
    body:
      priorities.length > 0
        ? `Operations priorities: ${priorities.join("; ")}. Start with paid-not-shipped orders, then failed payments, then low-stock references because those affect customer trust and sell-through first.`
        : "No urgent operations risk is visible in the current ledger. Keep watching for new paid orders, stock drops, and failed payments.",
    context,
    intent: "risk",
    metrics: [
      {
        label: "Paid not shipped",
        tone: paidNotShipped.length > 0 ? "warning" : "positive",
        value: String(paidNotShipped.length),
      },
      {
        label: "Failed payment",
        tone: failedPayments.length > 0 ? "critical" : "positive",
        value: String(failedPayments.length),
      },
      {
        label: "Low stock",
        tone: lowStock.length > 0 ? "warning" : "positive",
        value: String(lowStock.length),
      },
    ],
    suggestions: [
      pageSuggestion({
        href: "/operations",
        name: "Operations",
        priceLabel: "Open control surface",
        productId: "operations",
      }),
      ...lowStock.slice(0, 3).map((line) => productToSuggestion(line.product)),
    ],
  });
}

export async function buildAdminAiOperationsReply(
  profile: AuthUserProfile,
  message: string,
  memory: AdminAiOperationsMemoryMessage[] = [],
): Promise<AdminAiOperationsResponse> {
  const [orders, products] = await Promise.all([
    listOrders(),
    listProducts({}),
  ]);
  const context: OperationsContext = {
    activeProducts: products.filter((product) => !product.deletedAt),
    orders,
    products,
  };
  const intent = detectIntent(message);

  if (intent === "greeting") {
    return buildGreetingReply(context, profile);
  }

  if (intent === "help") {
    return buildHelpReply(context);
  }

  if (intent === "revenue") {
    return buildRevenueReply(message, context);
  }

  if (intent === "revenue_compare") {
    return buildRevenueComparisonReply(context);
  }

  if (intent === "strategy") {
    return buildStrategyReply(context);
  }

  if (intent === "catalog_draft") {
    return buildCatalogDraftReply(message, context);
  }

  if (intent === "fulfillment") {
    return buildFulfillmentReply(context);
  }

  if (intent === "risk") {
    return buildRiskReply(context);
  }

  if (intent === "inventory") {
    const lookupTerm = extractProductLookupTerm(message);

    if (lookupTerm && !/\b(?:low stock|out of stock|inventory|catalog|ton kho)\b/.test(normalizeForSearch(message))) {
      return buildProductLookupReply(message, memory, context);
    }

    return buildInventoryReply(context);
  }

  if (intent === "product_lookup") {
    return buildProductLookupReply(message, memory, context);
  }

  return buildSummaryReply(context);
}
