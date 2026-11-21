import "server-only";
import webpush from "web-push";
import { z } from "zod";
import { tenantDashboard } from "@/lib/auth/routes";
import { cafeUrl, siteUrl } from "@/lib/env";
import { ORDER_STATUSES } from "@/lib/orders/schema";
import { pushConfig } from "@/lib/push/config";
import {
  newOrderPush,
  orderMovedPush,
  orderUpdatePush,
  tableMovedPush,
  type PushPayload,
} from "@/lib/push/texts";
import { createServiceClient } from "@/lib/supabase/service";

/*
 * Order notifications (Web Push), sent with the service-role client like the e-mail dispatcher:
 * new order → the café owners' devices; status change → the customer's phones.
 */

export type PushTarget = { endpoint: string; p256dh: string; auth: string; locale: string };
type ServiceDb = NonNullable<ReturnType<typeof createServiceClient>>;

/**
 * Sends one notification per target (payload built per target's language). Subscriptions the
 * push service reports as gone (404/410) are deleted; other failures are counted.
 */
export async function sendPush(
  db: ServiceDb,
  targets: PushTarget[],
  build: (t: PushTarget) => PushPayload | null,
): Promise<{ sent: number; failed: number }> {
  const cfg = pushConfig();
  if (!cfg || targets.length === 0) return { sent: 0, failed: 0 };
  webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);
  let sent = 0;
  let failed = 0;
  await Promise.all(
    targets.map(async (t) => {
      const payload = build(t);
      if (!payload) return;
      try {
        await webpush.sendNotification(
          { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60, urgency: "high" },
        );
        sent++;
      } catch (e) {
        failed++;
        const status = (e as { statusCode?: number }).statusCode;
        await db.rpc("push_drop_subscription", {
          p_endpoint: t.endpoint,
          p_gone: status === 404 || status === 410,
        });
      }
    }),
  );
  return { sent, failed };
}

const target = z.object({
  endpoint: z.string(),
  p256dh: z.string(),
  auth: z.string(),
  locale: z.string(),
});
const cafe = z.object({ name: z.string(), slug: z.string() });
const num = z.coerce.number();

const newOrderSchema = z.object({
  order: z.object({
    number: num,
    kind: z.string(),
    tableLabel: z.string().nullable(),
    customerName: z.string(),
    subtotal: num,
    currency: z.string(),
  }),
  cafe,
  subscriptions: z.array(target),
});

const updateSchema = z.object({
  order: z.object({
    number: num,
    status: z.enum(ORDER_STATUSES),
    reason: z.string(),
    kind: z.string(),
    tableLabel: z.string().nullable(),
    customerName: z.string(),
    movedFromLabel: z.string().nullable().optional(),
    token: z.string(),
  }),
  cafe,
  subscriptions: z.array(target),
});

/** New order → the café owners' devices. Once per order (the database guarantees it). */
export async function notifyNewOrder(slug: string, token: string): Promise<void> {
  const db = createServiceClient();
  if (!db || !pushConfig()) return;
  const { data } = await db.rpc("push_new_order_targets", { p_slug: slug, p_token: token });
  const parsed = newOrderSchema.safeParse(data);
  if (!parsed.success) return;
  const { order, cafe: c, subscriptions } = parsed.data;
  const url = siteUrl(`${tenantDashboard(c.slug).replace(/\/$/, "")}/orders`);
  await sendPush(db, subscriptions, (t) => newOrderPush(order, c, t.locale, url));
}

/**
 * Status change → the customer's phones (every step). Returns the order's café + token (for
 * the receipt), or null when the order can't be read.
 */
export async function notifyOrderUpdate(
  orderId: string,
): Promise<{ slug: string; token: string } | null> {
  const db = createServiceClient();
  if (!db) return null;
  const { data } = await db.rpc("push_order_update_targets", { p_order_id: orderId });
  const parsed = updateSchema.safeParse(data);
  if (!parsed.success) return null;
  const { order, cafe: c, subscriptions } = parsed.data;
  if (pushConfig() && subscriptions.length) {
    const url = `${cafeUrl(c.slug)}/order/${order.token}`;
    await sendPush(db, subscriptions, (t) => orderUpdatePush(order, c, t.locale, url));
  }
  return { slug: c.slug, token: order.token };
}

const movedSchema = z.object({
  order: z.object({
    number: num,
    tableLabel: z.string().nullable(),
    movedFromLabel: z.string().nullable(),
  }),
  cafe,
  subscriptions: z.array(target),
});

/** The customer moved their order → the café owners' devices. Once per move (database). */
export async function notifyTableMoved(slug: string, token: string): Promise<void> {
  const db = createServiceClient();
  if (!db || !pushConfig()) return;
  const { data } = await db.rpc("push_table_moved_targets", { p_slug: slug, p_token: token });
  const parsed = movedSchema.safeParse(data);
  if (!parsed.success) return;
  const { order, cafe: c, subscriptions } = parsed.data;
  const url = siteUrl(`${tenantDashboard(c.slug).replace(/\/$/, "")}/orders`);
  await sendPush(db, subscriptions, (t) => tableMovedPush(order, c, t.locale, url));
}

/** Staff moved an order → the customer's phones. */
export async function notifyOrderMoved(orderId: string): Promise<void> {
  const db = createServiceClient();
  if (!db || !pushConfig()) return;
  const { data } = await db.rpc("push_order_update_targets", { p_order_id: orderId });
  const parsed = updateSchema.safeParse(data);
  if (!parsed.success || !parsed.data.subscriptions.length) return;
  const { order, cafe: c, subscriptions } = parsed.data;
  const url = `${cafeUrl(c.slug)}/order/${order.token}`;
  await sendPush(db, subscriptions, (t) => orderMovedPush(order, c, t.locale, url));
}

/**
 * Asks the receipt route (React Email can't render inside server actions) to e-mail the
 * receipt. The route only sends for an accepted order with an e-mail, once.
 */
export async function requestReceipt(slug: string, token: string): Promise<void> {
  try {
    await fetch(siteUrl("/api/orders/receipt"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, token }),
      cache: "no-store",
    });
  } catch {
    /* no receipt this time; the next accept/retry can send it */
  }
}
