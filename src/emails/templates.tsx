import { render } from "@react-email/render";
import { emailCopy } from "./copy";
import { EmailLayout, H1, P, Quote } from "./layout";

/** Email templates = the event types that send email (see platform.event_type). */
export const EMAIL_TEMPLATES = [
  "register_new_user",
  "admin_approve_user",
  "admin_declined_user",
] as const;
export type EmailTemplate = (typeof EMAIL_TEMPLATES)[number];

export function isEmailTemplate(v: string): v is EmailTemplate {
  return (EMAIL_TEMPLATES as readonly string[]).includes(v);
}

export type EmailData = {
  recipientName?: string | null;
  businessName?: string | null;
  locale?: string | null;
  /** Decline reason (admin_declined_user). */
  reason?: string | null;
  /** Absolute links built by the caller (keeps templates free of env access). */
  links: { status: string; signIn: string; contact: string };
};

function Email({ template, data }: { template: EmailTemplate; data: EmailData }) {
  const c = emailCopy(data.locale);
  const business = data.businessName?.trim() || "your café";
  const common = { footer: c.footer, footerWhy: c.footerWhy };
  switch (template) {
    case "register_new_user":
      return (
        <EmailLayout
          {...common}
          preview={c.received.preview}
          title={c.received.title}
          cta={{ label: c.received.cta, href: data.links.status }}
        >
          <H1>{c.greeting(data.recipientName)}</H1>
          <P>{c.received.body(business)}</P>
          <P muted>{c.received.next}</P>
        </EmailLayout>
      );
    case "admin_approve_user":
      return (
        <EmailLayout
          {...common}
          tone="success"
          preview={c.approved.preview}
          title={c.approved.title}
          cta={{ label: c.approved.cta, href: data.links.signIn }}
        >
          <H1>{c.greeting(data.recipientName)}</H1>
          <P>{c.approved.body(business)}</P>
          <P muted>{c.approved.next}</P>
        </EmailLayout>
      );
    case "admin_declined_user":
      return (
        <EmailLayout
          {...common}
          tone="error"
          preview={c.declined.preview}
          title={c.declined.title}
          cta={{ label: c.declined.cta, href: data.links.contact }}
        >
          <H1>{c.greeting(data.recipientName)}</H1>
          <P>{c.declined.body(business)}</P>
          {data.reason ? <Quote label={c.declined.reasonLabel}>{data.reason}</Quote> : null}
          <P muted>{c.declined.next}</P>
        </EmailLayout>
      );
  }
}

const SUBJECTS: Record<EmailTemplate, (c: ReturnType<typeof emailCopy>) => string> = {
  register_new_user: (c) => c.received.subject,
  admin_approve_user: (c) => c.approved.subject,
  admin_declined_user: (c) => c.declined.subject,
};

/** Render subject + HTML + plain-text versions of one email. */
export async function renderEmail(template: EmailTemplate, data: EmailData) {
  const element = <Email template={template} data={data} />;
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { subject: SUBJECTS[template](emailCopy(data.locale)), html, text };
}
