import { CARD, svgDataUrl } from "@/lib/qr/card";

/* Browser downloads of a QR card (SVG as-is, PNG rendered at print resolution). */

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadSvg(svg: string, name: string) {
  save(new Blob([svg], { type: "image/svg+xml" }), `${name}.svg`);
}

/**
 * PNG at 3× the design size — card 1200×1680 px (sharp at ~10×14 cm), sticker 720×870 px
 * (sharp at ~5×6 cm).
 */
export async function downloadPng(
  svg: string,
  name: string,
  size: { width: number; height: number } = CARD,
  scale = 3,
): Promise<void> {
  const img = new Image();
  img.src = svgDataUrl(svg);
  await img.decode();
  const canvas = Object.assign(document.createElement("canvas"), {
    width: size.width * scale,
    height: size.height * scale,
  });
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/png"));
  if (!blob) throw new Error("PNG export failed");
  save(blob, `${name}.png`);
}

/** File-name-safe text, e.g. "Lune Bleue · T7" → "lune-bleue-t7". */
export const fileName = (...parts: string[]) =>
  parts
    .join("-")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
