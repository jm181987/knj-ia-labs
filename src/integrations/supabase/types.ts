export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      credit_packages: {
        Row: {
          active: boolean
          created_at: string
          credits: number
          highlighted: boolean
          id: string
          name: string
          price_uyu: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          credits: number
          highlighted?: boolean
          id?: string
          name: string
          price_uyu: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          credits?: number
          highlighted?: boolean
          id?: string
          name?: string
          price_uyu?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          created_at: string
          generation_id: string | null
          id: string
          reason: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          generation_id?: string | null
          id?: string
          reason: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          generation_id?: string | null
          id?: string
          reason?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      generations: {
        Row: {
          aspect_ratio: string | null
          created_at: string
          duration: string | null
          error_message: string | null
          id: string
          image_count: number | null
          mode: string | null
          model: string | null
          negative_prompt: string | null
          parameters: Json | null
          prompt: string
          reference_image_url: string | null
          result_urls: Json | null
          status: Database["public"]["Enums"]["generation_status"]
          task_id: string | null
          type: Database["public"]["Enums"]["generation_type"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          aspect_ratio?: string | null
          created_at?: string
          duration?: string | null
          error_message?: string | null
          id?: string
          image_count?: number | null
          mode?: string | null
          model?: string | null
          negative_prompt?: string | null
          parameters?: Json | null
          prompt: string
          reference_image_url?: string | null
          result_urls?: Json | null
          status?: Database["public"]["Enums"]["generation_status"]
          task_id?: string | null
          type: Database["public"]["Enums"]["generation_type"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          aspect_ratio?: string | null
          created_at?: string
          duration?: string | null
          error_message?: string | null
          id?: string
          image_count?: number | null
          mode?: string | null
          model?: string | null
          negative_prompt?: string | null
          parameters?: Json | null
          prompt?: string
          reference_image_url?: string | null
          result_urls?: Json | null
          status?: Database["public"]["Enums"]["generation_status"]
          task_id?: string | null
          type?: Database["public"]["Enums"]["generation_type"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_uyu: number
          approved_at: string | null
          created_at: string
          credits: number
          id: string
          mp_payment_id: string | null
          mp_preference_id: string | null
          mp_response: Json | null
          package_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_uyu: number
          approved_at?: string | null
          created_at?: string
          credits: number
          id?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          mp_response?: Json | null
          package_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_uyu?: number
          approved_at?: string | null
          created_at?: string
          credits?: number
          id?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          mp_response?: Json | null
          package_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "credit_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing: {
        Row: {
          credits: number
          description: string | null
          key: string
          updated_at: string
        }
        Insert: {
          credits: number
          description?: string | null
          key: string
          updated_at?: string
        }
        Update: {
          credits?: number
          description?: string | null
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          count: number
          user_id: string
          window_start: string
        }
        Insert: {
          count?: number
          user_id: string
          window_start: string
        }
        Update: {
          count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount_uyu: number
          created_at: string
          id: string
          init_point: string | null
          last_credited_payment_id: string | null
          monthly_credits: number
          mp_preapproval_id: string | null
          mp_response: Json | null
          next_payment_date: string | null
          preapproval_plan_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_uyu?: number
          created_at?: string
          id?: string
          init_point?: string | null
          last_credited_payment_id?: string | null
          monthly_credits?: number
          mp_preapproval_id?: string | null
          mp_response?: Json | null
          next_payment_date?: string | null
          preapproval_plan_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_uyu?: number
          created_at?: string
          id?: string
          init_point?: string | null
          last_credited_payment_id?: string | null
          monthly_credits?: number
          mp_preapproval_id?: string | null
          mp_response?: Json | null
          next_payment_date?: string | null
          preapproval_plan_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          active: boolean
          created_at: string
          facebook_url: string | null
          id: string
          instagram_url: string | null
          linkedin_url: string | null
          message: string
          message_en: string | null
          message_pt: string | null
          name: string
          photo_url: string | null
          role: string | null
          role_en: string | null
          role_pt: string | null
          sort_order: number
          tiktok_url: string | null
          twitter_url: string | null
          updated_at: string
          website_url: string | null
          youtube_url: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          linkedin_url?: string | null
          message: string
          message_en?: string | null
          message_pt?: string | null
          name: string
          photo_url?: string | null
          role?: string | null
          role_en?: string | null
          role_pt?: string | null
          sort_order?: number
          tiktok_url?: string | null
          twitter_url?: string | null
          updated_at?: string
          website_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          linkedin_url?: string | null
          message?: string
          message_en?: string | null
          message_pt?: string | null
          name?: string
          photo_url?: string | null
          role?: string | null
          role_en?: string | null
          role_pt?: string | null
          sort_order?: number
          tiktok_url?: string | null
          twitter_url?: string | null
          updated_at?: string
          website_url?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_credits_system: {
        Args: { _amount: number; _reason: string; _user_id: string }
        Returns: number
      }
      check_and_increment_rate_limit: {
        Args: { _max_per_minute?: number; _user_id: string }
        Returns: boolean
      }
      cleanup_old_generations: { Args: never; Returns: number }
      consume_credits: {
        Args: { _amount: number; _generation_id?: string; _reason: string }
        Returns: number
      }
      debit_credits_for_user: {
        Args: { _amount: number; _reason: string; _user_id: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      refund_credits_for_user: {
        Args: {
          _amount: number
          _generation_id?: string
          _reason: string
          _user_id: string
        }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "user"
      generation_status: "pending" | "processing" | "completed" | "failed"
      generation_type: "video" | "image"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      generation_status: ["pending", "processing", "completed", "failed"],
      generation_type: ["video", "image"],
    },
  },
} as const
