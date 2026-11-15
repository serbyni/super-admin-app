import "server-only";
import { requireAdmin } from "@/lib/auth/admin";
import type { AdminBusinessType } from "@/lib/business-types/schema";

export async function listBusinessTypesForAdmin(): Promise<AdminBusinessType[]> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_list_business_types");
  if (error) throw new Error(`admin_list_business_types failed: ${error.message}`);
  return (data ?? []) as AdminBusinessType[];
}
