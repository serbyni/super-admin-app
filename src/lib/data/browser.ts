import type { Provider } from "@supabase/supabase-js";
import { siteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";

/** Browser-only data calls (Client Components). Server code uses the other modules. */

/** Start Google/Facebook sign-in (redirects away on success). Returns false when it could not start. */
export async function startOAuthSignIn(provider: Provider): Promise<boolean> {
  const { error } = await createClient().auth.signInWithOAuth({
    provider,
    options: { redirectTo: siteUrl("/auth/callback") },
  });
  return !error;
}
