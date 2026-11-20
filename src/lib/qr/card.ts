import QRCode from "qrcode";
import { QR_LOGO } from "./logo";

/*
 * QR images as self-contained SVGs (shown on screen, downloaded as SVG/PNG, printed):
 *   · CARD    — large card (café, "Table T7", code) for stands and menus;
 *   · STICKER — small QR + table name, for stickers on tables.
 * The Serbi mark sits in the middle of the code; error correction H (≈30 % recoverable) keeps it
 * scannable with the logo covering ≈5 % of the area. Pure: no DOM, no network.
 */

export type QrColors = {
  primary: string;
  onPrimary: string;
  container: string;
  onContainer: string;
};

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
  colors: QrColors;
  /** Brand mark in the middle of the code (default true). */
  logo?: boolean;
  /** Small line at the bottom (default "Powered by Serbi"; the café's language when printed). */
  footer?: string;
};

export type QrStickerInput = Pick<QrCardInput, "url" | "code" | "colors" | "logo"> & {
  /** Short label under the code, e.g. "T7" or "Menu". */
  label: string;
};

/** Design sizes (SVG units = CSS px). */
export const CARD = { width: 400, height: 560 } as const;
export const STICKER = { width: 240, height: 290 } as const;

const FONT = "'Plus Jakarta Sans', 'Segoe UI', Arial, sans-serif";

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

/** Truncates long text so it fits a line. */
const fit = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/** QR modules as one SVG path (1 unit per module), plus its size in modules. */
export function qrPath(url: string, level: "M" | "H" = "M"): { d: string; size: number } {
  const qr = QRCode.create(url, { errorCorrectionLevel: level });
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

/** The QR code itself (white square incl. quiet zone) at (x, y), `box` wide; optional logo. */
function qrBlock(url: string, x: number, y: number, box: number, logo: boolean): string {
  const { d, size } = qrPath(url, logo ? "H" : "M");
  const quiet = 4; // quiet zone in modules (required by scanners)
  const scale = box / (size + quiet * 2);
  let out = `<rect x="${x}" y="${y}" width="${box}" height="${box}" rx="${box * 0.03}" fill="#ffffff"/>
<path transform="translate(${x + quiet * scale} ${y + quiet * scale}) scale(${scale})" d="${d}" fill="#000000" shape-rendering="crispEdges"/>`;
  if (logo) {
    const l = box * 0.22; // logo backing ≈ 22 % of the width
    const lx = x + (box - l) / 2;
    const ly = y + (box - l) / 2;
    const pad = l * 0.08;
    out += `
<rect x="${lx}" y="${ly}" width="${l}" height="${l}" rx="${l * 0.22}" fill="#ffffff"/>
<image href="${QR_LOGO}" x="${lx + pad}" y="${ly + pad}" width="${l - 2 * pad}" height="${l - 2 * pad}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  return out;
}

export function qrCardSvg(c: QrCardInput): string {
  const { width: W, height: H } = CARD;
  const qrBox = 260;
  const qrX = (W - qrBox) / 2;
  const qrY = 150;
  const initial = esc(c.cafeName.trim().charAt(0).toUpperCase() || "S");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`${c.title} — ${c.subtitle}`)}">
<rect width="${W}" height="${H}" rx="28" fill="${c.colors.primary}"/>
<rect x="16" y="16" width="${W - 32}" height="${H - 32}" rx="20" fill="#ffffff"/>
<rect x="36" y="38" width="44" height="44" rx="12" fill="${c.colors.primary}"/>
<text x="58" y="68" text-anchor="middle" font-family="${FONT}" font-size="22" font-weight="700" fill="${c.colors.onPrimary}">${initial}</text>
<text x="92" y="60" font-family="${FONT}" font-size="18" font-weight="700" fill="#1e1b19">${esc(fit(c.cafeName, 24))}</text>
<text x="92" y="80" font-family="${FONT}" font-size="13" fill="#50453e">${esc(fit(c.subtitle, 34))}</text>
<rect x="${qrX - 8}" y="${qrY - 8}" width="${qrBox + 16}" height="${qrBox + 16}" rx="16" fill="${c.colors.container}"/>
${qrBlock(c.url, qrX, qrY, qrBox, c.logo ?? true)}
<text x="${W / 2}" y="${qrY + qrBox + 62}" text-anchor="middle" font-family="${FONT}" font-size="34" font-weight="800" fill="${c.colors.primary}">${esc(fit(c.title, 18))}</text>
<text x="${W / 2}" y="${qrY + qrBox + 92}" text-anchor="middle" font-family="${FONT}" font-size="13" letter-spacing="3" fill="#82746d">CODE ${esc(c.code)}</text>
<text x="${W / 2}" y="${H - 36}" text-anchor="middle" font-family="${FONT}" font-size="11" fill="#82746d">${esc(c.footer ?? "Powered by Serbi")}</text>
</svg>`;
}

/** Small sticker: the code with a thin café-coloured frame and the table name under it. */
export function qrStickerSvg(s: QrStickerInput): string {
  const { width: W, height: H } = STICKER;
  const box = 208;
  const x = (W - box) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`QR code ${s.label}`)}">
<rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="18" fill="#ffffff" stroke="${s.colors.primary}" stroke-width="3"/>
${qrBlock(s.url, x, 14, box, s.logo ?? true)}
<text x="${W / 2}" y="${14 + box + 34}" text-anchor="middle" font-family="${FONT}" font-size="26" font-weight="800" fill="${s.colors.primary}">${esc(fit(s.label, 14))}</text>
<text x="${W / 2}" y="${H - 14}" text-anchor="middle" font-family="${FONT}" font-size="10" letter-spacing="2" fill="#82746d">${esc(s.code)}</text>
</svg>`;
}

export const svgDataUrl = (svg: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
