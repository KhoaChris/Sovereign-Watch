import {
  formatProductSize,
  normalizeProductSizeValue,
} from "../shared";
import type {
  AiConciergeResponse,
  AiConciergeMemoryMessage,
  AuthUserProfile,
  CartItemRecord,
  FavoriteRecord,
  OrderRecord,
  ProductFacetOption,
  ProductRecord,
  ProductVariant,
  SupportChatProductSuggestion,
} from "../shared";
import {
  addCartItem,
  clearCartRecord,
  getCartRecord,
  removeCartItem,
} from "./cart-service";
import {
  addFavoriteProduct,
  clearFavoriteRecord,
  getFavoriteRecord,
  removeFavoriteProduct,
} from "./favorite-service";
import { listOrders, listOrdersByCustomer } from "./order-service";
import { getProductById, getProductDiscovery } from "./product-service";

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

interface CartVariantChoice {
  price: number;
  product: ProductRecord;
  stock: number;
  variant: ProductVariant;
}

type ConciergeIntentLabel =
  | "authenticity"
  | "cart"
  | "capability"
  | "compare"
  | "contact"
  | "farewell"
  | "favorite"
  | "greeting"
  | "identity"
  | "order"
  | "off_topic"
  | "payment"
  | "product"
  | "recommendation"
  | "removal"
  | "shipping"
  | "sizing"
  | "thanks"
  | "warranty"
  | "watchroom"
  | "wellbeing"
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
const CART_KEYWORDS = [
  "add to cart",
  "cart",
  "gio hang",
  "reserve",
  "reserve cart",
  "them vao gio",
  "them vao gio hang",
];
const RECOMMENDATION_KEYWORDS = [
  "advise",
  "best option",
  "best piece",
  "best watch",
  "de xuat",
  "goi y",
  "help me choose",
  "nen chon",
  "nen mua",
  "pick for me",
  "recommendation",
  "recommended",
  "recommend",
  "suggested",
  "suggestion",
  "suggest",
  "tu van chon",
  "what should i buy",
  "what should i choose",
  "which one",
  "which should i pick",
  "which watch",
];
const DIRECT_CART_ADD_KEYWORDS = [
  "add",
  "add to cart",
  "put in cart",
  "reserve this",
  "reserve watch",
  "them",
  "them vao gio",
  "them vao gio hang",
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
  "save",
  "save this",
  "saved reference",
  "saved references",
  "wishlist",
  "yeu thich",
];
const REMOVE_KEYWORDS = [
  "clear",
  "delete",
  "empty",
  "remove",
  "remove all",
  "wipe",
  "xoa",
  "xoa het",
];
const ORDER_KEYWORDS = ["don hang", "ma don", "order", "status", "tracking"];
const WARRANTY_KEYWORDS = ["bao hanh", "service", "sua", "warranty"];
const AUTHENTICITY_KEYWORDS = ["auth", "authentic", "chinh hang", "giay to", "kiem dinh", "legit", "original", "zin"];
const CONTACT_KEYWORDS = ["admin", "contact", "gap nguoi", "hotline", "lien he", "nhan vien", "support", "tu van"];
const GREETING_KEYWORDS = [
  "alo",
  "chao",
  "good afternoon",
  "good evening",
  "good morning",
  "hello",
  "hi",
  "xin chao",
];
const FAREWELL_KEYWORDS = ["bye", "goodbye", "hen gap lai", "see you", "tam biet"];
const WELLBEING_KEYWORDS = [
  "are you ok",
  "are you okay",
  "ban co khoe khong",
  "ban khoe khong",
  "how are you",
  "khoe khong",
];
const IDENTITY_KEYWORDS = [
  "ai are you",
  "ban la ai",
  "ban ten gi",
  "bot la ai",
  "ten ban",
  "your name",
  "who are you",
  "what are you",
  "you are",
];
const THANKS_KEYWORDS = ["appreciate", "cam on", "cảm ơn", "thank", "thanks", "ty"];
const WATCHROOM_BRAND_KEYWORDS = [
  "about sovereign",
  "about watchroom",
  "brand info",
  "brand story",
  "company info",
  "gioi thieu",
  "heritage",
  "tell me about sovereign",
  "tell me about watchroom",
  "sovereign la gi",
  "thong tin brand",
  "ve sovereign",
  "ve watchroom",
  "what is sovereign",
  "what is watchroom",
  "watchroom la gi",
];
const SIZE_KEYWORDS = ["36mm", "38mm", "40mm", "41mm", "42mm", "size", "wrist"];
const SIZING_ADVICE_KEYWORDS = ["fit", "fits", "size advice", "size guide", "wrist size"];
const DRESS_WATCH_KEYWORDS = ["dress", "dress watch", "formal", "lich su"];
const DAILY_WATCH_KEYWORDS = ["daily", "everyday", "hang ngay", "wear daily"];
const SPORT_WATCH_KEYWORDS = ["chrono", "chronograph", "rubber", "sport", "sports"];
const COLLECTOR_WATCH_KEYWORDS = ["allocation", "collector", "investment", "limited", "rare", "suu tam"];
const COMPARE_KEYWORDS = ["compare", "comparison", "different", "khac nhau", "so sanh", "vs", "versus"];
const CAPABILITY_KEYWORDS = ["ban lam duoc gi", "can you do", "help me", "how can you help", "what can you do"];
const OFF_TOPIC_KEYWORDS = [
  "code",
  "crypto",
  "football",
  "game",
  "homework",
  "movie",
  "music",
  "news",
  "programming",
  "stock market",
  "thoi tiet",
  "weather",
];
const AVAILABLE_ONLY_KEYWORDS = [
  "available",
  "available now",
  "co hang",
  "in stock",
  "ready",
  "san hang",
];

