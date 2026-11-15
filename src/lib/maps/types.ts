import type { BusinessLocation } from "@/lib/location/address";

export type Language = "en" | "fr" | "ar";

/** One autocomplete suggestion. `place` is set when the provider already returns the full result. */
export type Suggestion = {
  placeId: string;
  main: string;
  secondary?: string;
  place?: BusinessLocation;
};

export type ReverseAddress = Partial<
  Pick<
    BusinessLocation,
    "formatted_address" | "street" | "postal_code" | "city" | "region" | "country" | "country_code"
  >
>;

/** Server-side maps provider (keys never leave the server). */
export interface MapsProvider {
  name: "geoapify" | "google";
  /** Attribution text that must be shown on the map image. */
  attribution: string;
  autocomplete(input: string, sessionToken: string, language: Language): Promise<Suggestion[]>;
  details(
    placeId: string,
    sessionToken: string,
    language: Language,
  ): Promise<BusinessLocation | null>;
  reverse(lat: number, lng: number, language: Language): Promise<ReverseAddress | null>;
  /** Static map at a standard (256px-tile) zoom level; providers convert if needed. */
  staticMap(lat: number, lng: number, zoom: number, marker: boolean): Promise<Response>;
}

export const STATIC_MAP = { width: 640, height: 320, scale: 2, minZoom: 3, maxZoom: 19 } as const;
