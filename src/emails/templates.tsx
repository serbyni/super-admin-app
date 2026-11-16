import { render } from "@react-email/render";
import { emailCopy } from "./copy";
import {
  B,
  Card,
  EmailLayout,
  Fields,
  H2,
  MetaBar,
  Note,
  P,
  PrimaryButton,
  Quote,
  SecondaryButton,
  SignOff,
  Step,
  Title,
} from "./layout";
import { emailTheme as t } from "./theme";

/**
 * Email templates = the events that send email (platform.event_type). The same names are used
 * for the Resend templates (alias), Resend events and Resend automations.
 */
export const EMAIL_TEMPLATES = [
  "register_new_user",
  "admin_approve_user",
  "admin_declined_user",
] as const;
export type EmailTemplate = (typeof EMAIL_TEMPLATES)[number];

export function isEmailTemplate(v: string): v is EmailTemplate {
  return (EMAIL_TEMPLATES as readonly string[]).includes(v);
}

/** Template variables (Resend: {{{KEY}}}). All strings; links are built from SITE_URL. */
export const EMAIL_VARIABLES = {
  SITE_URL: "https://serbi.me",
  OWNER_NAME: "there",
  OWNER_EMAIL: "",
  BUSINESS_NAME: "your café",
  BUSINESS_ADDRESS: "—",
  SUBMITTED_AT: "—",
  DECIDED_AT: "—",
  REASON: "Our team could not verify your application details.",
} as const;
export type EmailVariable = keyof typeof EMAIL_VARIABLES;
export type EmailVars = Record<EmailVariable, string>;

/** Variables each template uses (sent as Resend event payload / template variables). */
export const TEMPLATE_VARIABLES: Record<EmailTemplate, EmailVariable[]> = {
  register_new_user: [
    "SITE_URL",
    "OWNER_NAME",
    "BUSINESS_NAME",
    "BUSINESS_ADDRESS",
    "SUBMITTED_AT",
  ],
  admin_approve_user: [
    "SITE_URL",
    "OWNER_NAME",
    "OWNER_EMAIL",
    "BUSINESS_NAME",
    "BUSINESS_ADDRESS",
    "DECIDED_AT",
  ],
  admin_declined_user: ["SITE_URL", "OWNER_NAME", "BUSINESS_NAME", "DECIDED_AT", "REASON"],
};

function footer(v: EmailVars, locale?: string | null) {
  const c = emailCopy(locale);
  return {
    tagline: c.footerTagline,
    why: c.footerWhy,
    links: [
      { label: c.footerLinks.privacy, href: `${v.SITE_URL}/privacy` },
      { label: c.footerLinks.terms, href: `${v.SITE_URL}/terms` },
      { label: c.footerLinks.contact, href: `${v.SITE_URL}/contact` },
    ],
  };
}

function RegisterNewUser({ v, locale }: { v: EmailVars; locale?: string | null }) {
  const c = emailCopy(locale);
  const r = c.received;
  return (
    <EmailLayout
      preview={r.preview}
      badge={c.headerBadge}
      tagline={c.brandTagline}
      hero={{ tone: "brand", label: r.heroLabel, title: r.heroTitle, subtitle: v.BUSINESS_NAME }}
      footer={footer(v, locale)}
    >
      <Title>{r.title}</Title>
      <P strong>{`Hello ${v.OWNER_NAME},`}</P>
      <P muted>{r.intro(v.BUSINESS_NAME)}</P>
      <Card
        title={r.summaryTitle}
        status={{
          label: r.summaryStatus,
          bg: t.color.secondaryContainer,
          fg: t.color.onSecondaryContainer,
        }}
      >
        <Fields
          items={[
            { label: r.fields.business, value: v.BUSINESS_NAME },
            { label: r.fields.owner, value: v.OWNER_NAME },
            { label: r.fields.address, value: v.BUSINESS_ADDRESS },
            { label: r.fields.submitted, value: v.SUBMITTED_AT },
          ]}
        />
      </Card>
      <H2>{r.stepsTitle}</H2>
      <P small muted>
        {r.stepsIntro}
      </P>
      <Step
        marker="✓"
        state="done"
        title={r.steps[0].title}
        body={r.steps[0].body}
        status={r.steps[0].status}
      />
      <Step
        marker="2"
        state="active"
        title={r.steps[1].title}
        body={r.steps[1].body}
        status={r.steps[1].status}
      />
      <Step
        marker="3"
        state="todo"
        title={r.steps[2].title}
        body={r.steps[2].body}
        status={r.steps[2].status}
      />
      <div style={{ height: "12px" }} />
      <Note icon="🔔" title={r.infoTitle}>
        {r.infoBody}
      </Note>
      <PrimaryButton href={`${v.SITE_URL}/pending`}>{r.cta}</PrimaryButton>
      <SecondaryButton href={`${v.SITE_URL}/contact`}>{r.secondaryCta}</SecondaryButton>
      <P small muted>
        <br />
        {r.help}
      </P>
      <SignOff line={c.signOff} team={c.team} />
    </EmailLayout>
  );
}

