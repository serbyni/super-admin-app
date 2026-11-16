/**
 * Sets up the whole Resend side of Serbi emails from the repo (idempotent — safe to re-run):
 *   1. templates  — rendered from src/emails, created/updated by alias, then published
 *   2. events     — register_new_user, admin_approve_user, admin_declined_user (+ payload schema)
 *   3. automations — one per event: trigger → send the template from EMAIL_FROM
 *
 *   RESEND_API_KEY=re_... EMAIL_FROM="Serbi <noreply@dev.serbi.me>" npm run email:sync
 *
 * Needs a FULL-ACCESS Resend key (the app itself only needs a sending key) and a VERIFIED domain
 * for EMAIL_FROM (Resend refuses automations otherwise). Run it once per environment.
 */
import { Resend } from "resend";
import {
  EMAIL_TEMPLATES,
  renderResendTemplate,
  TEMPLATE_VARIABLES,
  type EmailTemplate,
} from "../src/emails/templates";

const AUTOMATION_NAME = (t: EmailTemplate) => `Serbi · ${t}`;

function check<T>(label: string, res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(`${label}: ${res.error.message}`);
  return res.data as T;
}

void (async () => {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    console.error(
      'email:sync: set RESEND_API_KEY (full access) and EMAIL_FROM ("Serbi <noreply@…>")',
    );
    process.exit(1);
  }
  const resend = new Resend(key);
  const automations = check("list automations", await resend.automations.list({ limit: 100 })).data;

  for (const t of EMAIL_TEMPLATES) {
    // 1. Template
    const tpl = await renderResendTemplate(t);
    const existing = await resend.templates.get(tpl.alias);
    const payload = {
      name: `Serbi · ${tpl.alias}`,
      alias: tpl.alias,
      subject: tpl.subject,
      from,
      html: tpl.html,
      variables: tpl.variables,
    };
    const templateId = existing.data
      ? (check(`update ${t}`, await resend.templates.update(existing.data.id, payload)),
        existing.data.id)
      : check(`create ${t}`, await resend.templates.create(payload)).id;
    check(`publish ${t}`, await resend.templates.publish(templateId));

    // 2. Event (payload keys = template variables in snake_case)
    const schema = Object.fromEntries(
      TEMPLATE_VARIABLES[t].map((v) => [v.toLowerCase(), "string" as const]),
    );
    const event = await resend.events.get(t);
    if (event.data) check(`update event ${t}`, await resend.events.update(t, { schema }));
    else check(`create event ${t}`, await resend.events.create({ name: t, schema }));

    // 3. Automation: trigger(event) → send_email(template)
    const steps = [
      { key: "trigger", type: "trigger" as const, config: { eventName: t } },
      {
        key: "send_email",
        type: "send_email" as const,
        config: {
          template: {
            id: templateId,
            variables: Object.fromEntries(
              TEMPLATE_VARIABLES[t].map((v) => [v, { var: `event.${v.toLowerCase()}` }]),
            ),
          },
          from,
          subject: tpl.subject,
        },
      },
    ];
    const connections = [{ from: "trigger", to: "send_email" }];
    const current = automations.find((a) => a.name === AUTOMATION_NAME(t));
    if (current) {
      check(
        `update automation ${t}`,
        await resend.automations.update(current.id, { steps, connections, status: "enabled" }),
      );
    } else {
      check(
        `create automation ${t}`,
        await resend.automations.create({
          name: AUTOMATION_NAME(t),
          status: "enabled",
          steps,
          connections,
        }),
      );
    }
    console.log(
      `email:sync: ${t} — template ${existing.data ? "updated" : "created"}, event + automation ready`,
    );
  }
})().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
