export type BusinessPageKey =
  | "about"
  | "client-services"
  | "shipping-returns"
  | "privacy"
  | "terms";

export interface CompanyNavItem {
  key: BusinessPageKey | "contact";
  label: string;
  to: string;
}

export interface CompanyAction {
  kind: "anchor" | "route";
  label: string;
  to: string;
  tone: "primary" | "secondary";
}

export interface CompanySignal {
  label: string;
  note: string;
  value: string;
}

export interface CompanySection {
  bullets?: string[];
  copy: string;
  id: string;
  label: string;
  title: string;
}

export interface CompanyClosingCta {
  copy: string;
  eyebrow: string;
  primary: {
    label: string;
    to: string;
  };
  secondary: {
    label: string;
    to: string;
  };
  title: string;
}

export interface BusinessPageContent {
  actions: CompanyAction[];
  closing: CompanyClosingCta;
  eyebrow: string;
  lead: string;
  mode: "document" | "story";
  rail: {
    copy: string;
    label: string;
    title: string;
  };
  signals: CompanySignal[];
  sections: CompanySection[];
  title: string;
}

export const COMPANY_SOVEREIGN_EMAIL = "sovereign@watchroom.example";
export const COMPANY_PHONE = "+84 28 1234 5678";

export const companyNavItems: CompanyNavItem[] = [
  { key: "about", label: "About", to: "/about" },
  { key: "contact", label: "Contact", to: "/contact" },
  { key: "client-services", label: "Services", to: "/client-services" },
  { key: "shipping-returns", label: "Shipping", to: "/shipping-returns" },
  { key: "privacy", label: "Privacy", to: "/privacy" },
  { key: "terms", label: "Terms", to: "/terms" },
];

