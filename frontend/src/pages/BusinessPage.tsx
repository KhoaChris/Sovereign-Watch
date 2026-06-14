import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link, NavLink } from "react-router-dom";

import {
  businessPages,
  companyNavItems,
  type BusinessPageKey,
  type CompanyAction,
} from "../company-content";
import "../styles/pages/company-pages.css";
import "../styles/pages/business-page.css";

function CompanyActionLink({ action }: { action: CompanyAction }) {
  const className = `company-page__button company-page__button--${action.tone}`;

  if (action.kind === "anchor") {
    return (
      <a className={className} href={action.to}>
        {action.label}
      </a>
    );
  }

  return (
    <Link className={className} to={action.to}>
      {action.label}
    </Link>
  );
}

export function BusinessPage({ pageKey }: { pageKey: BusinessPageKey }) {
  const page = businessPages[pageKey];
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      className={`company-page company-page--business company-page--${page.mode}`}
    >
      <div className="company-page__ambient">
        {!prefersReducedMotion ? (
          <>
            <motion.span
              animate={{
                opacity: [0.46, 0.76, 0.46],
                scale: [1, 1.08, 1],
                x: [0, 18, 0],
              }}
              className="company-page__ambient-orb company-page__ambient-orb--warm"
              transition={{
                duration: 16,
                ease: "easeInOut",
                repeat: Number.POSITIVE_INFINITY,
              }}
            />
            <motion.span
              animate={{
                opacity: [0.26, 0.42, 0.26],
                scale: [1, 1.12, 1],
                x: [0, -20, 0],
                y: [0, 12, 0],
              }}
              className="company-page__ambient-orb company-page__ambient-orb--cool"
              transition={{
                duration: 19,
                ease: "easeInOut",
                repeat: Number.POSITIVE_INFINITY,
              }}
            />
          </>
        ) : null}
        <span className="company-page__ambient-grid" />
      </div>

      <div className="company-page__shell">
        <motion.header
          animate={{ opacity: 1, y: 0 }}
          className="company-page__hero"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 22 }}
          transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="company-page__hero-topline">
            <p className="company-page__desk-label">Watchroom company</p>
          </div>

          <nav aria-label="Company pages" className="company-page__nav">
            {companyNavItems.map((item) => (
              <NavLink
                key={item.key}
                className={({ isActive }) =>
                  `company-page__nav-link${isActive ? " company-page__nav-link--active" : ""}`
                }
                to={item.to}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="company-page__hero-grid">
            <div className="company-page__hero-copy">
              <p className="company-page__eyebrow">{page.eyebrow}</p>
              <h1 className="company-page__title">{page.title}</h1>
              <p className="company-page__lead">{page.lead}</p>

              <div className="company-page__hero-actions">
                {page.actions.map((action) => (
                  <CompanyActionLink key={action.label} action={action} />
                ))}
              </div>
            </div>

            <div className="company-page__hero-signals">
              {page.signals.map((signal, index) => (
                <motion.article
                  key={signal.label}
                  className="company-page__signal"
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
                  transition={{
                    duration: 0.4,
                    delay: prefersReducedMotion ? 0 : 0.08 + index * 0.06,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  whileInView={
                    prefersReducedMotion ? undefined : { opacity: 1, y: 0 }
                  }
                  viewport={{ amount: 0.25, once: true }}
                >
                  <span>{signal.label}</span>
                  <strong>{signal.value}</strong>
                  <p>{signal.note}</p>
                </motion.article>
              ))}
            </div>
          </div>

          <nav
            aria-label={`${page.eyebrow} quick sections`}
            className="company-page__summary-strip"
          >
            {page.sections.map((section, index) => (
              <a
                key={section.id}
                className="company-page__summary-link"
                href={`#${section.id}`}
              >
                <span>{`0${index + 1}`}</span>
                <strong>{section.label}</strong>
              </a>
            ))}
          </nav>
        </motion.header>

        <div className="company-page__workspace">
          <aside className="company-page__rail">
            <div className="company-page__rail-card">
              <p className="company-page__rail-label">On this page</p>

              <nav
                aria-label={`${page.eyebrow} chapters`}
                className="company-page__chapter-nav"
              >
                {page.sections.map((section, index) => (
                  <a
                    key={section.id}
                    className="company-page__chapter-link"
                    href={`#${section.id}`}
                  >
                    <span>{`0${index + 1}`}</span>
                    {section.label}
                  </a>
                ))}
              </nav>

              <div className="company-page__spotlight">
                <p className="company-page__spotlight-label">
                  {page.rail.label}
                </p>
                <h2 className="company-page__spotlight-title">
                  {page.rail.title}
                </h2>
                <p className="company-page__spotlight-copy">{page.rail.copy}</p>
              </div>
            </div>
          </aside>

          <div
            className={`company-page__chapters company-page__chapters--${page.mode}`}
          >
            {page.sections.map((section, index) => (
              <motion.section
                key={section.id}
                className="company-page__chapter"
                id={section.id}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 26 }}
                transition={{
                  duration: 0.46,
                  delay: prefersReducedMotion ? 0 : index * 0.05,
                  ease: [0.22, 1, 0.36, 1],
                }}
                viewport={{ amount: 0.2, once: true }}
                whileInView={
                  prefersReducedMotion ? undefined : { opacity: 1, y: 0 }
                }
              >
                <div className="company-page__chapter-meta">
                  <span className="company-page__chapter-index">{`0${index + 1}`}</span>
                  <p className="company-page__chapter-label">{section.label}</p>
                </div>

                <div className="company-page__chapter-body">
                  <h2 className="company-page__chapter-title">
                    {section.title}
                  </h2>

                  <div className="company-page__chapter-content">
                    <p className="company-page__chapter-copy">
                      {section.copy}
                    </p>

                    {section.bullets ? (
                      <ul className="company-page__chapter-list">
                        {section.bullets.map((bullet) => (
                          <li
                            key={bullet}
                            className="company-page__chapter-list-item"
                          >
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              </motion.section>
            ))}
          </div>
        </div>

        <motion.section
          className="company-page__closing"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ amount: 0.2, once: true }}
          whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        >
          <p className="company-page__closing-eyebrow">
            {page.closing.eyebrow}
          </p>
          <div className="company-page__closing-grid">
            <div className="company-page__closing-copy">
              <h2 className="company-page__closing-title">
                {page.closing.title}
              </h2>
              <p className="company-page__closing-text">{page.closing.copy}</p>
            </div>

            <div className="company-page__closing-actions">
              <Link
                className="company-page__button company-page__button--primary"
                to={page.closing.primary.to}
              >
                {page.closing.primary.label}
                <ArrowRight className="company-page__button-icon" />
              </Link>
              <Link
                className="company-page__button company-page__button--secondary"
                to={page.closing.secondary.to}
              >
                {page.closing.secondary.label}
              </Link>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
