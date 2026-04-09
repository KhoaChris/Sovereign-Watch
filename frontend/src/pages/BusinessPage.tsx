import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import "../styles/pages/business-page.css";

type BusinessPageKey = "about" | "client-services" | "shipping-returns" | "privacy" | "terms";

interface BusinessSection {
  title: string;
  copy: string;
  bullets?: string[];
}

interface BusinessPageContent {
  eyebrow: string;
  title: string;
  lead: string;
  asideTitle: string;
  asideCopy: string;
  sections: BusinessSection[];
}

const businessPages: Record<BusinessPageKey, BusinessPageContent> = {
  about: {
    eyebrow: "About",
    title: "A quieter watch business for clients who value discretion as much as design.",
    lead:
      "Watchroom is built around a simple idea: luxury watch buying should feel deliberate, private, and well-supported from first inquiry to final delivery.",
    asideTitle: "What we focus on",
    asideCopy:
      "Curated references, limited runs, clearer product context, and a reserve process that feels personal instead of transactional.",
    sections: [
      {
        title: "Curation over volume",
        copy:
          "We do not try to look like a giant catalogue business. The collection is intentionally narrower, with each listing chosen for silhouette, finish, and collector relevance.",
      },
      {
        title: "Reserve-led service",
        copy:
          "Our buying experience is centered around reserve requests, private follow-up, and a calmer pace of service rather than hard-sell urgency.",
      },
      {
        title: "Support after purchase",
        copy:
          "Shipping coordination, order follow-up, and client support continue after checkout so the experience still feels premium once the watch leaves the screen.",
      },
    ],
  },
  "client-services": {
    eyebrow: "Client Services",
    title: "Support for reserve requests, order follow-up, and after-purchase guidance.",
    lead:
      "Our client services desk is designed for collectors who want clarity, speed, and discretion without losing the feeling of a premium buying experience.",
    asideTitle: "Available support",
    asideCopy:
      "Product guidance, reserve assistance, delivery questions, post-order updates, and general support for active clients.",
    sections: [
      {
        title: "Pre-purchase guidance",
        copy:
          "We help clients compare references, review sizing and finish differences, and narrow a shortlist before they place a reserve request.",
        bullets: [
          "Reference recommendations by collection mood",
          "Variant and size guidance",
          "Availability clarification before reserve",
        ],
      },
      {
        title: "Reserve assistance",
        copy:
          "Once a reserve is submitted, the support flow stays clear and responsive so clients understand what comes next without chasing updates.",
        bullets: [
          "Order confirmation follow-up",
          "Payment preference coordination",
          "Delivery detail confirmation",
        ],
      },
      {
        title: "After-purchase support",
        copy:
          "We remain available for delivery progress, care questions, and the usual practical details that surround a premium purchase.",
      },
    ],
  },
  "shipping-returns": {
    eyebrow: "Shipping & Returns",
    title: "Clear delivery standards, careful packaging, and a return policy written like a business should.",
    lead:
      "Luxury goods need shipping language that feels trustworthy. This page explains how delivery windows, handoff, and return conditions are handled.",
    asideTitle: "At a glance",
    asideCopy:
      "Tracked delivery, address confirmation before dispatch, and support access if timing or condition issues need review.",
    sections: [
      {
        title: "Shipping process",
        copy:
          "Orders are reviewed after reserve confirmation, then prepared for dispatch once address and payment details are finalized.",
        bullets: [
          "Tracked delivery for shipped orders",
          "Address confirmation before release",
          "Status updates surfaced during fulfillment",
        ],
      },
      {
        title: "Delivery windows",
        copy:
          "Estimated delivery timing depends on reference availability, order confirmation, and the destination address selected during reserve.",
      },
      {
        title: "Returns and review",
        copy:
          "If a delivery issue or order concern arises, clients should contact our team promptly so the case can be reviewed against the order record and shipping status.",
      },
    ],
  },
  privacy: {
    eyebrow: "Privacy",
    title: "Client privacy matters before, during, and after a reserve request.",
    lead:
      "This business handles identity, address, and order data carefully. We keep the language plain because privacy pages should be understandable, not theatrical.",
    asideTitle: "Information handled",
    asideCopy:
      "Contact information, shipping details, reserve history, and order records used to support purchases and follow-up service.",
    sections: [
      {
        title: "Why information is used",
        copy:
          "Order and contact data is used to process reserve requests, coordinate delivery, support active orders, and maintain purchase records.",
      },
      {
        title: "What is retained",
        copy:
          "Client-facing account, order, shipping, and payment-status information may be retained where necessary for service, fulfillment, and business operations.",
      },
      {
        title: "Support requests",
        copy:
          "Clients who want clarification regarding how their information is used can contact the team directly through the business contact page.",
      },
    ],
  },
  terms: {
    eyebrow: "Terms",
    title: "Straightforward purchase terms for a premium reserve-led storefront.",
    lead:
      "These terms describe the practical expectations around reserve submission, order review, availability, payment selection, and post-order support.",
    asideTitle: "Core principles",
    asideCopy:
      "Availability can change, reserves are reviewed before fulfillment, and final shipping timelines depend on order confirmation and service follow-up.",
    sections: [
      {
        title: "Reserve requests",
        copy:
          "Submitting a reserve request indicates purchase intent, but final order handling still depends on reference availability and business confirmation.",
      },
      {
        title: "Availability and listing updates",
        copy:
          "Product listings, pricing, and stock visibility may change as inventory moves or references are refreshed across the storefront.",
      },
      {
        title: "Business communication",
        copy:
          "Clients are expected to provide accurate delivery information and respond promptly if follow-up is needed to complete the order process.",
      },
    ],
  },
};

export function BusinessPage({ pageKey }: { pageKey: BusinessPageKey }) {
  const page = businessPages[pageKey];

  return (
    <div className="business-page">
      <div className="business-page__ambient" />
      <div className="business-page__shell">
        <motion.header
          animate={{ opacity: 1, y: 0 }}
          className="business-page__hero"
          initial={{ opacity: 0, y: 18 }}
          transition={{ duration: 0.45 }}
        >
          <div className="business-page__hero-copy">
            <p className="business-page__eyebrow">{page.eyebrow}</p>
            <h1 className="business-page__title">{page.title}</h1>
            <p className="business-page__lead">{page.lead}</p>
          </div>

          <aside className="business-page__aside">
            <p className="business-page__aside-label">{page.asideTitle}</p>
            <p className="business-page__aside-copy">{page.asideCopy}</p>
            <Link className="business-page__aside-link" to="/contact">
              Contact Our Team
              <ArrowRight className="business-page__aside-icon" />
            </Link>
          </aside>
        </motion.header>

        <div className="business-page__sections">
          {page.sections.map((section, index) => (
            <motion.section
              key={section.title}
              className="business-page__section"
              initial={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.45, delay: index * 0.06 }}
              viewport={{ amount: 0.2, once: true }}
              whileInView={{ opacity: 1, y: 0 }}
            >
              <div className="business-page__section-rail">
                <span className="business-page__section-index">0{index + 1}</span>
              </div>
              <div className="business-page__section-body">
                <h2 className="business-page__section-title">{section.title}</h2>
                <p className="business-page__section-copy">{section.copy}</p>
                {section.bullets ? (
                  <ul className="business-page__list">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="business-page__list-item">
                        {bullet}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </motion.section>
          ))}
        </div>
      </div>
    </div>
  );
}
