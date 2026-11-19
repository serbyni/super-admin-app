import "server-only";
import { themeSeed } from "@/lib/cafes/theme";
import { unwrap } from "../errors";
import type { LazyDb } from "../types";

export type CafeStatus = "active" | "suspended";

export type Cafe = {
  id: string;
  slug: string;
  name: string;
  status: CafeStatus;
  countryCode: string;
  city: string | null;
  address: string | null;
  currency: string;
  timezone: string;
  locale: string;
  seed: string;
  phone: string | null;
  contactEmail: string | null;
  facebook: string | null;
  instagram: string | null;
  createdAt: string;
};

/** Editable café settings (the address/slug is not changed here). */
export type CafeSettingsInput = {
  name: string;
  countryCode: string;
  city: string;
  address?: string;
  currency: string;
  timezone: string;
  locale: string;
  seed: string;
  phone: string;
  email: string;
  facebook?: string;
  instagram?: string;
};

export type CafeListItem = Pick<
  Cafe,
  "id" | "slug" | "name" | "status" | "countryCode" | "city" | "createdAt"
> & { ownerUserId: string | null; ownerEmail: string | null; ownerName: string | null };

export type CafeAdminDetails = Cafe & {
  latitude: number | null;
  longitude: number | null;
  termsVersion: string;
  dpaVersion: string;
  agreedAt: string;
  updatedAt: string;
  ownerUserId: string | null;
  ownerEmail: string | null;
  ownerName: string | null;
  ownerPhone: string | null;
  membersCount: number;
};

const status = (s: string): CafeStatus => (s === "suspended" ? "suspended" : "active");

/**
 * Cafés (tenants). `mine` reads through RLS (members only); the admin calls go through
 * security-definer SQL functions that check the platform-admin role and return platform data only.
 */
export class CafesService {
  constructor(private readonly db: LazyDb) {}

  /** The signed-in member's café with this slug, or null (not a member / no such café). */
  async mine(slug: string): Promise<Cafe | null> {
    const { data, error } = await (
      await this.db()
    )
      .from("cafes")
      .select(
        "id, slug, name, status, country_code, city, address, currency, timezone, default_locale, theme, phone, contact_email, facebook_url, instagram_url, created_at",
      )
      .eq("slug", slug)
      .maybeSingle();
    unwrap("cafes.select", { data, error });
    if (!data) return null;
    return {
      id: data.id,
      slug: data.slug,
      name: data.name,
      status: status(data.status),
      countryCode: data.country_code,
      city: data.city,
      address: data.address,
      currency: data.currency,
      timezone: data.timezone,
      locale: data.default_locale,
      seed: themeSeed(data.theme),
      phone: data.phone,
      contactEmail: data.contact_email,
      facebook: data.facebook_url,
      instagram: data.instagram_url,
      createdAt: data.created_at,
    };
  }

  /**
   * Save the settings of the caller's café (owner only — checked by update_my_cafe).
   * Throws DataError "forbidden" | "invalid_input" (field via inputField()).
   */
  async updateMine(slug: string, i: CafeSettingsInput): Promise<void> {
    unwrap(
      "update_my_cafe",
      await (
        await this.db()
      ).rpc("update_my_cafe", {
        p_slug: slug,
        p_name: i.name,
        p_country_code: i.countryCode,
        p_city: i.city,
        p_address: i.address ?? "",
        p_currency: i.currency,
        p_timezone: i.timezone,
        p_locale: i.locale,
        p_seed: i.seed,
        p_phone: i.phone,
        p_email: i.email,
        p_facebook: i.facebook,
        p_instagram: i.instagram,
      }),
    );
  }

  /** Super admin: every café (newest first, max 500). */
  async adminList(): Promise<CafeListItem[]> {
    const rows = unwrap("admin_list_cafes", await (await this.db()).rpc("admin_list_cafes"));
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      status: status(r.status),
      countryCode: r.country_code,
      city: r.city,
      createdAt: r.created_at,
      ownerUserId: r.owner_user_id,
      ownerEmail: r.owner_email,
      ownerName: r.owner_name,
    }));
  }

  /** Super admin: one café's platform record, or null when the slug does not exist. */
  async adminGet(slug: string): Promise<CafeAdminDetails | null> {
    const [r] = unwrap(
      "admin_get_cafe",
      await (await this.db()).rpc("admin_get_cafe", { p_slug: slug }),
    );
    if (!r) return null;
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      status: status(r.status),
      countryCode: r.country_code,
      city: r.city,
      address: r.address,
      latitude: r.latitude,
      longitude: r.longitude,
      currency: r.currency,
      timezone: r.timezone,
      locale: r.default_locale,
      seed: themeSeed(r.theme),
      phone: r.phone,
      contactEmail: r.contact_email,
      facebook: r.facebook_url,
      instagram: r.instagram_url,
      termsVersion: r.terms_version,
      dpaVersion: r.dpa_version,
      agreedAt: r.agreed_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      ownerUserId: r.owner_user_id,
      ownerEmail: r.owner_email,
      ownerName: r.owner_name,
      ownerPhone: r.owner_phone,
      membersCount: r.members_count,
    };
  }
}
