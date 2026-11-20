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
      cafe_areas: {
        Row: {
          cafe_id: string;
          created_at: string;
          depth_m: number;
          id: string;
          name: string;
          sort_order: number;
          width_m: number;
        };
        Insert: {
          cafe_id: string;
          created_at?: string;
          depth_m?: number;
          id?: string;
          name: string;
          sort_order?: number;
          width_m?: number;
        };
        Update: {
          cafe_id?: string;
          created_at?: string;
          depth_m?: number;
          id?: string;
          name?: string;
          sort_order?: number;
          width_m?: number;
        };
        Relationships: [];
      };
      cafe_members: {
        Row: {
          cafe_id: string;
          created_at: string;
          role: string;
          user_id: string;
        };
        Insert: {
          cafe_id: string;
          created_at?: string;
          role: string;
          user_id: string;
        };
        Update: {
          cafe_id?: string;
          created_at?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cafe_members_cafe_id_fkey";
            columns: ["cafe_id"];
            isOneToOne: false;
            referencedRelation: "cafes";
            referencedColumns: ["id"];
          },
        ];
      };
      cafe_tables: {
        Row: {
          area_id: string;
          cafe_id: string;
          created_at: string;
          id: string;
          is_active: boolean;
          label: string;
          rotation: number;
          seats: number;
          shape: string;
          updated_at: string;
          x: number;
          y: number;
        };
        Insert: {
          area_id: string;
          cafe_id: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          label: string;
          rotation?: number;
          seats?: number;
          shape?: string;
          updated_at?: string;
          x?: number;
          y?: number;
        };
        Update: {
          area_id?: string;
          cafe_id?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          label?: string;
          rotation?: number;
          seats?: number;
          shape?: string;
          updated_at?: string;
          x?: number;
          y?: number;
        };
        Relationships: [];
      };
      cafe_websites: {
        Row: {
          cafe_id: string;
          draft: Json;
          draft_updated_at: string;
          published: Json | null;
          published_at: string | null;
          updated_by: string | null;
        };
        Insert: {
          cafe_id: string;
          draft: Json;
          draft_updated_at?: string;
          published?: Json | null;
          published_at?: string | null;
          updated_by?: string | null;
        };
        Update: {
          cafe_id?: string;
          draft?: Json;
          draft_updated_at?: string;
          published?: Json | null;
          published_at?: string | null;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cafe_websites_cafe_id_fkey";
            columns: ["cafe_id"];
            isOneToOne: true;
            referencedRelation: "cafes";
            referencedColumns: ["id"];
          },
        ];
      };
      cafes: {
        Row: {
          extra_locales: string[];
          locales: string[];
          address: string | null;
          agreed_at: string;
          city: string | null;
          contact_email: string | null;
          country_code: string;
          created_at: string;
          created_by: string | null;
          currency: string;
          default_locale: string;
          dpa_version: string;
          facebook_url: string | null;
          id: string;
          instagram_url: string | null;
          latitude: number | null;
          longitude: number | null;
          name: string;
          phone: string | null;
          slug: string;
          status: string;
          terms_version: string;
          theme: Json;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          agreed_at: string;
          city?: string | null;
          contact_email?: string | null;
          country_code: string;
          created_at?: string;
          created_by?: string | null;
          currency: string;
          default_locale?: string;
          dpa_version: string;
          facebook_url?: string | null;
          id?: string;
          instagram_url?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          name: string;
          phone?: string | null;
          slug: string;
          status?: string;
          terms_version: string;
          theme?: Json;
          timezone: string;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          agreed_at?: string;
          city?: string | null;
          contact_email?: string | null;
          country_code?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          default_locale?: string;
          dpa_version?: string;
          facebook_url?: string | null;
          id?: string;
          instagram_url?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          name?: string;
          phone?: string | null;
          slug?: string;
          status?: string;
          terms_version?: string;
          theme?: Json;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      menu_categories: {
        Row: {
          i18n: Json;
          cafe_id: string;
          created_at: string;
          id: string;
          is_visible: boolean;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          cafe_id: string;
          created_at?: string;
          id?: string;
          is_visible?: boolean;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          cafe_id?: string;
          created_at?: string;
          id?: string;
          is_visible?: boolean;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      menu_items: {
        Row: {
          i18n: Json;
          cafe_id: string;
          category_id: string;
          created_at: string;
          description: string;
          id: string;
          image: Json | null;
          is_available: boolean;
          is_featured: boolean;
          is_visible: boolean;
          name: string;
          price: number | null;
          sort_order: number;
          tags: string[];
          updated_at: string;
        };
        Insert: {
          cafe_id: string;
          category_id: string;
          created_at?: string;
          description?: string;
          id?: string;
          image?: Json | null;
          is_available?: boolean;
          is_featured?: boolean;
          is_visible?: boolean;
          name: string;
          price?: number | null;
          sort_order?: number;
          tags?: string[];
          updated_at?: string;
        };
        Update: {
          cafe_id?: string;
          category_id?: string;
          created_at?: string;
          description?: string;
          id?: string;
          image?: Json | null;
          is_available?: boolean;
          is_featured?: boolean;
          is_visible?: boolean;
          name?: string;
          price?: number | null;
          sort_order?: number;
          tags?: string[];
          updated_at?: string;
        };
        Relationships: [];
      };
      qr_codes: {
        Row: {
          cafe_id: string;
          code: string;
          created_at: string;
          retired_at: string | null;
          table_id: string | null;
        };
        Insert: {
          cafe_id: string;
          code: string;
          created_at?: string;
          retired_at?: string | null;
          table_id?: string | null;
        };
        Update: {
          cafe_id?: string;
          code?: string;
          created_at?: string;
          retired_at?: string | null;
          table_id?: string | null;
        };
        Relationships: [];
      };
      qr_scans: {
        Row: {
          cafe_id: string;
          code: string;
          day: string;
          scans: number;
        };
        Insert: {
          cafe_id: string;
          code: string;
          day: string;
          scans?: number;
        };
        Update: {
          cafe_id?: string;
          code?: string;
          day?: string;
          scans?: number;
        };
        Relationships: [];
      };
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
      admin_get_cafe: {
        Args: { p_slug: string };
        Returns: {
          address: string;
          agreed_at: string;
          city: string;
          contact_email: string;
          country_code: string;
          created_at: string;
          currency: string;
          default_locale: string;
          dpa_version: string;
          facebook_url: string;
          id: string;
          instagram_url: string;
          latitude: number;
          longitude: number;
          members_count: number;
          name: string;
          owner_email: string;
          owner_name: string;
          owner_phone: string;
          owner_user_id: string;
          phone: string;
          slug: string;
          status: string;
          terms_version: string;
          theme: Json;
          timezone: string;
          updated_at: string;
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
      admin_list_cafes: {
        Args: never;
        Returns: {
          city: string;
          country_code: string;
          created_at: string;
          id: string;
          name: string;
          owner_email: string;
          owner_name: string;
          owner_user_id: string;
          slug: string;
          status: string;
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
      check_slug: { Args: { p_slug: string }; Returns: Json };
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
          business_address: string;
          business_name: string;
          cafe_name: string;
          cafe_slug: string;
          decided_at: string;
          delivery_id: string;
          event_at: string;
          locale: string;
          payload: Json;
          reason: string;
          recipient_email: string;
          recipient_name: string;
          submitted_at: string;
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
      get_my_onboarding: { Args: never; Returns: Json };
      get_public_cafe: {
        Args: { p_slug: string };
        Returns: {
          address: string;
          city: string;
          contact_email: string;
          country_code: string;
          currency: string;
          default_locale: string;
          facebook_url: string;
          instagram_url: string;
          latitude: number;
          longitude: number;
          name: string;
          phone: string;
          slug: string;
          status: string;
          theme: Json;
          website: Json;
          locales: string[];
        }[];
      };
      get_my_website: {
        Args: { p_slug: string };
        Returns: { draft: Json; draft_updated_at: string; published: Json; published_at: string }[];
      };
      save_my_website: { Args: { p_draft: Json; p_slug: string }; Returns: string };
      publish_my_website: { Args: { p_slug: string }; Returns: string };
      discard_my_website_draft: { Args: { p_slug: string }; Returns: undefined };
      owns_cafe_folder: { Args: { p_name: string }; Returns: boolean };
      get_my_floor: { Args: { p_slug: string }; Returns: Json };
      save_my_area: {
        Args: {
          p_depth_m: number;
          p_id: string | null;
          p_name: string;
          p_slug: string;
          p_width_m: number;
        };
        Returns: string;
      };
      delete_my_area: { Args: { p_id: string; p_slug: string }; Returns: undefined };
      reorder_my_areas: { Args: { p_ids: string[]; p_slug: string }; Returns: undefined };
      save_my_table: {
        Args: {
          p_area_id: string;
          p_id: string | null;
          p_is_active: boolean;
          p_label: string;
          p_seats: number;
          p_shape: string;
          p_slug: string;
        };
        Returns: string;
      };
      save_my_layout: { Args: { p_layout: Json; p_slug: string }; Returns: undefined };
      delete_my_table: { Args: { p_id: string; p_slug: string }; Returns: undefined };
      regenerate_my_qr_code: {
        Args: { p_slug: string; p_table_id: string | null };
        Returns: string;
      };
      resolve_qr: {
        Args: { p_code: string };
        Returns: { cafe_slug: string; table_code: string; table_label: string }[];
      };
      get_public_table: { Args: { p_code: string; p_slug: string }; Returns: { label: string }[] };
      get_my_menu: { Args: { p_slug: string }; Returns: Json };
      get_public_menu: { Args: { p_slug: string }; Returns: Json };
      save_my_menu_category: {
        Args: {
          p_i18n?: Json;
          p_id: string | null;
          p_is_visible: boolean;
          p_name: string;
          p_slug: string;
        };
        Returns: string;
      };
      delete_my_menu_category: { Args: { p_id: string; p_slug: string }; Returns: undefined };
      reorder_my_menu_categories: { Args: { p_ids: string[]; p_slug: string }; Returns: undefined };
      save_my_menu_item: {
        Args: {
          p_i18n?: Json;
          p_category_id: string;
          p_description: string;
          p_id: string | null;
          p_image: Json | null;
          p_is_available: boolean;
          p_is_featured: boolean;
          p_is_visible: boolean;
          p_name: string;
          p_price: number | null;
          p_slug: string;
          p_tags: string[];
        };
        Returns: string;
      };
      set_my_menu_item_available: {
        Args: { p_available: boolean; p_id: string; p_slug: string };
        Returns: undefined;
      };
      delete_my_menu_item: { Args: { p_id: string; p_slug: string }; Returns: undefined };
      reorder_my_menu_items: {
        Args: { p_category_id: string; p_ids: string[]; p_slug: string };
        Returns: undefined;
      };
      apply_my_menu_template: { Args: { p_slug: string }; Returns: undefined };
      get_my_languages: { Args: { p_slug: string }; Returns: Json };
      set_my_languages: { Args: { p_locales: string[]; p_slug: string }; Returns: undefined };
      request_my_language: {
        Args: { p_locale: string; p_note: string; p_slug: string };
        Returns: string;
      };
      admin_list_language_requests: {
        Args: { p_status?: string | null };
        Returns: {
          cafe_name: string;
          cafe_slug: string;
          created_at: string;
          decided_at: string;
          decision_note: string;
          id: string;
          locale: string;
          note: string;
          owner_email: string;
          status: string;
        }[];
      };
      admin_decide_language_request: {
        Args: { p_approve: boolean; p_id: string; p_note: string };
        Returns: undefined;
      };
      admin_get_cafe_languages: { Args: { p_slug: string }; Returns: Json };
      admin_set_cafe_extra_locales: {
        Args: { p_locales: string[]; p_slug: string };
        Returns: undefined;
      };
      get_my_owner: {
        Args: never;
        Returns: {
          cafe_slug: string;
          locale: string;
          status: string;
        }[];
      };
      get_my_owner_status: { Args: never; Returns: string };
      set_my_ui_locale: { Args: { p_locale: string }; Returns: undefined };
      get_my_profile: {
        Args: never;
        Returns: {
          email: string;
          full_name: string;
          phone: string;
        }[];
      };
      grant_platform_admin: { Args: { p_user_id: string }; Returns: undefined };
      is_cafe_member: { Args: { p_cafe_id: string }; Returns: boolean };
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
      provision_cafe: {
        Args: {
          p_address: string;
          p_city: string;
          p_country_code: string;
          p_currency: string;
          p_dpa_version: string;
          p_email: string;
          p_facebook?: string;
          p_instagram?: string;
          p_locale: string;
          p_name: string;
          p_phone: string;
          p_slug: string;
          p_terms_version: string;
          p_theme: Json;
          p_timezone: string;
        };
        Returns: string;
      };
      reserve_slug: { Args: { p_slug: string }; Returns: Json };
      save_onboarding: {
        Args: { p_data: Json; p_step: number };
        Returns: undefined;
      };
      update_my_cafe: {
        Args: {
          p_address: string;
          p_city: string;
          p_country_code: string;
          p_currency: string;
          p_email: string;
          p_facebook?: string;
          p_instagram?: string;
          p_locale: string;
          p_name: string;
          p_phone: string;
          p_seed: string;
          p_slug: string;
          p_timezone: string;
        };
        Returns: undefined;
      };
      update_my_profile: {
        Args: { p_full_name: string; p_phone: string };
        Returns: undefined;
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