const SEARCH_STOP_WORDS = [
  "add to cart",
  "add to",
  "add",
  "advise",
  "available",
  "bao",
  "bao gia",
  "bao nhieu",
  "best option",
  "best piece",
  "best watch",
  "best",
  "cart",
  "cho",
  "clear",
  "co",
  "cost",
  "delete",
  "de xuat",
  "dong ho",
  "empty",
  "find",
  "first",
  "favourite",
  "favourites",
  "favorite",
  "favorites",
  "from favorite",
  "from favorites",
  "gia",
  "goi y",
  "giup",
  "help me choose",
  "gio",
  "gio hang",
  "it",
  "kiem",
  "mau",
  "minh",
  "nen chon",
  "nen mua",
  "number",
  "one",
  "option",
  "price",
  "product",
  "pick for me",
  "pick",
  "put in cart",
  "put in",
  "put",
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
  "reserve cart",
  "reserve",
  "search",
  "san pham",
  "second",
  "same",
  "stage",
  "suggested",
  "suggestion",
  "suggest",
  "them",
  "them vao",
  "them vao gio",
  "them vao gio hang",
  "that",
  "third",
  "this",
  "three",
  "tim",
  "to cart",
  "to",
  "toi",
  "two",
  "tu van chon",
  "tu van",
  "watch",
  "what should i buy",
  "what should i choose",
  "which should i pick",
  "which watch",
  "which one",
  "xin",
  "wipe",
  "xoa",
  "xoa het",
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

function getVariantPrice(variant: ProductVariant): number {
  return variant.discountPrice ?? variant.price;
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

function formatVariantSize(size: string): string {
  return formatProductSize(size, size);
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

function variantChoiceLine(choice: CartVariantChoice): string {
  return `${choice.product.name} / ${formatVariantSize(choice.variant.size)} / ${choice.variant.color} / ${formatPrice(choice.price)} / ${choice.stock} in stock`;
}

function variantChoiceCommand(choice: CartVariantChoice): string {
  return `add ${choice.product.name} ${formatVariantSize(choice.variant.size)} to cart`;
}

function getVariantChoicePriceRange(choices: CartVariantChoice[]): string {
  const prices = choices.map((choice) => choice.price).filter((price) => price > 0);

  if (prices.length === 0) {
    return "Contact for price";
  }

  const min = Math.min(...prices);
  const max = Math.max(...prices);

  return min === max ? formatPrice(min) : `${formatPrice(min)} - ${formatPrice(max)}`;
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

async function getMemoryProducts(memory: AiConciergeMemoryMessage[]): Promise<ProductRecord[]> {
  const suggestions = getMemoryProductSuggestions(memory);
  const products: ProductRecord[] = [];

  for (const suggestion of suggestions) {
    const product = await getProductById(suggestion.productId);

    if (product) {
      products.push(product);
    }
  }

  return products;
}

function getOrdinalIndex(message: string): number | null {
  const normalized = normalizeForSearch(message);

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

function getReferencedMemorySuggestion(
  message: string,
  memory: AiConciergeMemoryMessage[],
): SupportChatProductSuggestion | null {
  const suggestions = getMemoryProductSuggestions(memory);
  const normalized = normalizeForSearch(message);

  if (suggestions.length === 0) {
    return null;
  }

  const ordinalIndex = getOrdinalIndex(message);

  if (ordinalIndex !== null) {
    return suggestions[ordinalIndex] ?? null;
  }

  if (/\b(?:it|that|this|that one|this one|same one|same watch)\b/.test(normalized)) {
    return suggestions[0] ?? null;
  }

  return null;
}

function buildContextualMessage(
  message: string,
  memory: AiConciergeMemoryMessage[],
): string {
  const referencedSuggestion = getReferencedMemorySuggestion(message, memory);

  if (!referencedSuggestion) {
    return message;
  }

  return `${message} ${referencedSuggestion.name}`;
}

function isMemoryRefinement(
  message: string,
  memory: AiConciergeMemoryMessage[],
): boolean {
  if (getMemoryProductSuggestions(memory).length === 0) {
    return false;
  }

  return (
    includesAnyKeyword(message, PRICE_KEYWORDS) ||
    findFirstMoneyValue(normalizeForSearch(message)) !== null ||
    includesAnyKeyword(message, SIZE_KEYWORDS) ||
    includesAnyKeyword(message, AVAILABLE_ONLY_KEYWORDS) ||
    includesAnyKeyword(message, DRESS_WATCH_KEYWORDS) ||
    includesAnyKeyword(message, DAILY_WATCH_KEYWORDS) ||
    includesAnyKeyword(message, SPORT_WATCH_KEYWORDS) ||
    includesAnyKeyword(message, COLLECTOR_WATCH_KEYWORDS) ||
    /\b(?:cheaper|lower|higher|smaller|larger|bigger|more formal|more sport|available)\b/.test(
      normalizeForSearch(message),
    )
  );
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
    new RegExp(`(?:between|from|tu)\\s+(?:usd|\\$)?\\s*${amountPattern}\\s*(?:-|to|and|den)\\s*(?:usd|\\$)?\\s*${amountPattern}(?!\\s*mm)`, "i"),
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

function getAvailableVariantChoices(
  products: ProductRecord[],
  intent: ConciergeIntent,
): CartVariantChoice[] {
  const normalizedSize = intent.size
    ? normalizeProductSizeValue(intent.size) || intent.size
    : "";

  return products
    .flatMap((product) =>
      product.variants.map((variant) => {
        const price = getVariantPrice(variant);
        const stock = Math.max(0, variant.stockQuantity);

        return {
          price,
          product,
          stock,
          variant,
        };
      }),
    )
    .filter((choice) => {
      if (choice.stock <= 0) {
        return false;
      }

      if (intent.budgetMin !== undefined && choice.price < intent.budgetMin) {
        return false;
      }

      if (intent.budgetMax !== undefined && choice.price > intent.budgetMax) {
        return false;
      }

      if (!normalizedSize) {
        return true;
      }

      const variantSize = normalizeProductSizeValue(choice.variant.size) || choice.variant.size;
      return normalizeForSearch(variantSize) === normalizeForSearch(normalizedSize);
    })
    .sort((left, right) => {
      const scoreDelta =
        scoreConciergeProduct(right.product, intent) -
        scoreConciergeProduct(left.product, intent);

      return scoreDelta !== 0 ? scoreDelta : left.price - right.price;
    });
}

function extractCartQuantity(message: string): number {
  const normalized = normalizeForSearch(message);
  const explicitMatch =
    normalized.match(/\b(?:qty|quantity|so luong|x)\s*(\d{1,2})\b/) ??
    normalized.match(/\b(\d{1,2})\s*(?:pcs|pieces|piece|cai|chiec)\b/);
  const quantity = explicitMatch ? Number(explicitMatch[1]) : 1;

  return Number.isInteger(quantity) && quantity > 0 ? Math.min(quantity, 9) : 1;
}

function isDirectCartAddRequest(message: string): boolean {
  const normalized = normalizeForSearch(message);

  if (/\b(?:build|prepare|recommend|suggest|goi y|de xuat|tu van)\b/.test(normalized)) {
    return false;
  }

  if (/\breserve cart\b/.test(normalized)) {
    return false;
  }

  return includesAnyKeyword(message, DIRECT_CART_ADD_KEYWORDS);
}

function selectAutoAddChoice(
  message: string,
  result: ProductMatchResult,
  choices: CartVariantChoice[],
): CartVariantChoice | null {
  if (!isDirectCartAddRequest(message) || choices.length === 0) {
    return null;
  }

  if (choices.length === 1) {
    return choices[0];
  }

  const searchTerm = result.searchTerm.trim();
  const productIds = new Set(choices.map((choice) => choice.product.id));

  if (productIds.size === 1 && result.intent.size) {
    return choices[0];
  }

  const normalizedMessage = normalizeForSearch(message);
  const messageMatchedChoices = choices.filter((choice) => {
    const productTokens = normalizeForSearch(choice.product.name)
      .split(/\s+/)
      .filter((token) => token.length >= 3);
    const matchedTokenCount = productTokens.filter((token) =>
      normalizedMessage.includes(token),
    ).length;

    return matchedTokenCount >= Math.min(2, productTokens.length);
  });
  const matchedProductIds = new Set(messageMatchedChoices.map((choice) => choice.product.id));

  if (
    messageMatchedChoices.length === 1 ||
    (matchedProductIds.size === 1 && result.intent.size)
  ) {
    return messageMatchedChoices[0] ?? null;
  }

  if (searchTerm.length >= 3) {
    const matchingChoices = choices.filter((choice) => {
      const productName = normalizeForSearch(choice.product.name);
      const productType = normalizeForSearch(choice.product.type);
      const term = normalizeForSearch(searchTerm);

      return productName.includes(term) || productType.includes(term);
    });

    if (matchingChoices.length === 1) {
      return matchingChoices[0];
    }
  }

  return null;
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

function extractCompareTerms(message: string): string[] {
  const normalized = normalizeForSearch(message)
    .replace(/\b(?:compare|comparison|different|difference|between|khac nhau|so sanh)\b/g, " ")
    .replace(/[?!.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return [
    ...new Set(
      normalized
        .split(/\s+(?:and|or|versus|voi|vs|with)\s+|[,/&]+/g)
        .map((term) => term.trim())
        .filter((term) => term.length >= 3),
    ),
  ];
}

async function getCompareProducts(message: string): Promise<ProductRecord[]> {
  const intent = buildConciergeIntent(message);
  const terms = extractCompareTerms(message);
  const products = new Map<string, ProductRecord>();

  for (const term of terms) {
    const discovery = await getProductDiscovery({
      availability: "all",
      priceMax: intent.budgetMax,
      priceMin: intent.budgetMin,
      search: term,
      size: intent.size,
      sort: "newest",
    });
    const bestMatch = [...discovery.items].sort(
      (left, right) => scoreConciergeProduct(right, intent) - scoreConciergeProduct(left, intent),
    )[0];

    if (bestMatch) {
      products.set(bestMatch.id, bestMatch);
    }
  }

  if (products.size >= 2) {
    return [...products.values()];
  }

  const fallback = await getProductMatches(message);

  return fallback.products.slice(0, 3);
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

function isRemovalRequest(message: string): boolean {
  return includesAnyKeyword(message, REMOVE_KEYWORDS);
}

function hasCartScope(message: string): boolean {
  const normalized = normalizeForSearch(message);

  return /\b(?:cart|checkout|gio hang|reserve cart|bag)\b/.test(normalized);
}

function hasFavoriteScope(message: string): boolean {
  return includesAnyKeyword(message, FAVORITE_KEYWORDS);
}

function isClearAllRequest(message: string): boolean {
  const normalized = normalizeForSearch(message);

  return /\b(?:all|clear|empty|everything|wipe|xoa het|remove all|delete all)\b/.test(normalized);
}

function joinsCartAndFavorites(message: string): boolean {
  return /\b(?:and|va|và)\b|&|\+/.test(normalizeForSearch(message));
}

function isFavoritesToCartRequest(message: string): boolean {
  const normalized = normalizeForSearch(message);
  const hasFavoriteSignal = includesAnyKeyword(message, FAVORITE_KEYWORDS);
  const hasCartSignal = /\b(?:cart|checkout|gio hang|reserve|stage)\b/.test(normalized);
  const hasMoveSignal =
    /\b(?:add|move|pull|put|reserve|stage|them|chuyen|bring)\b/.test(normalized);

  return hasFavoriteSignal && hasCartSignal && hasMoveSignal;
}

function isFavoriteSaveRequest(message: string): boolean {
  if (isFavoritesToCartRequest(message)) {
    return false;
  }

  const normalized = normalizeForSearch(message);

  return (
    includesAnyKeyword(message, FAVORITE_KEYWORDS) ||
    /\b(?:save|heart|favorite|favourite|wishlist|luu|yeu thich)\b/.test(normalized)
  );
}

function getFavoriteProducts(favorites: FavoriteRecord): ProductRecord[] {
  return favorites.items
    .map((item) => item.product)
    .filter((product): product is ProductRecord => Boolean(product));
}

function productMatchesMessage(product: ProductRecord, message: string): boolean {
  const searchTerm = extractSearchTerm(message);
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

function getTargetFavoriteProducts(
  message: string,
  favorites: FavoriteRecord,
): ProductRecord[] {
  const products = getFavoriteProducts(favorites);
  const ordinalIndex = getOrdinalIndex(message);

  if (ordinalIndex !== null) {
    const product = products[ordinalIndex];
    return product ? [product] : [];
  }

  const filteredProducts = products.filter((product) => productMatchesMessage(product, message));

  return filteredProducts.length > 0 ? filteredProducts : products;
}

function getStrictTargetFavoriteProducts(
  message: string,
  favorites: FavoriteRecord,
  memory: AiConciergeMemoryMessage[],
): ProductRecord[] {
  const products = getFavoriteProducts(favorites);
  const referencedSuggestion = getReferencedMemorySuggestion(message, memory);

  if (referencedSuggestion) {
    return products.filter((product) => product.id === referencedSuggestion.productId);
  }

  const ordinalIndex = getOrdinalIndex(message);

  if (ordinalIndex !== null) {
    const product = products[ordinalIndex];
    return product ? [product] : [];
  }

  return products.filter((product) => productMatchesMessage(product, message));
}

function cartItemMatchesMessage(item: CartItemRecord, message: string): boolean {
  const searchTerm = extractSearchTerm(message);
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
  message: string,
  items: CartItemRecord[],
  memory: AiConciergeMemoryMessage[],
): CartItemRecord[] {
  const referencedSuggestion = getReferencedMemorySuggestion(message, memory);

  if (referencedSuggestion) {
    return items.filter((item) => item.productId === referencedSuggestion.productId);
  }

  const ordinalIndex = getOrdinalIndex(message);

  if (ordinalIndex !== null) {
    const item = items[ordinalIndex];
    return item ? [item] : [];
  }

  return items.filter((item) => cartItemMatchesMessage(item, message));
}

async function buildRemovalReply(
  profile: AuthUserProfile,
  message: string,
  memory: AiConciergeMemoryMessage[] = [],
): Promise<AiConciergeResponse> {
  const hasCart = hasCartScope(message);
  const hasFavorites = hasFavoriteScope(message);
  const clearAll = isClearAllRequest(message);
  const shouldClearBoth = hasCart && hasFavorites && joinsCartAndFavorites(message);
  const clearCart = hasCart && clearAll;
  const clearFavorites = hasFavorites && clearAll && (!hasCart || shouldClearBoth);

  if (clearCart || clearFavorites) {
    const cart = clearCart ? await clearCartRecord(profile.firebaseUid) : undefined;
    const favorites = clearFavorites ? await clearFavoriteRecord(profile.firebaseUid) : undefined;
    const clearedTargets = [
      clearCart ? "reserve cart" : null,
      clearFavorites ? "Favorites desk" : null,
    ].filter(Boolean);

    return {
      body: `Cleared your ${clearedTargets.join(" and ")}. ${clearCart ? "The reserve cart is now empty." : ""} ${clearFavorites ? "Favorites now has no saved references." : ""}`.trim(),
      cart,
      context: {
        intent: "removal",
        matchedProducts: 0,
        recentOrders: 0,
      },
      favorites,
      source: "backend_context",
      suggestions: [
        ...(clearCart ? [cartPageSuggestion()] : []),
        ...(clearFavorites ? [favoritePageSuggestion()] : []),
      ],
    };
  }

  if (hasCartScope(message)) {
    const cartRecord = await getCartRecord(profile.firebaseUid);

    if (cartRecord.items.length === 0) {
      return {
        body: "Your reserve cart is already empty. There is no cart piece to remove.",
        cart: cartRecord,
        context: {
          intent: "removal",
          matchedProducts: 0,
          recentOrders: 0,
        },
        source: "backend_context",
        suggestions: [cartPageSuggestion()],
      };
    }

    const targetItems = getTargetCartItems(message, cartRecord.items, memory);

    if (targetItems.length === 0) {
      return {
        body: "I could not safely match which cart piece to remove. Use the product name, variant detail, or say \"remove first item from cart\". Say \"empty cart\" if you want to clear everything.",
        cart: cartRecord,
        context: {
          intent: "removal",
          matchedProducts: 0,
          recentOrders: 0,
        },
        source: "backend_context",
        suggestions: [cartPageSuggestion()],
      };
    }

    let nextCart = cartRecord;

    for (const item of targetItems) {
      nextCart = await removeCartItem(profile.firebaseUid, item.id);
    }

    return {
      body: `Removed ${targetItems.length} cart piece${targetItems.length === 1 ? "" : "s"}: ${targetItems.map((item) => `${item.productName} / ${item.variantSize} / ${item.variantColor}`).join("; ")}. Open the cart to review the remaining reserve items.`,
      cart: nextCart,
      context: {
        intent: "removal",
        matchedProducts: targetItems.length,
        recentOrders: 0,
      },
      source: "backend_context",
      suggestions: [cartPageSuggestion()],
    };
  }

  if (hasFavoriteScope(message)) {
    const favorites = await getFavoriteRecord(profile.firebaseUid);

    if (favorites.count === 0 || getFavoriteProducts(favorites).length === 0) {
      return {
        body: "Your Favorites desk is already empty. There is no saved reference to remove.",
        context: {
          intent: "removal",
          matchedProducts: 0,
          recentOrders: 0,
        },
        favorites,
        source: "backend_context",
        suggestions: [favoritePageSuggestion()],
      };
    }

    const targetProducts = getStrictTargetFavoriteProducts(message, favorites, memory);

    if (targetProducts.length === 0) {
      return {
        body: "I could not safely match which favorite to remove. Use the model name, or say \"remove first favorite\". Say \"empty favorites\" if you want to clear every saved reference.",
        context: {
          intent: "removal",
          matchedProducts: 0,
          recentOrders: 0,
        },
        favorites,
        source: "backend_context",
        suggestions: [
          favoritePageSuggestion(),
          ...getFavoriteProducts(favorites).slice(0, 3).map(productToSuggestion),
        ].slice(0, 4),
      };
    }

    let nextFavorites = favorites;

    for (const product of targetProducts) {
      nextFavorites = await removeFavoriteProduct(profile.firebaseUid, product.id);
    }

    return {
      body: `Removed ${targetProducts.length} saved reference${targetProducts.length === 1 ? "" : "s"} from Favorites: ${targetProducts.map((product) => product.name).join("; ")}.`,
      context: {
        intent: "removal",
        matchedProducts: targetProducts.length,
        recentOrders: 0,
      },
      favorites: nextFavorites,
      source: "backend_context",
      suggestions: [
        favoritePageSuggestion(),
        ...targetProducts.slice(0, 3).map(productToSuggestion),
      ].slice(0, 4),
    };
  }

  return {
    body: "I can remove pieces from the reserve cart or Favorites, but I need the destination to be explicit before deleting anything. Try \"remove Daytona from cart\", \"remove first favorite\", \"empty cart\", or \"empty favorites\".",
    context: {
      intent: "removal",
      matchedProducts: 0,
      recentOrders: 0,
    },
    source: "backend_context",
    suggestions: [
      cartPageSuggestion(),
      favoritePageSuggestion(),
    ],
  };
}

async function buildAddFavoriteReply(
  profile: AuthUserProfile,
  product: ProductRecord,
): Promise<AiConciergeResponse> {
  const favorites = await addFavoriteProduct(profile.firebaseUid, product.id);

  return {
    body: `${product.name} is saved to your Favorites desk. You can keep comparing pieces from there, or say "add favorites to cart" when you want me to stage saved references for checkout.`,
    context: {
      intent: "favorite",
      matchedProducts: 1,
      recentOrders: 0,
    },
    favorites,
    source: "backend_context",
    suggestions: [
      favoritePageSuggestion(),
      productToSuggestion(product),
      cartPageSuggestion(),
    ],
  };
}

async function buildFavoritesToCartReply(
  profile: AuthUserProfile,
  message: string,
): Promise<AiConciergeResponse> {
  const favorites = await getFavoriteRecord(profile.firebaseUid);
  const targetProducts = getTargetFavoriteProducts(message, favorites);

  if (favorites.count === 0 || getFavoriteProducts(favorites).length === 0) {
    return {
      body: "Your Favorites desk is empty right now. Save a reference first, then I can stage saved pieces into the reserve cart.",
      context: {
        intent: "cart",
        matchedProducts: 0,
        recentOrders: 0,
      },
      favorites,
      source: "backend_context",
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
      context: {
        intent: "cart",
        matchedProducts: 0,
        recentOrders: 0,
      },
      favorites,
      source: "backend_context",
      suggestions: [
        favoritePageSuggestion(),
        ...getFavoriteProducts(favorites).slice(0, 3).map(productToSuggestion),
      ].slice(0, 4),
    };
  }

  const intent = buildConciergeIntent(message);
  const quantity = extractCartQuantity(message);
  const addedLines: string[] = [];
  const skippedLines: string[] = [];
  let cart;

  for (const product of targetProducts) {
    const [choice] = getAvailableVariantChoices([product], intent);

    if (!choice) {
      skippedLines.push(`${product.name} (no matching in-stock variant)`);
      continue;
    }

    try {
      cart = await addCartItem(profile.firebaseUid, {
        productVariantId: choice.variant.id,
        quantity,
      });
      addedLines.push(
        `${product.name} / ${formatVariantSize(choice.variant.size)} / ${choice.variant.color}`,
      );
    } catch (error) {
      skippedLines.push(
        `${product.name} (${error instanceof Error ? error.message : "cart update failed"})`,
      );
    }
  }

  if (!cart || addedLines.length === 0) {
    return {
      body: `I found your saved references, but none could be staged into the reserve cart. ${skippedLines.length > 0 ? `Blocked: ${skippedLines.join("; ")}.` : "Try choosing a different saved piece or removing strict size/budget filters."}`,
      context: {
        intent: "cart",
        matchedProducts: 0,
        recentOrders: 0,
      },
      favorites,
      source: "backend_context",
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
    context: {
      intent: "cart",
      matchedProducts: addedLines.length,
      recentOrders: 0,
    },
    favorites,
    source: "backend_context",
    suggestions: [
      cartPageSuggestion(),
      favoritePageSuggestion(),
      ...targetProducts.slice(0, 2).map(productToSuggestion),
    ].slice(0, 4),
  };
}

async function buildFavoriteReply(
  profile: AuthUserProfile,
  message: string,
  memory: AiConciergeMemoryMessage[] = [],
): Promise<AiConciergeResponse> {
  if (isFavoritesToCartRequest(message)) {
    return buildFavoritesToCartReply(profile, message);
  }

  const referencedSuggestion = getReferencedMemorySuggestion(message, memory);

  if (referencedSuggestion) {
    const product = await getProductById(referencedSuggestion.productId);

    if (product) {
      return buildAddFavoriteReply(profile, product);
    }
  }

  const result = await getProductMatches(message);
  const products = result.products.filter((product) => !product.deletedAt).slice(0, 4);

  if (products.length === 1) {
    return buildAddFavoriteReply(profile, products[0]);
  }

  if (products.length > 1) {
    return {
      body: `I found ${products.length} possible references to save. Reply "save first one to favorites", "save second one", or send the exact model name so I do not save the wrong piece.`,
      context: {
        intent: "favorite",
        matchedProducts: products.length,
        recentOrders: 0,
      },
      source: "backend_context",
      suggestions: [
        ...products.slice(0, 3).map(productToSuggestion),
        favoritePageSuggestion(),
      ].slice(0, 4),
    };
  }

  return {
    body: "I can save a piece to Favorites once I can match the exact watch. Send a model, brand, reference, or use a shortlist command like \"save first one to favorites\".",
    context: {
      intent: "favorite",
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
      favoritePageSuggestion(),
    ],
  };
}

async function buildAddCartChoiceReply(
  profile: AuthUserProfile,
  choice: CartVariantChoice,
  quantity: number,
): Promise<AiConciergeResponse> {
  try {
    const cart = await addCartItem(profile.firebaseUid, {
      productVariantId: choice.variant.id,
      quantity,
    });

    return {
      body: `Added ${quantity} x ${choice.product.name} (${formatVariantSize(choice.variant.size)}, ${choice.variant.color}) to your reserve cart at ${formatPrice(choice.price)} each. Open the cart to review checkout details, payment method, and delivery address before creating the order.`,
      cart,
      context: {
        intent: "cart",
        matchedProducts: 1,
        recentOrders: 0,
      },
      source: "backend_context",
      suggestions: [
        cartPageSuggestion(),
        productToSuggestion(choice.product),
      ],
    };
  } catch (error) {
    return {
      body: `I matched ${choice.product.name}, but I could not update the reserve cart because ${error instanceof Error ? error.message : "the cart update failed"}. You can still open the product page and reserve it manually, or send a different quantity.`,
      context: {
        intent: "cart",
        matchedProducts: 1,
        recentOrders: 0,
      },
      source: "backend_context",
      suggestions: [
        productToSuggestion(choice.product),
        cartPageSuggestion(),
      ],
    };
  }
}

async function buildCartReply(
  profile: AuthUserProfile,
  message: string,
  memory: AiConciergeMemoryMessage[] = [],
): Promise<AiConciergeResponse> {
  const quantity = extractCartQuantity(message);
  const referencedSuggestion = getReferencedMemorySuggestion(message, memory);

  if (referencedSuggestion && isDirectCartAddRequest(message)) {
    const product = await getProductById(referencedSuggestion.productId);

    if (product) {
      const [choice] = getAvailableVariantChoices([product], buildConciergeIntent(message));

      if (choice) {
        return buildAddCartChoiceReply(profile, choice, quantity);
      }

      return {
        body: `I matched ${referencedSuggestion.name} from the previous shortlist, but I could not find an in-stock variant that fits this exact request. Send a case size or open the product card to choose a variant manually.`,
        context: {
          intent: "cart",
          matchedProducts: 1,
          recentOrders: 0,
        },
        source: "backend_context",
        suggestions: [
          referencedSuggestion,
          cartPageSuggestion(),
        ],
      };
    }
  }

  const result = await getProductMatches(message);
  const visibleProducts = result.products.filter((product) => getTotalProductStock(product) > 0);
  const variantChoices = getAvailableVariantChoices(visibleProducts, result.intent);
  const selectedChoice = selectAutoAddChoice(message, result, variantChoices);
  const suggestions = visibleProducts.slice(0, 3).map(productToSuggestion);

  if (selectedChoice) {
    return buildAddCartChoiceReply(profile, selectedChoice, quantity);
  }

  if (suggestions.length === 0 || variantChoices.length === 0) {
    return {
      body: "I can help prepare a reserve cart, but I could not find an in-stock variant that safely matches that request. Send a brand, reference, size, or budget such as \"Rolex under $30k\" and I will shortlist pieces that can be reserved.",
      context: {
        intent: "cart",
        matchedProducts: 0,
        recentOrders: 0,
      },
      source: "backend_context",
      suggestions: [
        pageSuggestion({
          href: "/collection",
          name: "Collection",
          priceLabel: "Find reserve pieces",
          productId: "collection",
        }),
        cartPageSuggestion(),
      ],
    };
  }

  const priceRange = getVariantChoicePriceRange(variantChoices);
  const brief = buildConciergeQueryLabel(result.intent, result.label);
  const variantLines = variantChoices
    .slice(0, 4)
    .map((choice, index) => `${index + 1}. ${variantChoiceLine(choice)}`)
    .join(" ");
  const sizeGuidance = result.intent.size
    ? "The requested size is already applied."
    : "If you do not know the size yet, choose the watch first; 39-41mm is usually the safest daily range, while 36-38mm feels more restrained.";
  const commandExample = variantChoiceCommand(variantChoices[0]);

  return {
    body: `I found ${variantChoices.length} reservable variant${variantChoices.length === 1 ? "" : "s"} for ${brief}. Recommended variants: ${variantLines}. Indicative range: ${priceRange}. ${sizeGuidance} Reply "${commandExample}" and I can stage that exact variant in your reserve cart.`,
    context: {
      intent: "cart",
      matchedProducts: variantChoices.length,
      recentOrders: 0,
    },
    source: "backend_context",
    suggestions: [
      ...suggestions,
      cartPageSuggestion(),
    ].slice(0, 4),
  };
}

async function buildCompareReply(message: string): Promise<AiConciergeResponse> {
  const products = (await getCompareProducts(message)).slice(0, 3);
  const suggestions = products.map(productToSuggestion);

  if (products.length < 2) {
    return {
      body: "I can compare watches once I can match at least two pieces from live inventory. Try two clear model names or references, for example \"compare Daytona and Oyster\", \"Daytona vs Big Bang\", or \"compare sport watches under $30k\".",
      context: {
        intent: "compare",
        matchedProducts: products.length,
        recentOrders: 0,
      },
      source: "backend_context",
      suggestions: suggestions.length > 0
        ? suggestions
        : [
            pageSuggestion({
              href: "/collection",
              name: "Collection",
              priceLabel: "Browse options",
              productId: "collection",
            }),
          ],
    };
  }

  const comparisonLines = products.map((product) => {
    const stock = getProductStockLabel(product).toLowerCase();
    return `${product.name}: ${formatPrice(getLowestProductPrice(product))}, ${product.type}, ${stock}`;
  });

  return {
    body: `Here is a quick desk-style comparison from live inventory. ${comparisonLines.join(" | ")}. For purchase intent, pick the piece with the strongest fit on wrist, then confirm variant, condition, and allocation with the desk.`,
    context: {
      intent: "compare",
      matchedProducts: products.length,
      recentOrders: 0,
    },
    source: "backend_context",
    suggestions,
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

function getRecommendationReason(product: ProductRecord, intent: ConciergeIntent): string {
  const price = getLowestProductPrice(product);
  const reasons = [
    price !== null && intent.budgetMax !== undefined && price <= intent.budgetMax
      ? `budget fit under ${formatPrice(intent.budgetMax)}`
      : null,
    price !== null && intent.budgetMin !== undefined && price >= intent.budgetMin
      ? `value positioned above ${formatPrice(intent.budgetMin)}`
      : null,
    intent.size && productHasSize(product, intent.size)
      ? `requested ${formatVariantSize(intent.size)} case sizing`
      : null,
    intent.occasion && productMatchesOccasion(product, intent.occasion)
      ? `${intent.occasion} use-case fit`
      : null,
    getTotalProductStock(product) <= 2
      ? "limited but available stock"
      : "comfortable live stock",
  ].filter(Boolean);

  return reasons.join(", ");
}

function getRecommendationVariantCommand(
  product: ProductRecord,
  intent: ConciergeIntent,
): string | null {
  const [choice] = getAvailableVariantChoices([product], intent);

  return choice ? variantChoiceCommand(choice) : null;
}

function getRecommendationFollowUp(intent: ConciergeIntent): string {
  if (!intent.budgetMax && !intent.budgetMin) {
    return "Add a budget and I can tighten this into a purchase-ready shortlist.";
  }

  if (!intent.size) {
    return "If case size matters, send a wrist size or target diameter and I will rerank the options.";
  }

  if (!intent.occasion) {
    return "Tell me daily, formal, sport, or collector use and I will refine the recommendation.";
  }

  return "Confirm the exact variant when ready and I can stage it in the reserve cart.";
}

async function buildRecommendationReply(
  message: string,
  memory: AiConciergeMemoryMessage[] = [],
): Promise<AiConciergeResponse> {
  const result = await getProductMatches(message);
  const memoryProducts = isMemoryRefinement(message, memory)
    ? await getMemoryProducts(memory)
    : [];
  let candidateProducts = memoryProducts.length > 0
    ? memoryProducts.filter((product) => {
        const hasSpecificFilter =
          result.intent.budgetMax !== undefined ||
          result.intent.budgetMin !== undefined ||
          Boolean(result.intent.size);

        return hasSpecificFilter
          ? getAvailableVariantChoices([product], result.intent).length > 0
          : getTotalProductStock(product) > 0;
      })
    : result.products;

  if (candidateProducts.length === 0) {
    const discovery = await getProductDiscovery({
      availability: "all",
      priceMax: result.intent.budgetMax,
      priceMin: result.intent.budgetMin,
      size: result.intent.size,
      sort: result.intent.budgetMax ? "price-asc" : "newest",
    });

    candidateProducts = discovery.items;
  }

  const availableProducts = [...candidateProducts]
    .filter((product) => getTotalProductStock(product) > 0)
    .sort(
      (left, right) =>
        scoreConciergeProduct(right, result.intent) -
          scoreConciergeProduct(left, result.intent) ||
        (getLowestProductPrice(left) ?? Number.MAX_SAFE_INTEGER) -
          (getLowestProductPrice(right) ?? Number.MAX_SAFE_INTEGER),
    );
  const suggestions = availableProducts.slice(0, 3).map(productToSuggestion);

  if (suggestions.length === 0) {
    return {
      body: "I can recommend a watch, but I do not see a clean in-stock match for that request yet. Send a budget, brand, case size, or use case like daily, formal, sport, or collector and I will build a sharper shortlist.",
      context: {
        intent: "recommendation",
        matchedProducts: 0,
        recentOrders: 0,
      },
      source: "backend_context",
      suggestions: [
        pageSuggestion({
          href: "/collection",
          name: "Collection",
          priceLabel: "Browse live inventory",
          productId: "collection",
        }),
      ],
    };
  }

  const recommendationLines = availableProducts
    .slice(0, 3)
    .map((product, index) => {
      const reason = getRecommendationReason(product, result.intent);
      return `${index + 1}. ${product.name}: ${formatPrice(getLowestProductPrice(product))}, ${product.type}, ${getProductStockLabel(product).toLowerCase()}${reason ? ` - ${reason}` : ""}`;
    })
    .join(" ");
  const primaryProduct = availableProducts[0];
  const command = getRecommendationVariantCommand(primaryProduct, result.intent);
  const brief = buildConciergeQueryLabel(result.intent, result.label || "your request");
  const lead = memoryProducts.length > 0
    ? `I narrowed the previous shortlist for ${brief}`
    : result.searchTerm || result.intent.budgetMax || result.intent.size || result.intent.occasion
      ? `My recommendation shortlist for ${brief}`
      : "My safest starting recommendations from live inventory";
  const nextStep = command
    ? `To stage the strongest match, reply "${command}".`
    : "Open the product card to choose the exact variant before checkout.";

  return {
    body: `${lead}: ${recommendationLines}. First pick: ${primaryProduct.name}, because it offers ${getRecommendationReason(primaryProduct, result.intent)}. ${getRecommendationFollowUp(result.intent)} ${nextStep}`,
    context: {
      intent: "recommendation",
      matchedProducts: availableProducts.length,
      recentOrders: 0,
    },
    source: "backend_context",
    suggestions,
  };
}

function detectIntent(message: string): ConciergeIntentLabel {
  if (isRemovalRequest(message)) {
    return "removal";
  }

  if (isFavoritesToCartRequest(message) || isFavoriteSaveRequest(message)) {
    return "favorite";
  }

  if (isDirectCartAddRequest(message)) {
    return "cart";
  }

  if (includesAnyKeyword(message, CART_KEYWORDS)) {
    return "cart";
  }

  if (includesAnyKeyword(message, COMPARE_KEYWORDS)) {
    return "compare";
  }

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

  if (includesAnyKeyword(message, WATCHROOM_BRAND_KEYWORDS)) {
    return "watchroom";
  }

  if (includesAnyKeyword(message, IDENTITY_KEYWORDS)) {
    return "identity";
  }

  if (includesAnyKeyword(message, CAPABILITY_KEYWORDS)) {
    return "capability";
  }

  if (includesAnyKeyword(message, WELLBEING_KEYWORDS)) {
    return "wellbeing";
  }

  if (includesAnyKeyword(message, THANKS_KEYWORDS)) {
    return "thanks";
  }

  if (includesAnyKeyword(message, FAREWELL_KEYWORDS)) {
    return "farewell";
  }

  if (includesAnyKeyword(message, GREETING_KEYWORDS)) {
    return "greeting";
  }

  if (includesAnyKeyword(message, RECOMMENDATION_KEYWORDS)) {
    return "recommendation";
  }

  if (
    includesAnyKeyword(message, SIZING_ADVICE_KEYWORDS) ||
    (includesAnyKeyword(message, SIZE_KEYWORDS) && !includesAnyKeyword(message, PRODUCT_KEYWORDS))
  ) {
    return "sizing";
  }

  if (
    includesAnyKeyword(message, PRODUCT_KEYWORDS) ||
    includesAnyKeyword(message, PRICE_KEYWORDS) ||
    includesAnyKeyword(message, DRESS_WATCH_KEYWORDS) ||
    includesAnyKeyword(message, SIZE_KEYWORDS)
  ) {
    return "product";
  }

  if (includesAnyKeyword(message, OFF_TOPIC_KEYWORDS)) {
    return "off_topic";
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

  if (intent === "watchroom") {
    return {
      body: "Sovereign Watchroom is built as a private luxury watch marketplace: curated inventory, reserve-cart checkout, authenticated handover, order tracking, and admin-led operations. The AI concierge helps narrow choices and prepare context before the live desk steps in.",
      context: {
        intent,
        matchedProducts: 0,
        recentOrders: 0,
      },
      source: "backend_context",
      suggestions: [
        pageSuggestion({
          href: "/about",
          name: "About Watchroom",
          priceLabel: "Brand profile",
          productId: "about",
        }),
        pageSuggestion({
          href: "/client-services",
          name: "Client Services",
          priceLabel: "Concierge support",
          productId: "client-services",
        }),
        pageSuggestion({
          href: "/collection",
          name: "Collection",
          priceLabel: "Curated pieces",
          productId: "collection",
        }),
      ],
    };
  }

  if (intent === "identity") {
    return {
      body: "I am the Sovereign AI Concierge, the assistant inside Watchroom. I help with product discovery, budget matching, watch comparison, favorite saving, reserve-cart preparation, order context, shipping, payment, authentication, and aftercare questions.",
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
          priceLabel: "Search inventory",
          productId: "collection",
        }),
        pageSuggestion({
          href: "/client-services",
          name: "Client Services",
          priceLabel: "Desk support",
          productId: "client-services",
        }),
      ],
    };
  }

  if (intent === "wellbeing") {
    return {
      body: "I am running smoothly, thanks for checking in. I am here whenever you want to narrow a watch by budget, size, use case, availability, or order status.",
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
          priceLabel: "Browse watches",
          productId: "collection",
        }),
      ],
    };
  }

  if (intent === "thanks") {
    return {
      body: "You are welcome. Send a model, budget, wrist size, occasion, or order number whenever you want me to narrow the next step.",
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
          priceLabel: "Continue browsing",
          productId: "collection",
        }),
      ],
    };
  }

  if (intent === "farewell") {
    return {
      body: "See you soon. I will keep this thread ready whenever you want to continue with a watch, reserve cart, order, or delivery question.",
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
          priceLabel: "Return anytime",
          productId: "collection",
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

  if (intent === "sizing") {
    return {
      body: "For most wrists, 36-38mm feels restrained, 39-41mm is the safest daily range, and 42mm+ reads more sport-forward. Lug-to-lug, bracelet fit, and case thickness matter as much as diameter, so send your wrist size and preferred style if you want a cleaner shortlist.",
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
          priceLabel: "Filter by size",
          productId: "collection",
        }),
        pageSuggestion({
          href: "/client-services",
          name: "Client Services",
          priceLabel: "Fit guidance",
          productId: "client-services",
        }),
      ],
    };
  }

  if (intent === "capability") {
    return {
      body: "I can help with inventory search, budget matching, case size guidance, product comparison, saving pieces to Favorites, staging saved references into the reserve cart, payment and shipping policy, authentication notes, warranty context, and live order status. I will keep answers tied to Watchroom data whenever possible.",
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
          priceLabel: "Search watches",
          productId: "collection",
        }),
        pageSuggestion({
          href: "/orders",
          name: "Orders",
          priceLabel: "Track status",
          productId: "orders",
        }),
        pageSuggestion({
          href: "/cart",
          name: "Reserve Cart",
          priceLabel: "Prepare checkout",
          productId: "cart",
        }),
      ],
    };
  }

  if (intent === "off_topic") {
    return {
      body: "I am scoped to Watchroom support, so I will keep this chat focused on watches, inventory, reserve cart, orders, payment, shipping, authentication, and aftercare. Send a model, budget, wrist size, or order number and I will help from there.",
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
          priceLabel: "Browse watches",
          productId: "collection",
        }),
        pageSuggestion({
          href: "/client-services",
          name: "Client Services",
          priceLabel: "Support scope",
          productId: "client-services",
        }),
      ],
    };
  }

  return null;
}

