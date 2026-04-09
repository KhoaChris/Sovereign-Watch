import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LoaderCircle, X } from "lucide-react";

import { useStorefront } from "../storefront/storefront-context";
import "../styles/components/auth-modal.css";

function AuthModalContent({
  authBusy,
  authError,
  authMode,
  closeAuthModal,
  openAuthModal,
  signIn,
  signUp,
}: {
  authBusy: boolean;
  authError: string | null;
  authMode: "sign-in" | "sign-up";
  closeAuthModal: () => void;
  openAuthModal: (mode?: "sign-in" | "sign-up") => void;
  signIn: (credentials: { email: string; password: string }) => Promise<void>;
  signUp: (credentials: { email: string; fullName: string; password: string }) => Promise<void>;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const isSignUp = authMode === "sign-up";

  async function handleSubmit(): Promise<void> {
    if (isSignUp) {
      await signUp({
        email,
        fullName,
        password,
      });
      return;
    }

    await signIn({
      email,
      password,
    });
  }

  return (
    <motion.div
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="auth-modal__dialog"
      exit={{ opacity: 0, y: 14, scale: 0.98 }}
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="auth-modal__header">
        <div>
          <p className="auth-modal__eyebrow">Watchroom account</p>
          <h2 className="auth-modal__title">{isSignUp ? "Create your private desk" : "Sign in to Watchroom"}</h2>
        </div>

        <button aria-label="Close authentication modal" className="auth-modal__close" onClick={closeAuthModal} type="button">
          <X className="auth-modal__close-icon" />
        </button>
      </div>

      <p className="auth-modal__copy">
        {isSignUp
          ? "Save favorites, manage your reserve cart, and keep your details ready for quieter checkout."
          : "Access your favorites, reserve cart, and account details from one private control point."}
      </p>

      <form
        className="auth-modal__form"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        {isSignUp ? (
          <label className="auth-modal__field">
            <span>Full name</span>
            <input
              autoComplete="name"
              className="auth-modal__input"
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Your full name"
              value={fullName}
            />
          </label>
        ) : null}

        <label className="auth-modal__field">
          <span>Email</span>
          <input
            autoComplete="email"
            className="auth-modal__input"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            type="email"
            value={email}
          />
        </label>

        <label className="auth-modal__field">
          <span>Password</span>
          <input
            autoComplete={isSignUp ? "new-password" : "current-password"}
            className="auth-modal__input"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            type="password"
            value={password}
          />
        </label>

        {authError ? <p className="auth-modal__error">{authError}</p> : null}

        <button className="auth-modal__submit" disabled={authBusy} type="submit">
          {authBusy ? <LoaderCircle className="auth-modal__submit-icon auth-modal__submit-icon--spinning" /> : null}
          {authBusy ? "Processing" : isSignUp ? "Create account" : "Sign in"}
        </button>
      </form>

      <div className="auth-modal__footer">
        <p>{isSignUp ? "Already have an account?" : "New to Watchroom?"}</p>
        <button
          className="auth-modal__switch"
          onClick={() => openAuthModal(isSignUp ? "sign-in" : "sign-up")}
          type="button"
        >
          {isSignUp ? "Sign in instead" : "Create an account"}
        </button>
      </div>
    </motion.div>
  );
}

export function AuthModal() {
  const {
    authBusy,
    authError,
    authModalOpen,
    authMode,
    closeAuthModal,
    openAuthModal,
    signIn,
    signUp,
  } = useStorefront();

  useEffect(() => {
    if (!authModalOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeAuthModal();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [authModalOpen, closeAuthModal]);

  return (
    <AnimatePresence>
      {authModalOpen ? (
        <motion.div
          animate={{ opacity: 1 }}
          className="auth-modal"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
        >
          <button aria-label="Close authentication modal" className="auth-modal__backdrop" onClick={closeAuthModal} type="button" />
          <AuthModalContent
            key={authMode}
            authBusy={authBusy}
            authError={authError}
            authMode={authMode}
            closeAuthModal={closeAuthModal}
            openAuthModal={openAuthModal}
            signIn={signIn}
            signUp={signUp}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
