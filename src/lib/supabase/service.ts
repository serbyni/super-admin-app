import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Service-role client (bypasses RLS). ONLY for trusted background work such as the email
 * dispatcher — never with user input deciding what it touches. Needs SUPABASE_SECRET_KEY
 * (server-only env, never NEXT_PUBLIC_). Returns null when the key is not configured.
 */
export function createServiceClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) return null;
  return createClient<Database>(publicEnv().NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
