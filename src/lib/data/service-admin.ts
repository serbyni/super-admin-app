import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Privileged account operations (service role). Only called by trusted server code for the
 * signed-in user's own just-created account — never with ids taken from user input.
 */
export async function deleteAuthUser(userId: string): Promise<boolean> {
  const db = createServiceClient();
  if (!db) {
    console.warn("[auth] SUPABASE_SECRET_KEY missing: cannot remove an unregistered OAuth user");
    return false;
  }
  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) console.error("[auth] deleteUser failed", error.message);
  return !error;
}
