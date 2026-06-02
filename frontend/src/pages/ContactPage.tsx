import { useState, type FormEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Clock3, Mail, MapPin, Phone, Send } from "lucide-react";
import { Link, NavLink } from "react-router-dom";

import {
  COMPANY_SOVEREIGN_EMAIL,
  COMPANY_PHONE,
  companyNavItems,
} from "../company-content";
import { useFeedback } from "../feedback/feedback-context";
import "../styles/pages/company-pages.css";
import "../styles/pages/contact-page.css";

const contactItems = [
  {
    icon: Mail,
    label: "Email",
    note: "For watch, reserve, and order questions.",
    value: COMPANY_SOVEREIGN_EMAIL,
    href: `mailto:${COMPANY_SOVEREIGN_EMAIL}`,
  },
  {
    icon: Phone,
    label: "Phone",
    note: "For urgent desk-hour questions.",
    value: COMPANY_PHONE,
    href: `tel:${COMPANY_PHONE.replace(/\s+/g, "")}`,
  },
  {
    icon: MapPin,
    label: "Location",
    note: "Private desk for showroom and shipping coordination.",
    value: "District 1, Ho Chi Minh City",
  },
  {
    icon: Clock3,
    label: "Hours",
    note: "Replies start during desk hours.",
    value: "Monday to Saturday, 09:00-18:30",
  },
];

const inquiryTopics = [
  "Reference guidance",
  "Reserve assistance",
  "Delivery update",
  "After-purchase support",
  "Privacy or terms question",
  "Partnership or editorial",
];

type ContactFormState = {
  email: string;
  message: string;
  name: string;
  reference: string;
  topic: string;
};

type ContactFormErrors = Partial<Record<keyof ContactFormState, string>>;

function buildMailtoHref(form: ContactFormState): string {
  const subject = `[Watchroom] ${form.topic} inquiry from ${form.name.trim()}`;
  const lines = [
    "Hello Watchroom team,",
    "",
    `Name: ${form.name.trim()}`,
    `Email: ${form.email.trim()}`,
    `Topic: ${form.topic.trim()}`,
    form.reference.trim()
      ? `Reference / Order: ${form.reference.trim()}`
      : null,
    "",
    "Message:",
    form.message.trim(),
    "",
    "Sent from the Watchroom contact desk.",
  ].filter(Boolean);

  return `mailto:${COMPANY_SOVEREIGN_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    lines.join("\n"),
  )}`;
}

function validateContactForm(form: ContactFormState): ContactFormErrors {
  const errors: ContactFormErrors = {};

  if (form.name.trim().length < 2) {
    errors.name = "Please enter your name.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = "Please enter a valid email address.";
  }

  if (!form.topic.trim()) {
    errors.topic = "Please choose a topic.";
  }

  if (form.message.trim().length < 20) {
    errors.message = "Please enter a short message.";
  }

  return errors;
}

