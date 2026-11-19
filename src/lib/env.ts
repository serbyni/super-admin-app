import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  NEXT_PUBLIC_SITE_URL: z.url(),
  /**
   * Domain under which cafés get their address: <slug>.<root> (e.g. dev.serbi.me).
   * Locally the cafe-app host with its port, e.g. localhost:3001 (browsers resolve *.localhost).
   */
  NEXT_PUBLIC_CAFE_ROOT_DOMAIN: z
    .string()
    .regex(/^(?:[a-z0-9-]+\.)*(?:[a-z0-9-]+\.[a-z]{2,}|localhost)(?::\d{2,5})?$/)
    .optional(),
});

export type PublicEnv = z.infer<typeof schema>;

let cached: PublicEnv | undefined;

/**
 * Public environment, validated on first use (not at import time, so builds without
 * secrets — e.g. CI — still succeed). NEXT_PUBLIC_* values are inlined at build time.
 */
export function publicEnv(): PublicEnv {
  if (cached) return cached;
  const parsed = schema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_CAFE_ROOT_DOMAIN: process.env.NEXT_PUBLIC_CAFE_ROOT_DOMAIN || undefined,
  });
  if (!parsed.success) {
    throw new Error(
      `Missing or invalid environment variables: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}. See .env.example.`,
    );
  }
  cached = parsed.data;
  return cached;
}

/** Absolute URL on this app, e.g. siteUrl("/auth/confirm"). */
export function siteUrl(path: string): string {
  return new URL(path, publicEnv().NEXT_PUBLIC_SITE_URL).toString();
}

/** Root domain for café addresses (<slug>.<root>); falls back to the site's host. */
export function cafeRootDomain(): string {
  const env = publicEnv();
  return env.NEXT_PUBLIC_CAFE_ROOT_DOMAIN ?? new URL(env.NEXT_PUBLIC_SITE_URL).host;
}

/**
 * Public page of a café (served by cafe-app): <scheme>://<slug>.<root>. The scheme follows this
 * app's own URL, so local (http) and deployed (https) environments need no extra setting.
 */
export function cafeUrl(slug: string): string {
  const { protocol } = new URL(publicEnv().NEXT_PUBLIC_SITE_URL);
  return `${protocol}//${slug}.${cafeRootDomain()}`;
}
