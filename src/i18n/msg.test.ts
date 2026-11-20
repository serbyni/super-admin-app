import { describe, expect, it } from "vitest";
import { enText } from "./en-text";
import { msg, parseMsg } from "./msg";
import { pickUiLocale } from "./config";

describe("message keys", () => {
  it("round-trips keys with values", () => {
    expect(parseMsg(msg("emailLinkSent", { email: "a@b.co" }))).toEqual({
      key: "emailLinkSent",
      values: { email: "a@b.co" },
    });
    expect(parseMsg("Plain text")).toBeNull();
    expect(enText(msg("passwordMin", { min: 10 }))).toBe("Use at least 10 characters");
  });
});

describe("pickUiLocale", () => {
  it("uses the saved choice, else the browser language, else English", () => {
    expect(pickUiLocale({ saved: "ar", acceptLanguage: "fr-FR" })).toBe("ar");
    expect(pickUiLocale({ saved: null, acceptLanguage: "de-DE,fr;q=0.8" })).toBe("fr");
    expect(pickUiLocale({ saved: "xx", acceptLanguage: "de" })).toBe("en");
  });
});
