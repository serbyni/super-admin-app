import { publicEnv } from "@/lib/env";
import { MEDIA_BUCKET } from "./schema";

/** Public URL of a file in the café media bucket (public bucket: no signed URL needed). */
export function mediaUrl(path: string): string {
  return `${publicEnv().NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}
