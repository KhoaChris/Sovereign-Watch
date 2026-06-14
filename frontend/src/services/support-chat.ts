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
  AiConciergeMemoryMessage,
  AuthUserProfile,
  CartItemRecord,
  CartRecord,
  FavoriteRecord,
  ProductRecord,
  ProductVariant,
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
  cart?: CartRecord;
  favorites?: FavoriteRecord;
  suggestions: SupportChatProductSuggestion[];
}

interface ConciergeIntent {
  budgetMax?: number;
  budgetMin?: number;
  occasion: "collector" | "daily" | "formal" | "sport" | null;
  size?: string;
  wantsAvailableOnly: boolean;
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
export const SUPPORT_CHAT_CART_UPDATED_EVENT = "watchroom:cart-updated";
export const SUPPORT_CHAT_FAVORITES_UPDATED_EVENT = "watchroom:favorites-updated";
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
const PRICE_KEYWORDS = [
  "bao gia",
  "báo giá",
  "bao nhiêu",
  "below",
  "budget",
  "cost",
  "duoi",
  "dưới",
  "gia",
  "giá",
  "less than",
  "max",
  "price",
  "under",
  "up to",
];
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
const AVAILABLE_ONLY_KEYWORDS = [
  "available now",
  "available",
  "co hang",
  "có hàng",
  "in stock",
  "ready",
  "san hang",
  "sẵn hàng",
];
const DAILY_WATCH_KEYWORDS = ["daily", "everyday", "wear daily", "hằng ngày", "hang ngay"];
const SPORT_WATCH_KEYWORDS = ["chrono", "chronograph", "sport", "sports", "rubber"];
const COLLECTOR_WATCH_KEYWORDS = [
  "allocation",
  "collector",
  "investment",
  "limited",
  "rare",
  "suu tam",
  "sưu tầm",
];
const RECOMMENDATION_KEYWORDS = [
  "advise",
  "best option",
  "best piece",
  "best watch",
  "de xuat",
  "đề xuất",
  "goi y",
  "gợi ý",
  "help me choose",
  "nen chon",
  "nên chọn",
  "nen mua",
  "nên mua",
  "pick for me",
  "recommendation",
  "recommended",
  "recommend",
  "suggested",
  "suggestion",
  "suggest",
  "tu van chon",
  "tư vấn chọn",
  "what should i buy",
  "what should i choose",
  "which should i pick",
  "which watch",
  "which one",
];
const DIRECT_CART_ADD_KEYWORDS = [
  "add",
  "add to cart",
  "put in cart",
  "reserve this",
  "reserve watch",
  "stage",
  "stage this",
  "them",
  "thêm",
  "them vao gio",
  "thêm vào giỏ",
  "them vao gio hang",
  "thêm vào giỏ hàng",
];
const FAVORITE_KEYWORDS = [
  "add to favorite",
  "add to favorites",
  "favourite",
  "favourites",
  "favorite",
  "favorites",
  "heart",
  "luu yeu thich",
  "lưu yêu thích",
  "save",
  "save this",
  "saved reference",
  "saved references",
  "wishlist",
  "yeu thich",
  "yêu thích",
];
const REMOVE_KEYWORDS = [
  "clear",
  "delete",
  "empty",
  "remove",
  "remove all",
  "wipe",
  "xoa",
  "xoá",
  "xoa het",
  "xoá hết",
];

const SEARCH_STOP_WORDS = [
  "advise",
  "available",
  "bao",
  "bao gia",
  "bao nhieu",
  "báo",
  "báo giá",
  "bao nhiêu",
  "best option",
  "best piece",
  "best watch",
  "best",
  "cho",
  "clear",
  "co",
  "có",
  "cost",
  "delete",
  "dong ho",
  "đồng hồ",
  "empty",
  "find",
  "gia",
  "giá",
  "favorite",
  "favorites",
  "favourite",
  "favourites",
  "giup",
  "giúp",
  "goi y",
  "gợi ý",
  "help me choose",
  "kiem",
  "kiếm",
  "mau",
  "mẫu",
  "minh",
  "mình",
  "nen chon",
  "nên chọn",
  "nen mua",
  "nên mua",
  "pick for me",
  "pick",
  "price",
  "product",
  "recommendation",
  "recommended",
  "recommend",
  "reference",
  "remove",
  "remove all",
  "saved",
  "saved piece",
  "saved pieces",
  "saved reference",
  "saved references",
  "search",
  "san pham",
  "sản phẩm",
  "suggested",
  "suggestion",
  "suggest",
  "tim",
  "tìm",
  "toi",
  "tôi",
  "tu van chon",
  "tư vấn chọn",
  "tu van",
  "tư vấn",
  "watch",
  "what should i buy",
  "what should i choose",
  "which should i pick",
  "which watch",
  "which one",
  "wipe",
  "xoa",
  "xoá",
  "xoa het",
  "xoá hết",
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
    priceLabel: `${formatPrice(getLowestProductPrice(product))} · ${getProductStockLabel(product)}`,
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

function cartPageSuggestion(): SupportChatProductSuggestion {
  return pageSuggestion({
    href: "/cart",
    name: "Reserve Cart",
    priceLabel: "Review checkout",
    productId: "cart",
  });
}

function favoritePageSuggestion(): SupportChatProductSuggestion {
  return pageSuggestion({
    href: "/favorites",
    name: "Favorites",
    priceLabel: "Saved references",
    productId: "favorites",
  });
}

function getMemoryProductSuggestions(
  memory: AiConciergeMemoryMessage[],
): SupportChatProductSuggestion[] {
  const seenProductIds = new Set<string>();
  const suggestions: SupportChatProductSuggestion[] = [];

  for (const message of [...memory].reverse()) {
    for (const suggestion of message.suggestions ?? []) {
      const isProductSuggestion = suggestion.href.startsWith("/collection/");

      if (!isProductSuggestion || seenProductIds.has(suggestion.productId)) {
        continue;
      }

      seenProductIds.add(suggestion.productId);
      suggestions.push(suggestion);
    }
  }

  return suggestions;
}

function getReferencedMemorySuggestion(
  body: string,
  memory: AiConciergeMemoryMessage[],
): SupportChatProductSuggestion | null {
  const suggestions = getMemoryProductSuggestions(memory);
  const normalized = normalizeForSearch(body);

  if (suggestions.length === 0) {
    return null;
  }

  const ordinalIndex =
    /\b(?:third|3rd|option 3|option three|number 3|number three)\b/.test(normalized)
      ? 2
      : /\b(?:second|2nd|option 2|option two|number 2|number two)\b/.test(normalized)
        ? 1
        : /\b(?:first|1st|option 1|option one|number 1|number one)\b/.test(normalized)
          ? 0
          : null;

  if (ordinalIndex !== null) {
    return suggestions[ordinalIndex] ?? null;
  }

  if (/\b(?:it|that|this|that one|this one|same one|same watch)\b/.test(normalized)) {
    return suggestions[0] ?? null;
  }

  return null;
}

function isFavoritesToCartRequest(body: string): boolean {
  const normalized = normalizeForSearch(body);
  const hasFavoriteSignal = includesAnyKeyword(body, FAVORITE_KEYWORDS);
  const hasCartSignal = /\b(?:cart|checkout|gio hang|reserve|stage)\b/.test(normalized);
  const hasMoveSignal =
    /\b(?:add|move|pull|put|reserve|stage|them|thêm|chuyen|chuyển|bring)\b/.test(normalized);

  return hasFavoriteSignal && hasCartSignal && hasMoveSignal;
}

function isFavoriteSaveRequest(body: string): boolean {
  if (isFavoritesToCartRequest(body)) {
    return false;
  }

  const normalized = normalizeForSearch(body);

  return (
    includesAnyKeyword(body, FAVORITE_KEYWORDS) ||
    /\b(?:save|heart|favorite|favourite|wishlist|luu|yeu thich)\b/.test(normalized)
  );
}

function isDirectCartAddRequest(body: string): boolean {
  const normalized = normalizeForSearch(body);

  if (/\b(?:build|prepare|recommend|suggest|goi y|de xuat|tu van)\b/.test(normalized)) {
    return false;
  }

  if (/\breserve cart\b/.test(normalized)) {
    return false;
  }

  return (
    includesAnyKeyword(body, DIRECT_CART_ADD_KEYWORDS) ||
    /\b(?:put|stage|reserve)\s+(?:the\s+)?(?:first|second|third|option|number|this|that|it)\b/.test(
      normalized,
    )
  );
}

function extractCartQuantity(body: string): number {
  const normalized = normalizeForSearch(body);
  const explicitMatch =
    normalized.match(/\b(?:qty|quantity|so luong|x)\s*(\d{1,2})\b/) ??
    normalized.match(/\b(\d{1,2})\s*(?:pcs|pieces|piece|cai|chiec)\b/);
  const quantity = explicitMatch ? Number(explicitMatch[1]) : 1;

  return Number.isInteger(quantity) && quantity > 0 ? Math.min(quantity, 9) : 1;
}

function getVariantPrice(variant: ProductVariant): number {
  return variant.discountPrice ?? variant.price;
}

function selectCartVariant(product: ProductRecord, intent: ConciergeIntent): ProductVariant | null {
  const availableVariants = product.variants.filter((variant) => variant.stockQuantity > 0);
  const sizeMatchedVariants = intent.size
    ? availableVariants.filter(
        (variant) => normalizeForSearch(variant.size) === normalizeForSearch(intent.size ?? ""),
      )
    : availableVariants;
  const candidates = sizeMatchedVariants.length > 0 ? sizeMatchedVariants : availableVariants;
  const [bestVariant] = [...candidates].sort(
    (left, right) => getVariantPrice(left) - getVariantPrice(right),
  );

  return bestVariant ?? null;
}

function getFavoriteProducts(favorites: FavoriteRecord): ProductRecord[] {
  return favorites.items
    .map((item) => item.product)
    .filter((product): product is ProductRecord => Boolean(product));
}

function productMatchesMessage(product: ProductRecord, body: string): boolean {
  const searchTerm = extractSearchTerm(body);
  const tokens = searchTerm
    .split(/\s+/)
    .filter((token) => token.length >= 3);

  if (tokens.length === 0) {
    return false;
  }

  const haystack = normalizeForSearch(
    `${product.name} ${product.type} ${product.brandId} ${product.categoryId}`,
  );

  return tokens.every((token) => haystack.includes(token));
}

function getFavoriteOrdinalIndex(body: string): number | null {
  const normalized = normalizeForSearch(body);

  if (/\b(?:third|3rd|option 3|option three|number 3|number three)\b/.test(normalized)) {
    return 2;
  }

  if (/\b(?:second|2nd|option 2|option two|number 2|number two)\b/.test(normalized)) {
    return 1;
  }

  if (/\b(?:first|1st|option 1|option one|number 1|number one)\b/.test(normalized)) {
    return 0;
  }

  return null;
}

function getTargetFavoriteProducts(
  body: string,
  favorites: FavoriteRecord,
): ProductRecord[] {
  const products = getFavoriteProducts(favorites);
  const ordinalIndex = getFavoriteOrdinalIndex(body);

  if (ordinalIndex !== null) {
    const product = products[ordinalIndex];
    return product ? [product] : [];
  }

  const filteredProducts = products.filter((product) => productMatchesMessage(product, body));

  return filteredProducts.length > 0 ? filteredProducts : products;
}

function isRemovalRequest(body: string): boolean {
  return includesAnyKeyword(body, REMOVE_KEYWORDS);
}

function hasCartScope(body: string): boolean {
  const normalized = normalizeForSearch(body);

  return /\b(?:cart|checkout|gio hang|reserve cart|bag)\b/.test(normalized);
}

function hasFavoriteScope(body: string): boolean {
  return includesAnyKeyword(body, FAVORITE_KEYWORDS);
}

function isClearAllRequest(body: string): boolean {
  const normalized = normalizeForSearch(body);

  return /\b(?:all|clear|empty|everything|wipe|xoa het|remove all|delete all)\b/.test(normalized);
}

function joinsCartAndFavorites(body: string): boolean {
  return /\b(?:and|va|và)\b|&|\+/.test(normalizeForSearch(body));
}

function getStrictTargetFavoriteProducts(
  body: string,
  favorites: FavoriteRecord,
  memory: AiConciergeMemoryMessage[],
): ProductRecord[] {
  const products = getFavoriteProducts(favorites);
  const referencedSuggestion = getReferencedMemorySuggestion(body, memory);

  if (referencedSuggestion) {
    return products.filter((product) => product.id === referencedSuggestion.productId);
  }

  const ordinalIndex = getFavoriteOrdinalIndex(body);

  if (ordinalIndex !== null) {
    const product = products[ordinalIndex];
    return product ? [product] : [];
  }

  return products.filter((product) => productMatchesMessage(product, body));
}

function cartItemMatchesMessage(item: CartItemRecord, body: string): boolean {
  const searchTerm = extractSearchTerm(body);
  const tokens = searchTerm
    .split(/\s+/)
    .filter((token) => token.length >= 3);

  if (tokens.length === 0) {
    return false;
  }

  const haystack = normalizeForSearch(
    `${item.productName} ${item.productType} ${item.variantColor} ${item.variantSize}`,
  );

  return tokens.every((token) => haystack.includes(token));
}

function getTargetCartItems(
  body: string,
  items: CartItemRecord[],
  memory: AiConciergeMemoryMessage[],
): CartItemRecord[] {
  const referencedSuggestion = getReferencedMemorySuggestion(body, memory);

  if (referencedSuggestion) {
    return items.filter((item) => item.productId === referencedSuggestion.productId);
  }

  const ordinalIndex = getFavoriteOrdinalIndex(body);

  if (ordinalIndex !== null) {
    const item = items[ordinalIndex];
    return item ? [item] : [];
  }

  return items.filter((item) => cartItemMatchesMessage(item, body));
}

async function buildRemovalFallbackReply(
  body: string,
  memory: AiConciergeMemoryMessage[],
): Promise<BotReply | null> {
  if (!isRemovalRequest(body)) {
    return null;
  }

  try {
    const hasCart = hasCartScope(body);
    const hasFavorites = hasFavoriteScope(body);
    const clearAll = isClearAllRequest(body);
    const shouldClearBoth = hasCart && hasFavorites && joinsCartAndFavorites(body);
    const clearCart = hasCart && clearAll;
    const clearFavorites = hasFavorites && clearAll && (!hasCart || shouldClearBoth);

    if (clearCart || clearFavorites) {
      const cart = clearCart ? await storefrontApi.clearCart() : undefined;
      const favorites = clearFavorites ? await storefrontApi.clearFavorites() : undefined;
      const clearedTargets = [
        clearCart ? "reserve cart" : null,
        clearFavorites ? "Favorites desk" : null,
      ].filter(Boolean);

      return {
        body: `Cleared your ${clearedTargets.join(" and ")}. ${clearCart ? "The reserve cart is now empty." : ""} ${clearFavorites ? "Favorites now has no saved references." : ""}`.trim(),
        cart,
        favorites,
        suggestions: [
          ...(clearCart ? [cartPageSuggestion()] : []),
          ...(clearFavorites ? [favoritePageSuggestion()] : []),
        ],
      };
    }

    if (hasCartScope(body)) {
      const cartRecord = await storefrontApi.getCart();

      if (cartRecord.items.length === 0) {
        return {
          body: "Your reserve cart is already empty. There is no cart piece to remove.",
          cart: cartRecord,
          suggestions: [cartPageSuggestion()],
        };
      }

      const targetItems = getTargetCartItems(body, cartRecord.items, memory);

      if (targetItems.length === 0) {
        return {
          body: "I could not safely match which cart piece to remove. Use the product name, variant detail, or say \"remove first item from cart\". Say \"empty cart\" if you want to clear everything.",
          cart: cartRecord,
          suggestions: [cartPageSuggestion()],
        };
      }

      let nextCart = cartRecord;

      for (const item of targetItems) {
        nextCart = await storefrontApi.removeCartItem(item.id);
      }

      return {
        body: `Removed ${targetItems.length} cart piece${targetItems.length === 1 ? "" : "s"}: ${targetItems.map((item) => `${item.productName} / ${item.variantSize} / ${item.variantColor}`).join("; ")}. Open the cart to review the remaining reserve items.`,
        cart: nextCart,
        suggestions: [cartPageSuggestion()],
      };
    }

    if (hasFavoriteScope(body)) {
      const favorites = await storefrontApi.getFavorites();

      if (favorites.count === 0 || getFavoriteProducts(favorites).length === 0) {
        return {
          body: "Your Favorites desk is already empty. There is no saved reference to remove.",
          favorites,
          suggestions: [favoritePageSuggestion()],
        };
      }

      const targetProducts = getStrictTargetFavoriteProducts(body, favorites, memory);

      if (targetProducts.length === 0) {
        return {
          body: "I could not safely match which favorite to remove. Use the model name, or say \"remove first favorite\". Say \"empty favorites\" if you want to clear every saved reference.",
          favorites,
          suggestions: [
            favoritePageSuggestion(),
            ...getFavoriteProducts(favorites).slice(0, 3).map(productToSuggestion),
          ].slice(0, 4),
        };
      }

      let nextFavorites = favorites;

      for (const product of targetProducts) {
        nextFavorites = await storefrontApi.removeFavorite(product.id);
      }

      return {
        body: `Removed ${targetProducts.length} saved reference${targetProducts.length === 1 ? "" : "s"} from Favorites: ${targetProducts.map((product) => product.name).join("; ")}.`,
        favorites: nextFavorites,
        suggestions: [
          favoritePageSuggestion(),
          ...targetProducts.slice(0, 3).map(productToSuggestion),
        ].slice(0, 4),
      };
    }

    return {
      body: "I can remove pieces from the reserve cart or Favorites, but I need the destination to be explicit before deleting anything. Try \"remove Daytona from cart\", \"remove first favorite\", \"empty cart\", or \"empty favorites\".",
      suggestions: [
        cartPageSuggestion(),
        favoritePageSuggestion(),
      ],
    };
  } catch {
    return null;
  }
}

async function buildFavoriteToCartReply(body: string): Promise<BotReply | null> {
  if (!isFavoritesToCartRequest(body)) {
    return null;
  }

  const favorites = await storefrontApi.getFavorites();
  const favoriteProducts = getFavoriteProducts(favorites);
  const targetProducts = getTargetFavoriteProducts(body, favorites);

  if (favoriteProducts.length === 0) {
    return {
      body: "Your Favorites desk is empty right now. Save a reference first, then I can stage saved pieces into the reserve cart.",
      favorites,
      suggestions: [
        favoritePageSuggestion(),
        pageSuggestion({
          href: "/collection",
          name: "Collection",
          priceLabel: "Browse watches",
          productId: "collection",
        }),
      ],
    };
  }

  if (targetProducts.length === 0) {
    return {
      body: "I could not match that saved reference. Use an exact model name, or say \"add all favorites to cart\" to stage every saved piece that has an in-stock variant.",
      favorites,
      suggestions: [
        favoritePageSuggestion(),
        ...favoriteProducts.slice(0, 3).map(productToSuggestion),
      ].slice(0, 4),
    };
  }

  const intent = buildConciergeIntent(body);
  const quantity = extractCartQuantity(body);
  const addedLines: string[] = [];
  const skippedLines: string[] = [];
  let cart: CartRecord | undefined;

  for (const product of targetProducts) {
    const variant = selectCartVariant(product, intent);

    if (!variant) {
      skippedLines.push(`${product.name} (no matching in-stock variant)`);
      continue;
    }

    try {
      cart = await storefrontApi.addCartItem({
        productVariantId: variant.id,
        quantity,
      });
      addedLines.push(`${product.name} / ${variant.size} / ${variant.color}`);
    } catch (error) {
      skippedLines.push(
        `${product.name} (${error instanceof Error ? error.message : "cart update failed"})`,
      );
    }
  }

  if (!cart || addedLines.length === 0) {
    return {
      body: `I found your saved references, but none could be staged into the reserve cart. ${skippedLines.length > 0 ? `Blocked: ${skippedLines.join("; ")}.` : "Try choosing a different saved piece or removing strict size/budget filters."}`,
      favorites,
      suggestions: [
        favoritePageSuggestion(),
        cartPageSuggestion(),
        ...targetProducts.slice(0, 2).map(productToSuggestion),
      ].slice(0, 4),
    };
  }

  return {
    body: `Staged ${addedLines.length} saved reference${addedLines.length === 1 ? "" : "s"} from Favorites into your reserve cart: ${addedLines.join("; ")}. ${skippedLines.length > 0 ? `Skipped: ${skippedLines.join("; ")}.` : "Everything matched an in-stock variant."} Open the cart to review quantities, delivery details, and payment before checkout.`,
    cart,
    favorites,
    suggestions: [
      cartPageSuggestion(),
      favoritePageSuggestion(),
      ...targetProducts.slice(0, 2).map(productToSuggestion),
    ].slice(0, 4),
  };
}

async function buildMemoryFavoriteAddReply(
  body: string,
  memory: AiConciergeMemoryMessage[],
): Promise<BotReply | null> {
  if (!isFavoriteSaveRequest(body)) {
    return null;
  }

  const suggestion = getReferencedMemorySuggestion(body, memory);

  if (!suggestion) {
    return null;
  }

  let product: ProductRecord;

  try {
    product = await storefrontApi.getProduct(suggestion.productId);
  } catch {
    return null;
  }

  const favorites = await storefrontApi.addFavorite(product.id);

  return {
    body: `${product.name} is saved to your Favorites desk. You can keep comparing pieces from there, or say "add favorites to cart" when you want me to stage saved references for checkout.`,
    favorites,
    suggestions: [
      favoritePageSuggestion(),
      productToSuggestion(product),
      cartPageSuggestion(),
    ],
  };
}

async function buildFavoriteFallbackReply(
  body: string,
  memory: AiConciergeMemoryMessage[],
): Promise<BotReply | null> {
  try {
    const favoriteCartReply = await buildFavoriteToCartReply(body);

    if (favoriteCartReply) {
      return favoriteCartReply;
    }

    return buildMemoryFavoriteAddReply(body, memory);
  } catch {
    return null;
  }
}

async function buildMemoryCartAddReply(
  body: string,
  memory: AiConciergeMemoryMessage[],
): Promise<BotReply | null> {
  if (!isDirectCartAddRequest(body)) {
    return null;
  }

  const suggestion = getReferencedMemorySuggestion(body, memory);

  if (!suggestion) {
    return null;
  }

  let product: ProductRecord;

  try {
    product = await storefrontApi.getProduct(suggestion.productId);
  } catch {
    return null;
  }

  const intent = buildConciergeIntent(body);
  const variant = selectCartVariant(product, intent);

  if (!variant) {
    return {
      body: `I matched ${suggestion.name} from the previous shortlist, but I could not find an in-stock variant that fits this exact request. Send a case size or open the product card to choose a variant manually.`,
      suggestions: [
        suggestion,
        cartPageSuggestion(),
      ],
    };
  }

  const quantity = extractCartQuantity(body);

  try {
    const cart = await storefrontApi.addCartItem({
      productVariantId: variant.id,
      quantity,
    });

    return {
      body: `Added ${quantity} x ${product.name} (${variant.size}, ${variant.color}) to your reserve cart at ${formatPrice(getVariantPrice(variant))} each. Open the cart to review checkout details, payment method, and delivery address before creating the order.`,
      cart,
      suggestions: [
        cartPageSuggestion(),
        productToSuggestion(product),
      ],
    };
  } catch (error) {
    return {
      body: `I matched ${product.name}, but I could not update the reserve cart because ${error instanceof Error ? error.message : "the cart update failed"}. You can still open the product page and reserve it manually, or send a different quantity.`,
      suggestions: [
        productToSuggestion(product),
        cartPageSuggestion(),
      ],
    };
  }
}

function isMemoryRefinement(
  body: string,
  memory: AiConciergeMemoryMessage[],
): boolean {
  if (getMemoryProductSuggestions(memory).length === 0) {
    return false;
  }

  return (
    includesAnyKeyword(body, PRICE_KEYWORDS) ||
    findFirstMoneyValue(normalizeForSearch(body)) !== null ||
    includesAnyKeyword(body, SIZE_KEYWORDS) ||
    includesAnyKeyword(body, AVAILABLE_ONLY_KEYWORDS) ||
    includesAnyKeyword(body, DRESS_WATCH_KEYWORDS) ||
    includesAnyKeyword(body, DAILY_WATCH_KEYWORDS) ||
    includesAnyKeyword(body, SPORT_WATCH_KEYWORDS) ||
    includesAnyKeyword(body, COLLECTOR_WATCH_KEYWORDS)
  );
}

function buildMemoryFallbackReply(
  body: string,
  memory: AiConciergeMemoryMessage[],
): BotReply | null {
  if (!isMemoryRefinement(body, memory)) {
    return null;
  }

  const intent = buildConciergeIntent(body);
  const previousSuggestions = getMemoryProductSuggestions(memory);
  const budgetMax = intent.budgetMax;
  const filteredSuggestions = budgetMax
    ? previousSuggestions.filter((suggestion) => {
        const price = findFirstMoneyValue(suggestion.priceLabel);
        return price === null || price <= budgetMax;
      })
    : previousSuggestions;
  const suggestions = filteredSuggestions.length > 0
    ? filteredSuggestions.slice(0, 3)
    : previousSuggestions.slice(0, 3);
  const brief = buildConciergeQueryLabel(intent, "the previous shortlist");
  const firstPick = suggestions[0];

  if (!firstPick) {
    return null;
  }

  return {
    body: `Concierge recommendation: I narrowed the previous shortlist for ${brief}. First pick: ${firstPick.name}. ${suggestions.length > 1 ? "I kept the closest matching options attached below." : "That is the closest matching option from the previous list."} Send a case size, use case, or "add first one to cart" when you want the next step.`,
    suggestions,
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

function normalizeMoneyAmount(rawAmount: string): string {
  const compact = rawAmount
    .toLowerCase()
    .replace(/\b(?:usd|dollars?)\b/g, "")
    .replace(/\$/g, "")
    .replace(/\s+/g, "")
    .trim();

  if (/^\d{1,3}([,.]\d{3})+$/.test(compact)) {
    return compact.replace(/[,.]/g, "");
  }

  return compact.replace(/,/g, "");
}

function parseMoneyAmount(rawAmount: string, suffix = ""): number | null {
  const scale = `${rawAmount} ${suffix}`;
  const amount = Number(normalizeMoneyAmount(rawAmount));

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  if (/k|thousand|nghin|ngan/i.test(scale) || amount < 1_000) {
    return Math.round(amount * 1_000);
  }

  return Math.round(amount);
}

function findFirstMoneyValue(text: string): number | null {
  const moneyPattern =
    /(?:usd|\$)?\s*(\d+(?:[,.]\d{3})*|\d+(?:[,.]\d+)?)\s*(k|thousand|nghin|ngan)?\s*(usd|\$)?/gi;

  for (const match of text.matchAll(moneyPattern)) {
    const fullMatch = match[0] ?? "";
    const rawAmount = match[1] ?? "";
    const suffix = match[2] ?? "";
    const trailingCurrency = match[3] ?? "";
    const nextText = text.slice((match.index ?? 0) + fullMatch.length, (match.index ?? 0) + fullMatch.length + 4);
    const hasMoneySignal = Boolean(suffix || trailingCurrency || /\$|usd/i.test(fullMatch));

    if (!hasMoneySignal || /^\s*mm\b/i.test(nextText)) {
      continue;
    }

    const value = parseMoneyAmount(rawAmount, suffix);

    if (value) {
      return value;
    }
  }

  return null;
}

function extractBudgetIntent(body: string): Pick<ConciergeIntent, "budgetMax" | "budgetMin"> {
  const text = normalizeForSearch(body);
  const amountPattern = "(\\d+(?:[,.]\\d{3})*|\\d+(?:[,.]\\d+)?)\\s*(k|thousand|nghin|ngan)?\\s*(?:usd|\\$)?";
  const rangeMatch = text.match(
    new RegExp(`(?:between|from|tu|từ)\\s+(?:usd|\\$)?\\s*${amountPattern}\\s*(?:-|to|and|den|đến)\\s*(?:usd|\\$)?\\s*${amountPattern}(?!\\s*mm)`, "i"),
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
    new RegExp(`(?:under|below|less than|up to|max|budget|duoi|dưới)\\s*(?:usd|\\$)?\\s*${amountPattern}(?!\\s*mm)`, "i"),
  );
  const minMatch = text.match(
    new RegExp(`(?:over|above|from|min|tren|trên)\\s*(?:usd|\\$)?\\s*${amountPattern}(?!\\s*mm)`, "i"),
  );
  const budgetMax = maxMatch ? parseMoneyAmount(maxMatch[1], maxMatch[2]) : null;
  const budgetMin = minMatch ? parseMoneyAmount(minMatch[1], minMatch[2]) : null;
  const standaloneBudget = !budgetMax && !budgetMin ? findFirstMoneyValue(text) : null;

  return {
    ...(budgetMax ?? standaloneBudget ? { budgetMax: budgetMax ?? standaloneBudget ?? undefined } : {}),
    ...(budgetMin ? { budgetMin } : {}),
  };
}

function extractSizeIntent(body: string): string | undefined {
  const match = normalizeForSearch(body).match(/\b(2[8-9]|3[0-9]|4[0-9]|5[0-2])\s*mm\b/);

  return match ? `${match[1]}mm` : undefined;
}

function extractOccasionIntent(body: string): ConciergeIntent["occasion"] {
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

function productMatchesOccasion(
  product: ProductRecord,
  occasion: ConciergeIntent["occasion"],
): boolean {
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

function scoreConciergeProduct(
  product: ProductRecord,
  intent: ConciergeIntent,
): number {
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

  if (
    intent.size &&
    product.variants.some((variant) => normalizeForSearch(variant.size) === normalizeForSearch(intent.size ?? ""))
  ) {
    score += 18;
  }

  if (productMatchesOccasion(product, intent.occasion)) {
    score += 16;
  }

  return score;
}

async function getProductMatches(body: string): Promise<{
  intent: ConciergeIntent;
  label: string;
  products: ProductRecord[];
  searchTerm: string;
  wasExactMatch: boolean;
}> {
  const searchTerm = extractSearchTerm(body);
  const intent = buildConciergeIntent(body);
  const sort = includesAnyKeyword(body, PRICE_KEYWORDS) ? "price-asc" : "newest";
  const initialDiscovery = await storefrontApi.getProductDiscovery({
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
        (left, right) =>
          scoreConciergeProduct(right, intent) - scoreConciergeProduct(left, intent),
      ),
      searchTerm,
      wasExactMatch: true,
    };
  }

  const brandMatch = findFacetMatch(searchTerm || body, initialDiscovery.facets.brands);

  if (brandMatch) {
    const brandDiscovery = await storefrontApi.getProductDiscovery({
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
        (left, right) =>
          scoreConciergeProduct(right, intent) - scoreConciergeProduct(left, intent),
      ),
      searchTerm,
      wasExactMatch: brandDiscovery.items.length > 0,
    };
  }

  const categoryMatch = findFacetMatch(searchTerm || body, initialDiscovery.facets.categories);

  if (categoryMatch) {
    const categoryDiscovery = await storefrontApi.getProductDiscovery({
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
        (left, right) =>
          scoreConciergeProduct(right, intent) - scoreConciergeProduct(left, intent),
      ),
      searchTerm,
      wasExactMatch: categoryDiscovery.items.length > 0,
    };
  }

  if (includesAnyKeyword(body, DRESS_WATCH_KEYWORDS)) {
    const allDiscovery = await storefrontApi.getProductDiscovery({
      availability: "all",
      priceMax: intent.budgetMax,
      priceMin: intent.budgetMin,
      size: intent.size,
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
      intent,
      label: "dress watch",
      products: [...(dressLikeProducts.length > 0 ? dressLikeProducts : allDiscovery.items)].sort(
        (left, right) =>
          scoreConciergeProduct(right, intent) - scoreConciergeProduct(left, intent),
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
    const discovery = await storefrontApi.getProductDiscovery({
      availability: "all",
      priceMax: intent.budgetMax,
      priceMin: intent.budgetMin,
      size: intent.size,
      sort,
    });
    const occasionProducts = intent.occasion
      ? discovery.items.filter((product) =>
          productMatchesOccasion(product, intent.occasion),
        )
      : discovery.items;
    const products =
      occasionProducts.length > 0 ? occasionProducts : discovery.items;

    return {
      intent,
      label: buildConciergeQueryLabel(intent, searchTerm || "your request"),
      products: [...products].sort(
        (left, right) =>
          scoreConciergeProduct(right, intent) - scoreConciergeProduct(left, intent),
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

async function buildBotReply(
  body: string,
  memory: AiConciergeMemoryMessage[] = [],
): Promise<BotReply> {
  const removalReply = await buildRemovalFallbackReply(body, memory);

  if (removalReply) {
    return removalReply;
  }

  const favoriteReply = await buildFavoriteFallbackReply(body, memory);

  if (favoriteReply) {
    return favoriteReply;
  }

  const memoryCartReply = await buildMemoryCartAddReply(body, memory);

  if (memoryCartReply) {
    return memoryCartReply;
  }

  const memoryReply = buildMemoryFallbackReply(body, memory);

  if (memoryReply) {
    return memoryReply;
  }

  const asksForRecommendation = includesAnyKeyword(body, RECOMMENDATION_KEYWORDS);
  const asksAboutProducts =
    asksForRecommendation ||
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
      body: asksAboutAuthenticity
        ? "Concierge note: delivery and documentation are reviewed together. Shipping is confirmed from the order address, while authenticity is checked through card, serial, condition photos, and service history."
        : "Concierge note: shipping is confirmed by delivery address and order status. If tracking has been issued, Orders is the fastest place to review movement; returns are covered in Shipping & Returns.",
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

  if (asksAboutPayment) {
    return {
      body: "Concierge note: card and wallet payments are handled by Stripe and sync back to the order ledger after payment confirmation. COD remains available for selected cases; bank transfer is intentionally locked until reconciliation is fully handled.",
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

  if (asksAboutOrder) {
    return {
      body: "Concierge note: Orders shows reserve, payment, and shipping status in one ledger. Send the order number or checkout email here if you want the live desk to review a specific movement.",
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
        ? "Concierge note: authenticity is reviewed by serial, card, box, service history, and detailed photos. Send a model or reference and I can narrow comparable inventory first."
        : "Concierge note: warranty and service scope depends on the exact watch, condition, and handover record. Send the model or reference to confirm the available support path.",
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
    const visibleProducts = result.intent.wantsAvailableOnly
      ? result.products.filter((product) => getTotalProductStock(product) > 0)
      : result.products;
    const suggestions = visibleProducts.slice(0, 3).map(productToSuggestion);

    if (suggestions.length > 0) {
      const priceRange = getProductPriceRange(visibleProducts);
      const inventory = describeInventory(visibleProducts);
      const brief = buildConciergeQueryLabel(result.intent, result.label);
      const lead = result.wasExactMatch
        ? `I found ${visibleProducts.length} option${visibleProducts.length === 1 ? "" : "s"} for ${brief}`
        : `I did not find an exact match for "${result.searchTerm || body}", but these are the closest options`;

      return {
        body: asksForRecommendation
          ? `Concierge recommendation: ${lead}. My first pass prioritizes live availability, budget fit, size, and use case. Indicative range: ${priceRange}. Inventory: ${inventory}. Add a budget, wrist size, or daily/formal/sport use case for a sharper pick.`
          : includesAnyKeyword(body, PRICE_KEYWORDS)
            ? `Concierge brief: ${lead}. Indicative range: ${priceRange}. Inventory: ${inventory}. Final pricing and allocation can still be confirmed by the desk.`
            : `Concierge brief: ${lead}. I ranked the list by availability, budget fit, size, and use case, then attached the strongest matches below.`,
        suggestions,
      };
    }

    return {
      body: asksForRecommendation
        ? "Concierge recommendation: I can recommend a stronger piece once I have one useful signal. Send a budget, brand, case size, or use case like daily, formal, sport, or collector and I will narrow it again."
        : "Concierge brief: I could not find a clean match in current inventory. Send a brand, reference, case size, budget, or use case like daily, formal, sport, or collector and I will narrow it again.",
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
      body: "I noted that you would like desk support. When an admin is online, this conversation can move to the live desk; leave a phone number, order number, or watch reference here so the handoff has context.",
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
      body: "Hello, I am the Sovereign AI Concierge. I can narrow watches by budget, size, occasion, availability, and payment or shipping context before the live desk joins.",
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
    body: "I have noted your message. For a sharper concierge match, send a brand, reference, case size, budget, use case, order number, or shipping question.",
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

async function loadAiConciergeMemory(conversationId: string): Promise<AiConciergeMemoryMessage[]> {
  try {
    const snapshot = await getDocs(
      query(
        messagesRef(conversationId),
        orderBy("createdAt", "desc"),
        limit(8),
      ),
    );

    return snapshot.docs
      .map(mapMessageSnapshot)
      .reverse()
      .filter((message) => message.channel === "ai")
      .map((message) => ({
        body: message.body,
        senderRole: message.senderRole,
        suggestions: message.suggestions.slice(0, 4),
      }));
  } catch {
    return [];
  }
}

async function buildAiConciergeReply(
  body: string,
  memory: AiConciergeMemoryMessage[] = [],
): Promise<BotReply> {
  const removalReply = await buildRemovalFallbackReply(body, memory);

  if (removalReply) {
    return removalReply;
  }

  const favoriteReply = await buildFavoriteFallbackReply(body, memory);

  if (favoriteReply) {
    return favoriteReply;
  }

  const memoryCartReply = await buildMemoryCartAddReply(body, memory);

  if (memoryCartReply) {
    return memoryCartReply;
  }

  try {
    const reply = await storefrontApi.askAiConcierge({ memory, message: body });

    return {
      body: reply.body,
      cart: reply.cart,
      favorites: reply.favorites,
      suggestions: reply.suggestions,
    };
  } catch {
    try {
      return await buildBotReply(body, memory);
    } catch {
      return {
        body: "I have noted your message. The concierge context service is temporarily unavailable, but your message is saved here for the desk.",
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
  }
}

function emitCartUpdated(cart?: CartRecord): void {
  if (!cart || typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<CartRecord>(SUPPORT_CHAT_CART_UPDATED_EVENT, {
      detail: cart,
    }),
  );
}

function emitFavoritesUpdated(favorites?: FavoriteRecord): void {
  if (!favorites || typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<FavoriteRecord>(SUPPORT_CHAT_FAVORITES_UPDATED_EVENT, {
      detail: favorites,
    }),
  );
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
  const aiMemory = messageChannel === "ai" ? await loadAiConciergeMemory(user.id) : [];
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

  const botReply = await buildAiConciergeReply(trimmedBody, aiMemory);

  await addDoc(messagesRef(user.id), {
    body: botReply.body,
    channel: "ai",
    conversationId: user.id,
    createdAt: serverTimestamp(),
    moderationFlags: [],
    senderId: "support-bot",
    senderName: "Sovereign AI Concierge",
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
  emitCartUpdated(botReply.cart);
  emitFavoritesUpdated(botReply.favorites);
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
