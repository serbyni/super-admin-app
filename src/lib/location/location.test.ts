import { describe, expect, it } from "vitest";
import { parseAddressComponents, roundCoord } from "./address";
import { locationFromForm } from "./schema";

describe("parseAddressComponents", () => {
  it("parses Places API (New) components", () => {
    expect(
      parseAddressComponents([
        { types: ["street_number"], longText: "10", shortText: "10" },
        { types: ["route"], longText: "Rue de Marseille", shortText: "Rue de Marseille" },
        { types: ["locality", "political"], longText: "Tunis", shortText: "Tunis" },
        {
          types: ["administrative_area_level_1"],
          longText: "Tunis Governorate",
          shortText: "Tunis",
        },
        { types: ["country", "political"], longText: "Tunisia", shortText: "TN" },
        { types: ["postal_code"], longText: "1000", shortText: "1000" },
      ]),
    ).toEqual({
      street: "10 Rue de Marseille",
      postal_code: "1000",
      city: "Tunis",
      region: "Tunis Governorate",
      country: "Tunisia",
      country_code: "TN",
    });
  });

  it("parses Geocoder components and falls back for city", () => {
    const r = parseAddressComponents([
      { types: ["route"], long_name: "Avenue Habib Bourguiba", short_name: "Av. HB" },
      { types: ["administrative_area_level_2"], long_name: "Sousse Médina", short_name: "x" },
      { types: ["country"], long_name: "Tunisia", short_name: "tn" },
    ]);
    expect(r).toMatchObject({
      street: "Avenue Habib Bourguiba",
      city: "Sousse Médina",
      country_code: "TN",
    });
  });

  it("handles missing components", () => {
    expect(parseAddressComponents(undefined)).toEqual({
      street: undefined,
      postal_code: undefined,
      city: undefined,
      region: undefined,
      country: undefined,
      country_code: undefined,
    });
  });

  it("rounds coordinates to 7 decimals", () => {
    expect(roundCoord(36.80081234567)).toBe(36.8008123);
  });
});

describe("locationFromForm", () => {
  const form = (location: object, edits: Record<string, string> = {}) => {
    const fd = new FormData();
    fd.set("location", JSON.stringify(location));
    for (const [k, v] of Object.entries(edits)) fd.set(k, v);
    return fd;
  };

  it("merges the map JSON with edited street/zip/city", () => {
    const r = locationFromForm(
      form(
        { source: "place_search", city: "Tunis", country_code: "tn", lat: 36.8, lng: 10.18 },
        { street: "12 Rue X", postal_code: "1001", city: "Tunis Centre" },
      ),
    );
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({
      street: "12 Rue X",
      postal_code: "1001",
      city: "Tunis Centre",
      country_code: "TN",
    });
  });

  it("rejects a missing location", () => {
    const fd = new FormData();
    expect(locationFromForm(fd).success).toBe(false);
  });

  it("rejects out-of-range coordinates", () => {
    expect(
      locationFromForm(
        form({ source: "coordinates", city: "X", country_code: "TN", lat: 120, lng: 0 }),
      ).success,
    ).toBe(false);
  });

  it("accepts real city names in any script", () => {
    const base = { source: "map_pin", country_code: "TN", lat: 36.8, lng: 10.18 };
    for (const city of [
      "Tunis",
      "Sidi Bou Saïd",
      "L'Ariana",
      "Hammam-Lif",
      "صفاقس",
      "St. Julian's",
    ]) {
      expect(locationFromForm(form({ ...base, city })).success, city).toBe(true);
    }
  });

  it("rejects an email, URL or number autofilled into City", () => {
    const base = { source: "map_pin", country_code: "TN", lat: 36.8, lng: 10.18 };
    for (const city of ["raed@example.com", "https://serbi.me", "1000", "@home"]) {
      const r = locationFromForm(form({ ...base, city }));
      expect(r.success, city).toBe(false);
      expect(r.error?.issues[0]?.message).toMatch(/city name/);
    }
  });
});
