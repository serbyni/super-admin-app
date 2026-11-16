// GENERATED from the Supabase database — do not edit by hand.
// Regenerate after every migration: `npm run db:types` (see README → Data access layer).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_delete_business_type: { Args: { p_id: string }; Returns: undefined };
      admin_list_business_types: {
        Args: never;
        Returns: {
          icon: string;
          id: string;
          is_active: boolean;
          name: Json;
          owners_count: number;
          slug: string;
          sort_order: number;
          updated_at: string;
        }[];
      };
      admin_reorder_business_types: {
        Args: { p_ids: string[] };
        Returns: undefined;
      };
      admin_save_business_type: {
        Args: {
          p_icon: string;
          p_id: string;
          p_is_active: boolean;
          p_name: Json;
          p_slug: string;
        };
        Returns: string;
      };
      complete_owner_profile: {
        Args: {
          p_business_name: string;
          p_business_type: string;
          p_full_name: string;
          p_locale: string;
          p_location: Json;
          p_phone: string;
          p_terms_version: string;
        };
        Returns: string;
      };
      get_my_owner_status: { Args: never; Returns: string };
      grant_platform_admin: { Args: { p_user_id: string }; Returns: undefined };
      is_platform_admin: { Args: never; Returns: boolean };
      list_business_types: {
        Args: never;
        Returns: {
          icon: string;
          name: Json;
          slug: string;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database["public"];
export type DbFunctions = PublicSchema["Functions"];
export type DbFunctionName = keyof DbFunctions;
export type DbArgs<F extends DbFunctionName> = DbFunctions[F]["Args"];
export type DbReturns<F extends DbFunctionName> = DbFunctions[F]["Returns"];