export async function buildAiConciergeReply(
  profile: AuthUserProfile,
  message: string,
  memory: AiConciergeMemoryMessage[] = [],
): Promise<AiConciergeResponse> {
  const contextualMessage = buildContextualMessage(message, memory);
  let intent = detectIntent(contextualMessage);

  if (
    (intent === "general" || intent === "sizing" || intent === "product") &&
    isMemoryRefinement(message, memory)
  ) {
    intent = "recommendation";
  }

  if (intent === "cart") {
    return buildCartReply(profile, message, memory);
  }

  if (intent === "removal") {
    return buildRemovalReply(profile, message, memory);
  }

  if (intent === "favorite") {
    return buildFavoriteReply(profile, message, memory);
  }

  if (intent === "compare") {
    return buildCompareReply(contextualMessage);
  }

  if (intent === "product") {
    return buildProductReply(contextualMessage);
  }

  if (intent === "recommendation") {
    return buildRecommendationReply(contextualMessage, memory);
  }

  if (intent === "order") {
    return buildOrderReply(contextualMessage, await getRecentOrders(profile));
  }

  const reply = policyReply(intent, contextualMessage);

  if (reply) {
    return reply;
  }

  return {
    body: "I am here with you. I can be most useful when the question connects to Watchroom, watches, inventory, reserve cart, orders, payment, shipping, authentication, or aftercare. Send one clear detail and I will turn it into the next useful step.",
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
