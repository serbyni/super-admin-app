import "server-only";
import { Resend } from "resend";
import { isEmailTemplate, renderEmail } from "@/emails/templates";
import { emailConfig, type EmailConfig } from "@/lib/email/config";
import { siteUrl } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/service";
import { unwrap } from "./errors";

export type DispatchResult =
  | { status: "not_configured"; missing: string[] }
  | { status: "done"; sent: number; failed: number };

type Db = NonNullable<ReturnType<typeof createServiceClient>>;
type Delivery = Awaited<ReturnType<EmailDispatcher["claim"]>>[number];

/**
 * Sends due email deliveries from the outbox (platform.email_deliveries).
 *
 * Runs with the service-role client (deliveries belong to many users) — it never takes user
 * input about WHAT to send: it only processes rows the database trigger created. Each delivery
 * uses its id as Resend idempotency key, so a retry after a timeout never sends twice.
 */
export class EmailDispatcher {
  private readonly resend: Resend;

  constructor(
    private readonly db: Db,
    private readonly config: EmailConfig,
  ) {
    this.resend = new Resend(config.RESEND_API_KEY);
  }

  /** Dispatcher from server env, or the list of missing settings. */
  static fromEnv(): EmailDispatcher | { missing: string[] } {
    const db = createServiceClient();
    const config = emailConfig();
    const missing = [
      ...(db ? [] : ["SUPABASE_SECRET_KEY"]),
      ...(config ? [] : ["RESEND_API_KEY", "EMAIL_FROM"]),
    ];
    return db && config ? new EmailDispatcher(db, config) : { missing };
  }

  private async claim(limit: number) {
    return unwrap(
      "email_claim_deliveries",
      await this.db.rpc("email_claim_deliveries", { p_limit: limit, p_lease_seconds: 120 }),
    );
  }

  private async complete(id: string, result: { messageId?: string; error?: string }) {
    unwrap(
      "email_complete_delivery",
      await this.db.rpc("email_complete_delivery", {
        p_delivery_id: id,
        p_provider_message_id: result.messageId,
        p_error: result.error,
      }),
    );
  }

  private async sendOne(d: Delivery): Promise<{ messageId?: string; error?: string }> {
    if (!isEmailTemplate(d.template)) return { error: `unknown template ${d.template}` };
    const email = await renderEmail(d.template, {
      recipientName: d.recipient_name,
      businessName: d.business_name,
      locale: d.locale,
      reason: d.reason,
      links: {
        status: siteUrl("/pending"),
        signIn: siteUrl("/login"),
        contact: siteUrl("/contact"),
      },
    });
    const { data, error } = await this.resend.emails.send(
      {
        from: this.config.EMAIL_FROM,
        to: d.recipient_email,
        replyTo: this.config.EMAIL_REPLY_TO,
        subject: email.subject,
        html: email.html,
        text: email.text,
        tags: [{ name: "template", value: d.template }],
      },
      { idempotencyKey: `delivery-${d.delivery_id}` },
    );
    return error ? { error: `${error.name}: ${error.message}` } : { messageId: data?.id };
  }

  /** Claim and send up to `limit` due emails. Never throws for a single failed email. */
  async run(limit = 20): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;
    for (const d of await this.claim(limit)) {
      const result = await this.sendOne(d).catch((e: unknown) => ({
        error: e instanceof Error ? e.message : String(e),
      }));
      if (result.error) {
        failed++;
        console.error(`[email] ${d.template} delivery ${d.delivery_id} failed: ${result.error}`);
      } else {
        sent++;
      }
      await this.complete(d.delivery_id, result);
    }
    return { sent, failed };
  }
}

/** Send all due emails now (used by after()-kicks and the cron route). */
export async function dispatchDueEmails(limit = 20): Promise<DispatchResult> {
  const dispatcher = EmailDispatcher.fromEnv();
  if (!(dispatcher instanceof EmailDispatcher)) {
    return { status: "not_configured", missing: dispatcher.missing };
  }
  return { status: "done", ...(await dispatcher.run(limit)) };
}
