import { render } from "@react-email/render";
import { Column, Row, Text } from "@react-email/components";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { formatPrice } from "@/lib/menu/schema";
import { Card, EmailLayout, Fields, P, PrimaryButton, SignOff, Title } from "./layout";
import { emailTheme as t } from "./theme";

/** Receipt e-mailed to a customer when the café accepts the order (customer's language). */

export type ReceiptData = {
  number: number;
  kind: string;
  tableLabel: string | null;
  customerName: string;
  subtotal: number;
  currency: string;
  isPaid: boolean;
  locale: string;
  createdAt: string;
  items: {
    name: string;
    quantity: number;
    lineTotal: number;
    note: string;
    options: { choice: string }[];
  }[];
  cafe: { name: string; timezone: string };
  /** /order/<token> on the café site. */
  orderUrl: string;
  /** Absolute base URL of this app (logo). */
  siteUrl: string;
};

const TEXTS: Record<string, typeof en.receipt> = { en: en.receipt, fr: fr.receipt, ar: ar.receipt };
const fill = (s: string, v: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));
const DATE_LOCALE: Record<string, string> = { en: "en-GB", fr: "fr-FR", ar: "ar-TN" };

function Receipt({ d }: { d: ReceiptData }) {
  const lang = TEXTS[d.locale] ? d.locale : "en";
  const r = TEXTS[lang];
  const v = { cafe: d.cafe.name, number: d.number };
  const date = new Intl.DateTimeFormat(DATE_LOCALE[lang], {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: d.cafe.timezone,
  }).format(new Date(d.createdAt));
  const where =
    d.kind === "table"
      ? fill(r.table, { label: d.tableLabel ?? "" })
      : fill(r.takeaway, { name: d.customerName });
  return (
    <EmailLayout
      lang={lang}
      dir={lang === "ar" ? "rtl" : "ltr"}
      logoUrl={`${d.siteUrl}/brand/serbi-email-mark.png`}
      preview={fill(r.preview, v)}
      badge={r.badge}
      tagline={d.cafe.name}
      hero={{
        tone: "success",
        label: `✓ ${r.heroLabel}`,
        title: fill(r.heroTitle, v),
        subtitle: d.cafe.name,
      }}
      footer={{ tagline: r.tagline, why: fill(r.why, v), links: [] }}
    >
      <Title>{r.title}</Title>
      <P muted>{fill(r.intro, v)}</P>
      <Card title={r.details} tint="mid">
        <Fields
          items={[
            { label: r.date, value: date },
            { label: r.where, value: where },
          ]}
        />
      </Card>
      <Card title={r.items}>
        {d.items.map((li, i) => (
          <Row key={i} style={{ marginBottom: "8px" }}>
            <Column>
              <Text style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: t.color.text }}>
                {li.quantity} × {li.name}
              </Text>
              {li.options.length || li.note ? (
                <Text style={{ margin: 0, fontSize: "12px", color: t.color.textMuted }}>
                  {[li.options.map((o) => o.choice).join(", "), li.note ? `“${li.note}”` : ""]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              ) : null}
            </Column>
            <Column align={lang === "ar" ? "left" : "right"} style={{ width: "120px" }}>
              <Text style={{ margin: 0, fontSize: "14px", color: t.color.text }}>
                {formatPrice(li.lineTotal, d.currency)}
              </Text>
            </Column>
          </Row>
        ))}
        <Row style={{ borderTop: `1px solid ${t.color.surfaceHigh}`, paddingTop: "8px" }}>
          <Column>
            <Text style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: t.color.text }}>
              {r.total}
            </Text>
          </Column>
          <Column align={lang === "ar" ? "left" : "right"} style={{ width: "120px" }}>
            <Text style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: t.color.text }}>
              {formatPrice(d.subtotal, d.currency)}
            </Text>
          </Column>
        </Row>
      </Card>
      <P small muted>
        {d.isPaid ? r.paid : r.payAtCounter}
      </P>
      <PrimaryButton href={d.orderUrl}>{r.follow} →</PrimaryButton>
      <SignOff line={r.signOff} team={d.cafe.name} />
    </EmailLayout>
  );
}

export async function renderReceipt(d: ReceiptData) {
  const lang = TEXTS[d.locale] ? d.locale : "en";
  const element = <Receipt d={d} />;
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return {
    subject: fill(TEXTS[lang].subject, { cafe: d.cafe.name, number: d.number }),
    html,
    text,
  };
}
