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

/** A food & drink business shown on the interactive map. */
export type NearbyPlace = { id: string; name: string; icon: string; place: BusinessLocation };

export type BBox = { west: number; south: number; east: number; north: number };

/** Server-side maps provider (keys never leave the server). */
export interface MapsProvider {
  name: "geoapify" | "google";
  /** True when the provider can serve map tiles + nearby places (interactive map). */
  interactive: boolean;
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
  /** Raster map tile (256px, or 512px when retina). Interactive providers only. */
  tile?(z: number, x: number, y: number, retina: boolean): Promise<Response>;
  /** Cafés, restaurants, bakeries… inside a bounding box. Interactive providers only. */
  nearby?(bbox: BBox, language: Language): Promise<NearbyPlace[]>;
}

export const TILE_ZOOM = { min: 3, max: 19 } as const;
/** Nearby places are only loaded from this zoom (keeps requests small and useful). */
export const NEARBY_MIN_ZOOM = 16;

export const STATIC_MAP = { width: 640, height: 320, scale: 2, minZoom: 3, maxZoom: 19 } as const;
