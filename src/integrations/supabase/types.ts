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
      client_profiles: {
        Row: {
          a_number: string | null
          account_id: string
          address_apt: string | null
          address_city: string | null
          address_country: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          city_of_birth: string | null
          class_of_admission: string | null
          country_of_birth: string | null
          country_of_citizenship: string | null
          created_at: string
          created_by: string
          date_of_last_entry: string | null
          dob: string | null
          email: string | null
          first_name: string | null
          gender: string | null
          i94_number: string | null
          id: string
          immigration_status: string | null
          last_name: string | null
          mailing_apt: string | null
          mailing_city: string | null
          mailing_country: string | null
          mailing_same_as_physical: boolean | null
          mailing_state: string | null
          mailing_street: string | null
          mailing_zip: string | null
          marital_status: string | null
          middle_name: string | null
          mobile_phone: string | null
          notes: string | null
          passport_country: string | null
          passport_expiration: string | null
          passport_number: string | null
          phone: string | null
          place_of_last_entry: string | null
          province_of_birth: string | null
          ssn_last4: string | null
          updated_at: string
        }
        Insert: {
          a_number?: string | null
          account_id: string
          address_apt?: string | null
          address_city?: string | null
          address_country?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          city_of_birth?: string | null
          class_of_admission?: string | null
          country_of_birth?: string | null
          country_of_citizenship?: string | null
          created_at?: string
          created_by: string
          date_of_last_entry?: string | null
          dob?: string | null
          email?: string | null
          first_name?: string | null
          gender?: string | null
          i94_number?: string | null
          id?: string
          immigration_status?: string | null
          last_name?: string | null
          mailing_apt?: string | null
          mailing_city?: string | null
          mailing_country?: string | null
          mailing_same_as_physical?: boolean | null
          mailing_state?: string | null
          mailing_street?: string | null
          mailing_zip?: string | null
          marital_status?: string | null
          middle_name?: string | null
          mobile_phone?: string | null
          notes?: string | null
          passport_country?: string | null
          passport_expiration?: string | null
          passport_number?: string | null
          phone?: string | null
          place_of_last_entry?: string | null
          province_of_birth?: string | null
          ssn_last4?: string | null
          updated_at?: string
        }
        Update: {
          a_number?: string | null
          account_id?: string
          address_apt?: string | null
          address_city?: string | null
          address_country?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          city_of_birth?: string | null
          class_of_admission?: string | null
          country_of_birth?: string | null
          country_of_citizenship?: string | null
          created_at?: string
          created_by?: string
          date_of_last_entry?: string | null
          dob?: string | null
          email?: string | null
          first_name?: string | null
          gender?: string | null
          i94_number?: string | null
          id?: string
          immigration_status?: string | null
          last_name?: string | null
          mailing_apt?: string | null
          mailing_city?: string | null
          mailing_country?: string | null
          mailing_same_as_physical?: boolean | null
          mailing_state?: string | null
          mailing_street?: string | null
          mailing_zip?: string | null
          marital_status?: string | null
          middle_name?: string | null
          mobile_phone?: string | null
          notes?: string | null
          passport_country?: string | null
          passport_expiration?: string | null
          passport_number?: string | null
          phone?: string | null
          place_of_last_entry?: string | null
          province_of_birth?: string | null
          ssn_last4?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ner_accounts"
            referencedColumns: ["id"]
          },
        ]
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
      form_submissions: {
        Row: {
          account_id: string
          case_id: string | null
          client_email: string | null
          client_name: string | null
          client_profile_id: string | null
          created_at: string
          form_data: Json
          form_type: string
          form_version: string
          id: string
          notes: string | null
          share_token: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          case_id?: string | null
          client_email?: string | null
          client_name?: string | null
          client_profile_id?: string | null
          created_at?: string
          form_data?: Json
          form_type?: string
          form_version?: string
          id?: string
          notes?: string | null
          share_token?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          case_id?: string | null
          client_email?: string | null
          client_name?: string | null
          client_profile_id?: string | null
          created_at?: string
          form_data?: Json
          form_type?: string
          form_version?: string
          id?: string
          notes?: string | null
          share_token?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ner_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "client_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_client_profile_id_fkey"
            columns: ["client_profile_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
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
          attorney_address: string | null
          attorney_bar_number: string | null
          attorney_bar_state: string | null
          attorney_city: string | null
          attorney_country: string | null
          attorney_email: string | null
          attorney_fax: string | null
          attorney_name: string | null
          attorney_phone: string | null
          attorney_state: string | null
          attorney_zip: string | null
          created_at: string
          firm_name: string | null
          full_name: string | null
          id: string
          logo_url: string | null
          preparer_address: string | null
          preparer_business_name: string | null
          preparer_city: string | null
          preparer_country: string | null
          preparer_email: string | null
          preparer_fax: string | null
          preparer_name: string | null
          preparer_phone: string | null
          preparer_state: string | null
          preparer_zip: string | null
          user_id: string
        }
        Insert: {
          attorney_address?: string | null
          attorney_bar_number?: string | null
          attorney_bar_state?: string | null
          attorney_city?: string | null
          attorney_country?: string | null
          attorney_email?: string | null
          attorney_fax?: string | null
          attorney_name?: string | null
          attorney_phone?: string | null
          attorney_state?: string | null
          attorney_zip?: string | null
          created_at?: string
          firm_name?: string | null
          full_name?: string | null
          id?: string
          logo_url?: string | null
          preparer_address?: string | null
          preparer_business_name?: string | null
          preparer_city?: string | null
          preparer_country?: string | null
          preparer_email?: string | null
          preparer_fax?: string | null
          preparer_name?: string | null
          preparer_phone?: string | null
          preparer_state?: string | null
          preparer_zip?: string | null
          user_id: string
        }
        Update: {
          attorney_address?: string | null
          attorney_bar_number?: string | null
          attorney_bar_state?: string | null
          attorney_city?: string | null
          attorney_country?: string | null
          attorney_email?: string | null
          attorney_fax?: string | null
          attorney_name?: string | null
          attorney_phone?: string | null
          attorney_state?: string | null
          attorney_zip?: string | null
          created_at?: string
          firm_name?: string | null
          full_name?: string | null
          id?: string
          logo_url?: string | null
          preparer_address?: string | null
          preparer_business_name?: string | null
          preparer_city?: string | null
          preparer_country?: string | null
          preparer_email?: string | null
          preparer_fax?: string | null
          preparer_name?: string | null
          preparer_phone?: string | null
          preparer_state?: string | null
          preparer_zip?: string | null
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
      vawa_cases: {
        Row: {
          checklist_notes: Json
          checklist_progress: Json
          client_email: string | null
          client_name: string
          created_at: string
          id: string
          professional_id: string
          screener_answers: Json
          screener_result: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          checklist_notes?: Json
          checklist_progress?: Json
          client_email?: string | null
          client_name: string
          created_at?: string
          id?: string
          professional_id: string
          screener_answers?: Json
          screener_result?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          checklist_notes?: Json
          checklist_progress?: Json
          client_email?: string | null
          client_name?: string
          created_at?: string
          id?: string
          professional_id?: string
          screener_answers?: Json
          screener_result?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: []
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
      get_form_by_token: {
        Args: { _token: string }
        Returns: {
          client_email: string
          client_name: string
          form_data: Json
          form_type: string
          form_version: string
          id: string
          status: string
        }[]
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
      update_form_by_token: {
        Args: {
          _client_email?: string
          _client_name?: string
          _form_data: Json
          _status?: string
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
