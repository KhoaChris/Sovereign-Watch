import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "framer-motion";
import {
  ArrowRight,
  Heart,
  LogOut,
  Menu,
  ShoppingBag,
  User2,
  X,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { useStorefront } from "../storefront/storefront-context";
import "../styles/components/header.css";

const brandLogoSrc = "/editorial/logo.png";

function formatBadgeCount(value: number): string {
  if (value > 99) {
    return "99+";
  }

  return String(value);
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

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === "/";
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const lastScrollPosition = useRef(0);
  const prefersReducedMotion = useReducedMotion();
  const { scrollY } = useScroll();
  const {
    cartCount,
    favoriteCount,
    isAdmin,
    isAuthenticated,
    openAuthModal,
    signOut,
    user,
  } = useStorefront();

  const primaryNavigationItems = [
    { label: "Home", to: "/", caption: "Editorial landing" },
    { label: "Marketplace", to: "/collection", caption: "Curated references" },
    ...(isAuthenticated
      ? [
          {
            label: isAdmin ? "Operations" : "Orders",
            to: isAdmin ? "/operations" : "/orders",
            caption: isAdmin ? "Admin reserve desk" : "Reserve tracking",
          },
        ]
      : []),
  ];

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = previousOverflow;
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const mediaQuery = window.matchMedia("(min-width: 980px)");
    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setMenuOpen(false);
      }
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [menuOpen]);

  useMotionValueEvent(scrollY, "change", (current) => {
    const previous = lastScrollPosition.current;
    setIsScrolled(current > 20);

    if (menuOpen || current < 60) {
      setIsHidden(false);
      lastScrollPosition.current = current;
      return;
    }

    const delta = current - previous;

    if (delta > 16) {
      setIsHidden(true);
    } else if (delta < -12) {
      setIsHidden(false);
    }

    lastScrollPosition.current = current;
  });

  const headerIsDense = !isHome || isScrolled;
  const memberMark = getMemberMark(user?.fullName, user?.email);
  const showMemberCommerce = !isAdmin;

  const closeDrawer = () => {
    setMenuOpen(false);
  };

  const openMemberDesk = () => {
    closeDrawer();

    if (!isAuthenticated && user) {
      return;
    }

    if (isAuthenticated) {
      navigate("/account");
      return;
    }

    openAuthModal("sign-in");
  };

  const handleSignOut = () => {
    signOut();
    closeDrawer();
    navigate("/");
  };

  const openProtectedDestination = (path: string) => {
    closeDrawer();

    if (!isAuthenticated && user) {
      return;
    }

    if (!isAuthenticated) {
      openAuthModal("sign-in");
      return;
    }

    navigate(path);
  };

  const roleLabel = isAdmin ? "Admin" : isAuthenticated ? "Member" : "Guest";

  return (
    <>
      <motion.header
        animate={
          prefersReducedMotion
            ? undefined
            : {
                opacity: isHidden ? 0.94 : 1,
                y: isHidden ? -112 : 0,
              }
        }
        className={`site-header ${isHome ? "site-header--home" : "site-header--inner"} ${
          headerIsDense ? "site-header--dense" : ""
        } ${menuOpen ? "site-header--menu-open" : ""}`}
        transition={{ duration: 0.72, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="site-header__halo" />

        <div className="site-header__inner">
          <div className="site-header__left">
            <button
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="site-header__menu-button"
              onClick={() => setMenuOpen((current) => !current)}
              type="button"
            >
              {menuOpen ? (
                <X className="site-header__menu-icon" />
              ) : (
                <Menu className="site-header__menu-icon" />
              )}
            </button>

            <div className="site-header__brand-block">
              <NavLink className="site-header__brand-lockup" to="/">
                <span className="site-header__brand-mark-frame">
                  <img
                    alt="Watchroom logo"
                    className="site-header__brand-logo"
                    src={brandLogoSrc}
                  />
                </span>
                <span className="site-header__brand">Sovereign</span>
              </NavLink>
            </div>
          </div>

          <nav className="site-header__nav" aria-label="Primary navigation">
            {primaryNavigationItems.map((item) => (
              <NavLink
                key={item.to}
                className={({ isActive }) =>
                  isActive
                    ? "site-header__nav-link site-header__nav-link--active"
                    : "site-header__nav-link"
                }
                end={item.to === "/"}
                to={item.to}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="site-header__right">
            {isAuthenticated ? (
              <span
                className={`site-header__role-pill ${
                  isAdmin ? "site-header__role-pill--admin" : ""
                }`}
              >
                {roleLabel}
              </span>
            ) : null}

            <div className="site-header__icon-row">
              {isAuthenticated && showMemberCommerce ? (
                <NavLink
                  aria-label="Favorites"
                  className={({ isActive }) =>
                    isActive
                      ? "site-header__icon-button site-header__icon-button--active"
                      : "site-header__icon-button"
                  }
                  onClick={closeDrawer}
                  to="/favorites"
                >
                  <Heart className="site-header__icon" />
                  {favoriteCount > 0 ? (
                    <span className="site-header__icon-badge">
                      {formatBadgeCount(favoriteCount)}
                    </span>
                  ) : null}
                </NavLink>
              ) : !isAuthenticated ? (
                <button
                  aria-label="Sign in to access favorites"
                  className="site-header__icon-button"
                  onClick={() => openAuthModal("sign-in")}
                  type="button"
                >
                  <Heart className="site-header__icon" />
                </button>
              ) : null}

              {isAuthenticated && showMemberCommerce ? (
                <NavLink
                  aria-label="Cart"
                  className={({ isActive }) =>
                    isActive
                      ? "site-header__icon-button site-header__icon-button--active"
                      : "site-header__icon-button"
                  }
                  onClick={closeDrawer}
                  to="/cart"
                >
                  <ShoppingBag className="site-header__icon" />
                  {cartCount > 0 ? (
                    <span className="site-header__icon-badge">
                      {formatBadgeCount(cartCount)}
                    </span>
                  ) : null}
                </NavLink>
              ) : !isAuthenticated ? (
                <button
                  aria-label="Sign in to access your cart"
                  className="site-header__icon-button"
                  onClick={() => openAuthModal("sign-in")}
                  type="button"
                >
                  <ShoppingBag className="site-header__icon" />
                </button>
              ) : null}

              <button
                aria-label={isAuthenticated ? "Open account" : "Sign in"}
                className={`site-header__icon-button site-header__icon-button--member ${
                  location.pathname === "/account"
                    ? "site-header__icon-button--active"
                    : ""
                } ${isAuthenticated ? "site-header__icon-button--authed" : ""}`}
                onClick={openMemberDesk}
                type="button"
              >
                {isAuthenticated ? (
                  user?.avatarUrl ? (
                    <img
                      alt={`${user.fullName || "Member"} avatar`}
                      className="site-header__member-avatar"
                      src={user.avatarUrl}
                    />
                  ) : (
                    <span className="site-header__member-mark">{memberMark}</span>
                  )
                ) : (
                  <User2 className="site-header__icon" />
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="site-header__drawer-layer"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
          >
            <button
              aria-label="Close menu"
              className="site-header__drawer-backdrop"
              onClick={closeDrawer}
              type="button"
            />

            <motion.aside
              animate={{ x: 0 }}
              className="site-header__drawer"
              exit={{ x: "-100%" }}
              initial={{ x: "-104%" }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="site-header__drawer-head">
                <div className="site-header__drawer-brand">
                  <span className="site-header__drawer-brand-mark">
                    <img
                      alt="Watchroom logo"
                      className="site-header__drawer-brand-logo"
                      src={brandLogoSrc}
                    />
                  </span>
                  <div>
                    <p className="site-header__drawer-kicker">Watchroom menu</p>
                  </div>
                </div>

                <button
                  aria-label="Close menu"
                  className="site-header__drawer-close"
                  onClick={closeDrawer}
                  type="button"
                >
                  <X className="site-header__drawer-close-icon" />
                </button>
              </div>

              <div className="site-header__drawer-intro">
                <div className="site-header__drawer-pills" aria-hidden="true">
                  <span className="site-header__drawer-pill">{roleLabel}</span>
                  {showMemberCommerce ? (
                    <>
                      <span className="site-header__drawer-pill">
                        Favorites {formatBadgeCount(favoriteCount)}
                      </span>
                      <span className="site-header__drawer-pill">
                        Cart {formatBadgeCount(cartCount)}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="site-header__drawer-section">
                <p className="site-header__drawer-section-label">Browse</p>
                <nav
                  className="site-header__drawer-nav"
                  aria-label="Mobile navigation"
                >
                  {primaryNavigationItems.map((item) => (
                    <NavLink
                      key={item.to}
                      className={({ isActive }) =>
                        isActive
                          ? "site-header__drawer-link site-header__drawer-link--active"
                          : "site-header__drawer-link"
                      }
                      end={item.to === "/"}
                      onClick={closeDrawer}
                      to={item.to}
                    >
                      <div className="site-header__drawer-link-copy">
                        <span className="site-header__drawer-link-title">
                          {item.label}
                        </span>
                        <span className="site-header__drawer-link-caption">
                          {item.caption}
                        </span>
                      </div>
                      <span className="site-header__drawer-link-trailing">
                        <ArrowRight className="site-header__drawer-arrow" />
                      </span>
                    </NavLink>
                  ))}
                </nav>
              </div>

              <div className="site-header__drawer-section">
                <p className="site-header__drawer-section-label">
                  Private desk
                </p>
                <nav
                  className="site-header__drawer-nav"
                  aria-label="Member navigation"
                >
                  {showMemberCommerce ? (
                    <>
                      <NavLink
                        className={({ isActive }) =>
                          isActive
                            ? "site-header__drawer-link site-header__drawer-link--active"
                            : "site-header__drawer-link"
                        }
                        onClick={(event) => {
                          if (!isAuthenticated) {
                            event.preventDefault();
                            openProtectedDestination("/favorites");
                          } else {
                            closeDrawer();
                          }
                        }}
                        to={isAuthenticated ? "/favorites" : "#"}
                      >
                        <div className="site-header__drawer-link-copy">
                          <span className="site-header__drawer-link-title">
                            Favorites
                          </span>
                          <span className="site-header__drawer-link-caption">
                            Saved references
                          </span>
                        </div>
                        <span className="site-header__drawer-link-trailing site-header__drawer-link-trailing--value">
                          {formatBadgeCount(favoriteCount)}
                        </span>
                      </NavLink>

                      <NavLink
                        className={({ isActive }) =>
                          isActive
                            ? "site-header__drawer-link site-header__drawer-link--active"
                            : "site-header__drawer-link"
                        }
                        onClick={(event) => {
                          if (!isAuthenticated) {
                            event.preventDefault();
                            openProtectedDestination("/cart");
                          } else {
                            closeDrawer();
                          }
                        }}
                        to={isAuthenticated ? "/cart" : "#"}
                      >
                        <div className="site-header__drawer-link-copy">
                          <span className="site-header__drawer-link-title">
                            Cart
                          </span>
                          <span className="site-header__drawer-link-caption">
                            Reserve desk
                          </span>
                        </div>
                        <span className="site-header__drawer-link-trailing site-header__drawer-link-trailing--value">
                          {formatBadgeCount(cartCount)}
                        </span>
                      </NavLink>
                    </>
                  ) : null}

                  <button
                    className="site-header__drawer-link site-header__drawer-link--button"
                    onClick={openMemberDesk}
                    type="button"
                  >
                    <div className="site-header__drawer-link-copy">
                      <span className="site-header__drawer-link-title">
                        {isAuthenticated
                          ? isAdmin
                            ? "Admin account"
                            : "Account"
                          : "Sign in"}
                      </span>
                      <span className="site-header__drawer-link-caption">
                        {isAuthenticated
                          ? isAdmin
                            ? "Role, profile, and operations access"
                            : "Profile and delivery details"
                          : "Sync member access"}
                      </span>
                    </div>
                    <span className="site-header__drawer-link-trailing">
                      <ArrowRight className="site-header__drawer-arrow" />
                    </span>
                  </button>
                </nav>
              </div>

              <div className="site-header__drawer-footer">
                <div className="site-header__drawer-actions">
                  {isAuthenticated ? (
                    <button
                      className="site-header__drawer-secondary"
                      onClick={handleSignOut}
                      type="button"
                    >
                      <LogOut className="site-header__drawer-secondary-icon" />
                      Sign out
                    </button>
                  ) : (
                    <button
                      className="site-header__drawer-secondary"
                      onClick={() => {
                        closeDrawer();
                        openAuthModal("sign-up");
                      }}
                      type="button"
                    >
                      <User2 className="site-header__drawer-secondary-icon" />
                      Create account
                    </button>
                  )}
                </div>
              </div>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
