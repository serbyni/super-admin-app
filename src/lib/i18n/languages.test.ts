import { describe, expect, it } from "vitest";
import { cleanI18n, isContentLanguage, languageLabel } from "./languages";

describe("content languages", () => {
  it("labels languages", () => {
    expect(languageLabel("fr")).toBe("French (Français)");
    expect(languageLabel("en")).toBe("English");
    expect(languageLabel("xx")).toBe("xx");
    expect(isContentLanguage("ja")).toBe(true);
    expect(isContentLanguage("xx")).toBe(false);
  });

  it("drops empty translations", () => {
    expect(cleanI18n({ en: { name: " Latte ", description: "  " }, ar: { name: "" } })).toEqual({
      en: { name: "Latte" },
    });
  });
});
