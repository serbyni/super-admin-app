import "server-only";
import { requireAdmin } from "@/lib/auth/admin";
import { serverApi } from "@/lib/data/server-api";
import type { AdminBusinessType } from "@/lib/business-types/schema";

/** Admin page loader: guard + list. */
export async function listBusinessTypesForAdmin(): Promise<AdminBusinessType[]> {
  await requireAdmin();
  return await serverApi().businessTypes.adminList();
}
