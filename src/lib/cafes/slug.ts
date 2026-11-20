import { z } from "zod";
import { msg } from "@/i18n/msg";

/*
 * Café address (slug) rules on the app side — instant feedback in the form and validation in
 * server actions. The DATABASE is authoritative (platform.normalize_slug / slug_problem /
 * check_slug): only it knows "taken", "held" and the blocklist. Keep this file in sync with
 * migration 20261118221902 (a parity test pins the shared cases).
 */

/** 3–30 chars, a–z 0–9 and '-', no leading/trailing '-' (and no '--', see isValidSlugFormat). */
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;
export const SLUG_MIN = 3;
export const SLUG_MAX = 30;

/** Words a café address may never be (= platform.reserved_slugs). Also: anything ending in -dev. */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "about",
  "account",
  "admin",
  "admin-staging",
  "api",
  "app",
  "assets",
  "auth",
  "billing",
  "blog",
  "cdn",
  "contact",
  "dashboard",
  "dev",
  "docs",
  "dpa",
  "forgot-password",
  "help",
  "login",
  "logout",
  "mail",
  "menu",
  "onboarding",
  "pending",
  "privacy",
  "q",
  "register",
  "reset-password",
  "rsend",
  "send",
  "serbi",
  "settings",
  "staging",
  "static",
  "status",
  "support",
  "terms",
  "test",
  "www",
]);

/** Letters `unaccent` expands to two letters (NFD alone would drop them). */
const LIGATURES: Record<string, string> = {
  ß: "ss",
  æ: "ae",
  œ: "oe",
  ø: "o",
  đ: "d",
  ð: "d",
  ł: "l",
  þ: "th",
};

/** 'Café Lune  Tunis' → 'cafe-lune-tunis' (mirror of platform.normalize_slug). */
export function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[ßæœøđðłþ]/g, (c) => LIGATURES[c] ?? c)
    .normalize("NFD")
    .replace(/\p{M}+/gu, "") // strip accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isValidSlugFormat(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && !slug.includes("--");
}

/** Problems detectable without the database ('taken' / 'held' / 'blocked' need check_slug). */
export type LocalSlugProblem = "format" | "reserved";
export type SlugProblem = LocalSlugProblem | "blocked" | "taken" | "held";

export function localSlugProblem(slug: string): LocalSlugProblem | null {
  if (!isValidSlugFormat(slug)) return "format";
  if (RESERVED_SLUGS.has(slug) || slug.endsWith("-dev")) return "reserved";
  return null;
}

/** Human message per problem (form + toasts). */
export const SLUG_MESSAGES: Record<SlugProblem, string> = {
  format: msg("slugFormat", { min: SLUG_MIN, max: SLUG_MAX }),
  reserved: msg("slugReserved"),
  blocked: msg("slugBlocked"),
  taken: msg("slugTaken"),
  held: msg("slugHeld"),
};

/** Server-action schema: normalizes, then checks the local rules. */
export const slugSchema = z
  .string()
  .transform(normalizeSlug)
  .superRefine((slug, ctx) => {
    const problem = localSlugProblem(slug);
    if (problem) ctx.addIssue({ code: "custom", message: SLUG_MESSAGES[problem] });
  });

/** Public host shown in the form while typing, e.g. cafe-lune.serbi.me (root domain from config). */
export function cafeHost(slug: string, rootDomain: string): string {
  return `${slug || "your-cafe"}.${rootDomain}`;
}
