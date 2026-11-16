import "server-only";
import { getCurrentUser } from "@/lib/data/auth";
import { getMyOwnerStatus } from "@/lib/data/owners";
import type { OwnerStatus } from "./owner-status";

/** Current user + owner status (null user when signed out, null status when not an owner). */
export async function getOwnerSession() {
  const user = await getCurrentUser();
  if (!user) return { user: null, status: null as OwnerStatus | null };
  return { user, status: await getMyOwnerStatus() };
}
