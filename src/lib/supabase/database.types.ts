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
      admin_approve_owner: { Args: { p_user_id: string }; Returns: undefined };
      admin_decline_owner: {
        Args: { p_reason: string; p_user_id: string };
        Returns: undefined;
      };
      admin_delete_business_type: { Args: { p_id: string }; Returns: undefined };
      admin_get_owner: {
        Args: { p_user_id: string };
        Returns: {
          business_name: string;
          business_type: string;
          city: string;
          country: string;
          country_code: string;
          created_at: string;
          decided_at: string;
          decided_by_email: string;
          email: string;
          email_confirmed: boolean;
          formatted_address: string;
          full_name: string;
          latitude: number;
          locale: string;
          location_source: string;
          longitude: number;
          phone: string;
          postal_code: string;
          region: string;
          rejection_reason: string;
          signup_provider: string;
          status: string;
          street: string;
          submitted_at: string;
          user_id: string;
        }[];
      };
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
      admin_list_owners: {
        Args: { p_status?: string };
        Returns: {
          business_name: string;
          business_type: string;
          city: string;
          country_code: string;
          created_at: string;
          decided_at: string;
          email: string;
          full_name: string;
          phone: string;
          signup_provider: string;
          status: string;
          submitted_at: string;
          user_id: string;
        }[];
      };
      admin_owner_stats: {
        Args: never;
        Returns: {
          approved: number;
          pending: number;
          rejected: number;
          total: number;
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
      email_claim_deliveries: {
        Args: { p_lease_seconds?: number; p_limit?: number };
        Returns: {
          attempts: number;
          business_name: string;
          delivery_id: string;
          locale: string;
          reason: string;
          recipient_email: string;
          recipient_name: string;
          template: string;
        }[];
      };
      email_complete_delivery: {
        Args: {
          p_delivery_id: string;
          p_error?: string;
          p_provider_message_id?: string;
        };
        Returns: undefined;
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
      mark_my_notifications_read: {
        Args: { p_ids?: string[] };
        Returns: undefined;
      };
      my_notifications: {
        Args: { p_limit?: number };
        Returns: {
          created_at: string;
          data: Json;
          id: string;
          read_at: string;
          type: string;
        }[];
      };
      my_unread_notification_count: { Args: never; Returns: number };
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
