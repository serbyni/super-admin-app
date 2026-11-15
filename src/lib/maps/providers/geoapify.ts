import "server-only";
import { roundCoord, type BusinessLocation } from "@/lib/location/address";
import {
  STATIC_MAP,
  type BBox,
  type Language,
  type MapsProvider,
  type NearbyPlace,
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

/** Geoapify Places categories shown on the map, with the Material Symbol used for each. */
const NEARBY_CATEGORIES: [category: string, icon: string][] = [
  ["catering.cafe", "local_cafe"],
  ["catering.restaurant", "restaurant"],
  ["catering.fast_food", "fastfood"],
  ["catering.ice_cream", "icecream"],
  ["catering.bar", "local_bar"],
  ["catering.pub", "sports_bar"],
  ["commercial.food_and_drink.bakery", "bakery_dining"],
  ["commercial.food_and_drink.coffee_and_tea", "coffee"],
];

type PlacesFeature = { properties: GeoResult & { categories?: string[] } };

function iconFor(categories: string[] | undefined): string {
  for (const [cat, icon] of NEARBY_CATEGORIES) if (categories?.includes(cat)) return icon;
  return "storefront";
}

export const geoapifyProvider: MapsProvider = {
  name: "geoapify",
  interactive: true,
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

  async tile(z: number, x: number, y: number, retina: boolean): Promise<Response> {
    const url = new URL(
      `https://maps.geoapify.com/v1/tile/osm-bright/${z}/${x}/${y}${retina ? "@2x" : ""}.png`,
    );
    url.searchParams.set("apiKey", key());
    return fetch(url, { cache: "no-store" });
  },

  async nearby(bbox: BBox, language: Language): Promise<NearbyPlace[]> {
    const url = new URL("https://api.geoapify.com/v2/places");
    url.searchParams.set("categories", NEARBY_CATEGORIES.map(([c]) => c).join(","));
    url.searchParams.set("filter", `rect:${bbox.west},${bbox.south},${bbox.east},${bbox.north}`);
    url.searchParams.set("limit", "60");
    url.searchParams.set("lang", language);
    url.searchParams.set("apiKey", key());
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`geoapify places ${res.status}`);
    const data = (await res.json()) as { features?: PlacesFeature[] };
    return (data.features ?? [])
      .map((f) => f.properties)
      .filter((p) => p.name)
      .map((p) => ({
        id: p.place_id,
        name: p.name!,
        icon: iconFor(p.categories),
        place: toPlace(p),
      }));
  },
};
