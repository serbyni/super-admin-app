import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";
import { emailTheme as t } from "./theme";

export type Tone = "info" | "success" | "error";

const toneColors: Record<Tone, { fg: string; bg: string }> = {
  info: { fg: t.color.primary, bg: t.color.background },
  success: { fg: t.color.success, bg: t.color.successContainer },
  error: { fg: t.color.error, bg: t.color.errorContainer },
};

/** Shared frame for all Serbi emails (logo, card, button, footer). */
export function EmailLayout({
  preview,
  title,
  tone = "info",
  children,
  cta,
  footer,
  footerWhy,
  dir = "ltr",
}: {
  preview: string;
  title: string;
  tone?: Tone;
  children: ReactNode;
  cta?: { label: string; href: string };
  footer: string;
  footerWhy: string;
  dir?: "ltr" | "rtl";
}) {
  const c = toneColors[tone];
  return (
    <Html dir={dir}>
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: t.color.background,
          fontFamily: t.font,
          margin: 0,
          padding: "32px 0",
        }}
      >
        <Container style={{ maxWidth: "560px", margin: "0 auto", padding: "0 16px" }}>
          <Text
            style={{
              fontSize: "22px",
              fontWeight: 700,
              color: t.color.primary,
              margin: "0 0 16px",
            }}
          >
            ☕ Serbi
          </Text>
          <Section
            style={{
              backgroundColor: t.color.surface,
              borderRadius: t.radius,
              padding: "32px",
              border: `1px solid ${t.color.outline}`,
            }}
          >
            <Text
              style={{
                display: "inline-block",
                margin: "0 0 12px",
                padding: "4px 12px",
                borderRadius: "999px",
                backgroundColor: c.bg,
                color: c.fg,
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              {title}
            </Text>
            {children}
            {cta ? (
              <Button
                href={cta.href}
                style={{
                  backgroundColor: t.color.primary,
                  color: t.color.onPrimary,
                  borderRadius: "8px",
                  padding: "12px 24px",
                  fontSize: "15px",
                  fontWeight: 700,
                  textDecoration: "none",
                  display: "inline-block",
                  marginTop: "8px",
                }}
              >
                {cta.label}
              </Button>
            ) : null}
          </Section>
          <Hr style={{ borderColor: t.color.outline, margin: "24px 0 12px" }} />
          <Text style={{ fontSize: "12px", color: t.color.textMuted, margin: "0 0 4px" }}>
            {footer}
          </Text>
          <Text style={{ fontSize: "12px", color: t.color.textMuted, margin: 0 }}>{footerWhy}</Text>
        </Container>
      </Body>
    </Html>
  );
}

export function P({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <Text
      style={{
        fontSize: "15px",
        lineHeight: "24px",
        color: muted ? t.color.textMuted : t.color.text,
        margin: "0 0 16px",
      }}
    >
      {children}
    </Text>
  );
}

export function H1({ children }: { children: ReactNode }) {
  return (
    <Heading
      as="h1"
      style={{ fontSize: "24px", lineHeight: "32px", color: t.color.text, margin: "0 0 16px" }}
    >
      {children}
    </Heading>
  );
}

export function Quote({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Section
      style={{
        backgroundColor: t.color.background,
        borderInlineStart: `4px solid ${t.color.primaryContainer}`,
        borderRadius: "8px",
        padding: "12px 16px",
        margin: "0 0 16px",
      }}
    >
      <Text
        style={{
          fontSize: "12px",
          fontWeight: 700,
          color: t.color.textMuted,
          margin: "0 0 4px",
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: "15px",
          lineHeight: "22px",
          color: t.color.text,
          margin: 0,
          whiteSpace: "pre-line",
        }}
      >
        {children}
      </Text>
    </Section>
  );
}
