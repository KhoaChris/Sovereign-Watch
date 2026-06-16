import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Link } from "react-router-dom";
import {
  Archive,
  ArchiveRestore,
  Bot,
  ChevronDown,
  ChevronRight,
  Headphones,
  MessageCircle,
  ReceiptText,
  Search,
  Send,
  ShieldAlert,
  Trash2,
  UserRound,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";

import { useStorefront } from "../storefront/storefront-context";
import { mergeAdminCatalogDrafts } from "../services/admin-catalog-drafts";
import { storefrontApi } from "../services/api";
import {
  clearFirebaseClientSession,
  ensureFirebaseClientSession,
} from "../services/firebase-client";
import {
  clearSupportConversationHistory,
  loadMoreSupportConversations,
  markSupportConversationRead,
  sendAdminSupportMessage,
  sendCustomerSupportMessage,
  setAdminPresence,
  setSupportConversationArchived,
  subscribeAdminPresence,
  subscribeCustomerConversation,
  subscribeSupportConversations,
  subscribeSupportMessages,
  type AdminPresenceState,
  type SupportConversationPageCursor,
} from "../services/support-chat";
import type {
  AdminAiOperationsMemoryMessage,
  OrderRecord,
  SupportChatChannel,
  SupportChatMessage,
  SupportConversation,
  SupportConversationStatus,
} from "../shared";
import "../styles/components/support-chat.css";

const CONVERSATION_PAGE_SIZE = 25;
const QUICK_PROMPTS = [
  "Rolex under $30k",
  "Build reserve cart under $30k",
  "40mm daily watch",
  "Compare Daytona and Oyster",
  "Shipping & authentication",
  "Track my order",
];
const ADMIN_AI_QUICK_PROMPTS = [
  "Operations summary",
  "Compare revenue vs last month",
  "Suggest strategy",
  "Add 10 more new products",
  "Orders pending shipment",
  "Low stock products",
];
type ConversationStatusFilter = Extract<SupportConversationStatus, "open" | "archived">;
type CustomerSupportChannel = SupportChatChannel;
type AdminChatMode = "live" | "ai";
const ADMIN_AI_MEMORY_BODY_MAX = 900;

function formatChatTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getConversationLabel(conversation: SupportConversation): string {
  return conversation.userName || conversation.userEmail || "Watchroom Client";
}

function getConversationMeta(conversation: SupportConversation): string {
  if (conversation.status === "archived") {
    return "Archived";
  }

  return conversation.mode === "human" ? "Admin live" : "Bot fallback";
}

function getConversationInitials(conversation: SupportConversation): string {
  const label = getConversationLabel(conversation)
    .replace(/@.*/, "")
    .trim();
  const parts = label.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return (parts[0] ?? "WC").slice(0, 2).toUpperCase();
}

function normalizeConversationText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function formatStatusLabel(value?: string | null): string {
  if (!value) {
    return "Pending";
  }

  return value
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function getActiveOrderCount(orders: OrderRecord[]): number {
  return orders.filter(
    (order) => !["cancelled", "delivered"].includes(order.status),
  ).length;
}

function mergeConversations(
  current: SupportConversation[],
  incoming: SupportConversation[],
): SupportConversation[] {
  const byId = new Map<string, SupportConversation>();

  [...current, ...incoming].forEach((conversation) => {
    byId.set(conversation.id, conversation);
  });

  return Array.from(byId.values()).sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

function createLocalMessageId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function compactAdminAiMemoryText(value: string, maxLength = ADMIN_AI_MEMORY_BODY_MAX): string {
  return value.trim().slice(0, maxLength);
}

function createAdminAiMessage({
  body,
  senderRole,
  suggestions = [],
  user,
}: {
  body: string;
  senderRole: "admin" | "bot";
  suggestions?: SupportChatMessage["suggestions"];
  user?: ReturnType<typeof useStorefront>["user"];
}): SupportChatMessage {
  const createdAt = new Date().toISOString();

  return {
    body,
    channel: "ai",
    conversationId: "admin-ai-operations",
    createdAt,
    id: createLocalMessageId(),
    moderationFlags: [],
    senderId: senderRole === "admin" ? user?.id ?? "admin" : "operations-ai",
    senderName:
      senderRole === "admin"
        ? user?.fullName || "Admin"
        : "Sovereign Operations AI",
    senderRole,
    suggestions,
  };
}

function EmptyMessages({
  channel = "admin",
  isAdminAi = false,
  isAdmin,
}: {
  channel?: CustomerSupportChannel;
  isAdminAi?: boolean;
  isAdmin: boolean;
}) {
  const isAiChannel = channel === "ai";

  return (
    <div className="support-chat__empty">
      {isAdminAi || (isAiChannel && !isAdmin) ? (
        <Bot className="support-chat__empty-icon" />
      ) : (
        <MessageCircle className="support-chat__empty-icon" />
      )}
      <p>
        {isAdminAi
          ? "Ask the operations assistant."
          : isAdmin
          ? "Select a customer conversation."
          : isAiChannel
            ? "Ask the AI concierge."
            : "Message the admin desk."}
      </p>
      <span>
        {isAdminAi
          ? "Revenue, fulfillment, stock pressure, and product lookup stay separate from customer support."
          : isAdmin
          ? "New customer messages appear here in realtime."
          : isAiChannel
            ? "Curated guidance for price, product fit, shipping, payment, and orders."
            : "A live admin can review your request and reply in realtime."}
      </span>
    </div>
  );
}

function MessageBubble({
  message,
  viewerRole,
}: {
  message: SupportChatMessage;
  viewerRole: "admin" | "user";
}) {
  const isOutbound = message.senderRole === viewerRole;
  const isBot = message.senderRole === "bot";
  const hasModerationFlags = message.moderationFlags.length > 0;
  const channelLabel = message.channel === "ai" ? "AI" : "Admin";

  return (
    <article
      className={`support-chat__message ${
        isOutbound ? "support-chat__message--outbound" : ""
      } ${isBot ? "support-chat__message--bot" : ""}`}
    >
      <div className="support-chat__message-head">
        <span>
          {message.senderName || (isBot ? "Sovereign AI Concierge" : "Client")}
          {viewerRole === "admin" ? (
            <em className="support-chat__message-channel">{channelLabel}</em>
          ) : null}
        </span>
        <time>{formatChatTime(message.createdAt)}</time>
      </div>
      <p>{message.body}</p>
      {hasModerationFlags ? (
        <span className="support-chat__message-flag">
          <ShieldAlert className="support-chat__icon" />
          Flagged for review
        </span>
      ) : null}

      {message.suggestions.length > 0 ? (
        <div className="support-chat__suggestions">
          {message.suggestions.map((suggestion) => (
            <Link
              className="support-chat__suggestion"
              key={`${message.id}-${suggestion.productId}`}
              to={suggestion.href}
            >
              {suggestion.image ? (
                <img
                  alt=""
                  className="support-chat__suggestion-image"
                  src={suggestion.image}
                />
              ) : (
                <span className="support-chat__suggestion-image support-chat__suggestion-image--empty">
                  <ChevronRight className="support-chat__suggestion-icon" />
                </span>
              )}
              <span className="support-chat__suggestion-copy">
                <strong>{suggestion.name}</strong>
                <span>{suggestion.priceLabel}</span>
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function SupportChatWidget() {
  const {
    isAdmin,
    isAuthenticated,
    openAuthModal,
    user,
  } = useStorefront();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [adminPresence, setAdminPresenceState] = useState<AdminPresenceState>({
    email: "",
    name: "",
    online: false,
    updatedAt: "",
    userId: "",
  });
  const [customerConversation, setCustomerConversation] =
    useState<SupportConversation | null>(null);
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [conversationCursor, setConversationCursor] =
    useState<SupportConversationPageCursor | null>(null);
  const [conversationStatusFilter, setConversationStatusFilter] =
    useState<ConversationStatusFilter>("open");
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const [loadingMoreConversations, setLoadingMoreConversations] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    null,
  );
  const [adminOrders, setAdminOrders] = useState<OrderRecord[]>([]);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportChatMessage[]>([]);
  const [adminMode, setAdminMode] = useState<AdminChatMode>("live");
  const [adminAiMessages, setAdminAiMessages] = useState<SupportChatMessage[]>([]);
  const [customerChannel, setCustomerChannel] =
    useState<CustomerSupportChannel | null>(null);
  const [conversationSearch, setConversationSearch] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [customerContextExpanded, setCustomerContextExpanded] = useState(false);
  const [archivingConversation, setArchivingConversation] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const isAdminAiMode = isAdmin && adminMode === "ai";

  const activeConversationId = isAdmin
    ? isAdminAiMode
      ? null
      : selectedConversationId
    : user?.id ?? null;
  const activeConversation = useMemo(() => {
    if (isAdminAiMode) {
      return null;
    }

    if (!isAdmin) {
      return customerConversation;
    }

    return (
      conversations.find(
        (conversation) => conversation.id === selectedConversationId,
      ) ?? null
    );
  }, [
    conversations,
    customerConversation,
    isAdmin,
    isAdminAiMode,
    selectedConversationId,
  ]);

  const filteredConversations = useMemo(() => {
    const searchTerm = normalizeConversationText(conversationSearch.trim());
    const statusFilteredConversations = conversations.filter(
      (conversation) => conversation.status === conversationStatusFilter,
    );

    if (!searchTerm) {
      return statusFilteredConversations;
    }

    return statusFilteredConversations.filter((conversation) => {
      const searchableText = normalizeConversationText(
        [
          getConversationLabel(conversation),
          conversation.userEmail,
          conversation.lastMessage,
          getConversationMeta(conversation),
        ].join(" "),
      );

      return searchableText.includes(searchTerm);
    });
  }, [conversationSearch, conversationStatusFilter, conversations]);

  const activeConversationOrders = useMemo(() => {
    if (!isAdmin || !activeConversation) {
      return [];
    }

    return adminOrders
      .filter((order) => order.customerId === activeConversation.userId)
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      );
  }, [activeConversation, adminOrders, isAdmin]);

  const latestOrder = activeConversationOrders[0] ?? null;
  const activeOrderCount = getActiveOrderCount(activeConversationOrders);
  const activeConversationContextId = activeConversation?.id ?? null;
  const activeCustomerChannel: CustomerSupportChannel = isAdmin
    ? "admin"
    : customerChannel ?? (adminPresence.online ? "admin" : "ai");
  const isCustomerAdminChannelLocked =
    !isAdmin && activeCustomerChannel === "admin" && !adminPresence.online;
  const visibleMessages = useMemo(
    () =>
      isAdminAiMode
        ? adminAiMessages
        : isAdmin
        ? messages
        : messages.filter((message) => message.channel === activeCustomerChannel),
    [activeCustomerChannel, adminAiMessages, isAdmin, isAdminAiMode, messages],
  );

  const onlineLabel = isAdmin
    ? "Admin online"
    : adminPresence.online
      ? "Admin online"
      : "AI concierge";
  const headerTitle = isAdmin
    ? isAdminAiMode
      ? "Store AI"
      : "Live desk"
    : activeCustomerChannel === "admin"
      ? adminPresence.online
        ? "Admin online"
        : "Admin offline"
      : "AI concierge";
  const statusLabel = isAdmin
    ? isAdminAiMode
      ? "Operations AI ready"
      : "Admin online"
    : activeCustomerChannel === "admin"
      ? adminPresence.online
        ? "Admin online"
        : "Admin offline"
      : "Concierge ready";

  useEffect(() => {
    setCustomerContextExpanded(false);
  }, [activeConversationContextId]);

  useEffect(() => {
    let active = true;

    if (!user) {
      setReady(false);
      setSetupError(null);
      setCustomerConversation(null);
      setConversations([]);
      setConversationCursor(null);
      setHasMoreConversations(false);
      setSelectedConversationId(null);
      setMessages([]);
      setAdminMode("live");
      setAdminAiMessages([]);
      setCustomerChannel(null);
      setAdminOrders([]);
      void clearFirebaseClientSession();
      return;
    }

    setReady(false);
    setSetupError(null);

    const connect = async () => {
      try {
        const { customToken } = await storefrontApi.getFirebaseCustomToken();
        await ensureFirebaseClientSession(customToken, user.firebaseUid, user.role);

        if (active) {
          setReady(true);
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setReady(false);
        setSetupError(
          error instanceof Error
            ? error.message
            : "Unable to connect the live chat desk.",
        );
      }
    };

    void connect();

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!ready || !user) {
      return;
    }

    if (!isAdmin) {
      return subscribeAdminPresence(
        setAdminPresenceState,
        () =>
          setAdminPresenceState((current) => ({
            ...current,
            online: false,
          })),
      );
    }

    void setAdminPresence(user, true);
    const intervalId = window.setInterval(() => {
      void setAdminPresence(user, true);
    }, 25_000);
    const handlePageHide = () => {
      void setAdminPresence(user, false);
    };

    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("pagehide", handlePageHide);
      void setAdminPresence(user, false);
    };
  }, [isAdmin, ready, user]);

  useEffect(() => {
    if (isAdmin || customerChannel !== "admin" || adminPresence.online) {
      return;
    }

    setCustomerChannel("ai");
  }, [adminPresence.online, customerChannel, isAdmin]);

  useEffect(() => {
    if (!ready || !user || isAdmin) {
      return;
    }

    return subscribeCustomerConversation(
      user.id,
      setCustomerConversation,
      (error) => setSetupError(error.message),
    );
  }, [isAdmin, ready, user]);

  useEffect(() => {
    if (!ready || !isAdmin) {
      return;
    }

    return subscribeSupportConversations(
      (page) => {
        setConversations(page.conversations);
        setConversationCursor(page.cursor);
        setHasMoreConversations(page.hasMore);
      },
      (error) => setSetupError(error.message),
      CONVERSATION_PAGE_SIZE,
    );
  }, [isAdmin, ready]);

  useEffect(() => {
    if (!ready || !isAdmin) {
      return;
    }

    let active = true;

    const loadOrders = async () => {
      try {
        const orders = await storefrontApi.getOrders();

        if (active) {
          setAdminOrders(orders);
          setOrdersError(null);
        }
      } catch (error) {
        if (active) {
          setOrdersError(
            error instanceof Error ? error.message : "Unable to load order context.",
          );
        }
      }
    };

    void loadOrders();

    return () => {
      active = false;
    };
  }, [isAdmin, ready]);

  useEffect(() => {
    if (!isAdmin || isAdminAiMode) {
      return;
    }

    if (filteredConversations.length === 0) {
      setSelectedConversationId(null);
      return;
    }

    const selectedConversation = filteredConversations.find(
      (conversation) => conversation.id === selectedConversationId,
    );

    if (!selectedConversation) {
      setSelectedConversationId(filteredConversations[0].id);
    }
  }, [filteredConversations, isAdmin, isAdminAiMode, selectedConversationId]);

  useEffect(() => {
    if (isAdminAiMode || !activeConversationId || !ready) {
      setMessages([]);
      return;
    }

    return subscribeSupportMessages(
      activeConversationId,
      setMessages,
      (error) => setSetupError(error.message),
    );
  }, [activeConversationId, isAdminAiMode, ready]);

  useEffect(() => {
    if (!open || !activeConversationId || visibleMessages.length === 0) {
      return;
    }

    void markSupportConversationRead(
      activeConversationId,
      isAdmin ? "admin" : "user",
    ).catch(() => undefined);
  }, [activeConversationId, isAdmin, open, visibleMessages.length]);

  useEffect(() => {
    if (!messageListRef.current) {
      return;
    }

    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [visibleMessages.length, open]);

  useEffect(() => {
    if (!clearConfirmOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !clearingHistory) {
        setClearConfirmOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [clearConfirmOpen, clearingHistory]);

  const handleOpenClick = useCallback(() => {
    if (!isAuthenticated) {
      openAuthModal("sign-in");
      return;
    }

    setOpen(true);
  }, [isAuthenticated, openAuthModal]);

  const buildAdminAiMemory = useCallback((): AdminAiOperationsMemoryMessage[] => {
    return adminAiMessages
      .slice(-8)
      .map((message) => ({
        body: compactAdminAiMemoryText(message.body),
        senderRole: message.senderRole === "bot" ? "bot" : "admin",
        suggestions: message.suggestions.slice(0, 4).map((suggestion) => ({
          href: compactAdminAiMemoryText(suggestion.href, 500),
          image: "",
          name: compactAdminAiMemoryText(suggestion.name, 120),
          priceLabel: compactAdminAiMemoryText(suggestion.priceLabel, 160),
          productId: compactAdminAiMemoryText(suggestion.productId, 120),
          type: compactAdminAiMemoryText(suggestion.type, 80),
        })),
      }));
  }, [adminAiMessages]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user || !messageDraft.trim() || sending) {
      return;
    }

    if (isAdmin && !isAdminAiMode && !activeConversationId) {
      return;
    }

    if (isCustomerAdminChannelLocked) {
      setCustomerChannel("ai");
      setSetupError("The admin desk is offline. AI assistant is still available.");
      return;
    }

    const nextMessage = messageDraft;
    setMessageDraft("");
    setSending(true);
    setSetupError(null);

    try {
      if (isAdminAiMode) {
        const adminMessage = createAdminAiMessage({
          body: nextMessage,
          senderRole: "admin",
          user,
        });
        const memory = buildAdminAiMemory();

        setAdminAiMessages((current) => [...current, adminMessage]);

        const reply = await storefrontApi.askAdminAiOperations({
          memory,
          message: nextMessage,
        });

        if ((reply.catalogDrafts ?? []).length > 0) {
          mergeAdminCatalogDrafts(reply.catalogDrafts ?? []);
        }

        setAdminAiMessages((current) => [
          ...current,
          createAdminAiMessage({
            body: reply.body,
            senderRole: "bot",
            suggestions: reply.suggestions,
          }),
        ]);
      } else if (isAdmin && activeConversationId) {
        await sendAdminSupportMessage({
          admin: user,
          body: nextMessage,
          conversationId: activeConversationId,
        });
      } else {
        await sendCustomerSupportMessage({
          adminOnline:
            activeCustomerChannel === "admin" && adminPresence.online,
          body: nextMessage,
          channel: activeCustomerChannel,
          user,
        });
      }
    } catch (error) {
      if (isAdminAiMode) {
        setAdminAiMessages((current) => [
          ...current,
          createAdminAiMessage({
            body:
              error instanceof Error
                ? `Store AI could not read operations context: ${error.message}`
                : "Store AI could not read operations context right now.",
            senderRole: "bot",
          }),
        ]);
        setSetupError(null);
      } else {
        setMessageDraft(nextMessage);
        setSetupError(
          error instanceof Error
            ? error.message
            : "Unable to send the message right now.",
        );
      }
    } finally {
      setSending(false);
    }
  };

  const handleComposerKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
        return;
      }

      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    },
    [],
  );

  const handleRequestClearHistory = useCallback(() => {
    if (
      (!isAdminAiMode && !activeConversationId) ||
      visibleMessages.length === 0 ||
      clearingHistory
    ) {
      return;
    }

    setClearConfirmOpen(true);
  }, [
    activeConversationId,
    clearingHistory,
    isAdminAiMode,
    visibleMessages.length,
  ]);

  const handleConfirmClearHistory = useCallback(async () => {
    if (
      (!isAdminAiMode && !activeConversationId) ||
      visibleMessages.length === 0 ||
      clearingHistory
    ) {
      return;
    }

    setClearingHistory(true);
    setSetupError(null);

    try {
      if (isAdminAiMode) {
        setAdminAiMessages([]);
        setMessageDraft("");
        setClearConfirmOpen(false);
        return;
      }

      if (!activeConversationId) {
        return;
      }

      await clearSupportConversationHistory(
        activeConversationId,
        isAdmin ? undefined : activeCustomerChannel,
      );
      setMessageDraft("");
      setClearConfirmOpen(false);
    } catch (error) {
      setSetupError(
        error instanceof Error
          ? error.message
          : "Unable to clear chat history right now.",
      );
    } finally {
      setClearingHistory(false);
    }
  }, [
    activeConversationId,
    activeCustomerChannel,
    clearingHistory,
    isAdmin,
    isAdminAiMode,
    visibleMessages.length,
  ]);

  const handleCancelClearHistory = useCallback(() => {
    if (clearingHistory) {
      return;
    }

    setClearConfirmOpen(false);
  }, [clearingHistory]);

  const handleLoadMoreConversations = useCallback(async () => {
    if (!conversationCursor || loadingMoreConversations) {
      return;
    }

    setLoadingMoreConversations(true);

    try {
      const page = await loadMoreSupportConversations(
        conversationCursor,
        CONVERSATION_PAGE_SIZE,
      );

      setConversations((current) => mergeConversations(current, page.conversations));
      setConversationCursor(page.cursor);
      setHasMoreConversations(page.hasMore);
    } catch (error) {
      setSetupError(
        error instanceof Error
          ? error.message
          : "Unable to load more conversations right now.",
      );
    } finally {
      setLoadingMoreConversations(false);
    }
  }, [conversationCursor, loadingMoreConversations]);

  const handleArchiveConversation = useCallback(async () => {
    if (!user || !activeConversation || archivingConversation) {
      return;
    }

    const nextArchived = activeConversation.status !== "archived";

    setArchivingConversation(true);
    setSetupError(null);

    try {
      await setSupportConversationArchived({
        admin: user,
        archived: nextArchived,
        conversationId: activeConversation.id,
      });
      setConversationStatusFilter(nextArchived ? "open" : "archived");
    } catch (error) {
      setSetupError(
        error instanceof Error
          ? error.message
          : "Unable to update conversation archive status.",
      );
    } finally {
      setArchivingConversation(false);
    }
  }, [activeConversation, archivingConversation, user]);

  const unreadCount = isAdmin
    ? conversations.reduce(
        (count, conversation) => count + conversation.unreadForAdmin,
        0,
      )
    : customerConversation?.unreadForUser ?? 0;

  return (
    <div className="support-chat" aria-live="polite">
      {open && isAuthenticated ? (
        <section
          aria-label="Support chat"
          className={`support-chat__panel ${
            isAdmin ? "support-chat__panel--admin" : ""
          }`}
        >
          <header className="support-chat__header">
            <div className="support-chat__title-block">
              <span className="support-chat__header-icon">
                {isAdminAiMode ? (
                  <Bot className="support-chat__icon" />
                ) : isAdmin ? (
                  <Headphones className="support-chat__icon" />
                ) : activeCustomerChannel === "ai" ? (
                  <Bot className="support-chat__icon" />
                ) : adminPresence.online ? (
                  <Wifi className="support-chat__icon" />
                ) : (
                  <WifiOff className="support-chat__icon" />
                )}
              </span>
              <div>
                <p className="support-chat__eyebrow">
                  {isAdminAiMode
                    ? "Admin intelligence"
                    : isAdmin
                      ? "Support operations"
                      : "Client support"}
                </p>
                <h2>{headerTitle}</h2>
              </div>
            </div>
            <button
              aria-label="Close support chat"
              className="support-chat__icon-button"
              onClick={() => setOpen(false)}
              title="Close"
              type="button"
            >
              <X className="support-chat__icon" />
            </button>
          </header>

          {setupError ? (
            <p className="support-chat__error">{setupError}</p>
          ) : null}

          {!ready ? (
            <div className="support-chat__loading">Connecting live desk</div>
          ) : (
            <div
              className={`support-chat__body ${
                isAdminAiMode ? "support-chat__body--admin-ai" : ""
              }`}
            >
              {isAdmin && !isAdminAiMode ? (
                <aside className="support-chat__threads" aria-label="Customer conversations">
                  <div className="support-chat__threads-toolbar">
                    <span>
                      <p className="support-chat__eyebrow">Customers</p>
                      <strong>{conversations.length} conversations</strong>
                    </span>
                    <em>{filteredConversations.length}</em>
                  </div>

                  <div
                    aria-label="Conversation status"
                    className="support-chat__thread-tabs"
                    role="group"
                  >
                    {(["open", "archived"] as const).map((status) => (
                      <button
                        className={
                          conversationStatusFilter === status
                            ? "support-chat__thread-tab support-chat__thread-tab--active"
                            : "support-chat__thread-tab"
                        }
                        key={status}
                        onClick={() => setConversationStatusFilter(status)}
                        type="button"
                      >
                        {status === "open" ? "Open" : "Archived"}
                      </button>
                    ))}
                  </div>

                  <label className="support-chat__thread-search">
                    <Search className="support-chat__icon" />
                    <span className="support-chat__sr-only">Search customers</span>
                    <input
                      onChange={(event) => setConversationSearch(event.target.value)}
                      placeholder="Search name, email, message"
                      type="search"
                      value={conversationSearch}
                    />
                    {conversationSearch ? (
                      <button
                        aria-label="Clear customer search"
                        onClick={() => setConversationSearch("")}
                        title="Clear search"
                        type="button"
                      >
                        <X className="support-chat__icon" />
                      </button>
                    ) : null}
                  </label>

                  <div className="support-chat__thread-list">
                    {conversations.length === 0 ? (
                      <p className="support-chat__threads-empty">No conversations yet.</p>
                    ) : filteredConversations.length === 0 ? (
                      <p className="support-chat__threads-empty">No customers match this search.</p>
                    ) : (
                      <>
                        {filteredConversations.map((conversation) => (
                          <button
                            className={`support-chat__thread ${
                              selectedConversationId === conversation.id
                                ? "support-chat__thread--active"
                                : ""
                            } ${
                              conversation.unreadForAdmin > 0
                                ? "support-chat__thread--unread"
                                : ""
                            }`}
                            key={conversation.id}
                            onClick={() => setSelectedConversationId(conversation.id)}
                            type="button"
                          >
                            <span className="support-chat__thread-avatar">
                              {getConversationInitials(conversation)}
                            </span>
                            <span className="support-chat__thread-main">
                              <span className="support-chat__thread-top">
                                <strong>{getConversationLabel(conversation)}</strong>
                                <time>{formatChatTime(conversation.lastMessageAt)}</time>
                              </span>
                              <span className="support-chat__thread-detail">
                                {conversation.userEmail || getConversationMeta(conversation)}
                              </span>
                              <span className="support-chat__thread-preview">
                                {conversation.lastMessage || getConversationMeta(conversation)}
                              </span>
                            </span>
                            {conversation.unreadForAdmin > 0 ? (
                              <em>{Math.min(conversation.unreadForAdmin, 9)}</em>
                            ) : null}
                          </button>
                        ))}
                        {hasMoreConversations ? (
                          <button
                            className="support-chat__load-more"
                            disabled={loadingMoreConversations}
                            onClick={handleLoadMoreConversations}
                            type="button"
                          >
                            {loadingMoreConversations ? "Loading" : "Load more"}
                          </button>
                        ) : null}
                      </>
                    )}
                  </div>
                </aside>
              ) : null}

              <div className="support-chat__conversation">
                {isAdmin ? (
                  <div
                    aria-label="Admin chat mode"
                    className="support-chat__channel-switch support-chat__channel-switch--admin"
                    role="group"
                  >
                    <button
                      aria-pressed={adminMode === "live"}
                      className={`support-chat__channel-option ${
                        adminMode === "live"
                          ? "support-chat__channel-option--active"
                          : ""
                      }`}
                      onClick={() => {
                        setSetupError(null);
                        setAdminMode("live");
                      }}
                      type="button"
                    >
                      <span className="support-chat__channel-icon">
                        <Headphones className="support-chat__icon" />
                      </span>
                      <span className="support-chat__channel-copy">
                        <strong>Customer desk</strong>
                        <small>Realtime support queue</small>
                      </span>
                      <em className="support-chat__channel-badge support-chat__channel-badge--online">
                        Live
                      </em>
                    </button>

                    <button
                      aria-pressed={adminMode === "ai"}
                      className={`support-chat__channel-option ${
                        adminMode === "ai"
                          ? "support-chat__channel-option--active"
                          : ""
                      }`}
                      onClick={() => {
                        setSetupError(null);
                        setAdminMode("ai");
                      }}
                      type="button"
                    >
                      <span className="support-chat__channel-icon">
                        <Bot className="support-chat__icon" />
                      </span>
                      <span className="support-chat__channel-copy">
                        <strong>Store AI</strong>
                        <small>Revenue, products, orders</small>
                      </span>
                      <em className="support-chat__channel-badge support-chat__channel-badge--online">
                        Internal
                      </em>
                    </button>
                  </div>
                ) : null}

                {!isAdmin ? (
                  <div
                    aria-label="Support channel"
                    className="support-chat__channel-switch"
                    role="group"
                  >
                    <button
                      aria-pressed={activeCustomerChannel === "admin"}
                      className={`support-chat__channel-option ${
                        activeCustomerChannel === "admin"
                          ? "support-chat__channel-option--active"
                          : ""
                      }`}
                      disabled={!adminPresence.online}
                      onClick={() => {
                        setSetupError(null);
                        setCustomerChannel("admin");
                      }}
                      title={
                        adminPresence.online
                          ? "Chat with the admin desk"
                          : "Admin desk is offline"
                      }
                      type="button"
                    >
                      <span className="support-chat__channel-icon">
                        {adminPresence.online ? (
                          <Headphones className="support-chat__icon" />
                        ) : (
                          <WifiOff className="support-chat__icon" />
                        )}
                      </span>
                      <span className="support-chat__channel-copy">
                        <strong>Admin desk</strong>
                        <small>
                          {adminPresence.online
                            ? "Live support available"
                            : "Offline right now"}
                        </small>
                      </span>
                      <em
                        className={
                          adminPresence.online
                            ? "support-chat__channel-badge support-chat__channel-badge--online"
                            : "support-chat__channel-badge"
                        }
                      >
                        {adminPresence.online ? "Online" : "Locked"}
                      </em>
                    </button>

                    <button
                      aria-pressed={activeCustomerChannel === "ai"}
                      className={`support-chat__channel-option ${
                        activeCustomerChannel === "ai"
                          ? "support-chat__channel-option--active"
                          : ""
                      }`}
                      onClick={() => {
                        setSetupError(null);
                        setCustomerChannel("ai");
                      }}
                      type="button"
                    >
                      <span className="support-chat__channel-icon">
                        <Bot className="support-chat__icon" />
                      </span>
                      <span className="support-chat__channel-copy">
                        <strong>AI concierge</strong>
                        <small>Always available</small>
                      </span>
                      <em className="support-chat__channel-badge support-chat__channel-badge--online">
                        24/7
                      </em>
                    </button>
                  </div>
                ) : null}

                <div className="support-chat__status-row">
                  <span
                    className={`support-chat__status ${
                      isAdmin ||
                      isAdminAiMode ||
                      activeCustomerChannel === "ai" ||
                      adminPresence.online
                        ? "support-chat__status--online"
                        : ""
                    }`}
                  >
                    {isAdminAiMode ? (
                      <Bot className="support-chat__status-icon" />
                    ) : !isAdmin && activeCustomerChannel === "ai" ? (
                      <Bot className="support-chat__status-icon" />
                    ) : isAdmin || adminPresence.online ? (
                      <Wifi className="support-chat__status-icon" />
                    ) : (
                      <WifiOff className="support-chat__status-icon" />
                    )}
                    <span>{statusLabel}</span>
                  </span>
                  <div className="support-chat__status-actions">
                    {activeConversation ? (
                      <span>{getConversationLabel(activeConversation)}</span>
                    ) : null}
                    {isAdmin && activeConversation ? (
                      <button
                        aria-expanded={customerContextExpanded}
                        aria-label={
                          customerContextExpanded
                            ? "Hide customer context"
                            : "Show customer context"
                        }
                        className={`support-chat__context-toggle ${
                          customerContextExpanded
                            ? "support-chat__context-toggle--active"
                            : ""
                        }`}
                        onClick={() =>
                          setCustomerContextExpanded((expanded) => !expanded)
                        }
                        title={
                          customerContextExpanded
                            ? "Hide customer context"
                            : "Show customer context"
                        }
                        type="button"
                      >
                        <ChevronDown className="support-chat__context-chevron" />
                      </button>
                    ) : null}
                    {isAdmin && activeConversation ? (
                      <button
                        aria-label={
                          activeConversation.status === "archived"
                            ? "Restore conversation"
                            : "Archive conversation"
                        }
                        className="support-chat__clear support-chat__clear--neutral"
                        disabled={archivingConversation}
                        onClick={handleArchiveConversation}
                        title={
                          activeConversation.status === "archived"
                            ? "Restore conversation"
                            : "Archive conversation"
                        }
                        type="button"
                      >
                        {activeConversation.status === "archived" ? (
                          <ArchiveRestore className="support-chat__icon" />
                        ) : (
                          <Archive className="support-chat__icon" />
                        )}
                      </button>
                    ) : null}
                    <button
                      aria-label="Clear chat history"
                      className="support-chat__clear"
                      disabled={
                        clearingHistory ||
                        (!isAdminAiMode && !activeConversationId) ||
                        visibleMessages.length === 0
                      }
                      onClick={handleRequestClearHistory}
                      title="Clear history"
                      type="button"
                    >
                      <Trash2 className="support-chat__icon" />
                    </button>
                  </div>
                </div>

                {isAdmin && activeConversation && customerContextExpanded ? (
                  <section className="support-chat__context" aria-label="Customer context">
                    <div className="support-chat__context-item">
                      <MessageCircle className="support-chat__icon" />
                      <span>
                        <strong>{activeConversation.messageCount}</strong>
                        <small>Messages</small>
                      </span>
                    </div>
                    <div className="support-chat__context-item">
                      <ShieldAlert className="support-chat__icon" />
                      <span>
                        <strong>{activeConversation.moderationFlagCount}</strong>
                        <small>Flags</small>
                      </span>
                    </div>
                    <div className="support-chat__context-item support-chat__context-item--wide">
                      <ReceiptText className="support-chat__icon" />
                      <span>
                        <strong>
                          {activeConversationOrders.length} orders
                          {activeOrderCount > 0 ? ` / ${activeOrderCount} active` : ""}
                        </strong>
                        <small>
                          {ordersError
                            ? "Order context unavailable"
                            : latestOrder
                              ? `${latestOrder.orderNumber} · ${formatStatusLabel(latestOrder.status)} · ${formatStatusLabel(latestOrder.payment?.status)}`
                              : "No orders linked to this customer"}
                        </small>
                      </span>
                    </div>
                  </section>
                ) : null}

                {clearConfirmOpen ? (
                  <div
                    aria-describedby="support-chat-clear-description"
                    aria-labelledby="support-chat-clear-title"
                    aria-modal="true"
                    className="support-chat__modal-backdrop"
                    onClick={handleCancelClearHistory}
                    role="dialog"
                  >
                    <div
                      className="support-chat__modal"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <span className="support-chat__modal-icon">
                        <Trash2 className="support-chat__icon" />
                      </span>
                      <div className="support-chat__modal-copy">
                        <p className="support-chat__eyebrow">Conversation history</p>
                        <h3 id="support-chat-clear-title">Clear chat history?</h3>
                        <p id="support-chat-clear-description">
                          {isAdminAiMode
                            ? "This removes only the local Store AI thread in this browser."
                            : isAdmin
                            ? "This removes every message in the selected conversation."
                            : "This removes messages in the current support channel."}
                          {" "}
                          {isAdminAiMode
                            ? "Live customer conversations are not changed."
                            : "The conversation stays available for new support notes."}
                        </p>
                      </div>
                      <div className="support-chat__modal-actions">
                        <button
                          autoFocus
                          className="support-chat__modal-button support-chat__modal-button--ghost"
                          disabled={clearingHistory}
                          onClick={handleCancelClearHistory}
                          type="button"
                        >
                          Cancel
                        </button>
                        <button
                          className="support-chat__modal-button support-chat__modal-button--danger"
                          disabled={clearingHistory}
                          onClick={handleConfirmClearHistory}
                          type="button"
                        >
                          <Trash2 className="support-chat__icon" />
                          {clearingHistory ? "Clearing" : "Clear history"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="support-chat__messages" ref={messageListRef}>
                  {visibleMessages.length === 0 ? (
                    <EmptyMessages
                      channel={activeCustomerChannel}
                      isAdminAi={isAdminAiMode}
                      isAdmin={isAdmin}
                    />
                  ) : (
                    visibleMessages.map((message) => (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        viewerRole={isAdmin ? "admin" : "user"}
                      />
                    ))
                  )}
                </div>

                {isAdminAiMode ? (
                  <div className="support-chat__quick-row">
                    {ADMIN_AI_QUICK_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => setMessageDraft(prompt)}
                        type="button"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                ) : !isAdmin && activeCustomerChannel === "ai" ? (
                  <div className="support-chat__quick-row">
                    {QUICK_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => setMessageDraft(prompt)}
                        type="button"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                ) : null}

                <form className="support-chat__composer" onSubmit={handleSubmit}>
                  <label className="support-chat__input-shell">
                    <span className="support-chat__sr-only">Message</span>
                    <textarea
                      disabled={
                        sending ||
                        (isAdmin && !isAdminAiMode && !activeConversationId) ||
                        isCustomerAdminChannelLocked
                      }
                      onChange={(event) => setMessageDraft(event.target.value)}
                      onKeyDown={handleComposerKeyDown}
                      placeholder={
                        isAdmin
                          ? isAdminAiMode
                            ? "Ask Store AI about revenue, stock, orders"
                            : "Reply to the selected customer"
                          : activeCustomerChannel === "admin"
                            ? "Message the admin desk"
                            : "Ask the AI concierge"
                      }
                      rows={2}
                      value={messageDraft}
                    />
                  </label>
                  <button
                    aria-label="Send message"
                    className="support-chat__send"
                    disabled={
                      sending ||
                      !messageDraft.trim() ||
                      (isAdmin && !isAdminAiMode && !activeConversationId) ||
                      isCustomerAdminChannelLocked
                    }
                    title="Send"
                    type="submit"
                  >
                    <Send className="support-chat__icon" />
                  </button>
                </form>
              </div>
            </div>
          )}
        </section>
      ) : null}

      <button
        aria-label={isAuthenticated ? "Open support chat" : "Sign in to chat"}
        className="support-chat__launcher"
        onClick={handleOpenClick}
        type="button"
      >
        {isAdmin ? (
          <Headphones className="support-chat__launcher-icon" />
        ) : (
          <MessageCircle className="support-chat__launcher-icon" />
        )}
        {unreadCount > 0 ? (
          <span className="support-chat__badge">{Math.min(unreadCount, 9)}</span>
        ) : null}
        <span className="support-chat__launcher-copy">
          {isAuthenticated ? onlineLabel : "Chat"}
        </span>
        {!isAdmin && !adminPresence.online ? (
          <UserRound className="support-chat__launcher-mini" />
        ) : null}
      </button>
    </div>
  );
}
