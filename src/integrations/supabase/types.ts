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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      account_app_access: {
        Row: {
          account_id: string
          app_id: string
          granted_at: string
          id: string
        }
        Insert: {
          account_id: string
          app_id: string
          granted_at?: string
          id?: string
        }
        Update: {
          account_id?: string
          app_id?: string
          granted_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_app_access_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ner_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_app_access_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "hub_apps"
            referencedColumns: ["id"]
          },
        ]
      }
      account_members: {
        Row: {
          account_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["account_role"]
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["account_role"]
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["account_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_members_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ner_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_history: {
        Row: {
          checklist: Json | null
          created_at: string
          document_type: string
          file_names: string[]
          id: string
          language: string
          result_markdown: string
          share_token: string | null
          urgency_level: string | null
          user_id: string
        }
        Insert: {
          checklist?: Json | null
          created_at?: string
          document_type: string
          file_names?: string[]
          id?: string
          language?: string
          result_markdown: string
          share_token?: string | null
          urgency_level?: string | null
          user_id: string
        }
        Update: {
          checklist?: Json | null
          created_at?: string
          document_type?: string
          file_names?: string[]
          id?: string
          language?: string
          result_markdown?: string
          share_token?: string | null
          urgency_level?: string | null
          user_id?: string
        }
        Relationships: []
      }
      bulletin_sync_log: {
        Row: {
          bulletin_month: number
          bulletin_year: number
          created_at: string
          error_message: string | null
          id: string
          records_inserted: number
          status: string
        }
        Insert: {
          bulletin_month: number
          bulletin_year: number
          created_at?: string
          error_message?: string | null
          id?: string
          records_inserted?: number
          status: string
        }
        Update: {
          bulletin_month?: number
          bulletin_year?: number
          created_at?: string
          error_message?: string | null
          id?: string
          records_inserted?: number
          status?: string
        }
        Relationships: []
      }
      client_cases: {
        Row: {
          access_token: string
          beneficiary_name: string | null
          case_type: string
          client_email: string
          client_name: string
          created_at: string
          id: string
          notes: string | null
          petitioner_name: string | null
          professional_id: string
          status: string
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          access_token?: string
          beneficiary_name?: string | null
          case_type?: string
          client_email: string
          client_name: string
          created_at?: string
          id?: string
          notes?: string | null
          petitioner_name?: string | null
          professional_id: string
          status?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          access_token?: string
          beneficiary_name?: string | null
          case_type?: string
          client_email?: string
          client_name?: string
          created_at?: string
          id?: string
          notes?: string | null
          petitioner_name?: string | null
          professional_id?: string
          status?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      cspa_calculations: {
        Row: {
          approval_date: string | null
          biological_age_days: number | null
          bulletin_info: string | null
          category: string
          chargeability: string
          client_email: string
          client_name: string
          client_phone: string | null
          created_at: string
          cspa_age_years: number | null
          dob: string
          id: string
          pending_time_days: number | null
          priority_date: string
          professional_id: string | null
          qualifies: boolean | null
          visa_available_date: string | null
        }
        Insert: {
          approval_date?: string | null
          biological_age_days?: number | null
          bulletin_info?: string | null
          category: string
          chargeability: string
          client_email: string
          client_name: string
          client_phone?: string | null
          created_at?: string
          cspa_age_years?: number | null
          dob: string
          id?: string
          pending_time_days?: number | null
          priority_date: string
          professional_id?: string | null
          qualifies?: boolean | null
          visa_available_date?: string | null
        }
        Update: {
          approval_date?: string | null
          biological_age_days?: number | null
          bulletin_info?: string | null
          category?: string
          chargeability?: string
          client_email?: string
          client_name?: string
          client_phone?: string | null
          created_at?: string
          cspa_age_years?: number | null
          dob?: string
          id?: string
          pending_time_days?: number | null
          priority_date?: string
          professional_id?: string | null
          qualifies?: boolean | null
          visa_available_date?: string | null
        }
        Relationships: []
      }
      evidence_items: {
        Row: {
          caption: string | null
          case_id: string
          created_at: string
          date_is_approximate: boolean | null
          demonstrates: string | null
          event_date: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string
          form_complete: boolean | null
          id: string
          location: string | null
          notes: string | null
          participants: string | null
          platform: string | null
          source_location: string | null
          updated_at: string
          upload_order: number | null
        }
        Insert: {
          caption?: string | null
          case_id: string
          created_at?: string
          date_is_approximate?: boolean | null
          demonstrates?: string | null
          event_date?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string
          form_complete?: boolean | null
          id?: string
          location?: string | null
          notes?: string | null
          participants?: string | null
          platform?: string | null
          source_location?: string | null
          updated_at?: string
          upload_order?: number | null
        }
        Update: {
          caption?: string | null
          case_id?: string
          created_at?: string
          date_is_approximate?: boolean | null
          demonstrates?: string | null
          event_date?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string
          form_complete?: boolean | null
          id?: string
          location?: string | null
          notes?: string | null
          participants?: string | null
          platform?: string | null
          source_location?: string | null
          updated_at?: string
          upload_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "client_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_apps: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      ner_accounts: {
        Row: {
          account_name: string
          created_at: string
          ghl_contact_id: string | null
          id: string
          is_active: boolean
          max_users: number
          phone: string | null
          plan: Database["public"]["Enums"]["ner_plan"]
          updated_at: string
        }
        Insert: {
          account_name: string
          created_at?: string
          ghl_contact_id?: string | null
          id?: string
          is_active?: boolean
          max_users?: number
          phone?: string | null
          plan?: Database["public"]["Enums"]["ner_plan"]
          updated_at?: string
        }
        Update: {
          account_name?: string
          created_at?: string
          ghl_contact_id?: string | null
          id?: string
          is_active?: boolean
          max_users?: number
          phone?: string | null
          plan?: Database["public"]["Enums"]["ner_plan"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          firm_name: string | null
          full_name: string | null
          id: string
          logo_url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          firm_name?: string | null
          full_name?: string | null
          id?: string
          logo_url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          firm_name?: string | null
          full_name?: string | null
          id?: string
          logo_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tool_usage_logs: {
        Row: {
          account_id: string | null
          action: string
          created_at: string
          id: string
          metadata: Json | null
          tool_slug: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          tool_slug: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          tool_slug?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tool_usage_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ner_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      visa_bulletin: {
        Row: {
          bulletin_month: number
          bulletin_year: number
          category: string
          chargeability: string
          created_at: string
          final_action_date: string | null
          id: string
          is_current: boolean
          raw_value: string | null
          updated_at: string
        }
        Insert: {
          bulletin_month: number
          bulletin_year: number
          category: string
          chargeability: string
          created_at?: string
          final_action_date?: string | null
          id?: string
          is_current?: boolean
          raw_value?: string | null
          updated_at?: string
        }
        Update: {
          bulletin_month?: number
          bulletin_year?: number
          category?: string
          chargeability?: string
          created_at?: string
          final_action_date?: string | null
          id?: string
          is_current?: boolean
          raw_value?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_rate_limit: {
        Args: { _tool_slug: string; _user_id: string }
        Returns: Json
      }
      delete_evidence_by_token: {
        Args: { _evidence_id: string; _token: string }
        Returns: string
      }
      get_case_by_token: {
        Args: { _token: string }
        Returns: {
          beneficiary_name: string
          case_type: string
          client_name: string
          id: string
          petitioner_name: string
          status: string
        }[]
      }
      get_case_id_by_token: { Args: { _token: string }; Returns: string }
      get_evidence_by_token: {
        Args: { _token: string }
        Returns: {
          caption: string | null
          case_id: string
          created_at: string
          date_is_approximate: boolean | null
          demonstrates: string | null
          event_date: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string
          form_complete: boolean | null
          id: string
          location: string | null
          notes: string | null
          participants: string | null
          platform: string | null
          source_location: string | null
          updated_at: string
          upload_order: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "evidence_items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_shared_analysis: {
        Args: { _share_token: string }
        Returns: {
          checklist: Json
          created_at: string
          document_type: string
          file_names: string[]
          id: string
          language: string
          result_markdown: string
          urgency_level: string
        }[]
      }
      get_usage_stats: { Args: { _days?: number }; Returns: Json }
      has_account_role: {
        Args: {
          _role: Database["public"]["Enums"]["account_role"]
          _user_id: string
        }
        Returns: boolean
      }
      update_case_status_by_token: {
        Args: { _status: string; _token: string }
        Returns: undefined
      }
      update_evidence_by_token: {
        Args: {
          _caption?: string
          _demonstrates?: string
          _evidence_id: string
          _form_complete?: boolean
          _location?: string
          _notes?: string
          _participants?: string
          _platform?: string
          _token: string
        }
        Returns: undefined
      }
      user_account_id: { Args: { _user_id: string }; Returns: string }
    }
    Enums: {
      account_role: "owner" | "admin" | "member"
      ner_plan: "essential" | "professional" | "elite"
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
      account_role: ["owner", "admin", "member"],
      ner_plan: ["essential", "professional", "elite"],
    },
  },
} as const