export const businessPages: Record<BusinessPageKey, BusinessPageContent> = {
  about: {
    mode: "story",
    eyebrow: "About",
    title: "Watchroom for watch lovers",
    lead:
      "A curated watch store built around fewer, stronger references and a reserve process that stays personal from first inquiry to final delivery.",
    actions: [
      {
        kind: "route",
        label: "Contact us",
        to: "/contact",
        tone: "primary",
      },
      {
        kind: "anchor",
        label: "Our approach",
        to: "#about-curation",
        tone: "secondary",
      },
    ],
    rail: {
      label: "Store note",
      title: "Curated in Ho Chi Minh City",
      copy:
        "We focus on modern references, clearer product context, and service that feels more like a private desk than a crowded showroom.",
    },
    signals: [
      {
        label: "Collection",
        value: "Edited, not endless",
        note: "A tighter catalogue built around shape, finish, and relevance.",
      },
      {
        label: "Reserve",
        value: "Human follow-up",
        note: "Every order begins with a real review, not an auto-flow.",
      },
    ],
    sections: [
      {
        id: "about-curation",
        label: "Curation",
        title: "A smaller edit of sport, dress, and modern statement pieces.",
        copy:
          "We would rather present fewer watches well than stack pages with references that all feel the same. Every listing is chosen to stand on its own.",
        bullets: [
          "References chosen for finish, wrist presence, and collector appeal",
          "Clearer product pages before reserve",
          "A catalogue that stays deliberate instead of crowded",
        ],
      },
      {
        id: "about-reserve",
        label: "Reserve desk",
        title: "Reserve first. Confirm with a person.",
        copy:
          "Our checkout flow is built around reserve requests, follow-up, and confirmation. It keeps the pace calm and the communication clear.",
        bullets: [
          "Reserve-led handling instead of rush checkout",
          "Review before payment and fulfillment",
          "Order status that stays easy to read",
        ],
      },
      {
        id: "about-aftercare",
        label: "Aftercare",
        title: "Support continues after the reserve becomes a delivery.",
        copy:
          "Shipping, delivery detail checks, and post-order questions are handled through the same desk, so the experience does not flatten after payment.",
        bullets: [
          "Delivery updates tied to the order record",
          "One channel for support and follow-up",
          "Clear answers instead of generic ticket replies",
        ],
      },
    ],
    closing: {
      eyebrow: "Next move",
      title: "Need a hand before you reserve?",
      copy:
        "Reach out for reference guidance, shipping questions, or a more personal handoff before you commit to a piece.",
      primary: {
        label: "Contact the team",
        to: "/contact",
      },
      secondary: {
        label: "Browse collection",
        to: "/collection",
      },
    },
  },
  "client-services": {
    mode: "story",
    eyebrow: "Services",
    title: "Caring for your watch",
    lead:
      "Whether you need help choosing a watch or checking on an active order, the client desk is built to answer quickly and clearly.",
    actions: [
      {
        kind: "route",
        label: "Contact the desk",
        to: "/contact",
        tone: "primary",
      },
      {
        kind: "anchor",
        label: "Service lanes",
        to: "#services-guidance",
        tone: "secondary",
      },
    ],
    rail: {
      label: "How we help",
      title: "Guidance before and after the order",
      copy:
        "Most requests come down to three things: choosing the right reference, confirming what happens next, and getting support once the order is moving.",
    },
    signals: [
      {
        label: "Before reserve",
        value: "Reference guidance",
        note: "Help with size, finish, and shortlist direction.",
      },
      {
        label: "After purchase",
        value: "Support stays open",
        note: "Progress, care, and delivery questions still route here.",
      },
    ],
    sections: [
      {
        id: "services-guidance",
        label: "Pre-purchase",
        title: "We help narrow the right reference before you reserve.",
        copy:
          "If you are choosing between sizes, dial moods, or finishes, we can help reduce the shortlist before you commit.",
        bullets: [
          "Reference direction by style and wrist presence",
          "Sizing and finish clarification",
          "Availability context when it matters",
        ],
      },
      {
        id: "services-reserve",
        label: "Reserve follow-up",
        title: "Once a reserve is placed, the next steps stay easy to follow.",
        copy:
          "We keep the process clear around confirmation, payment preference, shipping details, and anything else tied to the order.",
        bullets: [
          "Reserve confirmation and follow-up",
          "Payment coordination after review",
          "Delivery detail checks before dispatch",
        ],
      },
      {
        id: "services-aftercare",
        label: "After-purchase",
        title: "Support stays available after the watch is on the way.",
        copy:
          "Questions about timing, progress, care, or documentation can still be routed through the same desk after payment.",
        bullets: [
          "Order progress through the member desk",
          "Support for timing and delivery concerns",
          "One channel for ongoing order context",
        ],
      },
    ],
    closing: {
      eyebrow: "Contact",
      title: "Need help with a watch or an active order?",
      copy:
        "Use the contact page and include the watch name or order number if the request is tied to something specific.",
      primary: {
        label: "Open contact",
        to: "/contact",
      },
      secondary: {
        label: "View shipping",
        to: "/shipping-returns",
      },
    },
  },
  "shipping-returns": {
    mode: "story",
    eyebrow: "Shipping & Returns",
    title: "Delivery & Return process",
    lead:
      "From reserve confirmation to courier handoff, this is how shipping, delivery checks, and return review are handled.",
    actions: [
      {
        kind: "route",
        label: "Shipping support",
        to: "/contact",
        tone: "primary",
      },
      {
        kind: "anchor",
        label: "Shipping flow",
        to: "#shipping-process",
        tone: "secondary",
      },
    ],
    rail: {
      label: "Delivery standard",
      title: "Tracked, verified, and tied to the order record",
      copy:
        "Shipping is handled with tracked movement, address confirmation before release, and support if timing or condition needs review.",
    },
    signals: [
      {
        label: "Dispatch",
        value: "Tracked handoff",
        note: "Courier movement stays tied to your order status.",
      },
      {
        label: "Review",
        value: "Issue handling with context",
        note: "Returns and concerns are reviewed against the delivery record.",
      },
    ],
    sections: [
      {
        id: "shipping-process",
        label: "Timeline",
        title: "Reserve confirmation moves into dispatch once the details are locked.",
        copy:
          "Orders move forward after availability, payment, and address details are reviewed. High-value goods are not released like standard parcels.",
        bullets: [
          "Tracked delivery for shipped orders",
          "Address verification before courier release",
          "Status updates in the member order desk",
        ],
      },
      {
        id: "shipping-windows",
        label: "Delivery windows",
        title: "Delivery timing depends on the watch, the order, and the destination.",
        copy:
          "Timing can shift based on the exact reference, when the reserve is confirmed, and where the order is going. We prefer accurate windows over rushed promises.",
        bullets: [
          "Reference availability affects dispatch timing",
          "Destination and courier lane affect transit time",
          "Support remains available during handoff",
        ],
      },
      {
        id: "shipping-review",
        label: "Review & returns",
        title: "Concerns are reviewed against the order and shipping record.",
        copy:
          "If there is a timing problem, a condition concern, or a delivery issue, contact the desk promptly so the case can be reviewed with the full order context.",
        bullets: [
          "Raise issues promptly through contact",
          "Include the order number when possible",
          "Return review is handled with the delivery record in view",
        ],
      },
    ],
    closing: {
      eyebrow: "Need help",
      title: "Need help with shipping or a return review?",
      copy:
        "Add the watch reference or order number so the desk can review the request faster.",
      primary: {
        label: "Contact support",
        to: "/contact",
      },
      secondary: {
        label: "Browse collection",
        to: "/collection",
      },
    },
  },
  privacy: {
    mode: "document",
    eyebrow: "Privacy",
    title: "Privacy policy & Record",
    lead:
      "We keep privacy language simple. The information we collect is tied to your account, your order, and the support needed to complete a purchase well.",
    actions: [
      {
        kind: "route",
        label: "Contact us",
        to: "/contact",
        tone: "primary",
      },
      {
        kind: "anchor",
        label: "Read policy",
        to: "#privacy-use",
        tone: "secondary",
      },
    ],
    rail: {
      label: "Privacy note",
      title: "Only the details needed to run the store well",
      copy:
        "That usually means account details, shipping information, order history, and the context needed to support you before and after delivery.",
    },
    signals: [
      {
        label: "Main use",
        value: "Orders and support",
        note: "Information is used to process reserves, delivery, and after-sales service.",
      },
      {
        label: "Questions",
        value: "Contact desk available",
        note: "Use the contact page if you want clarification on account or order data.",
      },
    ],
    sections: [
      {
        id: "privacy-use",
        label: "Usage & Purpose",
        title: "Why we use your information",
        copy:
          "Account, contact, and order details are used to process reserves, coordinate delivery, and support active and completed purchases.",
        bullets: [
          "Reserve and order handling",
          "Shipping coordination and delivery follow-up",
          "Client support before and after purchase",
        ],
      },
      {
        id: "privacy-retention",
        label: "Retention",
        title: "What may be kept on record",
        copy:
          "We may retain account details, shipping information, reserve history, and payment status where needed for fulfillment, support, and store operations.",
        bullets: [
          "Contact and account details",
          "Order, shipping, and payment status records",
          "Support history tied to past orders",
        ],
      },
      {
        id: "privacy-support",
        label: "Support & Questions",
        title: "How to ask a privacy question",
        copy:
          "If you want clarification about how information is used or stored, the contact desk can route the request with the right account or order context.",
        bullets: [
          "Use the contact page for privacy questions",
          "Include the order number if the request is purchase-specific",
          "The team will reply through the same concierge channel",
        ],
      },
    ],
    closing: {
      eyebrow: "Questions",
      title: "Need a human explanation instead of policy language?",
      copy:
        "The contact desk is available if a clause needs context against a specific order or account history.",
      primary: {
        label: "Ask a question",
        to: "/contact",
      },
      secondary: {
        label: "Review terms",
        to: "/terms",
      },
    },
  },
  terms: {
    mode: "document",
    eyebrow: "Terms",
    title: "Terms & Conditions",
    lead:
      "These terms explain how reserves, availability, payment, fulfillment timing, and client communication are handled across the store.",
    actions: [
      {
        kind: "route",
        label: "Contact us",
        to: "/contact",
        tone: "primary",
      },
      {
        kind: "anchor",
        label: "Read terms",
        to: "#terms-reserve",
        tone: "secondary",
      },
    ],
    rail: {
      label: "Core note",
      title: "Reserves are reviewed and listings can change",
      copy:
        "Availability shifts, reserve requests are reviewed before fulfillment, and clients are expected to provide accurate delivery details.",
    },
    signals: [
      {
        label: "Reserve terms",
        value: "Intent before confirmation",
        note: "A reserve request still depends on availability and review.",
      },
      {
        label: "Client duty",
        value: "Accurate details",
        note: "Order handling depends on clear contact and delivery details.",
      },
    ],
    sections: [
      {
        id: "terms-reserve",
        label: "Reserve",
        title: "A reserve shows purchase intent, but confirmation still depends on review.",
        copy:
          "Submitting a reserve does not bypass stock, availability, or store confirmation. Orders still depend on the watch being available and the desk completing review.",
        bullets: [
          "Reserve requests are reviewed before fulfillment",
          "Availability can affect whether a request proceeds",
          "Follow-up may be needed before shipping is finalized",
        ],
      },
      {
        id: "terms-listings",
        label: "Listings",
        title: "Product listings, prices, and stock can change as inventory moves.",
        copy:
          "The catalogue is live. References may be refreshed, repriced, or marked differently as inventory changes.",
        bullets: [
          "Pricing and stock visibility may change",
          "Listings can be updated or removed",
          "Displayed availability is still subject to review",
        ],
      },
      {
        id: "terms-communication",
        label: "Correct Information",
        title: "Clients are expected to provide accurate details and respond when needed.",
        copy:
          "Reserve and delivery handling depends on accurate contact information, shipping context, and timely responses when the team needs clarification.",
        bullets: [
          "Use accurate contact and delivery details",
          "Respond if the desk asks for confirmation",
          "Use the contact page when clarification is needed",
        ],
      },
    ],
    closing: {
      eyebrow: "Clarification",
      title: "Need a term explained against an active order?",
      copy:
        "Include the watch or order number so the team can answer with the right order context.",
      primary: {
        label: "Contact us",
        to: "/contact",
      },
      secondary: {
        label: "Browse collection",
        to: "/collection",
      },
    },
  },
};
