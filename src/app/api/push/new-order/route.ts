import { after } from "next/server";
import { z } from "zod";
import { notifyNewOrder } from "@/lib/data/push-dispatcher";

const body = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,40}$/),
  token: z.string().regex(/^[0-9a-f]{32}$/),
});

/**
 * Called by cafe-app's server right after an order is placed: pushes it to the café owners'
 * devices. No shared secret needed — the order token is the secret and the database sends the
 * push at most once, only for a fresh order. Always answers 204 (nothing to learn from it).
 */
export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (parsed.success) after(() => notifyNewOrder(parsed.data.slug, parsed.data.token));
  return new Response(null, { status: 204 });
}
