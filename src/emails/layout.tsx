import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import type { CSSProperties, ReactNode } from "react";
import { emailTheme as t } from "./theme";

/*
 * Building blocks of the Serbi emails, after the Stitch "Email Template" screens:
 * gradient strip → logo header + badge → hero band → body cards → CTA → footer.
 * React Email renders them as tables with inline styles (email-client safe).
 */

const font: CSSProperties = { fontFamily: t.font };

export type Tone = "brand" | "success" | "error";

const heroColors: Record<Tone, { bg: string; gradient: string; pillBg: string; pillFg: string }> = {
  brand: {
    bg: t.color.primaryContainer,
    gradient: `linear-gradient(135deg, ${t.color.primary} 0%, ${t.color.primaryContainer} 100%)`,
    pillBg: t.color.surface,
    pillFg: t.color.primary,
  },
  success: {
    bg: t.color.tertiary,
    gradient: `linear-gradient(135deg, ${t.color.tertiary} 0%, ${t.color.primaryContainer} 100%)`,
    pillBg: t.color.tertiaryFixed,
    pillFg: t.color.tertiary,
  },
  error: {
    bg: t.color.primary,
    gradient: `linear-gradient(90deg, ${t.color.primary} 0%, ${t.color.primaryContainer} 100%)`,
    pillBg: t.color.secondaryContainer,
    pillFg: t.color.primary,
  },
};

