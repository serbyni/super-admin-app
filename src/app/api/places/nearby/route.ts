import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/maps/server";

const query = z
  .object({
    west: z.coerce.number().min(-180).max(180),
    south: z.coerce.number().min(-90).max(90),
    east: z.coerce.number().min(-180).max(180),
    north: z.coerce.number().min(-90).max(90),
    language: z.enum(["en", "fr", "ar"]).default("en"),
  })
  // Only small areas (≈ a neighbourhood) — the client asks from zoom 16 up.
  .refine((b) => b.east > b.west && b.north > b.south, "invalid_bbox")
  .refine((b) => b.east - b.west <= 0.05 && b.north - b.south <= 0.05, "bbox_too_large");

/** GET /api/places/nearby — cafés, restaurants, bakeries… inside the visible map area. */
export async function GET(request: NextRequest) {
  const g = guard(request, "nearby", 40);
  if ("response" in g) return g.response;
  if (!g.provider.nearby) return NextResponse.json({ places: [] });
  const parsed = query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  try {
    const { language, ...bbox } = parsed.data;
    return NextResponse.json({ places: await g.provider.nearby(bbox, language) });
  } catch {
    return NextResponse.json({ error: "upstream_error" }, { status: 502 });
  }
}
