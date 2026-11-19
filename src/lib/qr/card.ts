import QRCode from "qrcode";

/*
 * Printable QR card as ONE self-contained SVG (shown on screen, downloaded as SVG/PNG, printed).
 * Pure: no DOM, no network — the QR matrix is computed locally.
 */

export type QrCardInput = {
  /** Encoded in the QR, e.g. https://serbi.me/q/K7P2X9. */
  url: string;
  cafeName: string;
  /** Big line, e.g. "Table T7" or "Menu". */
  title: string;
  /** e.g. "Scan to order" / "Scan to see our menu". */
  subtitle: string;
  /** Short code printed under the QR (staff can type it if a scan fails). */
  code: string;
  colors: { primary: string; onPrimary: string; container: string; onContainer: string };
};

export const CARD = { width: 400, height: 560 } as const;

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

/** Truncates long text so it fits a line of the card. */
const fit = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/** QR modules as one SVG path (1 unit per module), plus its size in modules. */
export function qrPath(url: string): { d: string; size: number } {
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const { size, data } = qr.modules;
  let d = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!data[y * size + x]) continue;
      // Merge horizontal runs into one rectangle.
      let run = 1;
      while (x + run < size && data[y * size + x + run]) run++;
      d += `M${x} ${y}h${run}v1h-${run}z`;
      x += run - 1;
    }
  }
  return { d, size };
}

export function qrCardSvg(c: QrCardInput): string {
  const { width: W, height: H } = CARD;
  const { d, size } = qrPath(c.url);
  const qrBox = 260;
  const quiet = 4; // quiet zone in modules (required by scanners)
  const scale = qrBox / (size + quiet * 2);
  const qrX = (W - qrBox) / 2;
  const qrY = 150;
  const font = "'Plus Jakarta Sans', 'Segoe UI', Arial, sans-serif";
  const initial = esc(c.cafeName.trim().charAt(0).toUpperCase() || "S");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`${c.title} — ${c.subtitle}`)}">
<rect width="${W}" height="${H}" rx="28" fill="${c.colors.primary}"/>
<rect x="16" y="16" width="${W - 32}" height="${H - 32}" rx="20" fill="#ffffff"/>
<rect x="36" y="38" width="44" height="44" rx="12" fill="${c.colors.primary}"/>
<text x="58" y="68" text-anchor="middle" font-family="${font}" font-size="22" font-weight="700" fill="${c.colors.onPrimary}">${initial}</text>
<text x="92" y="60" font-family="${font}" font-size="18" font-weight="700" fill="#1e1b19">${esc(fit(c.cafeName, 24))}</text>
<text x="92" y="80" font-family="${font}" font-size="13" fill="#50453e">${esc(fit(c.subtitle, 34))}</text>
<rect x="${qrX - 8}" y="${qrY - 8}" width="${qrBox + 16}" height="${qrBox + 16}" rx="16" fill="${c.colors.container}"/>
<rect x="${qrX}" y="${qrY}" width="${qrBox}" height="${qrBox}" rx="8" fill="#ffffff"/>
<path transform="translate(${qrX + quiet * scale} ${qrY + quiet * scale}) scale(${scale})" d="${d}" fill="#000000" shape-rendering="crispEdges"/>
<text x="${W / 2}" y="${qrY + qrBox + 62}" text-anchor="middle" font-family="${font}" font-size="34" font-weight="800" fill="${c.colors.primary}">${esc(fit(c.title, 18))}</text>
<text x="${W / 2}" y="${qrY + qrBox + 92}" text-anchor="middle" font-family="${font}" font-size="13" letter-spacing="3" fill="#82746d">CODE ${esc(c.code)}</text>
<text x="${W / 2}" y="${H - 36}" text-anchor="middle" font-family="${font}" font-size="11" fill="#82746d">Powered by Serbi</text>
</svg>`;
}

export const svgDataUrl = (svg: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
