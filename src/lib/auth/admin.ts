import "server-only";
import { redirect } from "next/navigation";
import { serverApi } from "@/lib/data/server-api";

/** Guard for admin pages and actions (redirects). The SQL functions also enforce this. */
export async function requireAdmin() {
  const api = serverApi();
  const user = await api.auth.currentUser();
  if (!user) redirect("/login?next=/admin");
  if (!(await api.admins.isPlatformAdmin())) redirect("/login?error=not_admin");
  return { user };
}
