import { describe, expect, it } from "vitest";
import { qrCardSvg, qrPath } from "./card";

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
