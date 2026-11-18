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
} as const;

const COPY = {
  subject: "Confirm your email for Serbi",
  preview: "One click to confirm your email and send your café application for review.",
  heroLabel: "Step 1 of 2",
  heroTitle: "Confirm your email address",
  title: "Almost there!",
  intro:
    "Thanks for registering your café on Serbi. Please confirm that this is your email address — then your application goes to our team for review.",
  cta: "Confirm my email",
  fallback: "Button not working? Copy this link into your browser:",
  noteTitle: "Didn't sign up for Serbi?",
  noteBody: "You can safely ignore this email — no account is activated without this confirmation.",
};

export function ConfirmSignup({
  siteUrl,
  confirmUrl,
  email,
}: {
  siteUrl: string;
  confirmUrl: string;
  email: string;
}) {
  const c = emailCopy("en");
  return (
    <EmailLayout
      logoUrl={`${siteUrl}/brand/serbi-email-mark.png`}
      preview={COPY.preview}
      badge={c.headerBadge}
      tagline={c.brandTagline}
      hero={{ tone: "brand", label: COPY.heroLabel, title: COPY.heroTitle, subtitle: email }}
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
      <Title>{COPY.title}</Title>
      <P muted>{COPY.intro}</P>
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
