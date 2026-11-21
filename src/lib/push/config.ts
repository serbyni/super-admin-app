import "server-only";

/**
 * Web push keys (VAPID), server side. Null when not configured: push is then simply off.
 * Generate with `npx web-push generate-vapid-keys`; set in .env.local / Vercel (never in code).
 */
export function pushConfig(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject || !/^(mailto:|https:)/.test(subject)) return null;
  return { publicKey, privateKey, subject };
}
