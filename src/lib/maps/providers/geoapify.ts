import "server-only";
import { roundCoord, type BusinessLocation } from "@/lib/location/address";
import {
  STATIC_MAP,
  type Language,
  type MapsProvider,
  type ReverseAddress,
  type Suggestion,
} from "../types";

const key = () => process.env.GEOAPIFY_API_KEY!;
const BASE = "https://api.geoapify.com/v1/geocode";

/** Subset of Geoapify geocoding result fields we use (format=json). */
type GeoResult = {
  place_id: string;
  name?: string;
  address_line1?: string;
  address_line2?: string;
  formatted?: string;
  street?: string;
  housenumber?: string;
  postcode?: string;
  city?: string;
  county?: string;
  state?: string;
  country?: string;
  country_code?: string;
  lat: number;
  lon: number;
};

function toAddress(r: GeoResult): ReverseAddress {
  const street = r.street ? (r.housenumber ? `${r.housenumber} ${r.street}` : r.street) : undefined;
  const cc = r.country_code?.toUpperCase();
  return {
    formatted_address: r.formatted,
    street,
    postal_code: r.postcode,
    city: r.city ?? r.county ?? r.state,
    region: r.state,
    country: r.country,
    country_code: cc && /^[A-Z]{2}$/.test(cc) ? cc : undefined,
  };
}

function toPlace(r: GeoResult): BusinessLocation {
  return {
    source: "place_search", // chosen from search results (any provider)
    place_id: r.place_id,
    lat: roundCoord(r.lat),
    lng: roundCoord(r.lon),
    ...toAddress(r),
  };
}

async function get(url: URL): Promise<{ results?: GeoResult[] }> {
  url.searchParams.set("format", "json");
  url.searchParams.set("apiKey", key());
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`geoapify ${res.status}`);
  return (await res.json()) as { results?: GeoResult[] };
}

export const geoapifyProvider: MapsProvider = {
  name: "geoapify",
  attribution: "© OpenStreetMap contributors · Powered by Geoapify",

  async autocomplete(
    input: string,
    _sessionToken: string,
    language: Language,
  ): Promise<Suggestion[]> {
    const url = new URL(`${BASE}/autocomplete`);
    url.searchParams.set("text", input);
    url.searchParams.set("lang", language);
    url.searchParams.set("limit", "6");
    const data = await get(url);
    // Results already contain coordinates + address: no separate details call (saves credits).
    return (data.results ?? []).map((r) => ({
      placeId: r.place_id,
      main: r.name ?? r.address_line1 ?? r.formatted ?? "",
      secondary: r.name
        ? r.address_line1 && r.address_line2
          ? `${r.address_line1}, ${r.address_line2}`
          : r.address_line2
        : r.address_line2,
      place: toPlace(r),
    }));
  },

  async details(): Promise<BusinessLocation | null> {
    return null; // not needed: autocomplete returns the full place
  },

  async reverse(lat: number, lng: number, language: Language): Promise<ReverseAddress | null> {
    const url = new URL(`${BASE}/reverse`);
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("lang", language);
    const best = (await get(url)).results?.[0];
    return best ? toAddress(best) : null;
  },

  async staticMap(lat: number, lng: number, zoom: number, marker: boolean): Promise<Response> {
    const url = new URL("https://maps.geoapify.com/v1/staticmap");
    url.searchParams.set("style", "osm-bright");
    url.searchParams.set("width", String(STATIC_MAP.width));
    url.searchParams.set("height", String(STATIC_MAP.height));
    url.searchParams.set("scaleFactor", String(STATIC_MAP.scale));
    url.searchParams.set("center", `lonlat:${lng},${lat}`);
    // Geoapify renders 512px tiles: its zoom z equals the standard 256px zoom z+1.
    url.searchParams.set("zoom", String(zoom - 1));
    if (marker) url.searchParams.set("marker", `lonlat:${lng},${lat};color:#6f4e37;size:medium`);
    url.searchParams.set("apiKey", key());
    return fetch(url, { cache: "no-store" });
  },
};
