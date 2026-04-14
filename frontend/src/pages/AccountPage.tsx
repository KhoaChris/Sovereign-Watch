import { useRef, useState, type ChangeEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Camera,
  Heart,
  LoaderCircle,
  LogOut,
  Package,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import { Link } from "react-router-dom";

import { useFeedback } from "../feedback/feedback-context";
import { useStorefront } from "../storefront/storefront-context";
import type { AuthUserProfile } from "../shared";
import "../styles/pages/account-page.css";

const AVATAR_ACCEPTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
const MAX_AVATAR_FILE_SIZE = 4 * 1024 * 1024;
const AVATAR_OUTPUT_SIZE = 320;

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

function readFileAsImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read the selected image."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () =>
        reject(new Error("The selected image could not be prepared."));
      image.onload = () => resolve(image);
      image.src = String(reader.result ?? "");
    };
    reader.readAsDataURL(file);
  });
}

async function prepareAvatarDataUrl(file: File): Promise<string> {
  if (!AVATAR_ACCEPTED_MIME_TYPES.has(file.type)) {
    throw new Error("Choose a PNG, JPG, or WEBP image for the profile avatar.");
  }

  if (file.size > MAX_AVATAR_FILE_SIZE) {
    throw new Error("Profile images should stay under 4 MB.");
  }

  const image = await readFileAsImage(file);
  const cropSize = Math.min(image.width, image.height);
  const sourceX = (image.width - cropSize) / 2;
  const sourceY = (image.height - cropSize) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_OUTPUT_SIZE;
  canvas.height = AVATAR_OUTPUT_SIZE;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Profile image processing is unavailable right now.");
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    image,
    sourceX,
    sourceY,
    cropSize,
    cropSize,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return canvas.toDataURL("image/webp", 0.9);
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
  const { notify } = useFeedback();
  const { authBusy, saveProfile } = useStorefront();
  const [fullName, setFullName] = useState(user.fullName);
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber);
  const [address, setAddress] = useState(user.address);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    {
      label: "Avatar",
      value: avatarUrl ? "Custom" : "Monogram",
    },
  ];

  async function handleSubmit(): Promise<void> {
    try {
      await saveProfile({
        avatarUrl,
        address,
        fullName,
        phoneNumber,
      });
    } catch {
      return;
    }
  }

  async function handleAvatarSelection(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setAvatarBusy(true);

    try {
      const nextAvatarUrl = await prepareAvatarDataUrl(file);
      setAvatarUrl(nextAvatarUrl);
      notify({
        title: "Avatar ready",
        description: "Your new profile image is staged. Save the profile to publish it.",
        tone: "success",
      });
    } catch (error) {
      notify({
        title: "Avatar could not be prepared",
        description:
          error instanceof Error
            ? error.message
            : "Choose another image and try again.",
        tone: "error",
      });
    } finally {
      setAvatarBusy(false);
    }
  }

  function handleRemoveAvatar(): void {
    setAvatarUrl("");
    notify({
      title: "Avatar removed",
      description: "Save the profile to switch back to your monogram.",
      tone: "info",
    });
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
              <div className="account-page__field account-page__field--wide">
                <span>Profile image</span>
                <div className="account-page__avatar-field">
                  <div className="account-page__avatar-preview">
                    {avatarUrl ? (
                      <img
                        alt={`${fullName.trim() || "Member"} avatar preview`}
                        className="account-page__avatar-image"
                        src={avatarUrl}
                      />
                    ) : (
                      <span className="account-page__avatar-mark">{memberMark}</span>
                    )}
                  </div>

                  <div className="account-page__avatar-copy">
                    <strong>
                      {avatarBusy
                        ? "Preparing image"
                        : avatarUrl
                          ? "Avatar ready to publish"
                          : "Add a profile image"}
                    </strong>
                    <p>
                      Upload a square-friendly PNG, JPG, or WEBP image. We crop
                      and optimize it automatically for your member desk.
                    </p>
                    <div className="account-page__avatar-actions">
                      <button
                        className="account-page__button account-page__button--primary"
                        disabled={avatarBusy}
                        onClick={() => fileInputRef.current?.click()}
                        type="button"
                      >
                        {avatarBusy ? (
                          <LoaderCircle className="account-page__button-icon account-page__button-icon--spinning" />
                        ) : (
                          <Camera className="account-page__button-icon" />
                        )}
                        {avatarUrl ? "Change avatar" : "Choose avatar"}
                      </button>

                      {avatarUrl ? (
                        <button
                          className="account-page__button"
                          onClick={handleRemoveAvatar}
                          type="button"
                        >
                          <RotateCcw className="account-page__button-icon" />
                          Use monogram
                        </button>
                      ) : null}
                    </div>
                    <input
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      className="account-page__avatar-input"
                      onChange={(event) => {
                        void handleAvatarSelection(event);
                      }}
                      ref={fileInputRef}
                      type="file"
                    />
                  </div>
                </div>
              </div>

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
                {avatarUrl ? (
                  <img
                    alt=""
                    className="account-page__summary-avatar-image"
                    src={avatarUrl}
                  />
                ) : (
                  memberMark
                )}
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
