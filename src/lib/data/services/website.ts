import "server-only";
import type { Json } from "@/lib/supabase/database.types";
import { parseWebsite, type Website } from "@/lib/website/schema";
import { unwrap } from "../errors";
import type { LazyDb } from "../types";

export type WebsiteState = {
  /** null = never edited (the editor starts from defaultWebsite). */
  draft: Website | null;
  published: Website | null;
  draftUpdatedAt: string | null;
  publishedAt: string | null;
};

/**
 * Café website (owner only — every SQL function checks ownership). Customers read the published
 * document through get_public_cafe (cafe-app).
 */
export class WebsiteService {
  constructor(private readonly db: LazyDb) {}

  async get(slug: string): Promise<WebsiteState> {
    const rows = unwrap(
      "get_my_website",
      await (await this.db()).rpc("get_my_website", { p_slug: slug }),
    );
    const r = rows[0];
    return {
      draft: r ? parseWebsite(r.draft) : null,
      published: r?.published ? parseWebsite(r.published) : null,
      draftUpdatedAt: r?.draft_updated_at ?? null,
      publishedAt: r?.published_at ?? null,
    };
  }

  /** Throws DataError "forbidden" | "invalid_input" (DETAIL: website | image). Returns the save time. */
  async saveDraft(slug: string, doc: Website): Promise<string> {
    return unwrap(
      "save_my_website",
      await (
        await this.db()
      ).rpc("save_my_website", { p_slug: slug, p_draft: doc as unknown as Json }),
    );
  }

  /** Publishes the saved draft. Throws "invalid_state" when nothing was saved. */
  async publish(slug: string): Promise<string> {
    return unwrap(
      "publish_my_website",
      await (await this.db()).rpc("publish_my_website", { p_slug: slug }),
    );
  }

  async discardDraft(slug: string): Promise<void> {
    unwrap(
      "discard_my_website_draft",
      await (await this.db()).rpc("discard_my_website_draft", { p_slug: slug }),
    );
  }
}