export function ContactPage() {
  const { notify } = useFeedback();
  const prefersReducedMotion = useReducedMotion();
  const [form, setForm] = useState<ContactFormState>({
    email: "",
    message: "",
    name: "",
    reference: "",
    topic: "",
  });
  const [errors, setErrors] = useState<ContactFormErrors>({});

  function updateField<K extends keyof ContactFormState>(
    field: K,
    value: ContactFormState[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateContactForm(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      notify({
        title: "Complete the form",
        description:
          "Please finish the required fields before opening the email draft.",
        tone: "error",
      });
      return;
    }

    notify({
      title: "Email draft ready",
      description: "Your mail app should open with the details filled in.",
      tone: "success",
    });

    window.location.href = buildMailtoHref(form);
  }

  return (
    <div className="company-page company-page--contact">
      <div className="company-page__ambient">
        {!prefersReducedMotion ? (
          <>
            <motion.span
              animate={{
                opacity: [0.5, 0.78, 0.5],
                scale: [1, 1.06, 1],
                x: [0, 14, 0],
              }}
              className="company-page__ambient-orb company-page__ambient-orb--warm"
              transition={{
                duration: 15,
                ease: "easeInOut",
                repeat: Number.POSITIVE_INFINITY,
              }}
            />
            <motion.span
              animate={{
                opacity: [0.24, 0.4, 0.24],
                scale: [1, 1.1, 1],
                x: [0, -18, 0],
                y: [0, 10, 0],
              }}
              className="company-page__ambient-orb company-page__ambient-orb--cool"
              transition={{
                duration: 18,
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
              <p className="company-page__eyebrow">Contact</p>
              <h1 className="company-page__title">Client support center</h1>
              <p className="company-page__lead">
                Ask about a watch, reserve, delivery, or after-sales support.
              </p>

              <div className="company-page__hero-actions">
                <a
                  className="company-page__button company-page__button--primary"
                  href={`mailto:${COMPANY_SOVEREIGN_EMAIL}`}
                >
                  Email concierge
                </a>
                <Link
                  className="company-page__button company-page__button--secondary"
                  to="/client-services"
                >
                  View client services
                </Link>
              </div>
            </div>

            <div className="company-page__hero-signals">
              <article className="company-page__signal">
                <span>Desk hours</span>
                <strong>Mon-Sat / 09:00-18:30</strong>
                <p>Most replies begin during desk hours.</p>
              </article>
              <article className="company-page__signal">
                <span>Use cases</span>
                <strong>Watch, reserve, delivery, support</strong>
                <p>One channel before and after purchase.</p>
              </article>
            </div>
          </div>
        </motion.header>

        <div className="contact-page__workspace">
          <div className="contact-page__column">
            <motion.section
              className="contact-page__surface"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
              transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              viewport={{ amount: 0.2, once: true }}
              whileInView={
                prefersReducedMotion ? undefined : { opacity: 1, y: 0 }
              }
            >
              <p className="contact-page__section-label">Direct channels</p>
              <div className="contact-page__contact-list">
                {contactItems.map((item) => {
                  const Icon = item.icon;
                  const content = (
                    <>
                      <span
                        className="contact-page__contact-icon-wrap"
                        aria-hidden="true"
                      >
                        <Icon className="contact-page__contact-icon" />
                      </span>
                      <div className="contact-page__contact-copy">
                        <p className="contact-page__contact-label">
                          {item.label}
                        </p>
                        <p className="contact-page__contact-value">
                          {item.value}
                        </p>
                        <p className="contact-page__contact-note">
                          {item.note}
                        </p>
                      </div>
                    </>
                  );

                  if (item.href) {
                    return (
                      <a
                        key={item.label}
                        className="contact-page__contact-item"
                        href={item.href}
                      >
                        {content}
                      </a>
                    );
                  }

                  return (
                    <div
                      key={item.label}
                      className="contact-page__contact-item"
                    >
                      {content}
                    </div>
                  );
                })}
              </div>
            </motion.section>

            <motion.section
              className="contact-page__surface"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
              transition={{
                duration: 0.42,
                delay: prefersReducedMotion ? 0 : 0.06,
                ease: [0.22, 1, 0.36, 1],
              }}
              viewport={{ amount: 0.2, once: true }}
              whileInView={
                prefersReducedMotion ? undefined : { opacity: 1, y: 0 }
              }
            >
              <p className="contact-page__section-label">How the desk works</p>
              <div className="contact-page__steps">
                <div className="contact-page__step">
                  <span className="contact-page__step-index">01</span>
                  <div>
                    <h2 className="contact-page__step-title">Choose a topic</h2>
                    <p className="contact-page__step-copy">
                      Pick the lane that best matches your question.
                    </p>
                  </div>
                </div>
                <div className="contact-page__step">
                  <span className="contact-page__step-index">02</span>
                  <div>
                    <h2 className="contact-page__step-title">
                      Add the watch or order
                    </h2>
                    <p className="contact-page__step-copy">
                      Include the watch name, SKU, or order number.
                    </p>
                  </div>
                </div>
                <div className="contact-page__step">
                  <span className="contact-page__step-index">03</span>
                  <div>
                    <h2 className="contact-page__step-title">Send the email</h2>
                    <p className="contact-page__step-copy">
                      We open a prefilled draft with the key details.
                    </p>
                  </div>
                </div>
              </div>
            </motion.section>
          </div>

          <motion.section
            className="contact-page__form-shell"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 22 }}
            transition={{
              duration: 0.45,
              delay: prefersReducedMotion ? 0 : 0.08,
              ease: [0.22, 1, 0.36, 1],
            }}
            viewport={{ amount: 0.15, once: true }}
            whileInView={
              prefersReducedMotion ? undefined : { opacity: 1, y: 0 }
            }
          >
            <div className="contact-page__form-head">
              <p className="contact-page__section-label">Contact form</p>
              <h2 className="contact-page__form-title">Send a message.</h2>
              <p className="contact-page__form-copy">
                Add the key details and open a prefilled email draft.
              </p>
            </div>

            <form
              className="contact-page__form"
              noValidate
              onSubmit={handleSubmit}
            >
              <div className="contact-page__form-grid">
                <label className="contact-page__field">
                  <span className="contact-page__field-label">Name</span>
                  <input
                    aria-invalid={Boolean(errors.name)}
                    className={`contact-page__input${errors.name ? " contact-page__input--error" : ""}`}
                    name="name"
                    onChange={(event) =>
                      updateField("name", event.target.value)
                    }
                    placeholder="Your name"
                    type="text"
                    value={form.name}
                  />
                  <span className="contact-page__field-help">
                    {errors.name ?? "Reply name."}
                  </span>
                </label>

                <label className="contact-page__field">
                  <span className="contact-page__field-label">Email</span>
                  <input
                    aria-invalid={Boolean(errors.email)}
                    className={`contact-page__input${errors.email ? " contact-page__input--error" : ""}`}
                    name="email"
                    onChange={(event) =>
                      updateField("email", event.target.value)
                    }
                    placeholder="you@example.com"
                    type="email"
                    value={form.email}
                  />
                  <span className="contact-page__field-help">
                    {errors.email ?? "Reply email."}
                  </span>
                </label>

                <label className="contact-page__field">
                  <span className="contact-page__field-label">
                    Inquiry topic
                  </span>
                  <select
                    aria-invalid={Boolean(errors.topic)}
                    className={`contact-page__input contact-page__select${errors.topic ? " contact-page__input--error" : ""}`}
                    name="topic"
                    onChange={(event) =>
                      updateField("topic", event.target.value)
                    }
                    value={form.topic}
                  >
                    <option value="">Select a lane</option>
                    {inquiryTopics.map((topic) => (
                      <option key={topic} value={topic}>
                        {topic}
                      </option>
                    ))}
                  </select>
                  <span className="contact-page__field-help">
                    {errors.topic ?? "Routes the message."}
                  </span>
                </label>

                <label className="contact-page__field">
                  <span className="contact-page__field-label">
                    Watch or order reference
                  </span>
                  <input
                    className="contact-page__input"
                    name="reference"
                    onChange={(event) =>
                      updateField("reference", event.target.value)
                    }
                    placeholder="Watch name, SKU, or order number"
                    type="text"
                    value={form.reference}
                  />
                  <span className="contact-page__field-help">
                    Optional reference.
                  </span>
                </label>
              </div>

              <label className="contact-page__field contact-page__field--full">
                <span className="contact-page__field-label">Message</span>
                <textarea
                  aria-invalid={Boolean(errors.message)}
                  className={`contact-page__input contact-page__textarea${errors.message ? " contact-page__input--error" : ""}`}
                  name="message"
                  onChange={(event) =>
                    updateField("message", event.target.value)
                  }
                  placeholder="Tell us what you need help with."
                  rows={7}
                  value={form.message}
                />
                <span className="contact-page__field-help">
                  {errors.message ?? "Short context is enough."}
                </span>
              </label>

              <div className="contact-page__form-actions">
                <button
                  className="company-page__button company-page__button--primary"
                  type="submit"
                >
                  <Send className="company-page__button-icon" />
                  Open email draft
                </button>
                <a
                  className="company-page__button company-page__button--secondary"
                  href={`mailto:${COMPANY_SOVEREIGN_EMAIL}`}
                >
                  Email directly
                  <ArrowRight className="company-page__button-icon" />
                </a>
              </div>

              <p className="contact-page__form-note">
                No mail app? Email{" "}
                <a href={`mailto:${COMPANY_SOVEREIGN_EMAIL}`}>
                  {COMPANY_SOVEREIGN_EMAIL}
                </a>
                .
              </p>
            </form>
          </motion.section>
        </div>
      </div>
    </div>
  );
}
