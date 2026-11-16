import type { Provider } from "@supabase/supabase-js";
import { siteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";
import type { Db } from "./types";

/** Data calls available in Client Components (browser session). */
export class BrowserApi {
  constructor(private readonly db: Db) {}

  /** Start Google/Facebook sign-in (redirects away on success). False when it could not start. */
  async startOAuthSignIn(provider: Provider): Promise<boolean> {
    const { error } = await this.db.auth.signInWithOAuth({
      provider,
      options: { redirectTo: siteUrl("/auth/callback") },
    });
    return !error;
  }
}

/** Browser API (the browser client is a singleton inside @supabase/ssr, so this is cheap). */
export function browserApi(): BrowserApi {
  return new BrowserApi(createClient());
}
