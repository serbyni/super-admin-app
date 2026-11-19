import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { publicEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers (user's session).
 * Create one per request — never keep it in module state (it carries the user's cookies).
 * App code does not call this directly: use the modules in src/lib/data.
 */
export async function createClient() {
  // Request-time only: the Supabase auth client reads the clock (Date.now()) on init, which
  // Cache Components forbid during prerendering.
  await connection();
  const env = publicEnv();
  const cookieStore = await cookies();
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component: cookies are read-only there. The proxy refreshes
            // the session, so this can be ignored.
          }
        },
      },
    },
  );
}
