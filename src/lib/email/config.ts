import "server-only";
import { z } from "zod";

const schema = z.object({
  RESEND_API_KEY: z.string().startsWith("re_"),
  /** e.g. "Serbi <noreply@dev.serbi.me>" (dev) or "Serbi <noreply@serbi.me>" (prod). */
  EMAIL_FROM: z.string().min(3),
  EMAIL_REPLY_TO: z.email().optional(),
});

export type EmailConfig = z.infer<typeof schema>;

/** Server-only email settings, or null when email sending is not configured (e.g. local dev). */
export function emailConfig(): EmailConfig | null {
  const parsed = schema.safeParse({
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO || undefined,
  });
  return parsed.success ? parsed.data : null;
}
