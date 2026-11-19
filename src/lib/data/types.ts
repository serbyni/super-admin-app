import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/** Typed Supabase client shared by the services of one request. */
export type Db = SupabaseClient<Database>;

/** Creates the client on first use (so services that never query never read cookies). */
export type LazyDb = () => Promise<Db>;

/** Result of Supabase Auth calls we show specific messages for (code = Auth error code). */
export type AuthResult = { ok: true } | { ok: false; code: string };
