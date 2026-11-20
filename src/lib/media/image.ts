/* Browser-only photo processing for uploads (canvas + Web Crypto). */

import { msg } from "@/i18n/msg";

export class MediaError extends Error {}

export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

/** SHA-256 of the file bytes (hex). The same photo always gives the same fingerprint. */
export async function fingerprint(file: Blob): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Shrinks a photo so its longest side is at most `maxSide` (WebP, JPEG fallback). */
export async function resizeImage(
  file: Blob,
  maxSide: number,
  quality = 0.82,
): Promise<{ blob: Blob; ext: "webp" | "jpg" }> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new MediaError(msg("mediaUnreadable"));
  });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const encode = (type: string) =>
    new Promise<Blob | null>((ok) => canvas.toBlob(ok, type, quality));
  const webp = await encode("image/webp");
  if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp" };
  const jpg = await encode("image/jpeg");
  if (!jpg) throw new MediaError(msg("mediaProcessFailed"));
  return { blob: jpg, ext: "jpg" };
}
