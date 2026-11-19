import { describe, expect, it } from "vitest";
import { qrCardSvg, qrPath, qrStickerSvg } from "./card";

const colors = {
  primary: "#553722",
  onPrimary: "#ffffff",
  container: "#ffdcc6",
  onContainer: "#2d1604",
};

describe("QR card", () => {
  it("builds a QR matrix for the short link", () => {
    const { d, size } = qrPath("https://dev.serbi.me/q/K7P2X9");
    expect(size).toBeGreaterThanOrEqual(21);
    expect(d.startsWith("M")).toBe(true);
  });

  it("escapes café-provided text", () => {
    const svg = qrCardSvg({
      url: "https://dev.serbi.me/q/K7P2X9",
      cafeName: `Café <script>"x"</script>`,
      title: "Table T7 & co",
      subtitle: "Scan to order",
      code: "K7P2X9",
      colors,
    });
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
    expect(svg).toContain("Table T7 &amp; co");
    expect(svg).toContain("CODE K7P2X9");
  });
});

describe("logo and sticker", () => {
  const base = { url: "https://dev.serbi.me/q/K7P2X9", code: "K7P2X9", colors };

  it("puts the Serbi mark in the middle and uses high error correction", () => {
    const withLogo = qrCardSvg({
      ...base,
      cafeName: "Lune",
      title: "Table T7",
      subtitle: "Scan to order",
    });
    expect(withLogo).toContain('<image href="data:image/png;base64,');
    const without = qrCardSvg({
      ...base,
      cafeName: "Lune",
      title: "Table T7",
      subtitle: "Scan to order",
      logo: false,
    });
    expect(without).not.toContain("<image");
    // H needs more modules than M for the same link
    expect(qrPath(base.url, "H").size).toBeGreaterThan(qrPath(base.url, "M").size);
  });

  it("builds a small sticker with the escaped table name", () => {
    const svg = qrStickerSvg({ ...base, label: "T<7>" });
    expect(svg).toContain('width="240" height="290"');
    expect(svg).toContain("T&lt;7&gt;");
    expect(svg).toContain("<image");
  });
});
