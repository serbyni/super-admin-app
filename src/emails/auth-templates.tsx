import { render } from "@react-email/render";
import { emailCopy } from "./copy";
import { EmailLayout, Note, P, PrimaryButton, SignOff, Title } from "./layout";
import { compactHtml } from "./templates";

/*
 * Supabase Auth emails (sent by Supabase, not by our dispatcher), styled like our other emails.
 * Rendered with Supabase's Go-template variables and pasted into
 * Supabase → Authentication → Emails → Templates (see README → Emails).
 */

/** Supabase template variables. */
const SUPABASE = {
  siteUrl: "{{ .SiteURL }}",
  /** Our /auth/callback verifies token_hash server-side (works on any device / email client). */
  confirmUrl: "{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email",
  email: "{{ .Email }}",
  /** Sign-up metadata sent by our register form (raw_user_meta_data). */
  fullName: "{{ .Data.full_name }}",
  businessName: "{{ .Data.business_name }}",
} as const;

const COPY = {
  subject: "Confirm your email for Serbi",
  preview: "One click to confirm your email and send your café application for review.",
  heroLabel: "Step 1 of 2",
  heroTitle: "Confirm your email address",
  title: (name: string) => `Almost there, ${name}!`,
  intro: (business: string) =>
    `Thanks for registering ${business} on Serbi. Please confirm that this is your email address — then your application goes to our team for review.`,
  cta: "Confirm my email",
  fallback: "Button not working? Copy this link into your browser:",
  noteTitle: "Didn't sign up for Serbi?",
  noteBody: "You can safely ignore this email — no account is activated without this confirmation.",
};

export function ConfirmSignup({
  siteUrl,
  confirmUrl,
  email,
  fullName,
  businessName,
}: {
  siteUrl: string;
  confirmUrl: string;
  email: string;
  fullName: string;
  businessName: string;
}) {
  const c = emailCopy("en");
  return (
    <EmailLayout
      logoUrl={`${siteUrl}/brand/serbi-email-mark.png`}
      preview={COPY.preview}
      badge={c.headerBadge}
      tagline={c.brandTagline}
      hero={{
        tone: "brand",
        label: COPY.heroLabel,
        title: COPY.heroTitle,
        subtitle: `${businessName} · ${email}`,
      }}
      footer={{
        tagline: c.footerTagline,
        why: c.footerWhy,
        links: [
          { label: c.footerLinks.privacy, href: `${siteUrl}/privacy` },
          { label: c.footerLinks.terms, href: `${siteUrl}/terms` },
          { label: c.footerLinks.contact, href: `${siteUrl}/contact` },
        ],
      }}
    >
      <Title>{COPY.title(fullName)}</Title>
      <P muted>{COPY.intro(businessName)}</P>
      <PrimaryButton href={confirmUrl}>{COPY.cta} →</PrimaryButton>
      <P small muted>
        <br />
        {COPY.fallback}
        <br />
        <a href={confirmUrl} style={{ color: "#553722", wordBreak: "break-all" }}>
          {confirmUrl}
        </a>
      </P>
      <Note icon="🔒" title={COPY.noteTitle}>
        {COPY.noteBody}
      </Note>
      <SignOff line={c.signOff} team={c.team} />
    </EmailLayout>
  );
}

/** "Confirm signup" template for Supabase (HTML with Go-template variables) + its subject. */
export async function renderSupabaseConfirmSignup() {
  const html = compactHtml(await render(<ConfirmSignup {...SUPABASE} />));
  return { subject: COPY.subject, html };
}

/* ── Reset password ───────────────────────────────────────────────────────── */

const RESET = {
  subject: "Reset your Serbi password",
  preview: "Choose a new password for your Serbi account.",
  heroLabel: "Account recovery",
  heroTitle: "Reset your password",
  title: "Choose a new password",
  intro:
    "We received a request to reset the password of your Serbi account. Click the button to choose a new one — the link expires after a short time.",
  cta: "Choose a new password",
  fallback: "Button not working? Copy this link into your browser:",
  noteTitle: "Didn't ask for this?",
  noteBody:
    "You can ignore this email — your password stays the same. If you keep getting these emails, contact us.",
};

export function ResetPassword({
  siteUrl,
  resetUrl,
  email,
}: {
  siteUrl: string;
  resetUrl: string;
  email: string;
}) {
  const c = emailCopy("en");
  return (
    <EmailLayout
      logoUrl={`${siteUrl}/brand/serbi-email-mark.png`}
      preview={RESET.preview}
      badge={RESET.heroLabel}
      tagline={c.brandTagline}
      hero={{ tone: "brand", label: RESET.heroLabel, title: RESET.heroTitle, subtitle: email }}
      footer={{
        tagline: c.footerTagline,
        why: "You receive this email because a password reset was requested for this address on Serbi.",
        links: [
          { label: c.footerLinks.privacy, href: `${siteUrl}/privacy` },
          { label: c.footerLinks.terms, href: `${siteUrl}/terms` },
          { label: c.footerLinks.contact, href: `${siteUrl}/contact` },
        ],
      }}
    >
      <Title>{RESET.title}</Title>
      <P muted>{RESET.intro}</P>
      <PrimaryButton href={resetUrl}>{RESET.cta} →</PrimaryButton>
      <P small muted>
        <br />
        {RESET.fallback}
        <br />
        <a href={resetUrl} style={{ color: "#553722", wordBreak: "break-all" }}>
          {resetUrl}
        </a>
      </P>
      <Note icon="🔒" title={RESET.noteTitle}>
        {RESET.noteBody}
      </Note>
      <SignOff line={c.signOff} team={c.team} />
    </EmailLayout>
  );
}

/** "Reset password" template for Supabase: link → our /auth/reset (token_hash, type=recovery). */
export async function renderSupabaseResetPassword() {
  const html = compactHtml(
    await render(
      <ResetPassword
        siteUrl={SUPABASE.siteUrl}
        resetUrl="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery"
        email={SUPABASE.email}
      />,
    ),
  );
  return { subject: RESET.subject, html };
}
