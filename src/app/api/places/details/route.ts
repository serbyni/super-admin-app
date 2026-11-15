import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, placeDetails } from "@/lib/maps/server";

const query = z.object({
  placeId: z.string().regex(/^[A-Za-z0-9_-]{10,300}$/),
  sessionToken: z.uuid(),
  language: z.enum(["en", "fr", "ar"]).default("en"),
});

/** GET /api/places/details — location + address for a chosen suggestion (ends the session). */
export async function GET(request: NextRequest) {
  const blocked = guard(request, "details", 20);
  if (blocked) return blocked;
  const parsed = query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  try {
    const { placeId, sessionToken, language } = parsed.data;
    const place = await placeDetails(placeId, sessionToken, language);
    return place
      ? NextResponse.json({ place })
      : NextResponse.json({ error: "not_found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "upstream_error" }, { status: 502 });
  }
}
