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
  createdAt: string;
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
        "id, slug, name, status, country_code, city, address, currency, timezone, default_locale, theme, created_at",
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
      createdAt: data.created_at,
    };
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
