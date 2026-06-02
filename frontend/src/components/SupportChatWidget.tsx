import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link } from "react-router-dom";
import {
  Bot,
  ChevronRight,
  Headphones,
  MessageCircle,
  Send,
  UserRound,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";

import { useStorefront } from "../storefront/storefront-context";
import { storefrontApi } from "../services/api";
import {
  clearFirebaseClientSession,
  ensureFirebaseClientSession,
} from "../services/firebase-client";
import {
  markSupportConversationRead,
  sendAdminSupportMessage,
  sendCustomerSupportMessage,
  setAdminPresence,
  subscribeAdminPresence,
  subscribeCustomerConversation,
  subscribeSupportConversations,
  subscribeSupportMessages,
  type AdminPresenceState,
} from "../services/support-chat";
import type { SupportChatMessage, SupportConversation } from "../shared";
import "../styles/components/support-chat.css";

const QUICK_PROMPTS = ["Giá Rolex", "Tìm dress watch", "Shipping"];

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
  return conversation.mode === "human" ? "Admin live" : "Bot fallback";
}

function EmptyMessages({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="support-chat__empty">
      <MessageCircle className="support-chat__empty-icon" />
      <p>{isAdmin ? "Select a customer conversation." : "Start a conversation with the desk."}</p>
      <span>
        {isAdmin
          ? "New customer messages appear here in realtime."
          : "Ask about price, product search, shipping, or an active order."}
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

  return (
    <article
      className={`support-chat__message ${
        isOutbound ? "support-chat__message--outbound" : ""
      } ${isBot ? "support-chat__message--bot" : ""}`}
    >
      <div className="support-chat__message-head">
        <span>{message.senderName || (isBot ? "Sovereign bot" : "Client")}</span>
        <time>{formatChatTime(message.createdAt)}</time>
      </div>
      <p>{message.body}</p>

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
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    null,
  );
  const [messages, setMessages] = useState<SupportChatMessage[]>([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [sending, setSending] = useState(false);
  const messageListRef = useRef<HTMLDivElement | null>(null);

  const activeConversationId = isAdmin ? selectedConversationId : user?.id ?? null;
  const activeConversation = useMemo(() => {
    if (!isAdmin) {
      return customerConversation;
    }

    return (
      conversations.find(
        (conversation) => conversation.id === selectedConversationId,
      ) ?? null
    );
  }, [conversations, customerConversation, isAdmin, selectedConversationId]);

  const onlineLabel = isAdmin
    ? "Admin online"
    : adminPresence.online
      ? "Admin online"
      : "Bot active";

  useEffect(() => {
    let active = true;

    if (!user) {
      setReady(false);
      setSetupError(null);
      setCustomerConversation(null);
      setConversations([]);
      setSelectedConversationId(null);
      setMessages([]);
      void clearFirebaseClientSession();
      return;
    }

    setReady(false);
    setSetupError(null);

    const connect = async () => {
      try {
        const { customToken } = await storefrontApi.getFirebaseCustomToken();
        await ensureFirebaseClientSession(customToken, user.firebaseUid);

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
      setConversations,
      (error) => setSetupError(error.message),
    );
  }, [isAdmin, ready]);

  useEffect(() => {
    if (!isAdmin || selectedConversationId || conversations.length === 0) {
      return;
    }

    setSelectedConversationId(conversations[0].id);
  }, [conversations, isAdmin, selectedConversationId]);

  useEffect(() => {
    if (!activeConversationId || !ready) {
      setMessages([]);
      return;
    }

    return subscribeSupportMessages(
      activeConversationId,
      setMessages,
      (error) => setSetupError(error.message),
    );
  }, [activeConversationId, ready]);

  useEffect(() => {
    if (!open || !activeConversationId || messages.length === 0) {
      return;
    }

    void markSupportConversationRead(
      activeConversationId,
      isAdmin ? "admin" : "user",
    ).catch(() => undefined);
  }, [activeConversationId, isAdmin, messages.length, open]);

  useEffect(() => {
    if (!messageListRef.current) {
      return;
    }

    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [messages.length, open]);

  const handleOpenClick = useCallback(() => {
    if (!isAuthenticated) {
      openAuthModal("sign-in");
      return;
    }

    setOpen(true);
  }, [isAuthenticated, openAuthModal]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user || !messageDraft.trim() || sending) {
      return;
    }

    if (isAdmin && !activeConversationId) {
      return;
    }

    const nextMessage = messageDraft;
    setMessageDraft("");
    setSending(true);

    try {
      if (isAdmin && activeConversationId) {
        await sendAdminSupportMessage({
          admin: user,
          body: nextMessage,
          conversationId: activeConversationId,
        });
      } else {
        await sendCustomerSupportMessage({
          adminOnline: adminPresence.online,
          body: nextMessage,
          user,
        });
      }
    } catch (error) {
      setMessageDraft(nextMessage);
      setSetupError(
        error instanceof Error
          ? error.message
          : "Unable to send the message right now.",
      );
    } finally {
      setSending(false);
    }
  };

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
                {isAdmin ? (
                  <Headphones className="support-chat__icon" />
                ) : adminPresence.online ? (
                  <Wifi className="support-chat__icon" />
                ) : (
                  <Bot className="support-chat__icon" />
                )}
              </span>
              <div>
                <p className="support-chat__eyebrow">
                  {isAdmin ? "Support operations" : "Client support"}
                </p>
                <h2>{isAdmin ? "Live desk" : onlineLabel}</h2>
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
            <div className="support-chat__body">
              {isAdmin ? (
                <aside className="support-chat__threads" aria-label="Customer conversations">
                  {conversations.length === 0 ? (
                    <p className="support-chat__threads-empty">No conversations yet.</p>
                  ) : (
                    conversations.map((conversation) => (
                      <button
                        className={`support-chat__thread ${
                          selectedConversationId === conversation.id
                            ? "support-chat__thread--active"
                            : ""
                        }`}
                        key={conversation.id}
                        onClick={() => setSelectedConversationId(conversation.id)}
                        type="button"
                      >
                        <span>
                          <strong>{getConversationLabel(conversation)}</strong>
                          <small>{getConversationMeta(conversation)}</small>
                        </span>
                        {conversation.unreadForAdmin > 0 ? (
                          <em>{conversation.unreadForAdmin}</em>
                        ) : null}
                      </button>
                    ))
                  )}
                </aside>
              ) : null}

              <div className="support-chat__conversation">
                <div className="support-chat__status-row">
                  <span
                    className={`support-chat__status ${
                      isAdmin || adminPresence.online
                        ? "support-chat__status--online"
                        : ""
                    }`}
                  >
                    {isAdmin || adminPresence.online ? (
                      <Wifi className="support-chat__status-icon" />
                    ) : (
                      <WifiOff className="support-chat__status-icon" />
                    )}
                    {onlineLabel}
                  </span>
                  {activeConversation ? (
                    <span>{getConversationLabel(activeConversation)}</span>
                  ) : null}
                </div>

                <div className="support-chat__messages" ref={messageListRef}>
                  {messages.length === 0 ? (
                    <EmptyMessages isAdmin={isAdmin} />
                  ) : (
                    messages.map((message) => (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        viewerRole={isAdmin ? "admin" : "user"}
                      />
                    ))
                  )}
                </div>

                {!isAdmin ? (
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
                      disabled={sending || (isAdmin && !activeConversationId)}
                      onChange={(event) => setMessageDraft(event.target.value)}
                      placeholder={
                        isAdmin
                          ? "Reply to the selected customer"
                          : adminPresence.online
                            ? "Message the admin desk"
                            : "Ask the bot or leave a note"
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
                      (isAdmin && !activeConversationId)
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
