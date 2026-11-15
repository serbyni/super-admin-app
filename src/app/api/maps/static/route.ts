import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, STATIC_MAP, staticMap } from "@/lib/maps/server";

const query = z.object({
  // Rounded so repeated views hit the cache.
  lat: z.coerce
    .number()
    .min(-85)
    .max(85)
    .transform((v) => Math.round(v * 1e6) / 1e6),
  lng: z.coerce
    .number()
    .min(-180)
    .max(180)
    .transform((v) => Math.round(v * 1e6) / 1e6),
  zoom: z.coerce.number().int().min(STATIC_MAP.minZoom).max(STATIC_MAP.maxZoom),
  marker: z.enum(["0", "1"]).default("1"),
});

/** GET /api/maps/static — Google Static Map image proxied with the server key. */
export async function GET(request: NextRequest) {
  const blocked = guard(request, "static", 90);
  if (blocked) return blocked;
  const parsed = query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { lat, lng, zoom, marker } = parsed.data;
  const upstream = await staticMap(lat, lng, zoom, marker === "1").catch(() => null);
  if (!upstream?.ok || !upstream.body) {
    return NextResponse.json({ error: "upstream_error" }, { status: 502 });
  }
  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/png",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
