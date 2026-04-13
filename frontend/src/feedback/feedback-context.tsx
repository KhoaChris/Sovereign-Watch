/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, CircleAlert, Info, Trash2, X } from "lucide-react";

import "../styles/components/feedback-layer.css";

export type FeedbackTone = "error" | "info" | "success";
export type ConfirmTone = "danger" | "default";

interface FeedbackToast {
  description?: string;
  duration?: number;
  id: string;
  title: string;
  tone: FeedbackTone;
}

interface NotifyOptions {
  description?: string;
  duration?: number;
  title: string;
  tone: FeedbackTone;
}

interface ConfirmOptions {
  cancelLabel?: string;
  confirmLabel?: string;
  description: string;
  title: string;
  tone?: ConfirmTone;
}

interface ActiveConfirm extends ConfirmOptions {
  resolve: (accepted: boolean) => void;
}

interface FeedbackContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  dismiss: (toastId: string) => void;
  notify: (options: NotifyOptions) => void;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

function createToastId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function FeedbackToastItem({
  onDismiss,
  toast,
}: {
  onDismiss: (toastId: string) => void;
  toast: FeedbackToast;
}) {
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      onDismiss(toast.id);
    }, toast.duration ?? 4200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [onDismiss, toast.duration, toast.id]);

  const Icon =
    toast.tone === "success"
      ? CheckCircle2
      : toast.tone === "error"
        ? CircleAlert
        : Info;

  return (
    <motion.div
      animate={{ opacity: 1, x: 0, y: 0 }}
      className={`feedback-layer__toast feedback-layer__toast--${toast.tone}`}
      exit={{ opacity: 0, scale: 0.96, x: 24 }}
      initial={{ opacity: 0, x: 24, y: 12 }}
      layout
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className="feedback-layer__toast-icon-wrap" aria-hidden="true">
        <Icon className="feedback-layer__toast-icon" size={18} />
      </span>
      <div className="feedback-layer__toast-body">
        <strong>{toast.title}</strong>
        {toast.description ? <p>{toast.description}</p> : null}
      </div>
      <button
        aria-label="Dismiss notification"
        className="feedback-layer__toast-dismiss"
        onClick={() => onDismiss(toast.id)}
        type="button"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}

function FeedbackViewport({
  onDismiss,
  toasts,
}: {
  onDismiss: (toastId: string) => void;
  toasts: FeedbackToast[];
}) {
  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className="feedback-layer__toast-viewport"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <FeedbackToastItem
            key={toast.id}
            onDismiss={onDismiss}
            toast={toast}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function FeedbackConfirmDialog({
  activeConfirm,
  onCancel,
  onConfirm,
}: {
  activeConfirm: ActiveConfirm | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ConfirmIcon =
    (activeConfirm?.tone ?? "default") === "danger" ? Trash2 : CircleAlert;

  return (
    <AnimatePresence>
      {activeConfirm ? (
        <div className="feedback-layer__confirm-layer">
          <motion.button
            animate={{ opacity: 1 }}
            aria-label="Close confirmation dialog"
            className="feedback-layer__confirm-backdrop"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={onCancel}
            type="button"
          />
          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            aria-modal="true"
            className="feedback-layer__confirm-dialog"
            exit={{ opacity: 0, scale: 0.98, y: 12 }}
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            role="dialog"
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="feedback-layer__confirm-head">
              <span
                className={`feedback-layer__confirm-icon feedback-layer__confirm-icon--${
                  activeConfirm.tone ?? "default"
                }`}
                aria-hidden="true"
              >
                <ConfirmIcon size={18} />
              </span>
              <div>
                <p className="feedback-layer__confirm-eyebrow">
                  Confirm action
                </p>
                <h2>{activeConfirm.title}</h2>
              </div>
            </div>

            <p className="feedback-layer__confirm-copy">
              {activeConfirm.description}
            </p>

            <div className="feedback-layer__confirm-actions">
              <button
                className="feedback-layer__button feedback-layer__button--quiet"
                onClick={onCancel}
                type="button"
              >
                {activeConfirm.cancelLabel ?? "Cancel"}
              </button>
              <button
                className={`feedback-layer__button ${
                  (activeConfirm.tone ?? "default") === "danger"
                    ? "feedback-layer__button--danger"
                    : "feedback-layer__button--primary"
                }`}
                onClick={onConfirm}
                type="button"
              >
                <ConfirmIcon size={16} />
                {activeConfirm.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

export function FeedbackProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<FeedbackToast[]>([]);
  const [activeConfirm, setActiveConfirm] = useState<ActiveConfirm | null>(null);

  const dismiss = useCallback((toastId: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }, []);

  const notify = useCallback((options: NotifyOptions) => {
    setToasts((current) => [
      ...current.slice(-3),
      {
        ...options,
        id: createToastId(),
      },
    ]);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setActiveConfirm({
        ...options,
        resolve,
      });
    });
  }, []);

  const handleCancel = useCallback(() => {
    setActiveConfirm((current) => {
      current?.resolve(false);
      return null;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setActiveConfirm((current) => {
      current?.resolve(true);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!activeConfirm) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleCancel();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeConfirm, handleCancel]);

  return (
    <FeedbackContext.Provider value={{ confirm, dismiss, notify }}>
      {children}
      <FeedbackViewport onDismiss={dismiss} toasts={toasts} />
      <FeedbackConfirmDialog
        activeConfirm={activeConfirm}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
      />
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackContextValue {
  const context = useContext(FeedbackContext);

  if (!context) {
    throw new Error("useFeedback must be used within FeedbackProvider.");
  }

  return context;
}