export function EmailLayout({
  logoUrl,
  preview,
  badge,
  tagline,
  hero,
  children,
  footer,
}: {
  /** Absolute URL of the app mark (served from the app: /brand/serbi-email-mark.png). */
  logoUrl: string;
  preview: string;
  badge: string;
  tagline: string;
  hero: { tone: Tone; label: string; title: string; subtitle?: string };
  children: ReactNode;
  footer: { tagline: string; why: string; links: { label: string; href: string }[] };
}) {
  const h = heroColors[hero.tone];
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ ...font, backgroundColor: t.color.page, margin: 0, padding: "32px 0" }}>
        <Container
          style={{
            maxWidth: "600px",
            width: "100%",
            backgroundColor: t.color.surface,
            borderRadius: t.radius.card,
            overflow: "hidden",
            border: `1px solid ${t.color.surfaceHighest}`,
          }}
        >
          {/* Gradient strip */}
          <Section
            style={{
              height: "8px",
              backgroundColor: t.color.primary,
              backgroundImage: `linear-gradient(90deg, ${t.color.primary}, ${t.color.primaryContainer}, ${t.color.secondary})`,
            }}
          >
            <Text style={{ margin: 0, fontSize: "1px", lineHeight: "8px" }}>&nbsp;</Text>
          </Section>

          {/* Logo header */}
          <Section style={{ padding: "24px 24px 16px" }}>
            <Row>
              <Column style={{ width: "56px", verticalAlign: "middle" }}>
                <Img
                  src={logoUrl}
                  width="44"
                  height="44"
                  alt="Serbi"
                  style={{ display: "block", width: "44px", height: "44px", border: 0 }}
                />
              </Column>
              <Column style={{ verticalAlign: "middle" }}>
                <Text
                  style={{
                    margin: 0,
                    fontSize: "18px",
                    lineHeight: "22px",
                    fontWeight: 700,
                    color: t.color.primary,
                  }}
                >
                  Serbi
                </Text>
                <Text
                  style={{
                    margin: 0,
                    fontSize: "11px",
                    lineHeight: "16px",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: t.color.textMuted,
                  }}
                >
                  {tagline}
                </Text>
              </Column>
              <Column align="right" style={{ verticalAlign: "middle" }}>
                <Pill bg={t.color.secondaryContainer} fg={t.color.onSecondaryContainer}>
                  {badge}
                </Pill>
              </Column>
            </Row>
          </Section>

          {/* Hero band */}
          <Section
            style={{
              backgroundColor: h.bg,
              backgroundImage: h.gradient,
              padding: "28px 24px",
            }}
          >
            <Pill bg={h.pillBg} fg={h.pillFg}>
              {hero.label}
            </Pill>
            <Text
              style={{
                margin: "12px 0 0",
                fontSize: "24px",
                lineHeight: "31px",
                fontWeight: 700,
                color: t.color.onPrimary,
              }}
            >
              {hero.title}
            </Text>
            {hero.subtitle ? (
              <Text
                style={{
                  margin: "4px 0 0",
                  fontSize: "15px",
                  lineHeight: "22px",
                  color: t.color.primaryFixed,
                }}
              >
                {hero.subtitle}
              </Text>
            ) : null}
          </Section>

          {/* Body */}
          <Section style={{ padding: "24px" }}>{children}</Section>

          {/* Footer */}
          <Section style={{ backgroundColor: t.color.surfaceContainer, padding: "20px 24px" }}>
            <Text
              style={{
                margin: "0 0 6px",
                fontSize: "12px",
                lineHeight: "18px",
                fontWeight: 700,
                color: t.color.text,
              }}
            >
              {footer.tagline}
            </Text>
            <Text
              style={{
                margin: "0 0 6px",
                fontSize: "12px",
                lineHeight: "18px",
                color: t.color.textMuted,
              }}
            >
              {footer.links.map((l, i) => (
                <span key={l.label}>
                  {i > 0 ? "  •  " : ""}
                  <Link
                    href={l.href}
                    style={{ color: t.color.textMuted, textDecoration: "underline" }}
                  >
                    {l.label}
                  </Link>
                </span>
              ))}
            </Text>
            <Text
              style={{ margin: 0, fontSize: "11px", lineHeight: "17px", color: t.color.textMuted }}
            >
              {footer.why}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function Pill({ bg, fg, children }: { bg: string; fg: string; children: ReactNode }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: t.radius.pill,
        backgroundColor: bg,
        color: fg,
        fontSize: "11px",
        lineHeight: "14px",
        fontWeight: 700,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return (
    <Heading
      as="h1"
      style={{
        margin: "0 0 12px",
        fontSize: "30px",
        lineHeight: "36px",
        fontWeight: 700,
        color: t.color.primary,
      }}
    >
      {children}
    </Heading>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return (
    <Heading
      as="h2"
      style={{
        margin: "0 0 6px",
        fontSize: "20px",
        lineHeight: "26px",
        fontWeight: 700,
        color: t.color.text,
      }}
    >
      {children}
    </Heading>
  );
}

export function P({
  children,
  muted = false,
  strong = false,
  small = false,
}: {
  children: ReactNode;
  muted?: boolean;
  strong?: boolean;
  small?: boolean;
}) {
  return (
    <Text
      style={{
        margin: "0 0 14px",
        fontSize: small ? "13px" : "15px",
        lineHeight: small ? "20px" : "24px",
        fontWeight: strong ? 700 : 400,
        color: muted ? t.color.textMuted : t.color.text,
      }}
    >
      {children}
    </Text>
  );
}

export function B({ children }: { children: ReactNode }) {
  return <strong style={{ color: t.color.text, fontWeight: 700 }}>{children}</strong>;
}

/** Tinted card with an optional header line (title + status pill). */
export function Card({
  title,
  status,
  tint = "low",
  children,
}: {
  title?: string;
  status?: { label: string; bg: string; fg: string };
  tint?: "low" | "mid";
  children: ReactNode;
}) {
  return (
    <Section
      style={{
        backgroundColor: tint === "low" ? t.color.surfaceLow : t.color.surfaceContainer,
        borderRadius: t.radius.card,
        padding: "16px",
        margin: "0 0 20px",
      }}
    >
      {title ? (
        <Row style={{ marginBottom: "10px" }}>
          <Column>
            <Text
              style={{
                margin: 0,
                fontSize: "11px",
                lineHeight: "16px",
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: t.color.textMuted,
              }}
            >
              {title}
            </Text>
          </Column>
          {status ? (
            <Column align="right">
              <Pill bg={status.bg} fg={status.fg}>
                {status.label}
              </Pill>
            </Column>
          ) : null}
        </Row>
      ) : null}
      {children}
    </Section>
  );
}

/** Two-column label/value grid (pairs). */
export function Fields({ items }: { items: { label: string; value: string }[] }) {
  const rows: { label: string; value: string }[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return (
    <>
      {rows.map((pair, r) => (
        <Row key={r} style={{ marginBottom: "8px" }}>
          {pair.map((f) => (
            <Column
              key={f.label}
              style={{ width: "50%", verticalAlign: "top", paddingRight: "8px" }}
            >
              <Text
                style={{
                  margin: 0,
                  fontSize: "12px",
                  lineHeight: "18px",
                  color: t.color.textMuted,
                }}
              >
                {f.label}
              </Text>
              <Text
                style={{
                  margin: 0,
                  fontSize: "14px",
                  lineHeight: "21px",
                  fontWeight: 700,
                  color: t.color.text,
                }}
              >
                {f.value}
              </Text>
            </Column>
          ))}
        </Row>
      ))}
    </>
  );
}

export type StepState = "done" | "active" | "todo" | "number";

/** One row of a step list ("What happens next" / launch checklist). */
export function Step({
  marker,
  state,
  title,
  body,
  status,
}: {
  marker: string;
  state: StepState;
  title: string;
  body: string;
  status?: string;
}) {
  const circle =
    state === "done"
      ? { bg: t.color.primary, fg: t.color.onPrimary }
      : state === "active"
        ? { bg: t.color.primaryContainer, fg: t.color.onPrimary }
        : state === "number"
          ? { bg: t.color.secondaryContainer, fg: t.color.onSecondaryContainer }
          : { bg: t.color.surfaceHighest, fg: t.color.textMuted };
  const rowBg = state === "active" ? t.color.secondaryContainer : t.color.surfaceLow;
  return (
    <Section
      style={{
        backgroundColor: rowBg,
        borderRadius: t.radius.card,
        padding: "12px",
        margin: "0 0 8px",
      }}
    >
      <Row>
        <Column style={{ width: "44px", verticalAlign: "top" }}>
          <Text
            style={{
              margin: 0,
              width: "32px",
              height: "32px",
              lineHeight: "32px",
              textAlign: "center",
              borderRadius: state === "number" ? t.radius.inner : t.radius.pill,
              backgroundColor: circle.bg,
              color: circle.fg,
              fontSize: "15px",
              fontWeight: 700,
            }}
          >
            {marker}
          </Text>
        </Column>
        <Column style={{ verticalAlign: "top" }}>
          <Text
            style={{
              margin: 0,
              fontSize: "15px",
              lineHeight: "22px",
              fontWeight: 700,
              color: t.color.text,
            }}
          >
            {title}
            {status ? (
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: state === "active" ? t.color.primary : t.color.textMuted,
                  paddingLeft: "8px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {status}
              </span>
            ) : null}
          </Text>
          <Text
            style={{
              margin: "2px 0 0",
              fontSize: "13px",
              lineHeight: "20px",
              color: t.color.textMuted,
            }}
          >
            {body}
          </Text>
        </Column>
      </Row>
    </Section>
  );
}

/** Highlighted note with an emoji marker (info / support boxes). */
export function Note({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Section
      style={{
        backgroundColor: t.color.surfaceContainer,
        borderRadius: t.radius.card,
        padding: "16px",
        margin: "0 0 20px",
      }}
    >
      <Row>
        <Column style={{ width: "36px", verticalAlign: "top" }}>
          <Text style={{ margin: 0, fontSize: "20px", lineHeight: "24px" }}>{icon}</Text>
        </Column>
        <Column style={{ verticalAlign: "top" }}>
          <Text
            style={{
              margin: "0 0 4px",
              fontSize: "15px",
              lineHeight: "22px",
              fontWeight: 700,
              color: t.color.text,
            }}
          >
            {title}
          </Text>
          <Text
            style={{ margin: 0, fontSize: "13px", lineHeight: "20px", color: t.color.textMuted }}
          >
            {children}
          </Text>
        </Column>
      </Row>
    </Section>
  );
}

/** Quoted admin note (decline reason). */
export function Quote({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Section
      style={{
        backgroundColor: t.color.surface,
        borderRadius: t.radius.inner,
        borderLeft: `4px solid ${t.color.primaryContainer}`,
        padding: "12px 16px",
        margin: "12px 0 0",
      }}
    >
      <Text
        style={{
          margin: "0 0 4px",
          fontSize: "11px",
          lineHeight: "16px",
          fontWeight: 700,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: t.color.primary,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          margin: 0,
          fontSize: "15px",
          lineHeight: "23px",
          fontStyle: "italic",
          color: t.color.textMuted,
          whiteSpace: "pre-line",
        }}
      >
        “{children}”
      </Text>
    </Section>
  );
}

export function PrimaryButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button
      href={href}
      style={{
        display: "block",
        width: "100%",
        boxSizing: "border-box",
        textAlign: "center",
        backgroundColor: t.color.primary,
        color: t.color.onPrimary,
        borderRadius: t.radius.card,
        padding: "14px 20px",
        fontSize: "16px",
        lineHeight: "22px",
        fontWeight: 700,
        textDecoration: "none",
      }}
    >
      {children}
    </Button>
  );
}

