import type { BusinessLocation } from "./address";

/** Rebuild the picker state from values echoed back after a failed submit. */
export function initialLocation(
  values?: Record<string, string>,
): Partial<BusinessLocation> | undefined {
  if (!values?.location) return undefined;
  try {
    const base = JSON.parse(values.location) as Partial<BusinessLocation>;
    return {
      ...base,
      street: values.street ?? base.street,
      postal_code: values.postal_code ?? base.postal_code,
      city: values.city ?? base.city,
    };
  } catch {
    return undefined;
  }
}
