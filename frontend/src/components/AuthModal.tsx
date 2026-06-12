import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LoaderCircle, X } from "lucide-react";

import { storefrontApi } from "../services/api";
import { useStorefront } from "../storefront/storefront-context";
import "../styles/components/auth-modal.css";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmailAddress(value: string): boolean {
  return EMAIL_PATTERN.test(value);
}

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
  signUp: (credentials: {
    email: string;
    emailOtpCode: string;
    fullName: string;
    password: string;
  }) => Promise<void>;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpMessage, setOtpMessage] = useState<string | null>(null);
  const [otpSentEmail, setOtpSentEmail] = useState("");
  const [password, setPassword] = useState("");
  const isSignUp = authMode === "sign-up";
  const normalizedEmail = email.trim().toLowerCase();
  const otpReady = otpSentEmail === normalizedEmail;

  async function handleRequestOtp(): Promise<void> {
    if (!normalizedEmail) {
      setOtpError("Enter your email before requesting a code.");
      return;
    }

    if (!isValidEmailAddress(normalizedEmail)) {
      setOtpError("Enter a valid email address before requesting a code.");
      return;
    }

    setOtpBusy(true);
    setOtpError(null);
    setOtpMessage(null);

    try {
      const result = await storefrontApi.requestSignUpEmailOtp({
        email: normalizedEmail,
      });
      setOtpSentEmail(result.email);
      setOtpCode("");
      setOtpMessage(
        `A 6-digit code was sent to ${result.email}. It expires in ${Math.round(
          result.expiresInSeconds / 60,
        )} minutes.`,
      );
    } catch (error) {
      setOtpError(
        error instanceof Error
          ? error.message
          : "Unable to send a verification code right now.",
      );
    } finally {
      setOtpBusy(false);
    }
  }

  async function handleSubmit(): Promise<void> {
    if (isSignUp) {
      if (!/^\d{6}$/.test(otpCode.trim())) {
        setOtpError("Enter the 6-digit code sent to your email.");
        return;
      }

      if (!otpReady) {
        setOtpError("Send a verification code to this email before continuing.");
        return;
      }

      await signUp({
        email,
        emailOtpCode: otpCode.trim(),
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
              required
              value={fullName}
            />
          </label>
        ) : null}

        <label className="auth-modal__field">
          <span>Email</span>
          <input
            autoComplete="email"
            className="auth-modal__input"
            onChange={(event) => {
              setEmail(event.target.value);
              setOtpCode("");
              setOtpError(null);
              setOtpMessage(null);
              setOtpSentEmail("");
            }}
            placeholder="you@example.com"
            required
            type="email"
            value={email}
          />
        </label>

        {isSignUp ? (
          <div className="auth-modal__otp-panel">
            <div className="auth-modal__otp-controls">
              <button
                className="auth-modal__inline-action"
                disabled={authBusy || otpBusy || !normalizedEmail}
                onClick={() => {
                  void handleRequestOtp();
                }}
                type="button"
              >
                {otpBusy ? (
                  <LoaderCircle className="auth-modal__submit-icon auth-modal__submit-icon--spinning" />
                ) : null}
                {otpReady ? "Resend code" : "Send OTP"}
              </button>

              <label className="auth-modal__otp-code-field">
                <span>Code</span>
                <input
                  autoComplete="one-time-code"
                  className="auth-modal__input auth-modal__input--otp"
                  disabled={!otpReady}
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) =>
                    setOtpCode(event.target.value.replace(/\D/g, ""))
                  }
                  pattern="[0-9]{6}"
                  placeholder={otpReady ? "000000" : "------"}
                  required={otpReady}
                  value={otpCode}
                />
              </label>
            </div>

            {otpMessage ? (
              <p className="auth-modal__message">{otpMessage}</p>
            ) : null}
            {otpError ? <p className="auth-modal__error">{otpError}</p> : null}
          </div>
        ) : null}

        <label className="auth-modal__field">
          <span>Password</span>
          <input
            autoComplete={isSignUp ? "new-password" : "current-password"}
            className="auth-modal__input"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            minLength={6}
            required
            type="password"
            value={password}
          />
        </label>

        {authError ? <p className="auth-modal__error">{authError}</p> : null}

        <button className="auth-modal__submit" disabled={authBusy || otpBusy} type="submit">
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
