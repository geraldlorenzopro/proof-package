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
          max_seats: number
        }
        Insert: {
          account_id: string
          app_id: string
          granted_at?: string
          id?: string
          max_seats?: number
        }
        Update: {
          account_id?: string
          app_id?: string
          granted_at?: string
          id?: string
          max_seats?: number
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
          custom_permissions: Json | null
          id: string
          permissions: Json | null
          role: Database["public"]["Enums"]["account_role"]
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          custom_permissions?: Json | null
          id?: string
          permissions?: Json | null
          role?: Database["public"]["Enums"]["account_role"]
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          custom_permissions?: Json | null
          id?: string
          permissions?: Json | null
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
      active_case_types: {
        Row: {
          account_id: string
          case_type: string
          created_at: string | null
          description: string | null
          display_name: string
          icon: string | null
          id: string
          is_active: boolean | null
          is_custom: boolean | null
          main_form: string | null
          sort_order: number | null
        }
        Insert: {
          account_id: string
          case_type: string
          created_at?: string | null
          description?: string | null
          display_name: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_custom?: boolean | null
          main_form?: string | null
          sort_order?: number | null
        }
        Update: {
          account_id?: string
          case_type?: string
          created_at?: string | null
          description?: string | null
          display_name?: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_custom?: boolean | null
          main_form?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "active_case_types_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ner_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_sessions: {
        Row: {
          account_id: string
          agent_slug: string
          case_id: string | null
          completed_at: string | null
          created_at: string | null
          credits_used: number | null
          error_message: string | null
          id: string
          input_data: Json | null
          model_used: string | null
          output_data: Json | null
          output_text: string | null
          started_at: string | null
          status: string | null
          tokens_used: number | null
          triggered_by: string
        }
        Insert: {
          account_id: string
          agent_slug: string
          case_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          credits_used?: number | null
          error_message?: string | null
          id?: string
          input_data?: Json | null
          model_used?: string | null
          output_data?: Json | null
          output_text?: string | null
          started_at?: string | null
          status?: string | null
          tokens_used?: number | null
          triggered_by: string
        }
        Update: {
          account_id?: string
          agent_slug?: string
          case_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          credits_used?: number | null
          error_message?: string | null
          id?: string
          input_data?: Json | null
          model_used?: string | null
          output_data?: Json | null
          output_text?: string | null
          started_at?: string | null
          status?: string | null
          tokens_used?: number | null
          triggered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_sessions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ner_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_sessions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "client_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          auto_trigger: boolean | null
          available_plans: string[] | null
          category: string | null
          color: string | null
          compatible_case_types: string[] | null
          created_at: string | null
          credit_cost: number
          description: string
          edge_function: string
          emoji: string
          id: string
          is_active: boolean | null
          is_beta: boolean | null
          max_tokens: number | null
          model: string
          name: string
          personality: string
          slug: string
          sort_order: number | null
          title: string
          trigger_on: string[] | null
        }
        Insert: {
          auto_trigger?: boolean | null
          available_plans?: string[] | null
          category?: string | null
          color?: string | null
          compatible_case_types?: string[] | null
          created_at?: string | null
          credit_cost?: number
          description: string
          edge_function: string
          emoji: string
          id?: string
          is_active?: boolean | null
          is_beta?: boolean | null
          max_tokens?: number | null
          model?: string
          name: string
          personality: string
          slug: string
          sort_order?: number | null
          title: string
          trigger_on?: string[] | null
        }
        Update: {
          auto_trigger?: boolean | null
          available_plans?: string[] | null
          category?: string | null
          color?: string | null
          compatible_case_types?: string[] | null
          created_at?: string | null
          credit_cost?: number
          description?: string
          edge_function?: string
          emoji?: string
          id?: string
          is_active?: boolean | null
          is_beta?: boolean | null
          max_tokens?: number | null
          model?: string
          name?: string
          personality?: string
          slug?: string
          sort_order?: number | null
          title?: string
          trigger_on?: string[] | null
        }
        Relationships: []
      }
      ai_credit_transactions: {
        Row: {
          account_id: string
          agent_slug: string | null
          amount: number
          balance_after: number
          case_id: string | null
          created_at: string | null
          description: string | null
          id: string
          session_id: string | null
          type: string
        }
        Insert: {
          account_id: string
          agent_slug?: string | null
          amount: number
          balance_after: number
          case_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          session_id?: string | null
          type: string
        }
        Update: {
          account_id?: string
          agent_slug?: string | null
          amount?: number
          balance_after?: number
          case_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          session_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_credit_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ner_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_credit_transactions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "client_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_credit_transactions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_credits: {
        Row: {
          account_id: string
          balance: number | null
          created_at: string | null
          id: string
          last_updated: string | null
          monthly_allowance: number | null
          reset_date: string | null
          rollover_balance: number | null
          used_this_month: number | null
        }
        Insert: {
          account_id: string
          balance?: number | null
          created_at?: string | null
          id?: string
          last_updated?: string | null
          monthly_allowance?: number | null
          reset_date?: string | null
          rollover_balance?: number | null
          used_this_month?: number | null
        }
        Update: {
          account_id?: string
          balance?: number | null
          created_at?: string | null
          id?: string
          last_updated?: string | null
          monthly_allowance?: number | null
          reset_date?: string | null
          rollover_balance?: number | null
          used_this_month?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_credits_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
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
      app_active_sessions: {
        Row: {
          account_id: string
          app_id: string
          created_at: string
          id: string
          last_heartbeat: string
          user_id: string
        }
        Insert: {
          account_id: string
          app_id: string
          created_at?: string
          id?: string
          last_heartbeat?: string
          user_id: string
        }
        Update: {
          account_id?: string
          app_id?: string
          created_at?: string
          id?: string
          last_heartbeat?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_active_sessions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ner_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_active_sessions_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "hub_apps"
            referencedColumns: ["id"]
          },
        ]
      }
      app_role_access: {
        Row: {
          account_id: string
          app_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["account_role"]
        }
        Insert: {
          account_id: string
          app_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["account_role"]
        }
        Update: {
          account_id?: string
          app_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["account_role"]
        }
        Relationships: [
          {
            foreignKeyName: "app_role_access_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ner_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_role_access_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "hub_apps"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          account_id: string
          appointment_date: string
          appointment_datetime: string | null
          appointment_time: string | null
          appointment_type: string | null
          case_id: string | null
          client_email: string | null
          client_name: string
          client_phone: string | null
          client_profile_id: string | null
          consultation_id: string | null
          converted_to_case: boolean | null
          created_at: string
          ghl_appointment_id: string | null
          ghl_contact_id: string | null
          id: string
          intake_session_id: string | null
          notes: string | null
          pre_intake_completed: boolean | null
          pre_intake_data: Json | null
          pre_intake_sent: boolean | null
          pre_intake_token: string | null
          status: string
          updated_at: string
        }
        Insert: {
          account_id: string
          appointment_date: string
          appointment_datetime?: string | null
          appointment_time?: string | null
          appointment_type?: string | null
          case_id?: string | null
          client_email?: string | null
          client_name: string
          client_phone?: string | null
          client_profile_id?: string | null
          consultation_id?: string | null
          converted_to_case?: boolean | null
          created_at?: string
          ghl_appointment_id?: string | null
          ghl_contact_id?: string | null
          id?: string
          intake_session_id?: string | null
          notes?: string | null
          pre_intake_completed?: boolean | null
          pre_intake_data?: Json | null
          pre_intake_sent?: boolean | null
          pre_intake_token?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          appointment_date?: string
          appointment_datetime?: string | null
          appointment_time?: string | null
          appointment_type?: string | null
          case_id?: string | null
          client_email?: string | null
          client_name?: string
          client_phone?: string | null
          client_profile_id?: string | null
          consultation_id?: string | null
          converted_to_case?: boolean | null
          created_at?: string
          ghl_appointment_id?: string | null
          ghl_contact_id?: string | null
          id?: string
          intake_session_id?: string | null
          notes?: string | null
          pre_intake_completed?: boolean | null
          pre_intake_data?: Json | null
          pre_intake_sent?: boolean | null
          pre_intake_token?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ner_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "client_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_profile_id_fkey"
            columns: ["client_profile_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_intake_session_id_fkey"
            columns: ["intake_session_id"]
            isOneToOne: false
            referencedRelation: "intake_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          account_id: string
          action: string
          created_at: string
          entity_id: string | null
          entity_label: string | null
          entity_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          user_display_name: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          action: string
          created_at?: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_display_name?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_display_name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ner_accounts"
            referencedColumns: ["id"]
          },
        ]
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
      case_deadlines: {
        Row: {
          account_id: string
          case_id: string | null
          case_type: string
          client_name: string
          created_at: string
          created_by: string
          deadline_date: string
          deadline_type: string
          id: string
          notes: string | null
          receipt_number: string | null
          source_analysis_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          account_id: string
          case_id?: string | null
          case_type?: string
          client_name: string
          created_at?: string
          created_by: string
          deadline_date: string
          deadline_type: string
          id?: string
          notes?: string | null
          receipt_number?: string | null
          source_analysis_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          case_id?: string | null
          case_type?: string
          client_name?: string
          created_at?: string
          created_by?: string
          deadline_date?: string
          deadline_type?: string
          id?: string
          notes?: string | null
          receipt_number?: string | null
          source_analysis_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_deadlines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ner_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_deadlines_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "client_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_deadlines_source_analysis_id_fkey"
            columns: ["source_analysis_id"]
            isOneToOne: false
            referencedRelation: "analysis_history"
            referencedColumns: ["id"]
          },
        ]
      }
      case_documents: {
        Row: {
          account_id: string
          case_id: string
          category: string | null
          created_at: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          uploaded_by: string
          uploaded_by_name: string | null
        }
        Insert: {
          account_id: string
          case_id: string
          category?: string | null
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          uploaded_by: string
          uploaded_by_name?: string | null
        }
        Update: {
          account_id?: string
          case_id?: string
          category?: string | null
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          uploaded_by?: string
          uploaded_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_documents_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ner_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "client_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_forms: {
        Row: {
          account_id: string
          approved_date: string | null
          case_id: string
          created_at: string
          denied_date: string | null
          filed_date: string | null
          form_type: string
          id: string
          notes: string | null
          receipt_date: string | null
          receipt_number: string | null
          sort_order: number | null
          status: string
          updated_at: string
        }
        Insert: {
          account_id: string
          approved_date?: string | null
          case_id: string
          created_at?: string
          denied_date?: string | null
          filed_date?: string | null
          form_type: string
          id?: string
          notes?: string | null
          receipt_date?: string | null
          receipt_number?: string | null
          sort_order?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          approved_date?: string | null
          case_id?: string
          created_at?: string
          denied_date?: string | null
          filed_date?: string | null
          form_type?: string
          id?: string
          notes?: string | null
          receipt_date?: string | null
          receipt_number?: string | null
          sort_order?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_forms_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ner_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_forms_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "client_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_notes: {
        Row: {
          account_id: string
          author_id: string
          author_name: string | null
          case_id: string
          content: string
          created_at: string
          id: string
          is_pinned: boolean
          note_type: string
        }
        Insert: {
          account_id: string
          author_id: string
          author_name?: string | null
          case_id: string
          content: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          note_type?: string
        }
        Update: {
          account_id?: string
          author_id?: string
          author_name?: string | null
          case_id?: string
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          note_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_notes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ner_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "client_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_questionnaire_answers: {
        Row: {
          account_id: string
          case_id: string
          created_at: string
          field_key: string
          id: string
          updated_at: string
          updated_by: string | null
          value: string | null
        }
        Insert: {
          account_id: string
          case_id: string
          created_at?: string
          field_key: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          account_id?: string
          case_id?: string
          created_at?: string
          field_key?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_questionnaire_answers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ner_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_questionnaire_answers_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "client_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_questionnaire_answers_field_key_fkey"
            columns: ["field_key"]
            isOneToOne: false
            referencedRelation: "form_field_registry"
            referencedColumns: ["field_key"]
          },
        ]
      }
      case_stage_history: {
        Row: {
          account_id: string
          case_id: string
          changed_by: string
          changed_by_name: string | null
          created_at: string
          from_stage: string | null
          id: string
          note: string | null
          to_stage: string
        }
        Insert: {
          account_id: string
          case_id: string
          changed_by: string
          changed_by_name?: string | null
          created_at?: string
          from_stage?: string | null
          id?: string
          note?: string | null
          to_stage: string
        }
        Update: {
          account_id?: string
          case_id?: string
          changed_by?: string
          changed_by_name?: string | null
          created_at?: string
          from_stage?: string | null
          id?: string
          note?: string | null
          to_stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_stage_history_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ner_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_stage_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "client_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_tag_definitions: {
        Row: {
          category: string
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          relevant_case_types: string[] | null
          relevant_stages: string[] | null
          sort_order: number | null
          subcategory: string | null
          tag_key: string
          tag_label: string
        }
        Insert: {
          category: string
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          relevant_case_types?: string[] | null
          relevant_stages?: string[] | null
          sort_order?: number | null
          subcategory?: string | null
          tag_key: string
          tag_label: string
        }
        Update: {
          category?: string
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          relevant_case_types?: string[] | null
          relevant_stages?: string[] | null
          sort_order?: number | null
          subcategory?: string | null
          tag_key?: string
          tag_label?: string
        }
        Relationships: []
      }
      case_tags: {
        Row: {
          account_id: string
          added_by: string
          added_by_name: string | null
          case_id: string
          created_at: string
          id: string
          removed_at: string | null
          removed_by: string | null
          tag: string
        }
        Insert: {
          account_id: string
          added_by: string
          added_by_name?: string | null
          case_id: string
          created_at?: string
          id?: string
          removed_at?: string | null
          removed_by?: string | null
          tag: string
        }
        Update: {
          account_id?: string
          added_by?: string
          added_by_name?: string | null
          case_id?: string
          created_at?: string
          id?: string
          removed_at?: string | null
          removed_by?: string | null
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_tags_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ner_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_tags_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "client_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_tasks: {
        Row: {
          account_id: string
          assigned_to: string | null
          assigned_to_name: string | null
          case_id: string
          completed_at: string | null
          created_at: string
          created_by: string
          created_by_name: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          account_id: string
          assigned_to?: string | null
          assigned_to_name?: string | null
          case_id: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          created_by_name?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          assigned_to?: string | null
          assigned_to_name?: string | null
          case_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          created_by_name?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_tasks_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ner_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "client_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      client_cases: {
        Row: {
          access_token: string
          account_id: string | null
          alien_number: string | null
          assigned_to: string | null
          ball_in_court: string | null
          beneficiary_country: string | null
          beneficiary_name: string | null
          cas_anio_nacimiento: string | null
          cas_apellido: string | null
          cas_interview_date: string | null
          cas_interview_time: string | null
          cas_pr_seguridad: string | null
          case_roles: Json | null
          case_tags_array: string[] | null
          case_type: string
          client_email: string
          client_name: string
          client_profile_id: string | null
          co_sponsor_name: string | null
          created_at: string
          custom_fields: Json | null
          drive_folder_id: string | null
          drive_folder_url: string | null
          emb_interview_date: string | null
          emb_interview_time: string | null
          file_number: string | null
          household_members: Json | null
          id: string
          interview_city: string | null
          interview_date: string | null
          interview_time: string | null
          interview_type: string | null
          notes: string | null
          nvc_cas_email: string | null
          nvc_cas_password: string | null
          nvc_case_number: string | null
          nvc_ds260_code: string | null
          nvc_invoice_id: string | null
          petitioner_name: string | null
          pipeline_stage: string | null
          priority_date: string | null
          process_stage: string | null
          process_type: string | null
          professional_id: string
          stage_entered_at: string | null
          status: string
          updated_at: string
          uscis_email: string | null
          uscis_password: string | null
          uscis_receipt_numbers: Json | null
          uscis_recovery_codes: string | null
          visa_category: string | null
          webhook_url: string | null
        }
        Insert: {
          access_token?: string
          account_id?: string | null
          alien_number?: string | null
          assigned_to?: string | null
          ball_in_court?: string | null
          beneficiary_country?: string | null
          beneficiary_name?: string | null
          cas_anio_nacimiento?: string | null
          cas_apellido?: string | null
          cas_interview_date?: string | null
          cas_interview_time?: string | null
          cas_pr_seguridad?: string | null
          case_roles?: Json | null
          case_tags_array?: string[] | null
          case_type?: string
          client_email: string
          client_name: string
          client_profile_id?: string | null
          co_sponsor_name?: string | null
          created_at?: string
          custom_fields?: Json | null
          drive_folder_id?: string | null
          drive_folder_url?: string | null
          emb_interview_date?: string | null
          emb_interview_time?: string | null
          file_number?: string | null
          household_members?: Json | null
          id?: string
          interview_city?: string | null
          interview_date?: string | null
          interview_time?: string | null
          interview_type?: string | null
          notes?: string | null
          nvc_cas_email?: string | null
          nvc_cas_password?: string | null
          nvc_case_number?: string | null
          nvc_ds260_code?: string | null
          nvc_invoice_id?: string | null
          petitioner_name?: string | null
          pipeline_stage?: string | null
          priority_date?: string | null
          process_stage?: string | null
          process_type?: string | null
          professional_id: string
          stage_entered_at?: string | null
          status?: string
          updated_at?: string
          uscis_email?: string | null
          uscis_password?: string | null
          uscis_receipt_numbers?: Json | null
          uscis_recovery_codes?: string | null
          visa_category?: string | null
          webhook_url?: string | null
        }
        Update: {
          access_token?: string
          account_id?: string | null
          alien_number?: string | null
          assigned_to?: string | null
          ball_in_court?: string | null
          beneficiary_country?: string | null
          beneficiary_name?: string | null
          cas_anio_nacimiento?: string | null
          cas_apellido?: string | null
          cas_interview_date?: string | null
          cas_interview_time?: string | null
          cas_pr_seguridad?: string | null
          case_roles?: Json | null
          case_tags_array?: string[] | null
          case_type?: string
          client_email?: string
          client_name?: string
          client_profile_id?: string | null
          co_sponsor_name?: string | null
          created_at?: string
          custom_fields?: Json | null
          drive_folder_id?: string | null
          drive_folder_url?: string | null
          emb_interview_date?: string | null
          emb_interview_time?: string | null
          file_number?: string | null
          household_members?: Json | null
          id?: string
          interview_city?: string | null
          interview_date?: string | null
          interview_time?: string | null
          interview_type?: string | null
          notes?: string | null
          nvc_cas_email?: string | null
          nvc_cas_password?: string | null
          nvc_case_number?: string | null
          nvc_ds260_code?: string | null
          nvc_invoice_id?: string | null
          petitioner_name?: string | null
          pipeline_stage?: string | null
          priority_date?: string | null
          process_stage?: string | null
          process_type?: string | null
          professional_id?: string
          stage_entered_at?: string | null
          status?: string
          updated_at?: string
          uscis_email?: string | null
          uscis_password?: string | null
          uscis_receipt_numbers?: Json | null
          uscis_recovery_codes?: string | null
          visa_category?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_cases_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ner_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_cases_client_profile_id_fkey"
            columns: ["client_profile_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
        ]
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
      consultation_types: {
        Row: {
          account_id: string
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          is_active: boolean | null
          name: string
          price: number | null
          sort_order: number | null
        }
        Insert: {
          account_id: string
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          price?: number | null
          sort_order?: number | null
        }
        Update: {
          account_id?: string
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "consultation_types_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ner_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      consultations: {
        Row: {
          account_id: string
          ai_action_items: string[] | null
          ai_eligibility_assessment: string | null
          ai_flags: string[] | null
          ai_recommended_case_type: string | null
          ai_risks: string[] | null
          ai_strengths: string[] | null
          ai_summary: string | null
          case_id: string | null
          client_profile_id: string | null
          contract_amount: number | null
          created_at: string | null
          created_by: string
          decision: string | null
          decision_notes: string | null
          derivatives: Json | null
          duration_minutes: number | null
          ended_at: string | null
          follow_up_date: string | null
          id: string
          raw_notes: string | null
          started_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          ai_action_items?: string[] | null
          ai_eligibility_assessment?: string | null
          ai_flags?: string[] | null
          ai_recommended_case_type?: string | null
          ai_risks?: string[] | null
          ai_strengths?: string[] | null
          ai_summary?: string | null
          case_id?: string | null
          client_profile_id?: string | null
          contract_amount?: number | null
          created_at?: string | null
          created_by: string
          decision?: string | null
          decision_notes?: string | null
          derivatives?: Json | null
          duration_minutes?: number | null
          ended_at?: string | null
          follow_up_date?: string | null
          id?: string
          raw_notes?: string | null
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          ai_action_items?: string[] | null
          ai_eligibility_assessment?: string | null
          ai_flags?: string[] | null
          ai_recommended_case_type?: string | null
          ai_risks?: string[] | null
          ai_strengths?: string[] | null
          ai_summary?: string | null
          case_id?: string | null
          client_profile_id?: string | null
          contract_amount?: number | null
          created_at?: string | null
          created_by?: string
          decision?: string | null
          decision_notes?: string | null
          derivatives?: Json | null
          duration_minutes?: number | null
          ended_at?: string | null
          follow_up_date?: string | null
          id?: string
          raw_notes?: string | null
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ner_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "client_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_client_profile_id_fkey"
            columns: ["client_profile_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
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
      cspa_feedback: {
        Row: {
          calculation_id: string | null
          comment: string | null
          created_at: string
          id: string
          rating: number
          user_id: string | null
        }
        Insert: {
          calculation_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          user_id?: string | null
        }
        Update: {
          calculation_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cspa_feedback_calculation_id_fkey"
            columns: ["calculation_id"]
            isOneToOne: false
            referencedRelation: "cspa_calculations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          account_id: string | null
          case_id: string | null
          created_at: string | null
          file_number: string | null
          ghl_message_id: string | null
          id: string
          metadata: Json | null
          recipient_email: string
          recipient_name: string | null
          sent_at: string | null
          status: string | null
          subject: string
          template_type: string
        }
        Insert: {
          account_id?: string | null
          case_id?: string | null
          created_at?: string | null
          file_number?: string | null
          ghl_message_id?: string | null
          id?: string
          metadata?: Json | null
          recipient_email: string
          recipient_name?: string | null
          sent_at?: string | null
          status?: string | null
          subject: string
          template_type: string
        }
        Update: {
          account_id?: string | null
          case_id?: string | null
          created_at?: string | null
          file_number?: string | null
          ghl_message_id?: string | null
          id?: string
          metadata?: Json | null
          recipient_email?: string
          recipient_name?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string
          template_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ner_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "client_cases"
            referencedColumns: ["id"]
          },
        ]
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
      form_field_mappings: {
        Row: {
          created_at: string
          field_key: string
          form_type: string
          id: string
          is_required: boolean | null
          part_label: string | null
          pdf_field_name: string | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          field_key: string
          form_type: string
          id?: string
          is_required?: boolean | null
          part_label?: string | null
          pdf_field_name?: string | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          field_key?: string
          form_type?: string
          id?: string
          is_required?: boolean | null
          part_label?: string | null
          pdf_field_name?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "form_field_mappings_field_key_fkey"
            columns: ["field_key"]
            isOneToOne: false
            referencedRelation: "form_field_registry"
            referencedColumns: ["field_key"]
          },
        ]
      }
      form_field_registry: {
        Row: {
          created_at: string
          field_group: string
          field_key: string
          field_subgroup: string | null
          field_type: string
          help_text_en: string | null
          help_text_es: string | null
          id: string
          label_en: string
          label_es: string
          options: Json | null
          sort_order: number | null
          validation_rules: Json | null
        }
        Insert: {
          created_at?: string
          field_group?: string
          field_key: string
          field_subgroup?: string | null
          field_type?: string
          help_text_en?: string | null
          help_text_es?: string | null
          id?: string
          label_en: string
          label_es: string
          options?: Json | null
          sort_order?: number | null
          validation_rules?: Json | null
        }
        Update: {
          created_at?: string
          field_group?: string
          field_key?: string
          field_subgroup?: string | null
          field_type?: string
          help_text_en?: string | null
          help_text_es?: string | null
          id?: string
          label_en?: string
          label_es?: string
          options?: Json | null
          sort_order?: number | null
          validation_rules?: Json | null
        }
        Relationships: []
      }
      form_submissions: {
        Row: {
          account_id: string
          beneficiary_profile_id: string | null
          case_id: string | null
          client_email: string | null
          client_name: string | null
          created_at: string
          form_data: Json
          form_type: string
          form_version: string
          id: string
          notes: string | null
          petitioner_profile_id: string | null
          share_token: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          beneficiary_profile_id?: string | null
          case_id?: string | null
          client_email?: string | null
          client_name?: string | null
          created_at?: string
          form_data?: Json
          form_type?: string
          form_version?: string
          id?: string
          notes?: string | null
          petitioner_profile_id?: string | null
          share_token?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          beneficiary_profile_id?: string | null
          case_id?: string | null
          client_email?: string | null
          client_name?: string | null
          created_at?: string
          form_data?: Json
          form_type?: string
          form_version?: string
          id?: string
          notes?: string | null
          petitioner_profile_id?: string | null
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
            columns: ["beneficiary_profile_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_petitioner_profile_id_fkey"
            columns: ["petitioner_profile_id"]
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
      intake_sessions: {
        Row: {
          account_id: string
          ai_confidence_score: number | null
          ai_flags: string[] | null
          ai_reasoning: string | null
          ai_suggested_case_type: string | null
          case_id: string | null
          client_email: string | null
          client_first_name: string | null
          client_goal: string | null
          client_language: string | null
          client_last_name: string | null
          client_phone: string | null
          client_profile_id: string | null
          created_at: string | null
          created_by: string
          current_documents: string[] | null
          current_status: string | null
          deadline_date: string | null
          entry_channel: string | null
          entry_date: string | null
          entry_method: string | null
          final_case_type: string | null
          has_criminal_record: boolean | null
          has_pending_deadline: boolean | null
          has_prior_deportation: boolean | null
          id: string
          is_existing_client: boolean | null
          notes: string | null
          referral_source: string | null
          status: string | null
          updated_at: string | null
          urgency_level: string | null
        }
        Insert: {
          account_id: string
          ai_confidence_score?: number | null
          ai_flags?: string[] | null
          ai_reasoning?: string | null
          ai_suggested_case_type?: string | null
          case_id?: string | null
          client_email?: string | null
          client_first_name?: string | null
          client_goal?: string | null
          client_language?: string | null
          client_last_name?: string | null
          client_phone?: string | null
          client_profile_id?: string | null
          created_at?: string | null
          created_by: string
          current_documents?: string[] | null
          current_status?: string | null
          deadline_date?: string | null
          entry_channel?: string | null
          entry_date?: string | null
          entry_method?: string | null
          final_case_type?: string | null
          has_criminal_record?: boolean | null
          has_pending_deadline?: boolean | null
          has_prior_deportation?: boolean | null
          id?: string
          is_existing_client?: boolean | null
          notes?: string | null
          referral_source?: string | null
          status?: string | null
          updated_at?: string | null
          urgency_level?: string | null
        }
        Update: {
          account_id?: string
          ai_confidence_score?: number | null
          ai_flags?: string[] | null
          ai_reasoning?: string | null
          ai_suggested_case_type?: string | null
          case_id?: string | null
          client_email?: string | null
          client_first_name?: string | null
          client_goal?: string | null
          client_language?: string | null
          client_last_name?: string | null
          client_phone?: string | null
          client_profile_id?: string | null
          created_at?: string | null
          created_by?: string
          current_documents?: string[] | null
          current_status?: string | null
          deadline_date?: string | null
          entry_channel?: string | null
          entry_date?: string | null
          entry_method?: string | null
          final_case_type?: string | null
          has_criminal_record?: boolean | null
          has_pending_deadline?: boolean | null
          has_prior_deportation?: boolean | null
          id?: string
          is_existing_client?: boolean | null
          notes?: string | null
          referral_source?: string | null
          status?: string | null
          updated_at?: string | null
          urgency_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intake_sessions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ner_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_sessions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "client_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_sessions_client_profile_id_fkey"
            columns: ["client_profile_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ner_accounts: {
        Row: {
          account_name: string
          created_at: string
          external_crm_id: string | null
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
          external_crm_id?: string | null
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
          external_crm_id?: string | null
          id?: string
          is_active?: boolean
          max_users?: number
          phone?: string | null
          plan?: Database["public"]["Enums"]["ner_plan"]
          updated_at?: string
        }
        Relationships: []
      }
      office_config: {
        Row: {
          account_id: string
          attorney_name: string | null
          attorney_signature_url: string | null
          bar_number: string | null
          bar_state: string | null
          created_at: string | null
          file_prefix: string | null
          firm_address: string | null
          firm_email: string | null
          firm_fax: string | null
          firm_logo_url: string | null
          firm_name: string | null
          firm_phone: string | null
          ghl_last_sync: string | null
          ghl_location_id: string | null
          id: string
          preferred_channel: string | null
          preferred_language: string | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          attorney_name?: string | null
          attorney_signature_url?: string | null
          bar_number?: string | null
          bar_state?: string | null
          created_at?: string | null
          file_prefix?: string | null
          firm_address?: string | null
          firm_email?: string | null
          firm_fax?: string | null
          firm_logo_url?: string | null
          firm_name?: string | null
          firm_phone?: string | null
          ghl_last_sync?: string | null
          ghl_location_id?: string | null
          id?: string
          preferred_channel?: string | null
          preferred_language?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          attorney_name?: string | null
          attorney_signature_url?: string | null
          bar_number?: string | null
          bar_state?: string | null
          created_at?: string | null
          file_prefix?: string | null
          firm_address?: string | null
          firm_email?: string | null
          firm_fax?: string | null
          firm_logo_url?: string | null
          firm_name?: string | null
          firm_phone?: string | null
          ghl_last_sync?: string | null
          ghl_location_id?: string | null
          id?: string
          preferred_channel?: string | null
          preferred_language?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "office_config_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "ner_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_templates: {
        Row: {
          account_id: string | null
          created_at: string
          description: string | null
          field_definitions: Json
          form_package: Json
          id: string
          is_active: boolean
          is_system: boolean
          process_label: string
          process_type: string
          stages: Json
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          description?: string | null
          field_definitions?: Json
          form_package?: Json
          id?: string
          is_active?: boolean
          is_system?: boolean
          process_label: string
          process_type: string
          stages?: Json
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          description?: string | null
          field_definitions?: Json
          form_package?: Json
          id?: string
          is_active?: boolean
          is_system?: boolean
          process_label?: string
          process_type?: string
          stages?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_templates_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ner_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string | null
          email: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          user_id?: string
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
          attorney_uscis_account: string | null
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
          attorney_uscis_account?: string | null
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
          attorney_uscis_account?: string | null
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
      uscis_forms: {
        Row: {
          category: string
          created_at: string
          form_name_en: string
          form_name_es: string
          form_number: string
          id: string
          is_active: boolean
          sort_order: number
        }
        Insert: {
          category?: string
          created_at?: string
          form_name_en: string
          form_name_es: string
          form_number: string
          id?: string
          is_active?: boolean
          sort_order?: number
        }
        Update: {
          category?: string
          created_at?: string
          form_name_en?: string
          form_name_es?: string
          form_number?: string
          id?: string
          is_active?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      vawa_cases: {
        Row: {
          account_id: string | null
          assigned_to: string | null
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
          account_id?: string | null
          assigned_to?: string | null
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
          account_id?: string | null
          assigned_to?: string | null
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
        Relationships: [
          {
            foreignKeyName: "vawa_cases_account_id_fkey"
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
      visa_evaluations: {
        Row: {
          access_token: string
          account_id: string | null
          answers: Json
          audio_recordings: Json | null
          avatar_code: string | null
          avatar_group: string | null
          avatar_label: string | null
          client_email: string | null
          client_name: string
          client_profile_id: string | null
          created_at: string
          id: string
          professional_id: string | null
          risk_level: string | null
          score: number | null
          score_breakdown: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          access_token?: string
          account_id?: string | null
          answers?: Json
          audio_recordings?: Json | null
          avatar_code?: string | null
          avatar_group?: string | null
          avatar_label?: string | null
          client_email?: string | null
          client_name: string
          client_profile_id?: string | null
          created_at?: string
          id?: string
          professional_id?: string | null
          risk_level?: string | null
          score?: number | null
          score_breakdown?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          account_id?: string | null
          answers?: Json
          audio_recordings?: Json | null
          avatar_code?: string | null
          avatar_group?: string | null
          avatar_label?: string | null
          client_email?: string | null
          client_name?: string
          client_profile_id?: string | null
          created_at?: string
          id?: string
          professional_id?: string | null
          risk_level?: string | null
          score?: number | null
          score_breakdown?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visa_evaluations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ner_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_evaluations_client_profile_id_fkey"
            columns: ["client_profile_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acquire_app_seat: {
        Args: { _app_slug: string; _user_id: string }
        Returns: Json
      }
      can_access_app: {
        Args: { _app_slug: string; _user_id: string }
        Returns: boolean
      }
      check_app_seat_status: {
        Args: { _app_slug: string; _user_id: string }
        Returns: Json
      }
      check_rate_limit: {
        Args: { _tool_slug: string; _user_id: string }
        Returns: Json
      }
      complete_pre_intake: {
        Args: { _data: Json; _token: string }
        Returns: undefined
      }
      delete_evidence_by_token: {
        Args: { _evidence_id: string; _token: string }
        Returns: string
      }
      generate_file_number: { Args: { p_account_id: string }; Returns: string }
      get_appointment_by_token: {
        Args: { _token: string }
        Returns: {
          account_id: string
          appointment_date: string
          appointment_datetime: string
          appointment_type: string
          client_email: string
          client_name: string
          id: string
          intake_session_id: string
          pre_intake_completed: boolean
          pre_intake_data: Json
          status: string
        }[]
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
      get_case_pipeline_by_token: {
        Args: { _token: string }
        Returns: {
          pipeline_stage: string
          process_label: string
          stages: Json
        }[]
      }
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
      get_firm_metrics: { Args: { _days?: number }; Returns: Json }
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
      get_user_role: { Args: { p_account_id: string }; Returns: string }
      get_visa_eval_by_token: {
        Args: { _token: string }
        Returns: {
          answers: Json
          avatar_code: string
          avatar_label: string
          client_name: string
          id: string
          risk_level: string
          score: number
          score_breakdown: Json
          status: string
        }[]
      }
      has_account_role: {
        Args: {
          _role: Database["public"]["Enums"]["account_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_account_role_in: {
        Args: {
          _account_id: string
          _role: Database["public"]["Enums"]["account_role"]
          _user_id: string
        }
        Returns: boolean
      }
      heartbeat_app_seat: {
        Args: { _app_slug: string; _user_id: string }
        Returns: Json
      }
      is_platform_admin: { Args: never; Returns: boolean }
      release_app_seat: {
        Args: { _app_slug: string; _user_id: string }
        Returns: undefined
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
      update_visa_eval_by_token: {
        Args: {
          _answers: Json
          _client_email?: string
          _client_name?: string
          _token: string
        }
        Returns: undefined
      }
      user_account_id: { Args: { _user_id: string }; Returns: string }
    }
    Enums: {
      account_role:
        | "owner"
        | "admin"
        | "member"
        | "attorney"
        | "paralegal"
        | "assistant"
        | "readonly"
      ner_plan: "essential" | "professional" | "elite" | "enterprise"
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
      account_role: [
        "owner",
        "admin",
        "member",
        "attorney",
        "paralegal",
        "assistant",
        "readonly",
      ],
      ner_plan: ["essential", "professional", "elite", "enterprise"],
    },
  },
} as const
