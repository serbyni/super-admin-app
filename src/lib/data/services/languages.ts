import "server-only";
import { z } from "zod";
import { unwrap } from "../errors";
import type { LazyDb } from "../types";

const requestSchema = z.object({
  id: z.string(),
  locale: z.string(),
  status: z.enum(["pending", "approved", "declined"]),
  note: z.string(),
  decisionNote: z.string(),
  createdAt: z.string(),
  decidedAt: z.string().nullable(),
});
const myLanguagesSchema = z.object({
  main: z.string(),
  offered: z.array(z.string()),
  available: z.array(z.string()),
  extras: z.array(z.string()),
  supported: z.array(z.string()),
  requests: z.array(requestSchema),
});
export type MyLanguages = z.infer<typeof myLanguagesSchema>;

const adminCafeSchema = z.object({
  main: z.string(),
  offered: z.array(z.string()),
  extras: z.array(z.string()),
  supported: z.array(z.string()),
  base: z.array(z.string()),
});
export type AdminCafeLanguages = z.infer<typeof adminCafeSchema>;

export type AdminLanguageRequest = {
  id: string;
  cafeSlug: string;
  cafeName: string;
  locale: string;
  note: string;
  status: "pending" | "approved" | "declined";
  decisionNote: string;
  ownerEmail: string | null;
  createdAt: string;
  decidedAt: string | null;
};
export type LanguageRequest = z.infer<typeof requestSchema>;

/**
 * Languages of the owner's café: offered languages (main first), available ones (EN/FR/AR +
 * admin-approved extras) and requests for extra languages. Errors: DataError "invalid_input"
 * (field via inputField()) | "conflict" (a pending request for that language exists).
 */
export class LanguagesService {
  constructor(private readonly db: LazyDb) {}

  async mine(slug: string): Promise<MyLanguages> {
    const raw = unwrap(
      "get_my_languages",
      await (await this.db()).rpc("get_my_languages", { p_slug: slug }),
    );
    return myLanguagesSchema.parse(raw);
  }

  async setOffered(slug: string, locales: string[]): Promise<void> {
    unwrap(
      "set_my_languages",
      await (await this.db()).rpc("set_my_languages", { p_slug: slug, p_locales: locales }),
    );
  }

  async request(slug: string, locale: string, note: string): Promise<string> {
    return unwrap(
      "request_my_language",
      await (
        await this.db()
      ).rpc("request_my_language", { p_slug: slug, p_locale: locale, p_note: note }),
    );
  }

  /* ── Super admin ── */

  /** Requests by status (null = all), newest first. */
  async adminRequests(
    status: "pending" | "approved" | "declined" | null,
  ): Promise<AdminLanguageRequest[]> {
    const rows = unwrap(
      "admin_list_language_requests",
      await (await this.db()).rpc("admin_list_language_requests", { p_status: status }),
    );
    return rows.map((r) => ({
      id: r.id,
      cafeSlug: r.cafe_slug,
      cafeName: r.cafe_name,
      locale: r.locale,
      note: r.note,
      status: r.status as AdminLanguageRequest["status"],
      decisionNote: r.decision_note,
      ownerEmail: r.owner_email,
      createdAt: r.created_at,
      decidedAt: r.decided_at,
    }));
  }

  /** Approve (language added and offered) or decline; the owner is notified. */
  async adminDecide(id: string, approve: boolean, note: string): Promise<void> {
    unwrap(
      "admin_decide_language_request",
      await (
        await this.db()
      ).rpc("admin_decide_language_request", { p_id: id, p_approve: approve, p_note: note }),
    );
  }

  async adminCafe(slug: string): Promise<AdminCafeLanguages | null> {
    const raw = unwrap(
      "admin_get_cafe_languages",
      await (await this.db()).rpc("admin_get_cafe_languages", { p_slug: slug }),
    );
    return raw ? adminCafeSchema.parse(raw) : null;
  }

  async adminSetExtras(slug: string, locales: string[]): Promise<void> {
    unwrap(
      "admin_set_cafe_extra_locales",
      await (
        await this.db()
      ).rpc("admin_set_cafe_extra_locales", { p_slug: slug, p_locales: locales }),
    );
  }
}
