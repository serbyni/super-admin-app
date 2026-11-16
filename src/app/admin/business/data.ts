import "server-only";
import { requireAdmin } from "@/lib/auth/admin";
import { adminListBusinessTypes } from "@/lib/data/business-types";
import type { AdminBusinessType } from "@/lib/business-types/schema";

/** Admin page loader: guard + list. */
export async function listBusinessTypesForAdmin(): Promise<AdminBusinessType[]> {
  await requireAdmin();
  return adminListBusinessTypes();
}
