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
      "A focused watch store built around stronger references and a calmer reserve process.",
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
        "Modern references, clearer context, and a private-desk style of service.",
    },
    signals: [
      {
        label: "Collection",
        value: "Edited, not endless",
        note: "A tighter catalogue shaped by finish and relevance.",
      },
      {
        label: "Reserve",
        value: "Human follow-up",
        note: "Each order starts with a real review.",
      },
    ],
    sections: [
      {
        id: "about-curation",
        label: "Curation",
        title: "A focused edit of sport, dress, and modern statement pieces.",
        copy:
          "We present fewer watches with clearer context, so each listing has a reason to be there.",
        bullets: [
          "Chosen for finish and wrist presence",
          "Product pages prepared for confident reserve",
        ],
      },
      {
        id: "about-reserve",
        label: "Reserve desk",
        title: "Reserve first, then confirm with a person.",
        copy:
          "The flow keeps checkout calm: request, review, confirmation, then fulfillment.",
        bullets: [
          "Review before payment and fulfillment",
          "Order status kept easy to read",
        ],
      },
      {
        id: "about-aftercare",
        label: "Aftercare",
        title: "Support continues after delivery starts.",
        copy:
          "Shipping checks and post-order questions stay with the same desk.",
        bullets: [
          "Delivery updates tied to the order",
          "One channel for support and follow-up",
        ],
      },
    ],
    closing: {
      eyebrow: "Next move",
      title: "Need a hand before you reserve?",
      copy:
        "Ask for reference guidance, shipping details, or a personal handoff before you commit.",
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
      "Get clear help before reserve, during fulfillment, or after purchase.",
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
        "Support is grouped around choice, order progress, and after-purchase care.",
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
        title: "Narrow the right reference before you reserve.",
        copy:
          "Share the style or fit you want, and the desk can narrow the shortlist.",
        bullets: [
          "Direction by style and wrist presence",
          "Sizing, finish, and availability context",
        ],
      },
      {
        id: "services-reserve",
        label: "Reserve follow-up",
        title: "After reserve, the next steps stay simple.",
        copy:
          "Confirmation, payment preference, and delivery details stay in one flow.",
        bullets: [
          "Reserve confirmation and follow-up",
          "Delivery detail checks before dispatch",
        ],
      },
      {
        id: "services-aftercare",
        label: "After-purchase",
        title: "Support stays available after dispatch.",
        copy:
          "Timing, care, and documentation questions still route through the desk.",
        bullets: [
          "Order progress through the member desk",
          "One channel for ongoing order context",
        ],
      },
    ],
    closing: {
      eyebrow: "Contact",
      title: "Need help with a watch or an active order?",
      copy:
        "Include the watch name or order number so the desk can route it faster.",
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
      "How shipping, delivery checks, and return review work after reserve.",
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
        "Tracked movement, address confirmation, and support when a case needs review.",
    },
    signals: [
      {
        label: "Dispatch",
        value: "Tracked handoff",
        note: "Courier movement stays tied to order status.",
      },
      {
        label: "Review",
        value: "Issue handling with context",
        note: "Concerns are checked against the delivery record.",
      },
    ],
    sections: [
      {
        id: "shipping-process",
        label: "Timeline",
        title: "Reserve confirmation moves into dispatch after details are locked.",
        copy:
          "Orders move after availability, payment, and address details are reviewed.",
        bullets: [
          "Tracked delivery for shipped orders",
          "Address verification before courier release",
        ],
      },
      {
        id: "shipping-windows",
        label: "Delivery windows",
        title: "Delivery timing depends on reference and destination.",
        copy:
          "Timing can shift by reference, reserve time, and courier lane.",
        bullets: [
          "Reference availability affects dispatch timing",
          "Destination and courier lane affect transit time",
        ],
      },
      {
        id: "shipping-review",
        label: "Review & returns",
        title: "Concerns are reviewed with the order record.",
        copy:
          "For timing, condition, or delivery issues, contact the desk with order context.",
        bullets: [
          "Include the order number when possible",
          "Return review follows the delivery record",
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
      "We use account and order details only to run the store and support purchases.",
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
        "Usually account details, shipping information, order history, and support context.",
    },
    signals: [
      {
        label: "Main use",
        value: "Orders and support",
        note: "Used for reserves, delivery, and service.",
      },
      {
        label: "Questions",
        value: "Contact desk available",
        note: "Ask the desk about account or order data.",
      },
    ],
    sections: [
      {
        id: "privacy-use",
        label: "Usage & Purpose",
        title: "Why we use your information",
        copy:
          "Account, contact, and order details support reserves, delivery, and service.",
        bullets: [
          "Reserve and order handling",
          "Shipping coordination and delivery follow-up",
        ],
      },
      {
        id: "privacy-retention",
        label: "Retention",
        title: "What may be kept on record",
        copy:
          "We may keep the records needed for fulfillment, support, and operations.",
        bullets: [
          "Contact and account details",
          "Order, shipping, and payment status",
        ],
      },
      {
        id: "privacy-support",
        label: "Support & Questions",
        title: "How to ask a privacy question",
        copy:
          "The contact desk can route privacy questions with the right account or order context.",
        bullets: [
          "Use the contact page for privacy questions",
          "Include the order number if the request is purchase-specific",
        ],
      },
    ],
    closing: {
      eyebrow: "Questions",
      title: "Need a human explanation instead of policy language?",
      copy:
        "The desk can explain a clause against a specific account or order.",
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
      "How reserves, availability, payment, fulfillment, and communication work.",
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
        "Availability shifts, reserves are reviewed, and delivery details must be accurate.",
    },
    signals: [
      {
        label: "Reserve terms",
        value: "Intent before confirmation",
        note: "Reserve requests depend on availability and review.",
      },
      {
        label: "Client duty",
        value: "Accurate details",
        note: "Order handling depends on clear details.",
      },
    ],
    sections: [
      {
        id: "terms-reserve",
        label: "Reserve",
        title: "A reserve shows intent; confirmation still requires review.",
        copy:
          "A reserve does not bypass stock, availability, or store confirmation.",
        bullets: [
          "Reserve requests are reviewed before fulfillment",
          "Availability can affect whether a request proceeds",
        ],
      },
      {
        id: "terms-listings",
        label: "Listings",
        title: "Listings, prices, and stock can change.",
        copy:
          "The catalogue is live, so references may be refreshed or removed.",
        bullets: [
          "Pricing and stock visibility may change",
          "Displayed availability is still subject to review",
        ],
      },
      {
        id: "terms-communication",
        label: "Correct Information",
        title: "Clients should provide accurate details.",
        copy:
          "Reserve and delivery handling depends on clear contact and shipping information.",
        bullets: [
          "Use accurate contact and delivery details",
          "Respond if the desk asks for confirmation",
        ],
      },
    ],
    closing: {
      eyebrow: "Clarification",
      title: "Need a term explained against an active order?",
      copy:
        "Include the watch or order number so the desk can answer with context.",
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
