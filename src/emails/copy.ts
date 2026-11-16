/** Email texts per locale. Only English for now; FR/AR are added here later (fallback: en). */

export type EmailLocale = "en" | "fr" | "ar";

type Copy = {
  footer: string;
  footerWhy: string;
  received: {
    subject: string;
    preview: string;
    title: string;
    body: (business: string) => string;
    next: string;
    cta: string;
  };
  approved: {
    subject: string;
    preview: string;
    title: string;
    body: (business: string) => string;
    next: string;
    cta: string;
  };
  declined: {
    subject: string;
    preview: string;
    title: string;
    body: (business: string) => string;
    reasonLabel: string;
    next: string;
    cta: string;
  };
  greeting: (name?: string | null) => string;
};

const en: Copy = {
  greeting: (name) => (name ? `Hi ${name.split(" ")[0]},` : "Hi,"),
  footer: "Serbi — QR menus and ordering for cafés.",
  footerWhy: "You receive this email because you applied for a café account on Serbi.",
  received: {
    subject: "We received your Serbi application",
    preview: "Thanks for applying — our team is reviewing your café.",
    title: "Application received",
    body: (b) =>
      `Thanks for registering ${b} on Serbi. Our team is reviewing your application, usually within 24 hours.`,
    next: "We'll email you as soon as a decision is made. You don't need to do anything in the meantime.",
    cta: "Check your status",
  },
  approved: {
    subject: "You're approved — welcome to Serbi",
    preview: "Your café account is approved. Sign in to continue.",
    title: "You're approved!",
    body: (b) => `Good news: ${b} is approved on Serbi.`,
    next: "Sign in to continue setting up your café — choose your subdomain, then build your menu.",
    cta: "Sign in to Serbi",
  },
  declined: {
    subject: "Update on your Serbi application",
    preview: "We couldn't approve your application this time.",
    title: "Not approved",
    body: (b) =>
      `Thank you for your interest in Serbi. After review, we couldn't approve ${b} at this time.`,
    reasonLabel: "Reason from our team",
    next: "If you think this is a mistake or you can provide more details, reply to this email or contact us.",
    cta: "Contact us",
  },
};

const COPY: Partial<Record<EmailLocale, Copy>> = { en };

export function emailCopy(locale: string | null | undefined): Copy {
  return COPY[(locale ?? "en") as EmailLocale] ?? en;
}
