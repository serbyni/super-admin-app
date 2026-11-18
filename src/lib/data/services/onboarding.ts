import "server-only";
import type { SlugProblem } from "@/lib/cafes/slug";
import type { WizardDraft } from "@/lib/onboarding/schema";
import { unwrap } from "../errors";
import type { LazyDb } from "../types";

export type OnboardingState = {
  status: "approved" | "onboarding";
  step: number;
  draft: WizardDraft;
  prefill: {
    name?: string;
    country_code?: string;
    city?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    locale?: string;
  };
  reservation: { slug: string; expires_at: string } | null;
};

export type SlugCheck =
  | { normalized: string; available: true }
  | { normalized: string; available: false; reason: SlugProblem; suggestions: string[] };

export type ProvisionInput = {
  name: string;
  slug: string;
  countryCode: string;
  city: string;
  address?: string;
  currency: string;
  timezone: string;
  locale: string;
  seed: string;
  termsVersion: string;
  dpaVersion: string;
};

/** Owner onboarding (approved / onboarding owners; the SQL functions enforce it). */
export class OnboardingService {
  constructor(private readonly db: LazyDb) {}

  async state(): Promise<OnboardingState> {
    return unwrap(
      "get_my_onboarding",
      await (await this.db()).rpc("get_my_onboarding"),
    ) as OnboardingState;
  }

  async checkSlug(slug: string): Promise<SlugCheck> {
    return unwrap(
      "check_slug",
      await (await this.db()).rpc("check_slug", { p_slug: slug }),
    ) as SlugCheck;
  }

  /** Throws DataError "unknown" with message slug_<problem> when it cannot be held. */
  async reserveSlug(slug: string): Promise<{ slug: string; expires_at: string }> {
    return unwrap(
      "reserve_slug",
      await (await this.db()).rpc("reserve_slug", { p_slug: slug }),
    ) as {
      slug: string;
      expires_at: string;
    };
  }

  async save(step: number, data: WizardDraft): Promise<void> {
    unwrap(
      "save_onboarding",
      await (await this.db()).rpc("save_onboarding", { p_step: step, p_data: data }),
    );
  }

  /** Creates the café (idempotent). Returns its id. */
  async provision(i: ProvisionInput): Promise<string> {
    return unwrap(
      "provision_cafe",
      await (
        await this.db()
      ).rpc("provision_cafe", {
        p_name: i.name,
        p_slug: i.slug,
        p_country_code: i.countryCode,
        p_city: i.city,
        p_address: i.address ?? "",
        p_currency: i.currency,
        p_timezone: i.timezone,
        p_locale: i.locale,
        p_theme: { seed: i.seed },
        p_terms_version: i.termsVersion,
        p_dpa_version: i.dpaVersion,
      }),
    );
  }
}
