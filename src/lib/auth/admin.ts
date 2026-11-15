import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Use at the top of every admin data component. RPCs also enforce this server-side. */
export async function requireAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?next=/admin");
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (isAdmin !== true) redirect("/login?error=not_admin");
  return { supabase, user: data.user };
}
