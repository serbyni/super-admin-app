import { describe, expect, it } from "vitest";
import { MEDIA_PATH, mediaPath } from "./config";

const CAFE = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";
const HASH = "0123456789abcdef".repeat(4);

describe("media paths", () => {
  it("builds content-named paths in the café's media folder", () => {
    expect(mediaPath(CAFE, HASH, "webp")).toBe(`${CAFE}/media/${HASH}.webp`);
    expect(MEDIA_PATH.test(mediaPath(CAFE, HASH, "jpg"))).toBe(true);
  });

  it("still accepts paths saved before the shared folder", () => {
    expect(MEDIA_PATH.test(`${CAFE}/website/bc377417-0a8b-4042.webp`)).toBe(true);
  });

  it("rejects anything else", () => {
    for (const bad of [
      `${CAFE}/media/short.webp`,
      `${CAFE}/media/${HASH}.png`,
      `${CAFE}/menu/${HASH}.webp`,
      `../${CAFE}/media/${HASH}.webp`,
      `${CAFE}/media/${HASH}.webp/../x`,
    ])
      expect(MEDIA_PATH.test(bad), bad).toBe(false);
  });
});
