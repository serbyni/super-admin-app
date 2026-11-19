import { MEDIA_BUCKET, mediaPath } from "@/lib/media/config";
import { ACCEPTED_IMAGE_TYPES, MediaError, fingerprint, resizeImage } from "@/lib/media/image";
import type { Db } from "../types";

/** Upload limit of the bucket (5 MB) — the original may be bigger, the stored file must not. */
const MAX_BYTES = 5 * 1024 * 1024;
/** Longest side of stored photos (shown at most ~1200px wide). */
const MAX_SIDE = 1600;

export type StoredImage = {
  /** Path in the media bucket: <cafe_id>/media/<fingerprint>.<ext>. */
  path: string;
  /** Suggested description from the file name (the owner can edit it). */
  alt: string;
  /** True when this exact photo was already stored for the café (nothing new was uploaded). */
  reused: boolean;
};

/**
 * Café media, shared by every feature (website, menu, branding). Browser side: photos are resized
 * on the device, named by the fingerprint of the ORIGINAL file and never overwritten — uploading
 * the same photo again reuses the stored file instead of making a copy.
 * Storage policies only let the café's owner write in <cafe_id>/.
 */
export class MediaService {
  constructor(private readonly db: Db) {}

  /** Throws MediaError with a message for the owner. */
  async uploadImage(cafeId: string, file: File): Promise<StoredImage> {
    if (file.type && !ACCEPTED_IMAGE_TYPES.includes(file.type))
      throw new MediaError("Use a JPG, PNG or WebP photo.");
    const [hash, { blob, ext }] = await Promise.all([
      fingerprint(file),
      resizeImage(file, MAX_SIDE),
    ]);
    if (blob.size > MAX_BYTES)
      throw new MediaError("This photo is too large, even after resizing.");
    const path = mediaPath(cafeId, hash, ext);

    const { error } = await this.db.storage
      .from(MEDIA_BUCKET)
      .upload(path, blob, { contentType: blob.type, cacheControl: "31536000", upsert: false });
    const reused = !!error && isAlreadyExists(error);
    if (error && !reused)
      throw new MediaError("Upload failed. Check your connection and try again.");

    const alt = file.name
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]+/g, " ")
      .trim()
      .slice(0, 150);
    return { path, alt, reused };
  }
}

/** Storage answers 409 / "already exists" when the file name is taken (= same content). */
function isAlreadyExists(error: unknown): boolean {
  const e = error as { statusCode?: string | number; status?: number; message?: string };
  return (
    String(e.statusCode ?? e.status ?? "") === "409" ||
    /already exists|duplicate/i.test(e.message ?? "")
  );
}
