import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { dispatchDueEmails } from "@/lib/data/email-dispatcher";

/**
 * GET /api/internal/email/dispatch — scheduled sweep that sends queued emails (retries and any
 * email whose immediate send was missed). Called by Vercel Cron with
 * `Authorization: Bearer <CRON_SECRET>`; anything else gets 401.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const ok =
    !!secret &&
    given.length === expected.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const result = await dispatchDueEmails(50);
  return NextResponse.json(result, { status: result.status === "not_configured" ? 503 : 200 });
}
