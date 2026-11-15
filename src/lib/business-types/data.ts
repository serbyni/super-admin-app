import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type { BusinessType } from "./schema";

export const BUSINESS_TYPES_TAG = "business-types";

/** Active business types for the register form. Cached; admin edits call updateTag(BUSINESS_TYPES_TAG). */
export async function getActiveBusinessTypes(): Promise<BusinessType[]> {
  "use cache";
  cacheTag(BUSINESS_TYPES_TAG);
  cacheLife("hours");
  const { data, error } = await createPublicClient().rpc("list_business_types");
  if (error) throw new Error(`list_business_types failed: ${error.message}`);
  return (data ?? []) as BusinessType[];
}
