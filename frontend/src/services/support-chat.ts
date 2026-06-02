import {
  addDoc,
  collection,
  doc,
  type DocumentSnapshot,
  getDoc,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
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

interface SendCustomerMessageInput {
  adminOnline: boolean;
  body: string;
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

const ADMIN_PRESENCE_DOC_ID = "admin";
const ADMIN_PRESENCE_STALE_MS = 75_000;
const CONVERSATIONS_COLLECTION = "supportConversations";
const MESSAGES_COLLECTION = "messages";

const PRODUCT_KEYWORDS = [
  "dong ho",
  "find",
  "kiem",
  "kiếm",
  "product",
  "reference",
  "rolex",
  "search",
  "tim",
  "tìm",
  "watch",
];
const PRICE_KEYWORDS = ["bao nhiêu", "cost", "gia", "giá", "price"];
const SHIPPING_KEYWORDS = [
  "delivery",
  "giao",
  "return",
  "shipping",
  "ship",
  "trả",
  "vận chuyển",
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

function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function includesAnyKeyword(value: string, keywords: string[]): boolean {
  const normalized = normalizeForSearch(value);
  return keywords.some((keyword) => normalized.includes(keyword));
}

function mapConversationSnapshot(
  snapshot: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>,
): SupportConversation {
  const data = snapshot.data() ?? {};

  return {
    assignedAdminEmail: String(data.assignedAdminEmail ?? ""),
    assignedAdminId: data.assignedAdminId ? String(data.assignedAdminId) : null,
    assignedAdminName: String(data.assignedAdminName ?? ""),
    createdAt: toIsoDate(data.createdAt),
    id: snapshot.id,
    lastMessage: String(data.lastMessage ?? ""),
    lastMessageAt: toIsoDate(data.lastMessageAt),
    mode: (data.mode === "human" ? "human" : "bot") satisfies SupportConversationMode,
    status: data.status === "closed" ? "closed" : "open",
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

  return {
    body: String(data.body ?? ""),
    conversationId: String(data.conversationId ?? ""),
    createdAt: toIsoDate(data.createdAt),
    id: snapshot.id,
    senderId: String(data.senderId ?? ""),
    senderName: String(data.senderName ?? ""),
    senderRole,
    suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
  };
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

function extractSearchTerm(body: string): string {
  return normalizeForSearch(body)
    .replace(/\b(bao nhieu|cost|dong ho|find|gia|kiem|price|product|search|tim|watch)\b/g, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function buildBotReply(body: string): Promise<BotReply> {
  const asksAboutProducts =
    includesAnyKeyword(body, PRODUCT_KEYWORDS) ||
    includesAnyKeyword(body, PRICE_KEYWORDS);
  const asksAboutShipping = includesAnyKeyword(body, SHIPPING_KEYWORDS);

  if (asksAboutProducts) {
    const search = extractSearchTerm(body) || body.trim();
    const discovery = await storefrontApi.getProductDiscovery({
      availability: "all",
      search,
      sort: "newest",
    });
    const suggestions = discovery.items.slice(0, 3).map(productToSuggestion);

    if (suggestions.length > 0) {
      return {
        body: includesAnyKeyword(body, PRICE_KEYWORDS)
          ? "Mình tìm thấy vài mẫu có giá tham khảo bên dưới. Admin sẽ xác nhận lại tình trạng và giá cuối khi online."
          : "Mình tìm thấy vài mẫu gần với yêu cầu của bạn. Bạn có thể mở nhanh từng sản phẩm để xem chi tiết.",
        suggestions,
      };
    }

    return {
      body: "Mình chưa tìm thấy mẫu khớp hoàn toàn. Bạn có thể gửi thêm brand, size hoặc tên reference để mình lọc lại.",
      suggestions: [],
    };
  }

  if (asksAboutShipping) {
    return {
      body: "Với shipping hoặc return, bạn có thể xem nhanh trang Shipping. Nếu có mã đơn hàng, gửi thêm để admin kiểm tra khi online.",
      suggestions: [
        {
          href: "/shipping-returns",
          image: "",
          name: "Shipping & Returns",
          priceLabel: "Policy",
          productId: "shipping-returns",
          type: "Company page",
        },
      ],
    };
  }

  return {
    body: "Mình đã ghi nhận tin nhắn. Hiện admin chưa online, nhưng bạn vẫn có thể hỏi nhanh về giá, tìm sản phẩm, shipping hoặc order.",
    suggestions: [],
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
  onChange: (conversations: SupportConversation[]) => void,
  onError?: (error: FirestoreError) => void,
): Unsubscribe {
  const conversationsQuery = query(
    collection(getFirebaseClientDb(), CONVERSATIONS_COLLECTION),
    orderBy("updatedAt", "desc"),
    limit(40),
  );

  return onSnapshot(
    conversationsQuery,
    (snapshot) => {
      onChange(snapshot.docs.map(mapConversationSnapshot));
    },
    onError,
  );
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
  user,
}: SendCustomerMessageInput): Promise<void> {
  const trimmedBody = body.trim();

  if (!trimmedBody) {
    return;
  }

  const ref = conversationRef(user.id);
  const existingConversation = await getDoc(ref);
  const messageRef = doc(messagesRef(user.id));
  const mode: SupportConversationMode = adminOnline ? "human" : "bot";
  const batch = writeBatch(getFirebaseClientDb());

  batch.set(
    ref,
    {
      assignedAdminEmail: existingConversation.data()?.assignedAdminEmail ?? "",
      assignedAdminId: existingConversation.data()?.assignedAdminId ?? null,
      assignedAdminName: existingConversation.data()?.assignedAdminName ?? "",
      createdAt: existingConversation.exists()
        ? existingConversation.data().createdAt
        : serverTimestamp(),
      id: user.id,
      lastMessage: trimmedBody,
      lastMessageAt: serverTimestamp(),
      mode,
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
    conversationId: user.id,
    createdAt: serverTimestamp(),
    id: messageRef.id,
    senderId: user.id,
    senderName: user.fullName || user.email,
    senderRole: "user",
    suggestions: [],
  });

  await batch.commit();

  if (adminOnline) {
    return;
  }

  const botReply = await buildBotReply(trimmedBody);

  await addDoc(messagesRef(user.id), {
    body: botReply.body,
    conversationId: user.id,
    createdAt: serverTimestamp(),
    senderId: "support-bot",
    senderName: "Sovereign bot",
    senderRole: "bot",
    suggestions: botReply.suggestions,
  });
  await setDoc(
    ref,
    {
      lastMessage: botReply.body,
      lastMessageAt: serverTimestamp(),
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
  const trimmedBody = body.trim();

  if (!trimmedBody) {
    return;
  }

  const ref = conversationRef(conversationId);
  const messageRef = doc(messagesRef(conversationId));
  const batch = writeBatch(getFirebaseClientDb());

  batch.set(messageRef, {
    body: trimmedBody,
    conversationId,
    createdAt: serverTimestamp(),
    id: messageRef.id,
    senderId: admin.id,
    senderName: admin.fullName || admin.email,
    senderRole: "admin",
    suggestions: [],
  });
  batch.set(
    ref,
    {
      assignedAdminEmail: admin.email,
      assignedAdminId: admin.id,
      assignedAdminName: admin.fullName || admin.email,
      lastMessage: trimmedBody,
      lastMessageAt: serverTimestamp(),
      mode: "human",
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
