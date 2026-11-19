import { NextResponse, type NextRequest } from "next/server";
import { serverApi } from "@/lib/data/server-api";
import { cafeUrl } from "@/lib/env";

/**
 * Printed QR codes: <site>/q/<CODE>. Counts the scan and sends the visitor to the café's menu —
 * with ?table=<CODE> for a live table code, so the menu knows the table. A temporary redirect
 * (302) on purpose: the code is ours and may later point elsewhere (address change, new code).
 * Unknown codes → a friendly "not recognised" page.
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/q/[code]">) {
  const { code } = await params;
  const normalized = code.trim().toUpperCase();
  let target = null;
  try {
    target = /^[A-HJKMNP-Z2-9]{6}$/.test(normalized)
      ? await serverApi().tables.resolveQr(normalized)
      : null;
  } catch {
    // Database unreachable: send the visitor to the help page rather than an error.
  }
  const to = target
    ? `${cafeUrl(target.cafeSlug)}/menu${target.tableCode ? `?table=${target.tableCode}` : ""}`
    : new URL("/q/unknown", request.url).toString();
  const res = NextResponse.redirect(to, 302);
  res.headers.set("Cache-Control", "no-store"); // every scan must reach us (and be counted)
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
}
