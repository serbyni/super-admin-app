import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { parseAddressComponents, roundCoord, type BusinessLocation } from "@/lib/location/address";
import { rateLimit } from "./rate-limit";

/** Server-only Google key. Never exposed to the browser (no NEXT_PUBLIC_ prefix). */
export function serverMapsKey(): string | undefined {
  return process.env.GOOGLE_MAPS_SERVER_KEY || undefined;
}

export function mapsConfigured(): boolean {
  return !!serverMapsKey();
}

/**
 * Common guard for the /api maps proxies: key configured, same-site request, rate limit.
 * Returns a response to send back, or null when the request may proceed.
 */
export function guard(
  request: NextRequest,
  bucket: string,
  perMinute: number,
): NextResponse | null {
  if (!serverMapsKey()) return NextResponse.json({ error: "maps_not_configured" }, { status: 503 });
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  if (!rateLimit(`${bucket}:${ip}`, perMinute)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  return null;
}

export type Suggestion = { placeId: string; main: string; secondary?: string };

type PlacesAutocompleteResponse = {
  suggestions?: {
    placePrediction?: {
      placeId: string;
      text?: { text: string };
      structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
    };
  }[];
};

export async function placesAutocomplete(input: string, sessionToken: string, language: string) {
  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": serverMapsKey()! },
    body: JSON.stringify({ input, sessionToken, languageCode: language }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`places autocomplete ${res.status}`);
  const data = (await res.json()) as PlacesAutocompleteResponse;
  return (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map<Suggestion>((p) => ({
      placeId: p.placeId,
      main: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
      secondary: p.structuredFormat?.secondaryText?.text,
    }));
}

type PlaceDetailsResponse = {
  id: string;
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  addressComponents?: { longText?: string; shortText?: string; types: string[] }[];
};

export async function placeDetails(placeId: string, sessionToken: string, language: string) {
  const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
  url.searchParams.set("sessionToken", sessionToken);
  url.searchParams.set("languageCode", language);
  const res = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": serverMapsKey()!,
      "X-Goog-FieldMask": "id,formattedAddress,location,addressComponents",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`place details ${res.status}`);
  const p = (await res.json()) as PlaceDetailsResponse;
  if (!p.location) return null;
  return {
    source: "google_place",
    place_id: p.id,
    formatted_address: p.formattedAddress,
    lat: roundCoord(p.location.latitude),
    lng: roundCoord(p.location.longitude),
    ...parseAddressComponents(p.addressComponents),
  } satisfies BusinessLocation;
}

type GeocodeResponse = {
  status: string;
  results?: {
    formatted_address: string;
    address_components: { long_name: string; short_name: string; types: string[] }[];
  }[];
};

export async function reverseGeocode(lat: number, lng: number, language: string) {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${lat},${lng}`);
  url.searchParams.set("language", language);
  url.searchParams.set("key", serverMapsKey()!);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`geocode ${res.status}`);
  const data = (await res.json()) as GeocodeResponse;
  // Geocoding reports key/quota problems with HTTP 200 + status (e.g. REQUEST_DENIED).
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") throw new Error(`geocode ${data.status}`);
  const best = data.results?.[0];
  if (!best) return null;
  return {
    formatted_address: best.formatted_address,
    ...parseAddressComponents(best.address_components),
  };
}

export const STATIC_MAP = { width: 640, height: 320, scale: 2, minZoom: 3, maxZoom: 20 } as const;

export async function staticMap(lat: number, lng: number, zoom: number, marker: boolean) {
  const url = new URL("https://maps.googleapis.com/maps/api/staticmap");
  url.searchParams.set("center", `${lat},${lng}`);
  url.searchParams.set("zoom", String(zoom));
  url.searchParams.set("size", `${STATIC_MAP.width}x${STATIC_MAP.height}`);
  url.searchParams.set("scale", String(STATIC_MAP.scale));
  if (marker) url.searchParams.set("markers", `color:0x6f4e37|${lat},${lng}`);
  url.searchParams.set("key", serverMapsKey()!);
  return fetch(url, { cache: "no-store" });
}
