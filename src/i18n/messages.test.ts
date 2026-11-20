import { describe, expect, it } from "vitest";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

const keys = (o: object, p = ""): string[] =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === "object" && !Array.isArray(v) ? keys(v, `${p}${k}.`) : [`${p}${k}`],
  );

describe("translations", () => {
  it("have the same keys in every language", () => {
    expect(keys(fr).sort()).toEqual(keys(en).sort());
    expect(keys(ar).sort()).toEqual(keys(en).sort());
  });
  it("have no empty texts", () => {
    for (const m of [en, fr, ar]) {
      const flat = JSON.stringify(m);
      expect(flat).not.toMatch(/:""/);
    }
  });
});
