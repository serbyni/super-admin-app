import { z } from "zod";
import { phoneSchema } from "@/lib/auth/register-schema";

/*
 * Café contact details (shown later on the public menu). Social links accept what owners
 * usually paste — a full link, "facebook.com/x", "@handle" or just "handle" — and are stored
 * as one canonical https link (the database checks the same format).
 */

const FB_PATH = /^[A-Za-z0-9._/-]{1,100}$/;
const IG_HANDLE = /^[A-Za-z0-9._]{1,30}$/;

/** Path after the domain when `input` is a link to one of `hosts`, else null. */
function pathOn(input: string, hosts: string[]): string | null {
  const withScheme = /^[a-z]+:\/\//i.test(input) ? input : `https://${input}`;
  try {
    const url = new URL(withScheme);
    const host = url.hostname.toLowerCase().replace(/^(www|m|web)\./, "");
    if (!hosts.includes(host)) return null;
    return url.pathname.replace(/^\/+|\/+$/g, "");
  } catch {
    return null;
  }
}

/** A link (has a scheme, a "/" or a known domain) — otherwise a bare name / @handle. */
const looksLikeLink = (v: string) =>
  !v.startsWith("@") &&
  (/^[a-z]+:\/\//i.test(v) || v.includes("/") || /(^|\.)(facebook|fb|instagram)\.com$/i.test(v));

/** Facebook page → "https://www.facebook.com/<page>", "" for empty, null when invalid. */
export function normalizeFacebook(raw: string): string | null {
  const v = raw.trim();
  if (!v) return "";
  if (v.includes("..")) return null;
  const path = looksLikeLink(v) ? pathOn(v, ["facebook.com", "fb.com"]) : v.replace(/^@/, "");
  if (!path || !FB_PATH.test(path) || path.includes("..")) return null;
  return `https://www.facebook.com/${path}`;
}

/** Instagram account → "https://www.instagram.com/<handle>", "" for empty, null when invalid. */
export function normalizeInstagram(raw: string): string | null {
  const v = raw.trim();
  if (!v) return "";
  const handle = looksLikeLink(v) ? pathOn(v, ["instagram.com"]) : v.replace(/^@/, "");
  if (!handle || !IG_HANDLE.test(handle)) return null;
  return `https://www.instagram.com/${handle}`;
}

/** "https://www.instagram.com/lune" → "@lune" (for display). */
export function socialHandle(url: string | null | undefined): string {
  if (!url) return "";
  const path = url.replace(/^https:\/\/www\.(facebook|instagram)\.com\//, "");
  return url.includes("instagram.com") ? `@${path}` : path;
}

const social = (normalize: (v: string) => string | null, message: string) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      const out = normalize(v ?? "");
      if (out === null) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return out || undefined;
    });

/** Phone + email of the café (required) and its social pages (optional). */
export const cafeContactSchema = z.object({
  phone: phoneSchema,
  email: z.string().trim().toLowerCase().pipe(z.email("Enter the café's email address")),
  facebook: social(
    normalizeFacebook,
    "Enter a Facebook page link or name, e.g. facebook.com/yourcafe",
  ),
  instagram: social(normalizeInstagram, "Enter an Instagram link or @handle, e.g. @yourcafe"),
});
export type CafeContactInput = z.infer<typeof cafeContactSchema>;
