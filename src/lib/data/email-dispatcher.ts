import "server-only";
import { Resend } from "resend";
import { formatDateTime } from "@/config/locale";
import { isEmailTemplate, TEMPLATE_VARIABLES, type EmailVariable } from "@/emails/templates";
import { emailCopy } from "@/emails/copy";
import { tenantSettings } from "@/lib/auth/routes";
import { emailConfig, type EmailConfig } from "@/lib/email/config";
import { languageLabel } from "@/lib/i18n/languages";
import { cafeHost } from "@/lib/cafes/slug";
import { cafeRootDomain, publicEnv } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/service";
import { unwrap } from "./errors";

export type DispatchResult =
  | { status: "not_configured"; missing: string[] }
  | { status: "done"; sent: number; failed: number };

type Db = NonNullable<ReturnType<typeof createServiceClient>>;
type Delivery = Awaited<ReturnType<EmailDispatcher["claim"]>>[number];

/** Resend inserts {{{VAR}}} values unescaped: escape user-entered text (names, reasons). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Approved/declined texts of the language-request e-mail (from the event payload). */
function languageDecision(
  d: Delivery,
  siteUrl: string,
): Partial<Record<EmailVariable, string | null>> {
  if (d.template !== "language_request_decided") return {};
  const p = (d.payload ?? {}) as {
    locale?: string;
    approved?: boolean;
    note?: string;
    cafe_slug?: string;
  };
  const l = emailCopy(d.locale).language;
  const lang = p.locale ? languageLabel(p.locale) : null;
  const name = lang ?? "Your language";
  return {
    LANGUAGE: lang,
    DECISION_TITLE: p.approved ? l.approvedTitle(name) : l.declinedTitle(name),
    DECISION_MESSAGE: p.approved ? l.approvedMessage(name) : l.declinedMessage,
    NOTE: p.note ?? null,
    SETTINGS_URL: p.cafe_slug
      ? `${siteUrl.replace(/\/$/, "")}${tenantSettings(p.cafe_slug)}?tab=languages`
      : `${siteUrl.replace(/\/$/, "")}/auth/home`,
  };
}

/**
 * Event payload for a delivery: snake_case keys (Resend event schema), one per template variable
 * the template uses. Automations map them to the template's {{{UPPER_CASE}}} variables.
 */
export function eventPayload(
  d: Delivery,
  siteUrl: string,
  rootDomain: string,
): Record<string, string> {
  const all: Partial<Record<EmailVariable, string | null>> = {
    SITE_URL: siteUrl.replace(/\/$/, ""),
    OWNER_NAME: d.recipient_name?.trim().split(/\s+/)[0],
    OWNER_EMAIL: d.recipient_email,
    BUSINESS_NAME: d.business_name,
    BUSINESS_ADDRESS: d.business_address,
    SUBMITTED_AT: d.submitted_at ? formatDateTime(d.submitted_at) : null,
    DECIDED_AT: d.decided_at ? formatDateTime(d.decided_at) : null,
    REASON: d.reason,
    CAFE_NAME: d.cafe_name ?? d.business_name,
    CAFE_HOST: d.cafe_slug ? cafeHost(d.cafe_slug, rootDomain) : null,
    CREATED_AT: d.event_at ? formatDateTime(d.event_at) : null,
    ...languageDecision(d, siteUrl),
  };
  const keys = isEmailTemplate(d.template) ? TEMPLATE_VARIABLES[d.template] : [];
  const payload: Record<string, string> = {};
  for (const k of keys) {
    const v = all[k]?.trim();
    // Empty → omitted, so the Resend template's fallback value is used.
    if (v) payload[k.toLowerCase()] = k === "SITE_URL" || k === "SETTINGS_URL" ? v : escapeHtml(v);
  }
  return payload;
}

/**
 * Turns due email deliveries (platform.email_deliveries) into Resend **events**. In Resend, one
 * automation per event sends the matching published template (see README → Emails).
 *
 * Runs with the service-role client (deliveries belong to many users) and never takes user input
 * about WHAT to send: it only processes rows the database trigger created. The delivery id is the
 * idempotency key, so a retry after a timeout never triggers the automation twice.
 */
export class EmailDispatcher {
  private readonly resend: Resend;

  constructor(
    private readonly db: Db,
    config: EmailConfig,
    private readonly siteUrl: string,
    private readonly rootDomain: string,
  ) {
    this.resend = new Resend(config.RESEND_API_KEY);
  }

  /** Dispatcher from server env, or the list of missing settings. */
  static fromEnv(): EmailDispatcher | { missing: string[] } {
    const db = createServiceClient();
    const config = emailConfig();
    const missing = [...(db ? [] : ["SUPABASE_SECRET_KEY"]), ...(config ? [] : ["RESEND_API_KEY"])];
    return db && config
      ? new EmailDispatcher(db, config, publicEnv().NEXT_PUBLIC_SITE_URL, cafeRootDomain())
      : { missing };
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
    const { data, error } = await this.resend.events.send(
      {
        event: d.template,
        email: d.recipient_email,
        payload: eventPayload(d, this.siteUrl, this.rootDomain),
      },
      // Same key on every retry of this delivery (standard Resend Idempotency-Key header).
      { headers: { "Idempotency-Key": `delivery-${d.delivery_id}` } },
    );
    return error
      ? { error: `${error.name}: ${error.message}` }
      : { messageId: `event:${data?.event}` };
  }

  /** Claim and dispatch up to `limit` due deliveries. Never throws for a single failure. */
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

/** Dispatch all due deliveries now (used by after()-kicks and the cron route). */
export async function dispatchDueEmails(limit = 20): Promise<DispatchResult> {
  const dispatcher = EmailDispatcher.fromEnv();
  if (!(dispatcher instanceof EmailDispatcher)) {
    return { status: "not_configured", missing: dispatcher.missing };
  }
  return { status: "done", ...(await dispatcher.run(limit)) };
}
