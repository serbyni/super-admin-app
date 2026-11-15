import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

/** Session-less client (publishable key only) for public data inside "use cache" functions. */
export function createPublicClient() {
  const env = publicEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
