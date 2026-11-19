import { browserApi } from "@/lib/data/browser-api";
import type { WebsiteImage } from "@/lib/website/schema";

/** Longest side after resizing; photos are shown at most ~1200px wide on the website. */
const MAX_SIDE = 1600;
const QUALITY = 0.82;
/** Upload limit of the bucket (5 MB) — the original may be bigger, the resized file must not. */
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export class UploadError extends Error {}

/** Shrinks a photo in the browser (WebP, JPEG fallback) so uploads stay small and fast. */
async function resize(file: File): Promise<{ blob: Blob; ext: "webp" | "jpg" }> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new UploadError("This file can't be read as a photo. Use JPG, PNG or WebP.");
  });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const encode = (type: string) =>
    new Promise<Blob | null>((ok) => canvas.toBlob(ok, type, QUALITY));
  const webp = await encode("image/webp");
  if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp" };
  const jpg = await encode("image/jpeg");
  if (!jpg) throw new UploadError("This photo could not be processed.");
  return { blob: jpg, ext: "jpg" };
}

/** Resizes and uploads a website photo to <cafeId>/website/; returns the stored image. */
export async function uploadWebsiteImage(cafeId: string, file: File): Promise<WebsiteImage> {
  if (file.type && !ACCEPTED.includes(file.type))
    throw new UploadError("Use a JPG, PNG or WebP photo.");
  const { blob, ext } = await resize(file);
  if (blob.size > MAX_BYTES) throw new UploadError("This photo is too large, even after resizing.");
  const path = `${cafeId}/website/${crypto.randomUUID()}.${ext}`;
  if (!(await browserApi().uploadCafeMedia(path, blob)))
    throw new UploadError("Upload failed. Check your connection and try again.");
  const alt = file.name
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .slice(0, 150);
  return { path, alt };
}
