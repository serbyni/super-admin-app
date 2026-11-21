import { after } from "next/server";
import { z } from "zod";
import { notifyTableMoved } from "@/lib/data/push-dispatcher";

const body = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,40}$/),
  token: z.string().regex(/^[0-9a-f]{32}$/),
});

/**
 * Called by cafe-app's server after a customer moved their order to another table: pushes it to
 * the café owners' devices. Same rules as /api/push/new-order — the order token is the secret and
 * the database sends at most one push per move, only for a recent one. Always 204.
 */
export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (parsed.success) after(() => notifyTableMoved(parsed.data.slug, parsed.data.token));
  return new Response(null, { status: 204 });
}
