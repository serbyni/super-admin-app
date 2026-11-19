import { publicEnv } from "@/lib/env";

/*
 * Café media (all features: website, menu, branding). One public bucket, one folder per café:
 *   cafe-media/<cafe_id>/media/<sha256 of the original file>.<webp|jpg>
 * Files are named by their content, so the same photo is stored once per café and reused.
 * The database checks the same rule (platform.check_media_path) — keep them in sync.
 */
export const MEDIA_BUCKET = "cafe-media";
export const MEDIA_FOLDER = "media";

/** Valid stored path. `website/` = paths saved before the shared media folder (still accepted). */
export const MEDIA_PATH =
  /^[0-9a-f-]{36}\/(?:media\/[0-9a-f]{64}\.(?:webp|jpg)|website\/[A-Za-z0-9_-]{1,64}\.(?:webp|jpe?g|png))$/;

export const mediaPath = (cafeId: string, hash: string, ext: string) =>
  `${cafeId}/${MEDIA_FOLDER}/${hash}.${ext}`;

/** Public URL of a stored file (public bucket: no signed URL needed). */
export function mediaUrl(path: string): string {
  return `${publicEnv().NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}
