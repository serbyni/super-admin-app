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
}
