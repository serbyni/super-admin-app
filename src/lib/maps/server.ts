import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { geoapifyProvider } from "./providers/geoapify";
import { googleProvider } from "./providers/google";
import { rateLimit } from "./rate-limit";
import type { MapsProvider } from "./types";

export { STATIC_MAP } from "./types";

/**
 * Active provider from server-only env (never NEXT_PUBLIC_):
 * MAPS_PROVIDER=geoapify|google, else the first one whose key is set (Geoapify first).
 */
export function mapsProvider(): MapsProvider | null {
  const geo = !!process.env.GEOAPIFY_API_KEY;
  const google = !!process.env.GOOGLE_MAPS_SERVER_KEY;
  switch (process.env.MAPS_PROVIDER) {
    case "google":
      return google ? googleProvider : null;
    case "geoapify":
      return geo ? geoapifyProvider : null;
    default:
      return geo ? geoapifyProvider : google ? googleProvider : null;
  }
}

export function mapsConfigured(): boolean {
  return mapsProvider() !== null;
}

/** Public info the browser may know (no keys). */
export function mapsClientConfig(): { enabled: boolean; attribution?: string } {
  const p = mapsProvider();
  return p ? { enabled: true, attribution: p.attribution } : { enabled: false };
}

/**
 * Common guard for the /api maps proxies: provider configured, same-site request, rate limit.
 * Returns the provider, or a response to send back.
 */
export function guard(
  request: NextRequest,
  bucket: string,
  perMinute: number,
): { provider: MapsProvider } | { response: NextResponse } {
  const provider = mapsProvider();
  if (!provider)
    return { response: NextResponse.json({ error: "maps_not_configured" }, { status: 503 }) };
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return { response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  if (!rateLimit(`${bucket}:${ip}`, perMinute)) {
    return { response: NextResponse.json({ error: "rate_limited" }, { status: 429 }) };
  }
  return { provider };
}
