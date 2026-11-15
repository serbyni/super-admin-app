import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, reverseGeocode } from "@/lib/maps/server";

const query = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  language: z.enum(["en", "fr", "ar"]).default("en"),
});

/** GET /api/geocode/reverse — address for a map pin or typed coordinates. */
export async function GET(request: NextRequest) {
  const blocked = guard(request, "geocode", 30);
  if (blocked) return blocked;
  const parsed = query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  try {
    const { lat, lng, language } = parsed.data;
    return NextResponse.json({ address: await reverseGeocode(lat, lng, language) });
  } catch {
    return NextResponse.json({ error: "upstream_error" }, { status: 502 });
  }
}
