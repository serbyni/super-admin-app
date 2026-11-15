import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, placesAutocomplete } from "@/lib/maps/server";

const body = z.object({
  input: z.string().trim().min(3).max(120),
  sessionToken: z.uuid(),
  language: z.enum(["en", "fr", "ar"]).default("en"),
});

/** POST /api/places/autocomplete — Places API (New) suggestions via the server key. */
export async function POST(request: NextRequest) {
  const blocked = guard(request, "autocomplete", 60);
  if (blocked) return blocked;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  try {
    const { input, sessionToken, language } = parsed.data;
    return NextResponse.json({
      suggestions: await placesAutocomplete(input, sessionToken, language),
    });
  } catch {
    return NextResponse.json({ error: "upstream_error" }, { status: 502 });
  }
}
