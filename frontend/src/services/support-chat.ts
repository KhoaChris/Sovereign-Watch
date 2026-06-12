import {
  addDoc,
  collection,
  doc,
  type DocumentSnapshot,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  writeBatch,
  type DocumentData,
  type FirestoreError,
  type QueryDocumentSnapshot,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";

import { getFirebaseClientDb } from "./firebase-client";
import { storefrontApi } from "./api";
import type {
  AuthUserProfile,
  ProductRecord,
  SupportChatChannel,
  SupportChatMessage,
  SupportChatProductSuggestion,
  SupportConversation,
  SupportConversationMode,
  SupportSenderRole,
} from "../shared";

export interface AdminPresenceState {
  email: string;
  name: string;
  online: boolean;
  updatedAt: string;
  userId: string;
}

export interface SupportConversationPage {
  conversations: SupportConversation[];
  cursor: SupportConversationPageCursor | null;
  hasMore: boolean;
}

interface SendCustomerMessageInput {
  adminOnline: boolean;
  body: string;
  channel?: SupportChatChannel;
  user: AuthUserProfile;
}

interface SendAdminMessageInput {
  admin: AuthUserProfile;
  body: string;
  conversationId: string;
}

interface BotReply {
  body: string;
  suggestions: SupportChatProductSuggestion[];
}

export type SupportConversationPageCursor = QueryDocumentSnapshot<DocumentData>;

const ADMIN_PRESENCE_DOC_ID = "admin";
const ADMIN_PRESENCE_STALE_MS = 75_000;
const CONVERSATIONS_COLLECTION = "supportConversations";
const CONVERSATION_PAGE_SIZE = 25;
const MESSAGE_MAX_LENGTH = 1_000;
const MESSAGE_RATE_LIMIT_MAX = 4;
const MESSAGE_RATE_LIMIT_WINDOW_MS = 15_000;
const MESSAGES_COLLECTION = "messages";
const senderMessageWindows = new Map<string, number[]>();

const BLOCKED_CONTENT_PATTERNS = [
  /\b(?:fuck|shit|bitch|asshole)\b/i,
  /\b(?:dit|djt|dm|dcm|l[oô]n|cac|c[aă]c)\b/i,
];
const SUSPICIOUS_URL_PATTERN = /https?:\/\/|www\./gi;

const PRODUCT_KEYWORDS = [
  "available",
  "co hang",
  "có hàng",
  "dong ho",
  "đồng hồ",
  "find",
  "kiem",
  "kiếm",
  "mau",
  "mẫu",
  "product",
  "reference",
  "rolex",
  "search",
  "san pham",
  "sản phẩm",
  "tim",
  "tìm",
  "watch",
];
const PRICE_KEYWORDS = ["bao gia", "báo giá", "bao nhiêu", "cost", "gia", "giá", "price"];
const SHIPPING_KEYWORDS = [
  "delivery",
  "giao",
  "return",
  "shipping",
  "ship",
  "trả",
  "tra hang",
  "trả hàng",
  "vận chuyển",
  "van chuyen",
];
const PAYMENT_KEYWORDS = [
  "bank",
  "card",
  "cod",
  "stripe",
  "thanh toan",
  "thanh toán",
  "transfer",
  "wallet",
];
const ORDER_KEYWORDS = [
  "don hang",
  "đơn hàng",
  "ma don",
  "mã đơn",
  "order",
  "status",
  "tracking",
];
const WARRANTY_KEYWORDS = [
  "bao hanh",
  "bảo hành",
  "service",
  "sua",
  "sửa",
  "warranty",
];
const AUTHENTICITY_KEYWORDS = [
  "auth",
  "authentic",
  "chinh hang",
  "chính hãng",
  "giay to",
  "giấy tờ",
  "kiem dinh",
  "kiểm định",
  "legit",
  "original",
  "zin",
];
const CONTACT_KEYWORDS = [
  "admin",
  "contact",
  "gap nguoi",
  "gặp người",
  "hotline",
  "lien he",
  "liên hệ",
  "nhan vien",
  "nhân viên",
  "support",
  "tu van",
  "tư vấn",
];
const GREETING_KEYWORDS = ["alo", "chao", "chào", "hello", "hi", "xin chao", "xin chào"];
const SIZE_KEYWORDS = ["36mm", "38mm", "40mm", "41mm", "42mm", "size", "wrist"];
const DRESS_WATCH_KEYWORDS = ["dress", "dress watch", "formal", "lich su", "lịch sự"];

const SEARCH_STOP_WORDS = [
  "available",
  "bao",
  "bao gia",
  "bao nhieu",
  "báo",
  "báo giá",
  "bao nhiêu",
  "cho",
  "co",
  "có",
  "cost",
  "dong ho",
  "đồng hồ",
  "find",
  "gia",
  "giá",
  "giup",
  "giúp",
  "kiem",
  "kiếm",
  "mau",
  "mẫu",
  "minh",
  "mình",
  "price",
  "product",
  "reference",
  "search",
  "san pham",
  "sản phẩm",
  "tim",
  "tìm",
  "toi",
  "tôi",
  "watch",
  "xin",
];

function toIsoDate(value: unknown): string {
  if (!value) {
    return new Date().toISOString();
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof (value as Timestamp).toDate === "function") {
    return (value as Timestamp).toDate().toISOString();
  }

  return new Date().toISOString();
}

function toMillis(value: unknown): number {
  if (!value) {
    return 0;
  }

  if (typeof value === "string") {
    return new Date(value).getTime();
  }

  if (typeof (value as Timestamp).toMillis === "function") {
    return (value as Timestamp).toMillis();
  }

  if (typeof (value as Timestamp).toDate === "function") {
    return (value as Timestamp).toDate().getTime();
  }

  return 0;
}

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

function prepareOutboundMessageBody(body: string): {
  body: string;
  moderationFlags: string[];
} {
  const normalizedBody = body.replace(/\s+/g, " ").trim();

  if (!normalizedBody) {
    throw new Error("Message cannot be empty.");
  }

  if (normalizedBody.length > MESSAGE_MAX_LENGTH) {
    throw new Error(`Message is too long. Keep it under ${MESSAGE_MAX_LENGTH} characters.`);
  }

  if (BLOCKED_CONTENT_PATTERNS.some((pattern) => pattern.test(normalizedBody))) {
    throw new Error("Message was blocked by the support desk content filter.");
  }

  const urlMatches = normalizedBody.match(SUSPICIOUS_URL_PATTERN) ?? [];
  const moderationFlags = [
    ...(urlMatches.length > 0 ? ["external-link"] : []),
    ...(urlMatches.length > 2 ? ["link-spam"] : []),
    ...(/(.)\1{8,}/.test(normalizedBody) ? ["repeated-characters"] : []),
  ];

  if (urlMatches.length > 2) {
    throw new Error("Too many external links in one support message.");
  }

  return {
    body: normalizedBody,
    moderationFlags,
  };
}

function assertMessageRateLimit(senderId: string): void {
  const now = Date.now();
  const windowStart = now - MESSAGE_RATE_LIMIT_WINDOW_MS;
  const recentMessages = (senderMessageWindows.get(senderId) ?? []).filter(
    (timestamp) => timestamp > windowStart,
  );

  if (recentMessages.length >= MESSAGE_RATE_LIMIT_MAX) {
    const retryAt = recentMessages[0] + MESSAGE_RATE_LIMIT_WINDOW_MS;
    const retryInSeconds = Math.max(1, Math.ceil((retryAt - now) / 1_000));

    throw new Error(`Please slow down. You can send another message in ${retryInSeconds}s.`);
  }

  recentMessages.push(now);
  senderMessageWindows.set(senderId, recentMessages);
}

function mapConversationSnapshot(
  snapshot: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>,
): SupportConversation {
  const data = snapshot.data() ?? {};

  return {
    assignedAdminEmail: String(data.assignedAdminEmail ?? ""),
    assignedAdminId: data.assignedAdminId ? String(data.assignedAdminId) : null,
    assignedAdminName: String(data.assignedAdminName ?? ""),
    archivedAt: data.archivedAt ? toIsoDate(data.archivedAt) : null,
    archivedByAdminId: data.archivedByAdminId ? String(data.archivedByAdminId) : null,
    archivedByAdminName: String(data.archivedByAdminName ?? ""),
    createdAt: toIsoDate(data.createdAt),
    id: snapshot.id,
    lastMessage: String(data.lastMessage ?? ""),
    lastAdminMessageAt: data.lastAdminMessageAt ? toIsoDate(data.lastAdminMessageAt) : null,
    lastBotMessageAt: data.lastBotMessageAt ? toIsoDate(data.lastBotMessageAt) : null,
    lastCustomerMessageAt: data.lastCustomerMessageAt
      ? toIsoDate(data.lastCustomerMessageAt)
      : null,
    lastMessageAt: toIsoDate(data.lastMessageAt),
    messageCount: Number(data.messageCount ?? 0),
    mode: (data.mode === "human" ? "human" : "bot") satisfies SupportConversationMode,
    moderationFlagCount: Number(data.moderationFlagCount ?? 0),
    status:
      data.status === "closed" || data.status === "archived"
        ? data.status
        : "open",
    unreadForAdmin: Number(data.unreadForAdmin ?? 0),
    unreadForUser: Number(data.unreadForUser ?? 0),
    updatedAt: toIsoDate(data.updatedAt),
    userEmail: String(data.userEmail ?? ""),
    userId: String(data.userId ?? snapshot.id),
    userName: String(data.userName ?? "Watchroom Client"),
  };
}

function mapMessageSnapshot(
  snapshot: QueryDocumentSnapshot<DocumentData>,
): SupportChatMessage {
  const data = snapshot.data();
  const senderRole: SupportSenderRole =
    data.senderRole === "admin" || data.senderRole === "bot"
      ? data.senderRole
      : "user";
  const channel = getMessageChannel(data, senderRole);

  return {
    body: String(data.body ?? ""),
    channel,
    conversationId: String(data.conversationId ?? ""),
    createdAt: toIsoDate(data.createdAt),
    id: snapshot.id,
    senderId: String(data.senderId ?? ""),
    senderName: String(data.senderName ?? ""),
    senderRole,
    moderationFlags: Array.isArray(data.moderationFlags) ? data.moderationFlags : [],
    suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
  };
}

function getMessageChannel(
  data: DocumentData,
  senderRole: SupportSenderRole,
): SupportChatChannel {
  if (data.channel === "ai" || data.channel === "admin") {
    return data.channel;
  }

  return senderRole === "bot" ? "ai" : "admin";
}

function mapAdminPresence(data: DocumentData | undefined): AdminPresenceState {
  if (!data) {
    return {
      email: "",
      name: "",
      online: false,
      updatedAt: "",
      userId: "",
    };
  }

  const updatedAt = toIsoDate(data.updatedAt);
  const isFresh = Date.now() - new Date(updatedAt).getTime() < ADMIN_PRESENCE_STALE_MS;

  return {
    email: String(data.email ?? ""),
    name: String(data.name ?? ""),
    online: Boolean(data.online) && isFresh,
    updatedAt,
    userId: String(data.userId ?? ""),
  };
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

function productToSuggestion(product: ProductRecord): SupportChatProductSuggestion {
  return {
    href: `/collection/${product.id}`,
    image: product.images[0] ?? "",
    name: product.name,
    priceLabel: formatPrice(getLowestProductPrice(product)),
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
  const availableCount = products.filter((product) =>
    product.variants.some((variant) => variant.stockQuantity > 0),
  ).length;

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
  facets: Array<{ id: string; label: string }>,
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

async function getProductMatches(body: string): Promise<{
  label: string;
  products: ProductRecord[];
  searchTerm: string;
  wasExactMatch: boolean;
}> {
  const searchTerm = extractSearchTerm(body);
  const sort = includesAnyKeyword(body, PRICE_KEYWORDS) ? "price-asc" : "newest";
  const initialDiscovery = await storefrontApi.getProductDiscovery({
    availability: "all",
    search: searchTerm || undefined,
    sort,
  });

  if (initialDiscovery.items.length > 0) {
    return {
      label: searchTerm || "your request",
      products: initialDiscovery.items,
      searchTerm,
      wasExactMatch: true,
    };
  }

  const brandMatch = findFacetMatch(searchTerm || body, initialDiscovery.facets.brands);

  if (brandMatch) {
    const brandDiscovery = await storefrontApi.getProductDiscovery({
      availability: "all",
      brand: brandMatch.id,
      sort,
    });

    return {
      label: brandMatch.label,
      products: brandDiscovery.items,
      searchTerm,
      wasExactMatch: brandDiscovery.items.length > 0,
    };
  }

  const categoryMatch = findFacetMatch(searchTerm || body, initialDiscovery.facets.categories);

  if (categoryMatch) {
    const categoryDiscovery = await storefrontApi.getProductDiscovery({
      availability: "all",
      category: categoryMatch.id,
      sort,
    });

    return {
      label: categoryMatch.label,
      products: categoryDiscovery.items,
      searchTerm,
      wasExactMatch: categoryDiscovery.items.length > 0,
    };
  }

  if (includesAnyKeyword(body, DRESS_WATCH_KEYWORDS)) {
    const allDiscovery = await storefrontApi.getProductDiscovery({
      availability: "all",
      sort: "price-asc",
    });

    const dressLikeProducts = allDiscovery.items.filter((product) => {
      const haystack = normalizeForSearch(
        `${product.name} ${product.description} ${product.type} ${product.brandId} ${product.categoryId}`,
      );

      return (
        haystack.includes("dress") ||
        haystack.includes("fashion") ||
        haystack.includes("luxury") ||
        haystack.includes("oyster")
      );
    });

    return {
      label: "dress watch",
      products: dressLikeProducts.length > 0 ? dressLikeProducts : allDiscovery.items,
      searchTerm,
      wasExactMatch: dressLikeProducts.length > 0,
    };
  }

  return {
    label: searchTerm || "your request",
    products: [],
    searchTerm,
    wasExactMatch: false,
  };
}

async function buildBotReply(body: string): Promise<BotReply> {
  const asksAboutProducts =
    includesAnyKeyword(body, PRODUCT_KEYWORDS) ||
    includesAnyKeyword(body, PRICE_KEYWORDS) ||
    includesAnyKeyword(body, DRESS_WATCH_KEYWORDS) ||
    includesAnyKeyword(body, SIZE_KEYWORDS);
  const asksAboutShipping = includesAnyKeyword(body, SHIPPING_KEYWORDS);
  const asksAboutPayment = includesAnyKeyword(body, PAYMENT_KEYWORDS);
  const asksAboutOrder = includesAnyKeyword(body, ORDER_KEYWORDS);
  const asksAboutWarranty = includesAnyKeyword(body, WARRANTY_KEYWORDS);
  const asksAboutAuthenticity = includesAnyKeyword(body, AUTHENTICITY_KEYWORDS);
  const asksForContact = includesAnyKeyword(body, CONTACT_KEYWORDS);
  const saysHello = includesAnyKeyword(body, GREETING_KEYWORDS);

  if (asksAboutShipping) {
    return {
      body: "Shipping is confirmed by the desk based on the delivery address and order status. If your order already has tracking, open Orders for updates; for returns, review Shipping & Returns.",
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
      ],
    };
  }

  if (asksAboutPayment) {
    return {
      body: "Checkout currently supports card and wallet payments through Stripe, plus COD for selected cases. Bank transfer is temporarily disabled until reconciliation is fully handled.",
      suggestions: [
        pageSuggestion({
          href: "/cart",
          name: "Reserve Cart",
          priceLabel: "Checkout",
          productId: "cart",
        }),
      ],
    };
  }

  if (asksAboutOrder) {
    return {
      body: "Open Orders to review reserve, payment, and shipping status. If you need a desk check, send the order number or checkout email in this chat.",
      suggestions: [
        pageSuggestion({
          href: "/orders",
          name: "Orders",
          priceLabel: "Order ledger",
          productId: "orders",
        }),
      ],
    };
  }

  if (asksAboutWarranty || asksAboutAuthenticity) {
    return {
      body: asksAboutAuthenticity
        ? "For authenticity and documentation, the desk confirms each watch by serial, card, box, service history, and detailed photos. Send a model or reference and I can suggest related pieces first."
        : "For warranty or service questions, the desk checks the exact watch and handover condition. Send the model or reference to confirm the available support scope.",
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

  if (asksAboutProducts) {
    const result = await getProductMatches(body);
    const suggestions = result.products.slice(0, 3).map(productToSuggestion);

    if (suggestions.length > 0) {
      const priceRange = getProductPriceRange(result.products);
      const inventory = describeInventory(result.products);
      const lead = result.wasExactMatch
        ? `I found ${result.products.length} ${result.label} option${result.products.length === 1 ? "" : "s"}`
        : `I did not find an exact match for "${result.searchTerm || body}", but these are the closest options`;

      return {
        body: includesAnyKeyword(body, PRICE_KEYWORDS)
          ? `${lead}. The current indicative range is ${priceRange}; inventory is ${inventory}. The desk will confirm final pricing and availability when online.`
          : `${lead}. I added up to 3 suggestions below so you can open details, sizes, and availability quickly.`,
        suggestions,
      };
    }

    return {
      body: "I could not find a clear match in the current inventory. Send a brand, reference, case size, or target budget and I will narrow the search.",
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

  if (asksForContact) {
    return {
      body: "I noted that you would like desk support. When an admin is online, this conversation moves to the live desk; you can leave a phone number, order number, or watch reference here.",
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

  if (saysHello) {
    return {
      body: "Hello, I am the Sovereign support bot. I can help with pricing, product search, shipping, payment, orders, warranty, and documentation before the live desk joins.",
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

  return {
    body: "I have noted your message. Try prompts like “Rolex pricing”, “Find a dress watch”, “Shipping”, “Pay by card”, “Check my order”, or “How does warranty work?”.",
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

function conversationRef(conversationId: string) {
  return doc(getFirebaseClientDb(), CONVERSATIONS_COLLECTION, conversationId);
}

function messagesRef(conversationId: string) {
  return collection(conversationRef(conversationId), MESSAGES_COLLECTION);
}

export function subscribeAdminPresence(
  onChange: (presence: AdminPresenceState) => void,
  onError?: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    doc(getFirebaseClientDb(), "supportPresence", ADMIN_PRESENCE_DOC_ID),
    (snapshot) => onChange(mapAdminPresence(snapshot.data())),
    onError,
  );
}

export function subscribeCustomerConversation(
  userId: string,
  onChange: (conversation: SupportConversation | null) => void,
  onError?: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    conversationRef(userId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onChange(null);
        return;
      }

      onChange(mapConversationSnapshot(snapshot));
    },
    onError,
  );
}

export function subscribeSupportConversations(
  onChange: (page: SupportConversationPage) => void,
  onError?: (error: FirestoreError) => void,
  pageSize = CONVERSATION_PAGE_SIZE,
): Unsubscribe {
  const conversationsQuery = query(
    collection(getFirebaseClientDb(), CONVERSATIONS_COLLECTION),
    orderBy("updatedAt", "desc"),
    limit(pageSize + 1),
  );

  return onSnapshot(
    conversationsQuery,
    (snapshot) => {
      const visibleDocs = snapshot.docs.slice(0, pageSize);

      onChange({
        conversations: visibleDocs.map(mapConversationSnapshot),
        cursor: visibleDocs.at(-1) ?? null,
        hasMore: snapshot.docs.length > pageSize,
      });
    },
    onError,
  );
}

export async function loadMoreSupportConversations(
  cursor: SupportConversationPageCursor | null,
  pageSize = CONVERSATION_PAGE_SIZE,
): Promise<SupportConversationPage> {
  if (!cursor) {
    return {
      conversations: [],
      cursor: null,
      hasMore: false,
    };
  }

  const snapshot = await getDocs(
    query(
      collection(getFirebaseClientDb(), CONVERSATIONS_COLLECTION),
      orderBy("updatedAt", "desc"),
      startAfter(cursor),
      limit(pageSize + 1),
    ),
  );
  const visibleDocs = snapshot.docs.slice(0, pageSize);

  return {
    conversations: visibleDocs.map(mapConversationSnapshot),
    cursor: visibleDocs.at(-1) ?? null,
    hasMore: snapshot.docs.length > pageSize,
  };
}

export function subscribeSupportMessages(
  conversationId: string,
  onChange: (messages: SupportChatMessage[]) => void,
  onError?: (error: FirestoreError) => void,
): Unsubscribe {
  const messagesQuery = query(
    messagesRef(conversationId),
    orderBy("createdAt", "asc"),
    limit(80),
  );

  return onSnapshot(
    messagesQuery,
    (snapshot) => onChange(snapshot.docs.map(mapMessageSnapshot)),
    onError,
  );
}

export async function setAdminPresence(
  admin: AuthUserProfile,
  online: boolean,
): Promise<void> {
  await setDoc(
    doc(getFirebaseClientDb(), "supportPresence", ADMIN_PRESENCE_DOC_ID),
    {
      email: admin.email,
      name: admin.fullName,
      online,
      updatedAt: serverTimestamp(),
      userId: admin.id,
    },
    { merge: true },
  );
}

export async function sendCustomerSupportMessage({
  adminOnline,
  body,
  channel,
  user,
}: SendCustomerMessageInput): Promise<void> {
  const { body: trimmedBody, moderationFlags } = prepareOutboundMessageBody(body);

  assertMessageRateLimit(user.id);

  const ref = conversationRef(user.id);
  const existingConversation = await getDoc(ref);
  const messageRef = doc(messagesRef(user.id));
  const messageChannel: SupportChatChannel = channel ?? (adminOnline ? "admin" : "ai");
  const mode: SupportConversationMode = messageChannel === "admin" ? "human" : "bot";
  const batch = writeBatch(getFirebaseClientDb());

  if (messageChannel === "admin" && !adminOnline) {
    throw new Error("The admin desk is offline. Switch to AI assistant for immediate help.");
  }

  batch.set(
    ref,
    {
      assignedAdminEmail: existingConversation.data()?.assignedAdminEmail ?? "",
      assignedAdminId: existingConversation.data()?.assignedAdminId ?? null,
      assignedAdminName: existingConversation.data()?.assignedAdminName ?? "",
      archivedAt: null,
      archivedByAdminId: null,
      archivedByAdminName: "",
      createdAt: existingConversation.exists()
        ? existingConversation.data().createdAt
        : serverTimestamp(),
      id: user.id,
      lastCustomerMessageAt: serverTimestamp(),
      lastMessage: trimmedBody,
      lastMessageAt: serverTimestamp(),
      messageCount: increment(1),
      mode,
      moderationFlagCount: increment(moderationFlags.length > 0 ? 1 : 0),
      status: "open",
      unreadForAdmin: increment(1),
      unreadForUser: 0,
      updatedAt: serverTimestamp(),
      userEmail: user.email,
      userId: user.id,
      userName: user.fullName || user.email,
    },
    { merge: true },
  );
  batch.set(messageRef, {
    body: trimmedBody,
    channel: messageChannel,
    conversationId: user.id,
    createdAt: serverTimestamp(),
    id: messageRef.id,
    senderId: user.id,
    senderName: user.fullName || user.email,
    senderRole: "user",
    moderationFlags,
    suggestions: [],
  });

  await batch.commit();

  if (messageChannel === "admin") {
    return;
  }

  const botReply = await buildBotReply(trimmedBody);

  await addDoc(messagesRef(user.id), {
    body: botReply.body,
    channel: "ai",
    conversationId: user.id,
    createdAt: serverTimestamp(),
    moderationFlags: [],
    senderId: "support-bot",
    senderName: "Sovereign bot",
    senderRole: "bot",
    suggestions: botReply.suggestions,
  });
  await setDoc(
    ref,
    {
      lastBotMessageAt: serverTimestamp(),
      lastMessage: botReply.body,
      lastMessageAt: serverTimestamp(),
      messageCount: increment(1),
      mode: "bot",
      unreadForUser: increment(1),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function sendAdminSupportMessage({
  admin,
  body,
  conversationId,
}: SendAdminMessageInput): Promise<void> {
  const { body: trimmedBody, moderationFlags } = prepareOutboundMessageBody(body);

  assertMessageRateLimit(admin.id);

  const ref = conversationRef(conversationId);
  const messageRef = doc(messagesRef(conversationId));
  const batch = writeBatch(getFirebaseClientDb());

  batch.set(messageRef, {
    body: trimmedBody,
    channel: "admin",
    conversationId,
    createdAt: serverTimestamp(),
    id: messageRef.id,
    senderId: admin.id,
    senderName: admin.fullName || admin.email,
    senderRole: "admin",
    moderationFlags,
    suggestions: [],
  });
  batch.set(
    ref,
    {
      assignedAdminEmail: admin.email,
      assignedAdminId: admin.id,
      assignedAdminName: admin.fullName || admin.email,
      archivedAt: null,
      archivedByAdminId: null,
      archivedByAdminName: "",
      lastAdminMessageAt: serverTimestamp(),
      lastMessage: trimmedBody,
      lastMessageAt: serverTimestamp(),
      messageCount: increment(1),
      mode: "human",
      moderationFlagCount: increment(moderationFlags.length > 0 ? 1 : 0),
      status: "open",
      unreadForAdmin: 0,
      unreadForUser: increment(1),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await batch.commit();
}

export async function markSupportConversationRead(
  conversationId: string,
  role: "admin" | "user",
): Promise<void> {
  await updateDoc(conversationRef(conversationId), {
    [role === "admin" ? "unreadForAdmin" : "unreadForUser"]: 0,
    updatedAt: serverTimestamp(),
  });
}

export async function setSupportConversationArchived({
  admin,
  archived,
  conversationId,
}: {
  admin: AuthUserProfile;
  archived: boolean;
  conversationId: string;
}): Promise<void> {
  await setDoc(
    conversationRef(conversationId),
    {
      archivedAt: archived ? serverTimestamp() : null,
      archivedByAdminId: archived ? admin.id : null,
      archivedByAdminName: archived ? admin.fullName || admin.email : "",
      status: archived ? "archived" : "open",
      unreadForAdmin: archived ? 0 : increment(0),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function clearSupportConversationHistory(
  conversationId: string,
  channel?: SupportChatChannel,
): Promise<void> {
  const db = getFirebaseClientDb();
  const snapshot = await getDocs(messagesRef(conversationId));
  const batchSize = 450;
  const docsToDelete = channel
    ? snapshot.docs.filter((message) => {
        const data = message.data();
        const senderRole: SupportSenderRole =
          data.senderRole === "admin" || data.senderRole === "bot"
            ? data.senderRole
            : "user";

        return getMessageChannel(data, senderRole) === channel;
      })
    : snapshot.docs;
  const deleteIds = new Set(docsToDelete.map((message) => message.id));
  const remainingDocs = snapshot.docs.filter((message) => !deleteIds.has(message.id));

  for (let index = 0; index < docsToDelete.length; index += batchSize) {
    const batch = writeBatch(db);
    const chunk = docsToDelete.slice(index, index + batchSize);

    chunk.forEach((message) => batch.delete(message.ref));
    await batch.commit();
  }

  const latestMessage = [...remainingDocs].sort(
    (left, right) =>
      toMillis(left.data().createdAt) - toMillis(right.data().createdAt),
  ).at(-1);
  const latestData = latestMessage?.data();
  const latestSenderRole: SupportSenderRole =
    latestData?.senderRole === "admin" || latestData?.senderRole === "bot"
      ? latestData.senderRole
      : "user";
  const latestChannel = latestData
    ? getMessageChannel(latestData, latestSenderRole)
    : "ai";
  const moderationFlagCount = remainingDocs.filter((message) => {
    const flags = message.data().moderationFlags;

    return Array.isArray(flags) && flags.length > 0;
  }).length;

  await setDoc(
    conversationRef(conversationId),
    {
      lastMessage: latestData ? String(latestData.body ?? "") : "",
      lastMessageAt: latestData?.createdAt ?? serverTimestamp(),
      messageCount: remainingDocs.length,
      mode: latestChannel === "admin" ? "human" : "bot",
      moderationFlagCount,
      unreadForAdmin: 0,
      unreadForUser: 0,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
