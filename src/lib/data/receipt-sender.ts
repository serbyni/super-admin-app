import "server-only";
import { Resend } from "resend";
import { z } from "zod";
import { renderReceipt } from "@/emails/order-receipt";
import { emailConfig } from "@/lib/email/config";
import { cafeUrl, publicEnv } from "@/lib/env";
import { orderSchema } from "@/lib/orders/schema";
import { createServiceClient } from "@/lib/supabase/service";

const receiptSchema = orderSchema.extend({
  orderId: z.string(),
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
 * E-mails the receipt of an accepted order to the customer's address (if they gave one). Marked
 * as sent only after Resend accepted it (receipt_order returns nothing once sent). Direct send — customers have no account, so the
 * event/automation pipeline of the platform e-mails does not apply.
 */
export async function sendReceipt(
  slug: string,
  token: string,
): Promise<"sent" | "skipped" | "failed"> {
  const config = emailConfig();
  const from = receiptFrom();
  const db = createServiceClient();
  if (!config || !from || !db) return "skipped";
  const { data } = await db.rpc("receipt_order", { p_slug: slug, p_token: token });
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
    // Not marked: a later accept or retry can still send it.
    console.error("[receipt] send failed:", error.message);
    return "failed";
  }
  await db.rpc("mark_receipt_sent", { p_order_id: o.orderId });
  return "sent";
}
