/** Normalised business location, collected on the register form. */
export type BusinessLocation = {
  source: "google_place" | "map_pin" | "coordinates";
  place_id?: string;
  formatted_address?: string;
  street?: string;
  postal_code?: string;
  city?: string;
  region?: string;
  country?: string;
  country_code?: string;
  lat: number;
  lng: number;
};

/** Address component from Places API (New) `{longText, shortText}` or Geocoder `{long_name, short_name}`. */
export type RawAddressComponent = {
  types: string[];
  longText?: string | null;
  shortText?: string | null;
  long_name?: string;
  short_name?: string;
};

type Parsed = Pick<
  BusinessLocation,
  "street" | "postal_code" | "city" | "region" | "country" | "country_code"
>;

/** Extracts street / postal code / city / region / country (+ ISO code) from Google address components. */
export function parseAddressComponents(
  components: RawAddressComponent[] | undefined | null,
): Parsed {
  const find = (type: string) => components?.find((c) => c.types.includes(type));
  const long = (type: string) => {
    const c = find(type);
    return (c?.longText ?? c?.long_name ?? undefined) || undefined;
  };
  const short = (type: string) => {
    const c = find(type);
    return (c?.shortText ?? c?.short_name ?? undefined) || undefined;
  };

  const number = long("street_number");
  const route = long("route");
  const street = route ? (number ? `${number} ${route}` : route) : (long("premise") ?? undefined);
  const city =
    long("locality") ??
    long("postal_town") ??
    long("administrative_area_level_2") ??
    long("sublocality") ??
    long("administrative_area_level_1");
  const countryCode = short("country")?.toUpperCase();

  return {
    street,
    postal_code: long("postal_code"),
    city,
    region: long("administrative_area_level_1"),
    country: long("country"),
    country_code: countryCode && /^[A-Z]{2}$/.test(countryCode) ? countryCode : undefined,
  };
}

/** Round to 7 decimals (~1 cm) for storage and display. */
export function roundCoord(n: number): number {
  return Math.round(n * 1e7) / 1e7;
}
