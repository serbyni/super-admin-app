import { z } from "zod";

const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

/** Location sent by the register form (hidden JSON field + editable street/zip/city). */
export const locationSchema = z.object({
  source: z.enum(["google_place", "map_pin", "coordinates"], { error: "Choose your location" }),
  place_id: opt(300),
  formatted_address: opt(300),
  street: opt(120),
  postal_code: opt(20),
  city: z.string().trim().min(1, "City is required").max(80),
  region: opt(80),
  country: opt(60),
  country_code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Choose a location on the map so we know the country"),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export type LocationInput = z.infer<typeof locationSchema>;

/**
 * Reads the location from FormData: JSON in `location` (from the map widget) merged with the
 * editable `street`, `postal_code` and `city` inputs.
 */
export function locationFromForm(formData: FormData) {
  let base: Record<string, unknown> = {};
  try {
    const raw = formData.get("location");
    base = typeof raw === "string" && raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    base = {};
  }
  const edit = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v : undefined;
  };
  return locationSchema.safeParse({
    ...base,
    street: edit("street") ?? base.street,
    postal_code: edit("postal_code") ?? base.postal_code,
    city: edit("city") ?? base.city,
  });
}
