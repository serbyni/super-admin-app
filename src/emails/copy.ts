/** Email texts per locale. Only English for now; FR/AR are added here later (fallback: en). */

export type EmailLocale = "en" | "fr" | "ar";

type Step = { title: string; body: string };

type Copy = {
  brandTagline: string;
  headerBadge: string;
  footerTagline: string;
  footerWhy: string;
  footerLinks: { privacy: string; terms: string; contact: string };
  signOff: string;
  team: string;
  received: {
    subject: string;
    preview: string;
    heroLabel: string;
    heroTitle: string;
    title: string;
    intro: (b: string) => string;
    summaryTitle: string;
    summaryStatus: string;
    fields: { business: string; owner: string; address: string; submitted: string };
    stepsTitle: string;
    stepsIntro: string;
    steps: [Step & { status: string }, Step & { status: string }, Step & { status: string }];
    infoTitle: string;
    infoBody: string;
    cta: string;
    secondaryCta: string;
    help: string;
  };
  approved: {
    subject: string;
    preview: string;
    heroLabel: string;
    heroTitle: string;
    title: (name: string) => string;
    intro: (b: string) => string;
    cta: string;
    stepsTitle: string;
    steps: Step[];
    recordTitle: string;
    fields: { email: string; business: string; address: string; approved: string };
    supportTitle: string;
    supportBody: string;
    supportCta: string;
  };
  ready: {
    subject: string;
    preview: string;
    heroLabel: string;
    heroTitle: string;
    title: (name: string) => string;
    intro: (cafe: string, host: string) => string;
    cta: string;
    recordTitle: string;
    fields: { cafe: string; address: string; email: string; created: string };
    stepsTitle: string;
    steps: Step[];
    qrTitle: string;
    qrBody: string;
    supportTitle: string;
    supportBody: string;
    supportCta: string;
  };
  declined: {
    subject: string;
    preview: string;
    heroLabel: string;
    title: (name: string) => string;
    intro: (b: string) => string;
    reviewed: string;
    reasonCategory: string;
    reasonTitle: string;
    reasonLabel: string;
    nextTitle: string;
    nextBody: string;
    cta: string;
    secondaryCta: string;
    helpTitle: string;
    helpBody: string;
  };
};

const en: Copy = {
  brandTagline: "QR menus & ordering for cafés",
  headerBadge: "Café onboarding",
  footerTagline: "Serbi · QR menus and ordering for cafés",
  footerWhy:
    "You receive this email because a café account was registered on Serbi with this address.",
  footerLinks: { privacy: "Privacy", terms: "Terms", contact: "Contact" },
  signOff: "Warm regards,",
  team: "The Serbi team",
  received: {
    subject: "We received your Serbi application",
    preview: "Thanks for applying — our team is reviewing your café.",
    heroLabel: "Application received",
    heroTitle: "Your café is under review",
    title: "Application received",
    intro: (b) =>
      `Thank you for registering ${b} on Serbi. Your application is logged and is now being reviewed by our team.`,
    summaryTitle: "Your application",
    summaryStatus: "Under review",
    fields: {
      business: "Business name",
      owner: "Account owner",
      address: "Address",
      submitted: "Submitted",
    },
    stepsTitle: "What happens next",
    stepsIntro: "Three steps from application to your live QR menu:",
    steps: [
      {
        title: "Application received",
        body: "Your business details and location are saved.",
        status: "Done",
      },
      {
        title: "Review by the Serbi team",
        body: "We check your business details — usually within 24 hours.",
        status: "In progress",
      },
      {
        title: "Approval & café setup",
        body: "Once approved, you sign in, choose your café address and build your QR menu.",
        status: "Next",
      },
    ],
    infoTitle: "No action is needed from you right now.",
    infoBody:
      "As soon as an administrator reviews your application, we'll email you the decision. Keep an eye on this inbox.",
    cta: "Check application status",
    secondaryCta: "Contact us",
    help: "Questions about your application? Simply reply to this email.",
  },
  approved: {
    subject: "You're approved — welcome to Serbi",
    preview: "Your café account is approved. Sign in to set up your café.",
    heroLabel: "Welcome to Serbi",
    heroTitle: "Your café is approved",
    title: (n) => `Congratulations ${n}!`,
    intro: (b) =>
      `Great news: our team reviewed and approved ${b}. Your Serbi account is ready — sign in to set up your café.`,
    cta: "Sign in to Serbi",
    stepsTitle: "Next steps: launch checklist",
    steps: [
      {
        title: "Choose your café address",
        body: "Pick the web address your customers will use for your menu.",
      },
      {
        title: "Build your QR menu",
        body: "Add categories, drinks and food, prices, photos and options.",
      },
      {
        title: "Set up tables & print QR codes",
        body: "Create your tables or zones and print a QR code for each one.",
      },
      {
        title: "Invite your staff",
        body: "Give your team access to receive and manage orders.",
      },
    ],
    recordTitle: "Your account",
    fields: {
      email: "Sign-in email",
      business: "Business",
      address: "Address",
      approved: "Approved on",
    },
    supportTitle: "Need help getting started?",
    supportBody: "Reply to this email and our team will help you set up your menu and QR codes.",
    supportCta: "Contact us",
  },
  ready: {
    subject: "Your café is ready on Serbi",
    preview: "Your café is set up. Open your dashboard to add your menu.",
    heroLabel: "Café created",
    heroTitle: "Your café is ready",
    title: (n) => `Well done ${n}!`,
    intro: (cafe, host) =>
      `${cafe} is set up on Serbi. Your customers will open your menu at ${host}. Next, add your menu and print a QR code for each table.`,
    cta: "Open my dashboard",
    recordTitle: "Your café",
    fields: {
      cafe: "Café",
      address: "Café address",
      email: "Sign-in email",
      created: "Created on",
    },
    stepsTitle: "Next steps",
    steps: [
      {
        title: "Add your menu",
        body: "Categories, drinks and food, prices, photos and options.",
      },
      {
        title: "Create tables & print QR codes",
        body: "One QR code per table or zone — customers scan it to see your menu and order.",
      },
      {
        title: "Invite your staff",
        body: "Give your team access to receive and manage orders.",
      },
    ],
    qrTitle: "Your QR codes never change",
    qrBody: "Printed QR codes keep working, even if you change your café address later.",
    supportTitle: "Need help setting up?",
    supportBody: "Reply to this email and our team will help you build your menu and QR codes.",
    supportCta: "Contact us",
  },
  declined: {
    subject: "Update on your Serbi application",
    preview: "We couldn't approve your application this time.",
    heroLabel: "Application update",
    title: (n) => `Dear ${n},`,
    intro: (b) =>
      `Thank you for your interest in Serbi with ${b}. After a careful review, we are unable to approve your registration at this time.`,
    reviewed: "Reviewed",
    reasonCategory: "Decision",
    reasonTitle: "Application not approved",
    reasonLabel: "Note from our review team",
    nextTitle: "How to resolve & next steps",
    nextBody:
      "Most issues can be resolved quickly. If you have more details or think this was a mistake, reply to this email or contact us — we'll review your application again.",
    cta: "Contact us",
    secondaryCta: "Visit Serbi",
    helpTitle: "Questions about this decision?",
    helpBody: "Reply directly to this email and a member of our team will get back to you.",
  },
};

const COPY: Partial<Record<EmailLocale, Copy>> = { en };

export function emailCopy(locale: string | null | undefined): Copy {
  return COPY[(locale ?? "en") as EmailLocale] ?? en;
}
