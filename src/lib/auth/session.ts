import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isOwnerStatus, type OwnerStatus } from "./owner-status";

/** Current user + owner status (null user when signed out, null status when not an owner). */
export async function getOwnerSession() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { supabase, user: null, status: null as OwnerStatus | null };
  const { data: status } = await supabase.rpc("get_my_owner_status");
  return { supabase, user: data.user, status: isOwnerStatus(status) ? status : null };
}
