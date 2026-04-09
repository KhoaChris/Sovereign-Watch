import { useRef } from "react";

import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { Link } from "react-router-dom";

import "../styles/components/footer.css";

const linkGroups = [
  {
    label: "Explore",
    links: [
      { label: "Home", to: "/" },
      { label: "Collection", to: "/collection" },
    ],
  },
  {
    label: "Company",
    links: [
      { label: "About", to: "/about" },
      { label: "Contact", to: "/contact" },
      { label: "Services", to: "/client-services" },
      { label: "Shipping", to: "/shipping-returns" },
      { label: "Privacy", to: "/privacy" },
      { label: "Terms", to: "/terms" },
    ],
  },
];

const brandLogoSrc = "/editorial/logo.png";

export function Footer() {
  const footerRef = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: footerRef,
    offset: ["start end", "end end"],
  });

  const panelY = useTransform(scrollYProgress, [0, 0.58, 1], [168, 56, 0]);
  const panelOpacity = useTransform(
    scrollYProgress,
    [0, 0.2, 0.72, 1],
    [0, 0.2, 0.9, 1],
  );
  const panelScale = useTransform(
    scrollYProgress,
    [0, 0.7, 1],
    [0.968, 0.99, 1],
  );
  const ambientOpacity = useTransform(
    scrollYProgress,
    [0, 0.34, 1],
    [0.08, 0.42, 0.7],
  );
  const ambientY = useTransform(scrollYProgress, [0, 1], [52, -16]);

  return (
    <footer ref={footerRef} className="site-footer">
      <motion.div
        aria-hidden="true"
        className="site-footer__ambient"
        style={
          prefersReducedMotion
            ? undefined
            : { opacity: ambientOpacity, y: ambientY }
        }
      />

      <div className="site-footer__track">
        <motion.div
          className="site-footer__panel"
          style={
            prefersReducedMotion
              ? undefined
              : {
                  opacity: panelOpacity,
                  scale: panelScale,
                  y: panelY,
                }
          }
        >
          <div className="site-footer__top">
            <div className="site-footer__brandblock">
              <Link className="site-footer__brand-lockup" to="/">
                <span className="site-footer__brand-mark-frame">
                  <img
                    alt="Watchroom logo"
                    className="site-footer__brand-logo"
                    src={brandLogoSrc}
                  />
                </span>
                <span className="site-footer__brandcopy">
                  <span className="site-footer__eyebrow-link">Sovereign</span>
                  <span className="site-footer__brand-subtitle">
                    Private watch marketplace
                  </span>
                </span>
              </Link>
              <h2 className="site-footer__title">
                Private reserve, carried with restraint.
              </h2>
            </div>

            <div className="site-footer__navgroups">
              {linkGroups.map((group) => (
                <div key={group.label} className="site-footer__group">
                  <p className="site-footer__label">{group.label}</p>
                  <div className="site-footer__links">
                    {group.links.map((link) => (
                      <Link
                        key={link.to}
                        className="site-footer__link"
                        to={link.to}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="site-footer__meta">
            <div className="site-footer__contactline">
              <a
                className="site-footer__contact-item"
                href="mailto:concierge@watchroom.example"
              >
                Sovereign@watchroom.example
              </a>
              <a className="site-footer__contact-item" href="tel:+842812345678">
                +84 28 1234 5678
              </a>
            </div>

            <div className="site-footer__bottom">
              <p>© 2026 Sovereign.</p>
              <p>Client services, shipping, and collector delivery support.</p>
            </div>
          </div>
        </motion.div>
      </div>
    </footer>
  );
}
