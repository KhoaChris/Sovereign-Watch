import { motion } from "framer-motion";
import { Clock3, Mail, MapPin, Phone } from "lucide-react";
import { Link } from "react-router-dom";

import "../styles/pages/contact-page.css";

const contactItems = [
  {
    icon: Mail,
    label: "Email",
    value: "concierge@watchroom.example",
    href: "mailto:concierge@watchroom.example",
  },
  {
    icon: Phone,
    label: "Phone",
    value: "+84 28 1234 5678",
    href: "tel:+842812345678",
  },
  {
    icon: MapPin,
    label: "Location",
    value: "District 1, Ho Chi Minh City",
  },
  {
    icon: Clock3,
    label: "Hours",
    value: "Monday to Saturday, 09:00-18:30",
  },
];

export function ContactPage() {
  return (
    <div className="contact-page">
      <div className="contact-page__ambient" />
      <div className="contact-page__shell">
        <motion.header
          animate={{ opacity: 1, y: 0 }}
          className="contact-page__hero"
          initial={{ opacity: 0, y: 18 }}
          transition={{ duration: 0.45 }}
        >
          <div className="contact-page__hero-copy">
            <p className="contact-page__eyebrow">Contact</p>
            <h1 className="contact-page__title">Speak with the Watchroom team.</h1>
            <p className="contact-page__lead">
              Whether you need product guidance, reserve support, or post-order help, our desk is set up to
              respond like a real business and not a placeholder storefront.
            </p>
          </div>

          <div className="contact-page__panel">
            <p className="contact-page__panel-label">Best for</p>
            <ul className="contact-page__panel-list">
              <li>Reference and variant questions</li>
              <li>Reserve and order follow-up</li>
              <li>Delivery and support requests</li>
            </ul>
            <Link className="contact-page__panel-link" to="/client-services">
              View Client Services
            </Link>
          </div>
        </motion.header>

        <div className="contact-page__grid">
          <section className="contact-page__section">
            <p className="contact-page__section-label">Direct contact</p>
            <div className="contact-page__contact-list">
              {contactItems.map((item) => {
                const Icon = item.icon;
                const content = (
                  <>
                    <Icon className="contact-page__contact-icon" />
                    <div>
                      <p className="contact-page__contact-label">{item.label}</p>
                      <p className="contact-page__contact-value">{item.value}</p>
                    </div>
                  </>
                );

                if (item.href) {
                  return (
                    <a key={item.label} className="contact-page__contact-item" href={item.href}>
                      {content}
                    </a>
                  );
                }

                return (
                  <div key={item.label} className="contact-page__contact-item">
                    {content}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="contact-page__section">
            <p className="contact-page__section-label">How we work</p>
            <div className="contact-page__steps">
              <div className="contact-page__step">
                <span className="contact-page__step-index">01</span>
                <div>
                  <h2 className="contact-page__step-title">Initial inquiry</h2>
                  <p className="contact-page__step-copy">
                    Share the reference, page, or order you need help with and we will route the request properly.
                  </p>
                </div>
              </div>
              <div className="contact-page__step">
                <span className="contact-page__step-index">02</span>
                <div>
                  <h2 className="contact-page__step-title">Client follow-up</h2>
                  <p className="contact-page__step-copy">
                    We respond with the relevant product, reserve, shipping, or support context rather than generic replies.
                  </p>
                </div>
              </div>
              <div className="contact-page__step">
                <span className="contact-page__step-index">03</span>
                <div>
                  <h2 className="contact-page__step-title">Resolution</h2>
                  <p className="contact-page__step-copy">
                    The goal is to move the request forward clearly, whether that means a reserve, an update, or support after purchase.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
