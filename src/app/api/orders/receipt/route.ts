import { z } from "zod";
import { sendReceipt } from "@/lib/data/receipt-sender";

const body = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,40}$/),
  token: z.string().regex(/^[0-9a-f]{32}$/),
});

/**
 * E-mails the receipt of an accepted order (rendered here: React Email needs a route handler).
 * The order token is the secret; the database only returns an accepted order with an e-mail
 * and no receipt yet, so it is sent at most once. Always 204.
 */
export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (parsed.success) await sendReceipt(parsed.data.slug, parsed.data.token);
  return new Response(null, { status: 204 });
}