export function SecondaryButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button
      href={href}
      style={{
        display: "block",
        width: "100%",
        boxSizing: "border-box",
        textAlign: "center",
        backgroundColor: t.color.surfaceHigh,
        color: t.color.primary,
        borderRadius: t.radius.card,
        padding: "12px 20px",
        marginTop: "8px",
        fontSize: "14px",
        lineHeight: "20px",
        fontWeight: 700,
        textDecoration: "none",
      }}
    >
      {children}
    </Button>
  );
}

export function SignOff({ line, team }: { line: string; team: string }) {
  return (
    <>
      <Text
        style={{ margin: "20px 0 0", fontSize: "15px", lineHeight: "22px", color: t.color.text }}
      >
        {line}
      </Text>
      <Text
        style={{
          margin: 0,
          fontSize: "17px",
          lineHeight: "24px",
          fontWeight: 700,
          color: t.color.primary,
        }}
      >
        {team}
      </Text>
    </>
  );
}

export function MetaBar({ items }: { items: string[] }) {
  return (
    <Section
      style={{
        backgroundColor: t.color.surfaceLow,
        borderRadius: t.radius.inner,
        padding: "8px 12px",
        margin: "0 0 16px",
      }}
    >
      <Text style={{ margin: 0, fontSize: "12px", lineHeight: "18px", color: t.color.secondary }}>
        {items.join("   •   ")}
      </Text>
    </Section>
  );
}
