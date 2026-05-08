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
      affiliate_clicks: {
        Row: {
          affiliate_id: string
          created_at: string
          id: string
          ip_hash: string | null
          landing_path: string | null
          referrer: string | null
          ua_hash: string | null
        }
        Insert: {
          affiliate_id: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          landing_path?: string | null
          referrer?: string | null
          ua_hash?: string | null
        }
        Update: {
          affiliate_id?: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          landing_path?: string | null
          referrer?: string | null
          ua_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_clicks_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_commissions: {
        Row: {
          affiliate_id: string
          approved_at: string | null
          commission_uyu: number
          created_at: string
          gross_amount_uyu: number
          id: string
          paid_at: string | null
          payment_id: string | null
          payout_id: string | null
          plan: string
          rate: number
          referred_user_id: string
          source_ref: string | null
          status: Database["public"]["Enums"]["commission_status"]
          subscription_id: string | null
          type: Database["public"]["Enums"]["commission_type"]
        }
        Insert: {
          affiliate_id: string
          approved_at?: string | null
          commission_uyu: number
          created_at?: string
          gross_amount_uyu: number
          id?: string
          paid_at?: string | null
          payment_id?: string | null
          payout_id?: string | null
          plan: string
          rate: number
          referred_user_id: string
          source_ref?: string | null
          status?: Database["public"]["Enums"]["commission_status"]
          subscription_id?: string | null
          type: Database["public"]["Enums"]["commission_type"]
        }
        Update: {
          affiliate_id?: string
          approved_at?: string | null
          commission_uyu?: number
          created_at?: string
          gross_amount_uyu?: number
          id?: string
          paid_at?: string | null
          payment_id?: string | null
          payout_id?: string | null
          plan?: string
          rate?: number
          referred_user_id?: string
          source_ref?: string | null
          status?: Database["public"]["Enums"]["commission_status"]
          subscription_id?: string | null
          type?: Database["public"]["Enums"]["commission_type"]
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commissions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "affiliate_payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_payouts: {
        Row: {
          affiliate_id: string
          amount_uyu: number
          approved_at: string | null
          created_at: string
          external_ref: string | null
          id: string
          method: string | null
          notes: string | null
          paid_at: string | null
          status: Database["public"]["Enums"]["payout_status"]
        }
        Insert: {
          affiliate_id: string
          amount_uyu: number
          approved_at?: string | null
          created_at?: string
          external_ref?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
        }
        Update: {
          affiliate_id?: string
          amount_uyu?: number
          approved_at?: string | null
          created_at?: string
          external_ref?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_payouts_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_referrals: {
        Row: {
          active: boolean
          affiliate_id: string
          attributed_at: string
          expires_at: string
          id: string
          ip_hash: string | null
          referred_user_id: string
        }
        Insert: {
          active?: boolean
          affiliate_id: string
          attributed_at?: string
          expires_at?: string
          id?: string
          ip_hash?: string | null
          referred_user_id: string
        }
        Update: {
          active?: boolean
          affiliate_id?: string
          attributed_at?: string
          expires_at?: string
          id?: string
          ip_hash?: string | null
          referred_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_referrals_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          approved_at: string | null
          code: string
          created_at: string
          id: string
          min_payout_uyu: number | null
          notes: string | null
          payout_details: Json | null
          payout_method: string | null
          pending_balance: number
          public_profile: boolean
          status: Database["public"]["Enums"]["affiliate_status"]
          tier: Database["public"]["Enums"]["affiliate_tier"]
          total_earned: number
          total_paid: number
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          code: string
          created_at?: string
          id?: string
          min_payout_uyu?: number | null
          notes?: string | null
          payout_details?: Json | null
          payout_method?: string | null
          pending_balance?: number
          public_profile?: boolean
          status?: Database["public"]["Enums"]["affiliate_status"]
          tier?: Database["public"]["Enums"]["affiliate_tier"]
          total_earned?: number
          total_paid?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          code?: string
          created_at?: string
          id?: string
          min_payout_uyu?: number | null
          notes?: string | null
          payout_details?: Json | null
          payout_method?: string | null
          pending_balance?: number
          public_profile?: boolean
          status?: Database["public"]["Enums"]["affiliate_status"]
          tier?: Database["public"]["Enums"]["affiliate_tier"]
          total_earned?: number
          total_paid?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
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
      email_sends: {
        Row: {
          created_at: string
          error: string | null
          id: string
          metadata: Json | null
          recipient_email: string
          recipient_user_id: string | null
          segment: string | null
          sendgrid_message_id: string | null
          sent_at: string | null
          status: string
          subject: string
          template_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          metadata?: Json | null
          recipient_email: string
          recipient_user_id?: string | null
          segment?: string | null
          sendgrid_message_id?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          template_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          metadata?: Json | null
          recipient_email?: string
          recipient_user_id?: string | null
          segment?: string | null
          sendgrid_message_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_sends_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          created_at: string
          created_by: string | null
          html: string
          id: string
          name: string
          subject: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          html: string
          id?: string
          name: string
          subject: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          html?: string
          id?: string
          name?: string
          subject?: string
          updated_at?: string
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
      _affiliate_rate: { Args: { _plan: string }; Returns: number }
      add_credits_system: {
        Args: { _amount: number; _reason: string; _user_id: string }
        Returns: number
      }
      admin_mark_payout_paid: {
        Args: { _external_ref?: string; _notes?: string; _payout_id: string }
        Returns: undefined
      }
      approve_pending_commissions: { Args: never; Returns: number }
      attribute_referral: {
        Args: {
          _ip_hash?: string
          _ref_code: string
          _referred_user_id: string
        }
        Returns: boolean
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
      record_affiliate_commission_payment: {
        Args: { _payment_id: string }
        Returns: string
      }
      record_affiliate_commission_subscription: {
        Args: {
          _amount: number
          _external_payment_id: string
          _subscription_id: string
        }
        Returns: string
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
      register_affiliate: {
        Args: { _code: string }
        Returns: {
          approved_at: string | null
          code: string
          created_at: string
          id: string
          min_payout_uyu: number | null
          notes: string | null
          payout_details: Json | null
          payout_method: string | null
          pending_balance: number
          public_profile: boolean
          status: Database["public"]["Enums"]["affiliate_status"]
          tier: Database["public"]["Enums"]["affiliate_tier"]
          total_earned: number
          total_paid: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "affiliates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_affiliate_payout: {
        Args: never
        Returns: {
          affiliate_id: string
          amount_uyu: number
          approved_at: string | null
          created_at: string
          external_ref: string | null
          id: string
          method: string | null
          notes: string | null
          paid_at: string | null
          status: Database["public"]["Enums"]["payout_status"]
        }
        SetofOptions: {
          from: "*"
          to: "affiliate_payouts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      affiliate_status: "pending" | "approved" | "rejected" | "blocked"
      affiliate_tier: "bronze" | "silver" | "gold"
      app_role: "admin" | "user"
      commission_status:
        | "pending"
        | "approved"
        | "paid"
        | "reversed"
        | "rejected"
      commission_type: "one_time" | "recurring"
      generation_status: "pending" | "processing" | "completed" | "failed"
      generation_type: "video" | "image"
      payout_status: "pending" | "approved" | "paid" | "rejected"
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
      affiliate_status: ["pending", "approved", "rejected", "blocked"],
      affiliate_tier: ["bronze", "silver", "gold"],
      app_role: ["admin", "user"],
      commission_status: [
        "pending",
        "approved",
        "paid",
        "reversed",
        "rejected",
      ],
      commission_type: ["one_time", "recurring"],
      generation_status: ["pending", "processing", "completed", "failed"],
      generation_type: ["video", "image"],
      payout_status: ["pending", "approved", "paid", "rejected"],
    },
  },
} as const
