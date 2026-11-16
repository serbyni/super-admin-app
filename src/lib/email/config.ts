import "server-only";
import { z } from "zod";

const schema = z.object({
  RESEND_API_KEY: z.string().startsWith("re_"),
});

export type EmailConfig = z.infer<typeof schema>;

/**
 * Server-only email settings, or null when not configured (e.g. local dev).
 * The sender address lives in the Resend automations (one set per environment / Resend team).
 */
export function emailConfig(): EmailConfig | null {
  const parsed = schema.safeParse({
    RESEND_API_KEY: process.env.RESEND_API_KEY,
  });
  return parsed.success ? parsed.data : null;
}
