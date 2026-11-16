import "server-only";
import { createClient } from "@/lib/supabase/server";
import { unwrap } from "./errors";

/** True when the signed-in user is a platform super admin. */
export async function isPlatformAdmin(): Promise<boolean> {
  const db = await createClient();
  return unwrap("is_platform_admin", await db.rpc("is_platform_admin")) === true;
}