function AdminApproveUser({ v, locale }: { v: EmailVars; locale?: string | null }) {
  const c = emailCopy(locale);
  const a = c.approved;
  return (
    <EmailLayout
      preview={a.preview}
      badge={c.headerBadge}
      tagline={c.brandTagline}
      hero={{
        tone: "success",
        label: `✓ ${a.heroLabel}`,
        title: a.heroTitle,
        subtitle: v.BUSINESS_NAME,
      }}
      footer={footer(v, locale)}
    >
      <Title>{a.title(v.OWNER_NAME)}</Title>
      <P muted>{a.intro(v.BUSINESS_NAME)}</P>
      <PrimaryButton href={`${v.SITE_URL}/login`}>{a.cta} →</PrimaryButton>
      <div style={{ height: "20px" }} />
      <H2>{a.stepsTitle}</H2>
      <div style={{ height: "6px" }} />
      {a.steps.map((s, i) => (
        <Step key={s.title} marker={String(i + 1)} state="number" title={s.title} body={s.body} />
      ))}
      <div style={{ height: "12px" }} />
      <Card title={a.recordTitle} tint="mid">
        <Fields
          items={[
            { label: a.fields.email, value: v.OWNER_EMAIL },
            { label: a.fields.business, value: v.BUSINESS_NAME },
            { label: a.fields.address, value: v.BUSINESS_ADDRESS },
            { label: a.fields.approved, value: v.DECIDED_AT },
          ]}
        />
      </Card>
      <Note icon="🤝" title={a.supportTitle}>
        {a.supportBody}
      </Note>
      <SecondaryButton href={`${v.SITE_URL}/contact`}>{a.supportCta}</SecondaryButton>
      <SignOff line={c.signOff} team={c.team} />
    </EmailLayout>
  );
}

function AdminDeclinedUser({ v, locale }: { v: EmailVars; locale?: string | null }) {
  const c = emailCopy(locale);
  const d = c.declined;
  return (
    <EmailLayout
      preview={d.preview}
      badge={c.headerBadge}
      tagline={c.brandTagline}
      hero={{ tone: "error", label: d.heroLabel, title: v.BUSINESS_NAME }}
      footer={footer(v, locale)}
    >
      <Title>{d.title(v.OWNER_NAME)}</Title>
      <P>{d.intro(v.BUSINESS_NAME)}</P>
      <MetaBar items={[`${d.reviewed}: ${v.DECIDED_AT}`]} />
      <Card title={d.reasonCategory} tint="mid">
        <P strong>
          <B>{d.reasonTitle}</B>
        </P>
        <Quote label={d.reasonLabel}>{v.REASON}</Quote>
      </Card>
      <H2>{d.nextTitle}</H2>
      <P muted>{d.nextBody}</P>
      <PrimaryButton href={`${v.SITE_URL}/contact`}>{d.cta} →</PrimaryButton>
      <SecondaryButton href={v.SITE_URL}>{d.secondaryCta}</SecondaryButton>
      <div style={{ height: "20px" }} />
      <Note icon="💬" title={d.helpTitle}>
        {d.helpBody}
      </Note>
      <SignOff line={c.signOff} team={c.team} />
    </EmailLayout>
  );
}

function Email({
  template,
  v,
  locale,
}: {
  template: EmailTemplate;
  v: EmailVars;
  locale?: string | null;
}) {
  switch (template) {
    case "register_new_user":
      return <RegisterNewUser v={v} locale={locale} />;
    case "admin_approve_user":
      return <AdminApproveUser v={v} locale={locale} />;
    case "admin_declined_user":
      return <AdminDeclinedUser v={v} locale={locale} />;
  }
}

const SUBJECTS: Record<EmailTemplate, (c: ReturnType<typeof emailCopy>) => string> = {
  register_new_user: (c) => c.received.subject,
  admin_approve_user: (c) => c.approved.subject,
  admin_declined_user: (c) => c.declined.subject,
};

export function emailSubject(template: EmailTemplate, locale?: string | null): string {
  return SUBJECTS[template](emailCopy(locale));
}

/**
 * Smaller template HTML for Resend: drops React/hydration comments (keeps Outlook `[if mso]`
 * conditionals) and the invisible preview-text padding. Visual output is unchanged.
 */
export function compactHtml(html: string): string {
  return html
    .replace(/<!--(?!\[if)(?!<!\[endif)[^]*?-->/g, (m) => (m.startsWith("<!--[if") ? m : ""))
    .replace(/<div>[\s\u200b-\u200f\u00a0\ufeff\u034f]*<\/div>/g, "");
}

/** Fill missing/blank values with the defaults. */
export function withDefaults(vars: Partial<EmailVars>): EmailVars {
  const out = { ...EMAIL_VARIABLES } as EmailVars;
  for (const [k, val] of Object.entries(vars) as [EmailVariable, string | undefined][]) {
    if (val && val.trim()) out[k] = val.trim();
  }
  return out;
}

/** Render one email with real values (previews, tests). */
export async function renderEmail(
  template: EmailTemplate,
  vars: Partial<EmailVars>,
  locale?: string | null,
) {
  const element = <Email template={template} v={withDefaults(vars)} locale={locale} />;
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { subject: emailSubject(template, locale), html, text };
}

/**
 * Render one email as a Resend template: every variable becomes {{{KEY}}}, filled by Resend
 * from the automation's event payload. Used by `npm run email:sync`.
 */
export async function renderResendTemplate(template: EmailTemplate, locale?: string | null) {
  const placeholders = Object.fromEntries(
    Object.keys(EMAIL_VARIABLES).map((k) => [k, `{{{${k}}}}`]),
  ) as EmailVars;
  const html = compactHtml(
    await render(<Email template={template} v={placeholders} locale={locale} />),
  );
  return {
    alias: template,
    subject: emailSubject(template, locale),
    html,
    variables: TEMPLATE_VARIABLES[template].map((key) => ({
      key,
      type: "string" as const,
      fallbackValue: EMAIL_VARIABLES[key],
    })),
  };
}
