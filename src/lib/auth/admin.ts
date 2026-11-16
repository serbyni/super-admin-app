import "server-only";
import { redirect } from "next/navigation";
import { isPlatformAdmin } from "@/lib/data/admins";
import { getCurrentUser } from "@/lib/data/auth";

/** Guard for admin pages and actions (redirects). The SQL functions also enforce this. */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (!(await isPlatformAdmin())) redirect("/login?error=not_admin");
  return { user };
}
