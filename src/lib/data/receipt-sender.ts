import "server-only";
import { Resend } from "resend";
import { z } from "zod";
import { renderReceipt } from "@/emails/order-receipt";
import { emailConfig } from "@/lib/email/config";
import { cafeUrl, publicEnv } from "@/lib/env";
import { orderSchema } from "@/lib/orders/schema";
import { createServiceClient } from "@/lib/supabase/service";

const receiptSchema = orderSchema.extend({
  email: z.string().email(),
  token: z.string(),
  cafe: z.object({ name: z.string(), slug: z.string(), timezone: z.string() }),
});

/** Receipt sender (EMAIL_FROM, e.g. "Serbi <noreply@dev.serbi.me>"), or null when not configured. */
function receiptFrom(): string | null {
  const from = process.env.EMAIL_FROM?.trim();
  return from && /<[^@\s]+@[^@\s>]+>$|^[^@\s]+@[^@\s]+$/.test(from) ? from : null;
}

/**
 * E-mails the receipt of an accepted order to the customer's address (if they gave one). Sent
 * at most once (receipt_order marks it). Direct send — customers have no account, so the
 * event/automation pipeline of the platform e-mails does not apply.
 */
export async function sendReceipt(orderId: string): Promise<"sent" | "skipped" | "failed"> {
  const config = emailConfig();
  const from = receiptFrom();
  const db = createServiceClient();
  // Check the settings BEFORE claiming the receipt, so a missing setting doesn't use it up.
  if (!config || !from || !db) return "skipped";
  const { data } = await db.rpc("receipt_order", { p_order_id: orderId });
  const parsed = receiptSchema.safeParse(data);
  if (!parsed.success) return "skipped";
  const o = parsed.data;
  const { subject, html, text } = await renderReceipt({
    ...o,
    cafe: o.cafe,
    orderUrl: `${cafeUrl(o.cafe.slug)}/order/${o.token}`,
    siteUrl: publicEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, ""),
  });
  const { error } = await new Resend(config.RESEND_API_KEY).emails.send({
    from,
    to: o.email,
    subject,
    html,
    text,
  });
  if (error) {
    console.error("[receipt] send failed:", error.message);
    return "failed";
  }
  return "sent";
}
