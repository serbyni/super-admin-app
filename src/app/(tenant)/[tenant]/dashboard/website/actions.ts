"use server";

import { requireTenantOwner } from "@/lib/auth/guards";
import { msg } from "@/i18n/msg";
import { inputField, isDataError } from "@/lib/data/errors";
import { serverApi } from "@/lib/data/server-api";
import { websiteErrors, websiteSchema, type Website } from "@/lib/website/schema";

export type WebsiteResult =
  | { ok: true; draftUpdatedAt: string; publishedAt?: string; draft?: Website | null }
  | { ok: false; message: string; errors?: Record<string, string> };

const failed = (message: string, errors?: Record<string, string>): WebsiteResult => ({
  ok: false,
  message,
  errors,
});

async function save(slug: string, input: unknown): Promise<WebsiteResult> {
  const parsed = websiteSchema.safeParse(input);
  if (!parsed.success) return failed(msg("fieldsNeedAttention"), websiteErrors(parsed.error));
  try {
    const at = await serverApi().website.saveDraft(slug, parsed.data);
    return { ok: true, draftUpdatedAt: at };
  } catch (e) {
    if (inputField(e) === "image") return failed(msg("photoUnusable"));
    if (isDataError(e)) return failed(msg("saveFailed"));
    throw e;
  }
}

/** Saves the draft (customers don't see it). Owner only (checked here and in SQL). */
export async function saveWebsiteAction(slug: string, doc: unknown): Promise<WebsiteResult> {
  await requireTenantOwner(slug);
  return save(slug, doc);
}

/** Saves what is on screen, then publishes it. */
export async function publishWebsiteAction(slug: string, doc: unknown): Promise<WebsiteResult> {
  await requireTenantOwner(slug);
  const saved = await save(slug, doc);
  if (!saved.ok) return saved;
  try {
    const publishedAt = await serverApi().website.publish(slug);
    return { ok: true, draftUpdatedAt: saved.draftUpdatedAt, publishedAt };
  } catch (e) {
    if (isDataError(e)) return failed(msg("publishFailed"));
    throw e;
  }
}

/** Drops unpublished changes; returns the restored draft (null = back to defaults). */
export async function discardWebsiteAction(slug: string): Promise<WebsiteResult> {
  await requireTenantOwner(slug);
  try {
    const api = serverApi().website;
    await api.discardDraft(slug);
    const state = await api.get(slug);
    return { ok: true, draftUpdatedAt: state.draftUpdatedAt ?? "", draft: state.draft };
  } catch (e) {
    if (isDataError(e)) return failed(msg("discardFailed"));
    throw e;
  }
}
