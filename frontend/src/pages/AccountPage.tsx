import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Heart,
  LoaderCircle,
  LogOut,
  Package,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import { Link } from "react-router-dom";

import { useStorefront } from "../storefront/storefront-context";
import type { AuthUserProfile } from "../shared";
import "../styles/pages/account-page.css";

function formatMemberSince(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function getMemberMark(fullName?: string, email?: string): string {
  const source = fullName?.trim() || email?.trim() || "Watchroom";
  const segments = source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2);

  if (segments.length === 0) {
    return "WR";
  }

  return segments.map((segment) => segment.charAt(0).toUpperCase()).join("");
}

function getProfileCompletion(fields: {
  address: string;
  fullName: string;
  phoneNumber: string;
}): {
  completedFields: number;
  percentage: number;
} {
  const values = [fields.fullName, fields.phoneNumber, fields.address];
  const completedFields = values.filter(
    (value) => value.trim().length > 0,
  ).length;

  return {
    completedFields,
    percentage: Math.round((completedFields / values.length) * 100),
  };
}

function getEntranceProps(prefersReducedMotion: boolean, delay = 0) {
  if (prefersReducedMotion) {
    return {};
  }

  return {
    animate: { opacity: 1, y: 0 },
    initial: { opacity: 0, y: 28 },
    transition: {
      delay,
      duration: 0.78,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  };
}

function AccountProfileForm({
  favoriteCount,
  isAdmin,
  cartCount,
  onSignOut,
  user,
}: {
  favoriteCount: number;
  isAdmin: boolean;
  cartCount: number;
  onSignOut: () => void;
  user: AuthUserProfile;
}) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const { authBusy, saveProfile } = useStorefront();
  const [fullName, setFullName] = useState(user.fullName);
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber);
  const [address, setAddress] = useState(user.address);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"neutral" | "success" | "error">(
    "neutral",
  );

  const memberMark = getMemberMark(fullName, user.email);
  const { completedFields, percentage } = getProfileCompletion({
    address,
    fullName,
    phoneNumber,
  });
  const readinessLabel =
    percentage === 100
      ? isAdmin
        ? "Operations ready"
        : "Reserve-ready"
      : "Desk in progress";

  const stageMeta = [
    {
      label: "Access",
      value: isAdmin ? "Admin" : "Member",
    },
    {
      label: "Member since",
      value: formatMemberSince(user.createdAt),
    },
  ];

  const deskSignals = [
    {
      label: "Profile completion",
      meta: `${completedFields} of 3 core details ready`,
      value: `${percentage}%`,
    },
    {
      label: "Favorites saved",
      meta: "Private references kept in view",
      value: String(favoriteCount),
    },
    {
      label: "Reserve cart",
      meta: "Pieces staged for checkout",
      value: String(cartCount),
    },
    {
      label: isAdmin ? "Role" : "Member since",
      meta: isAdmin
        ? "Operational controls enabled"
        : "Quietly retained across sessions",
      value: isAdmin ? "Admin" : formatMemberSince(user.createdAt),
    },
  ];

  const summaryMetrics = [
    {
      label: "Role",
      value: isAdmin ? "Admin" : "Member",
    },
    {
      label: "Email",
      value: user.email,
    },
  ];

  async function handleSubmit(): Promise<void> {
    setStatus(null);
    setStatusTone("neutral");

    try {
      await saveProfile({
        address,
        fullName,
        phoneNumber,
      });
      setStatus(
        "Profile updated. Your private desk details are ready for the next reserve.",
      );
      setStatusTone("success");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Unable to save your profile right now.",
      );
      setStatusTone("error");
    }
  }

  return (
    <>
      <motion.section
        className="account-page__stage"
        {...getEntranceProps(prefersReducedMotion)}
      >
        <div className="account-page__stage-copy">
          <p className="account-page__eyebrow">
            {isAdmin ? "Admin desk" : "Member desk"}
          </p>
          <h1 className="account-page__title">
            {isAdmin ? "Streamline your floor operations." : "Personal Space"}
          </h1>
          <p className="account-page__copy">
            {isAdmin
              ? "Manage profiles, orders, and reserve context in one unified dashboard."
              : "Access your saved details and preferences in a single, persistent space."}
          </p>

          <div className="account-page__stage-meta">
            {stageMeta.map((item) => (
              <div key={item.label} className="account-page__meta-chip">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="account-page__stage-visual" aria-hidden="true">
          <div className="account-page__member-orbit">
            <div className="account-page__member-badge">
              <span className="account-page__member-badge-label">
                Desk status
              </span>
              <strong>{readinessLabel}</strong>
              <p>
                {isAdmin
                  ? "Your account has elevated controls and full order visibility."
                  : "Complete details, then move between favorites, cart, and orders without friction."}
              </p>
            </div>

            <div className="account-page__member-progress">
              <div className="account-page__member-progress-head">
                <span>Profile readiness</span>
                <strong>{percentage}%</strong>
              </div>
              <div className="account-page__progress-track">
                <span
                  className="account-page__progress-fill"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <p>{completedFields} of 3 key profile details saved.</p>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section
        className="account-page__signal-row"
        {...getEntranceProps(prefersReducedMotion, 0.08)}
      >
        {deskSignals.map((item, index) => (
          <article
            key={item.label}
            className={`account-page__signal ${index === 0 ? "account-page__signal--emphasis" : ""}`}
          >
            <span className="account-page__signal-label">{item.label}</span>
            <strong className="account-page__signal-value">{item.value}</strong>
            <p className="account-page__signal-meta">{item.meta}</p>
          </article>
        ))}
      </motion.section>

      <div className="account-page__workspace">
        <motion.section
          className="account-page__panel account-page__panel--form"
          {...getEntranceProps(prefersReducedMotion, 0.12)}
        >
          <div className="account-page__section-head">
            <div>
              <p className="account-page__section-label">Profile workspace</p>
              <h2 className="account-page__section-title">Member details</h2>
            </div>
          </div>

          <form
            className="account-page__form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
          >
            <div className="account-page__form-grid">
              <label className="account-page__field">
                <span>Full name</span>
                <input
                  onChange={(event) => setFullName(event.target.value)}
                  value={fullName}
                />
              </label>

              <label className="account-page__field">
                <span>Phone number</span>
                <input
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  value={phoneNumber}
                />
              </label>

              <label className="account-page__field account-page__field--wide">
                <span>Primary address</span>
                <textarea
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="District, city, landmark, delivery notes"
                  rows={5}
                  value={address}
                />
              </label>
            </div>

            {status ? (
              <p
                className={`account-page__status account-page__status--${statusTone}`}
              >
                {status}
              </p>
            ) : null}

            <div className="account-page__form-actions">
              <button
                className="account-page__button account-page__button--primary"
                disabled={authBusy}
                type="submit"
              >
                {authBusy ? (
                  <LoaderCircle className="account-page__button-icon account-page__button-icon--spinning" />
                ) : null}
                {authBusy ? "Saving" : "Save profile"}
              </button>

              <button
                className="account-page__button"
                onClick={onSignOut}
                type="button"
              >
                <LogOut className="account-page__button-icon" />
                Sign out
              </button>
            </div>
          </form>
        </motion.section>

        <aside className="account-page__aside">
          <motion.div
            className="account-page__panel account-page__panel--summary"
            {...getEntranceProps(prefersReducedMotion, 0.18)}
          >
            <div className="account-page__summary-top">
              <div className="account-page__summary-mark" aria-hidden="true">
                {memberMark}
              </div>
              <div>
                <p className="account-page__section-label">
                  {isAdmin ? "Admin desk" : "Member desk"}
                </p>
                <h3 className="account-page__summary-title">
                  {fullName.trim() || "Private profile"}
                </h3>
              </div>
            </div>

            <div className="account-page__summary-grid">
              {summaryMetrics.map((item) => (
                <div key={item.label} className="account-page__summary-metric">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>

            <div className="account-page__quick-links">
              <Link className="account-page__quick-link" to="/favorites">
                <Heart className="account-page__quick-icon" />
                <div>
                  <strong>Favorites</strong>
                  <span>{favoriteCount} saved references</span>
                </div>
                <ArrowRight className="account-page__quick-arrow" />
              </Link>

              <Link className="account-page__quick-link" to="/cart">
                <ShoppingBag className="account-page__quick-icon" />
                <div>
                  <strong>Reserve cart</strong>
                  <span>{cartCount} pieces staged for checkout</span>
                </div>
                <ArrowRight className="account-page__quick-arrow" />
              </Link>

              <Link className="account-page__quick-link" to="/orders">
                <Package className="account-page__quick-icon" />
                <div>
                  <strong>{isAdmin ? "Operations" : "Orders"}</strong>
                  <span>
                    {isAdmin
                      ? "Review reserve states and workflow"
                      : "Track payment and shipping status"}
                  </span>
                </div>
                <ArrowRight className="account-page__quick-arrow" />
              </Link>

              {isAdmin ? (
                <div className="account-page__quick-link account-page__quick-link--static">
                  <ShieldCheck className="account-page__quick-icon" />
                  <div>
                    <strong>Admin role</strong>
                    <span>
                      Full order visibility and elevated product controls
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </motion.div>
        </aside>
      </div>
    </>
  );
}

export function AccountPage() {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const {
    authLoading,
    cartCount,
    favoriteCount,
    isAdmin,
    isAuthenticated,
    openAuthModal,
    signOut,
    user,
  } = useStorefront();

  if (authLoading && !user) {
    return (
      <div className="account-page">
        <div className="account-page__shell">
          <motion.section
            className="account-page__empty-state"
            {...getEntranceProps(prefersReducedMotion)}
          >
            <p className="account-page__section-label">Restoring session</p>
            <div className="account-page__loading-bar" aria-hidden="true" />
            <p className="account-page__empty-copy">
              Loading your private member desk.
            </p>
          </motion.section>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="account-page">
        <div className="account-page__shell">
          <motion.section
            className="account-page__empty-state account-page__empty-state--gate"
            {...getEntranceProps(prefersReducedMotion)}
          >
            <p className="account-page__eyebrow">Member access</p>
            <h1 className="account-page__title">Sign in to unlock</h1>
            <p className="account-page__copy">
              Save favorites, keep reserve details ready, and move between your
              cart and product dossiers.
            </p>
            <div className="account-page__gate-actions">
              <button
                className="account-page__button account-page__button--primary"
                onClick={() => openAuthModal("sign-in")}
                type="button"
              >
                Sign in
              </button>
              <Link className="account-page__button" to="/collection">
                Browse collection
              </Link>
            </div>
          </motion.section>
        </div>
      </div>
    );
  }

  return (
    <div className="account-page">
      <div className="account-page__shell">
        <AccountProfileForm
          key={user.id}
          cartCount={cartCount}
          favoriteCount={favoriteCount}
          isAdmin={isAdmin}
          onSignOut={signOut}
          user={user}
        />
      </div>
    </div>
  );
}
