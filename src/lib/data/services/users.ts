import "server-only";
import { isOwnerStatus, type OwnerStatus } from "@/lib/auth/owner-status";
import { unwrap } from "../errors";
import type { LazyDb } from "../types";

export type OwnerListItem = {
  userId: string;
  email: string;
  status: OwnerStatus;
  fullName: string | null;
  phone: string | null;
  businessName: string | null;
  businessType: string | null;
  city: string | null;
  countryCode: string | null;
  signupProvider: string;
  submittedAt: string | null;
  decidedAt: string | null;
  createdAt: string;
};

export type OwnerDetails = OwnerListItem & {
  emailConfirmed: boolean;
  locale: string;
  formattedAddress: string | null;
  street: string | null;
  postalCode: string | null;
  region: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  locationSource: string | null;
  decidedByEmail: string | null;
  rejectionReason: string | null;
};

export type OwnerStats = { pending: number; approved: number; rejected: number; total: number };

const status = (s: string): OwnerStatus => (isOwnerStatus(s) ? s : "profile_incomplete");

/** Super-admin user management (café owner applications). SQL functions enforce admin. */
export class UsersService {
  constructor(private readonly db: LazyDb) {}

  async list(filter?: OwnerStatus): Promise<OwnerListItem[]> {
    const rows = unwrap(
      "admin_list_owners",
      await (await this.db()).rpc("admin_list_owners", filter ? { p_status: filter } : {}),
    );
    return rows.map((r) => ({
      userId: r.user_id,
      email: r.email,
      status: status(r.status),
      fullName: r.full_name,
      phone: r.phone,
      businessName: r.business_name,
      businessType: r.business_type,
      city: r.city,
      countryCode: r.country_code,
      signupProvider: r.signup_provider,
      submittedAt: r.submitted_at,
      decidedAt: r.decided_at,
      createdAt: r.created_at,
    }));
  }

  async stats(): Promise<OwnerStats> {
    const [row] = unwrap("admin_owner_stats", await (await this.db()).rpc("admin_owner_stats"));
    return {
      pending: Number(row?.pending ?? 0),
      approved: Number(row?.approved ?? 0),
      rejected: Number(row?.rejected ?? 0),
      total: Number(row?.total ?? 0),
    };
  }

  async get(userId: string): Promise<OwnerDetails | null> {
    const [r] = unwrap(
      "admin_get_owner",
      await (await this.db()).rpc("admin_get_owner", { p_user_id: userId }),
    );
    if (!r) return null;
    return {
      userId: r.user_id,
      email: r.email,
      emailConfirmed: r.email_confirmed,
      status: status(r.status),
      fullName: r.full_name,
      phone: r.phone,
      businessName: r.business_name,
      businessType: r.business_type,
      city: r.city,
      countryCode: r.country_code,
      signupProvider: r.signup_provider,
      submittedAt: r.submitted_at,
      decidedAt: r.decided_at,
      createdAt: r.created_at,
      locale: r.locale,
      formattedAddress: r.formatted_address,
      street: r.street,
      postalCode: r.postal_code,
      region: r.region,
      country: r.country,
      latitude: r.latitude,
      longitude: r.longitude,
      locationSource: r.location_source,
      decidedByEmail: r.decided_by_email,
      rejectionReason: r.rejection_reason,
    };
  }

  /** Throws DataError "invalid_status" when the application is no longer pending. */
  async approve(userId: string): Promise<void> {
    unwrap(
      "admin_approve_owner",
      await (await this.db()).rpc("admin_approve_owner", { p_user_id: userId }),
    );
  }

  /** Throws DataError "invalid_status" | "invalid_reason" (10–1000 characters). */
  async decline(userId: string, reason: string): Promise<void> {
    unwrap(
      "admin_decline_owner",
      await (await this.db()).rpc("admin_decline_owner", { p_user_id: userId, p_reason: reason }),
    );
  }
}
