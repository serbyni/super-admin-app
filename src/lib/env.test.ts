import { afterEach, describe, expect, it, vi } from "vitest";

const BASE = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_xxxxxxxxxxxxxxxxxxxx",
};

/** Fresh env module per case (publicEnv caches its result). */
async function load(env: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries({ ...BASE, ...env })) vi.stubEnv(k, v);
  return import("./env");
}

afterEach(() => vi.unstubAllEnvs());

describe("cafeUrl", () => {
  it("uses https and the café root domain when deployed", async () => {
    const { cafeUrl } = await load({
      NEXT_PUBLIC_SITE_URL: "https://dev.serbi.me",
      NEXT_PUBLIC_CAFE_ROOT_DOMAIN: "dev.serbi.me",
    });
    expect(cafeUrl("lune-bleue")).toBe("https://lune-bleue.dev.serbi.me");
  });

  it("keeps http and the port locally", async () => {
    const { cafeUrl } = await load({
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      NEXT_PUBLIC_CAFE_ROOT_DOMAIN: "localhost:3001",
    });
    expect(cafeUrl("lune-bleue")).toBe("http://lune-bleue.localhost:3001");
  });

  it("falls back to the site's host without a café root domain", async () => {
    const { cafeUrl } = await load({
      NEXT_PUBLIC_SITE_URL: "https://serbi.me",
      NEXT_PUBLIC_CAFE_ROOT_DOMAIN: "",
    });
    expect(cafeUrl("lune-bleue")).toBe("https://lune-bleue.serbi.me");
  });

  it("rejects a root domain with a scheme", async () => {
    const { publicEnv } = await load({
      NEXT_PUBLIC_SITE_URL: "https://serbi.me",
      NEXT_PUBLIC_CAFE_ROOT_DOMAIN: "https://serbi.me",
    });
    expect(() => publicEnv()).toThrow(/NEXT_PUBLIC_CAFE_ROOT_DOMAIN/);
  });
});
