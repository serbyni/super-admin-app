import "server-only";
import { serverApi } from "@/lib/data/server-api";
import type { OwnerStatus } from "./owner-status";

/** Current user + owner status (null user when signed out, null status when not an owner). */
export async function getOwnerSession() {
  const api = serverApi();
  const user = await api.auth.currentUser();
  if (!user) return { user: null, status: null as OwnerStatus | null };
  return { user, status: await api.owners.myStatus() };
}
