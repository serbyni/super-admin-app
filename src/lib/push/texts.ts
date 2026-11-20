import ar from "../../../messages/ar.json";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { formatPrice } from "@/lib/menu/schema";
import type { OrderStatus } from "@/lib/orders/schema";

/** Notification texts in the reader's language (EN/FR/AR; English for other languages). */

type PushTexts = typeof en.push;
const TEXTS: Record<string, PushTexts> = { en: en.push, fr: fr.push, ar: ar.push };
const fill = (s: string, v: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));
const texts = (locale: string) => TEXTS[locale] ?? TEXTS.en;

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
  /** Owner's new order: stays on screen until handled. */
  requireInteraction?: boolean;
};

export function newOrderPush(
  o: {
    number: number;
    kind: string;
    tableLabel: string | null;
    customerName: string;
    subtotal: number;
    currency: string;
  },
  cafe: { name: string },
  locale: string,
  url: string,
): PushPayload {
  const t = texts(locale);
  const total = formatPrice(o.subtotal, o.currency);
  return {
    title: fill(t.newOrderTitle, { number: o.number, cafe: cafe.name }),
    body:
      o.kind === "table"
        ? fill(t.newOrderTable, { label: o.tableLabel ?? "", total })
        : fill(t.newOrderTakeaway, { name: o.customerName, total }),
    url,
    tag: `new-order-${o.number}`,
    requireInteraction: true,
  };
}

export function orderUpdatePush(
  o: {
    number: number;
    status: OrderStatus;
    reason: string;
    kind: string;
    tableLabel: string | null;
    customerName: string;
  },
  cafe: { name: string },
  locale: string,
  url: string,
): PushPayload | null {
  if (o.status === "new") return null;
  const t = texts(locale);
  let body = t.status[o.status];
  if (o.status === "ready")
    body =
      o.kind === "table"
        ? fill(t.readyTable, { label: o.tableLabel ?? "" })
        : fill(t.readyTakeaway, { name: o.customerName });
  if ((o.status === "declined" || o.status === "cancelled") && o.reason)
    body = `${body} ${fill(t.reason, { reason: o.reason })}`;
  return {
    title: fill(t.customerTitle, { cafe: cafe.name, number: o.number }),
    body,
    url,
    tag: `order-${o.number}`,
  };
}
