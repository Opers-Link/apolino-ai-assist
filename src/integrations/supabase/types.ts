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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_usage_logs: {
        Row: {
          completion_tokens: number | null
          conversation_id: string | null
          created_at: string | null
          error_message: string | null
          has_knowledge_modules: boolean | null
          id: string
          model: string | null
          prompt_tokens: number | null
          session_id: string | null
          success: boolean | null
          total_tokens: number | null
        }
        Insert: {
          completion_tokens?: number | null
          conversation_id?: string | null
          created_at?: string | null
          error_message?: string | null
          has_knowledge_modules?: boolean | null
          id?: string
          model?: string | null
          prompt_tokens?: number | null
          session_id?: string | null
          success?: boolean | null
          total_tokens?: number | null
        }
        Update: {
          completion_tokens?: number | null
          conversation_id?: string | null
          created_at?: string | null
          error_message?: string | null
          has_knowledge_modules?: boolean | null
          id?: string
          model?: string | null
          prompt_tokens?: number | null
          session_id?: string | null
          success?: boolean | null
          total_tokens?: number | null
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          agent_notes: string | null
          ai_enabled: boolean | null
          assigned_at: string | null
          assigned_to: string | null
          category: Database["public"]["Enums"]["conversation_category"] | null
          ended_at: string | null
          first_response_time: number | null
          human_requested_at: string | null
          id: string
          resolved_at: string | null
          sentiment:
            | Database["public"]["Enums"]["conversation_sentiment"]
            | null
          session_id: string
          sla_alert_sent: boolean | null
          started_at: string
          status: string | null
          tags: string[] | null
          total_messages: number | null
          user_agent: string | null
          user_ip: string | null
        }
        Insert: {
          agent_notes?: string | null
          ai_enabled?: boolean | null
          assigned_at?: string | null
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["conversation_category"] | null
          ended_at?: string | null
          first_response_time?: number | null
          human_requested_at?: string | null
          id?: string
          resolved_at?: string | null
          sentiment?:
            | Database["public"]["Enums"]["conversation_sentiment"]
            | null
          session_id: string
          sla_alert_sent?: boolean | null
          started_at?: string
          status?: string | null
          tags?: string[] | null
          total_messages?: number | null
          user_agent?: string | null
          user_ip?: string | null
        }
        Update: {
          agent_notes?: string | null
          ai_enabled?: boolean | null
          assigned_at?: string | null
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["conversation_category"] | null
          ended_at?: string | null
          first_response_time?: number | null
          human_requested_at?: string | null
          id?: string
          resolved_at?: string | null
          sentiment?:
            | Database["public"]["Enums"]["conversation_sentiment"]
            | null
          session_id?: string
          sla_alert_sent?: boolean | null
          started_at?: string
          status?: string | null
          tags?: string[] | null
          total_messages?: number | null
          user_agent?: string | null
          user_ip?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          id: string
          is_user: boolean
          message_order: number
          timestamp: string
        }
        Insert: {
          content: string
          conversation_id: string
          id?: string
          is_user: boolean
          message_order: number
          timestamp?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          id?: string
          is_user?: boolean
          message_order?: number
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_insights: {
        Row: {
          conversation_count: number | null
          generated_at: string | null
          generated_by: string | null
          id: string
          insights_data: Json
          message_count: number | null
          period_end: string
          period_start: string
        }
        Insert: {
          conversation_count?: number | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          insights_data: Json
          message_count?: number | null
          period_end: string
          period_start: string
        }
        Update: {
          conversation_count?: number | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          insights_data?: Json
          message_count?: number | null
          period_end?: string
          period_start?: string
        }
        Relationships: []
      }
      knowledge_config: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      knowledge_module_files: {
        Row: {
          extracted_text: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          module_id: string
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          extracted_text?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          module_id: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          extracted_text?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          module_id?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_module_files_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "knowledge_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_modules: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          display_order: number | null
          id: string
          name: string
          updated_at: string | null
          variable_name: string
          version: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          name: string
          updated_at?: string | null
          variable_name: string
          version?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          name?: string
          updated_at?: string | null
          variable_name?: string
          version?: string | null
        }
        Relationships: []
      }
      manual_insights: {
        Row: {
          description: string | null
          file_count: number | null
          generated_at: string | null
          generated_by: string | null
          id: string
          insights_data: Json
          period_end: string | null
          period_start: string | null
          source_files: Json
          title: string
          total_records: number | null
        }
        Insert: {
          description?: string | null
          file_count?: number | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          insights_data: Json
          period_end?: string | null
          period_start?: string | null
          source_files?: Json
          title: string
          total_records?: number | null
        }
        Update: {
          description?: string | null
          file_count?: number | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          insights_data?: Json
          period_end?: string | null
          period_start?: string | null
          source_files?: Json
          title?: string
          total_records?: number | null
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
          mobile_phone: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          mobile_phone?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          mobile_phone?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      system_prompts: {
        Row: {
          content: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
          version: number | null
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
          version?: number | null
        }
        Relationships: []
      }
      system_prompts_history: {
        Row: {
          change_reason: string | null
          changed_at: string | null
          changed_by: string | null
          content: string
          id: string
          prompt_id: string | null
          version: number
        }
        Insert: {
          change_reason?: string | null
          changed_at?: string | null
          changed_by?: string | null
          content: string
          id?: string
          prompt_id?: string | null
          version: number
        }
        Update: {
          change_reason?: string | null
          changed_at?: string | null
          changed_by?: string | null
          content?: string
          id?: string
          prompt_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "system_prompts_history_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "system_prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_assignments: {
        Row: {
          assigned_at: string | null
          assigned_from: string | null
          assigned_to: string | null
          conversation_id: string | null
          id: string
          reason: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_from?: string | null
          assigned_to?: string | null
          conversation_id?: string | null
          id?: string
          reason?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_from?: string | null
          assigned_to?: string | null
          conversation_id?: string | null
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_assignments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
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
          role?: Database["public"]["Enums"]["app_role"]
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
      categorize_conversation: {
        Args: { conversation_messages: string }
        Returns: Database["public"]["Enums"]["conversation_category"]
      }
      extract_conversation_tags: {
        Args: { conversation_messages: string }
        Returns: string[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "gerente" | "agente"
      conversation_category:
        | "usabilidade"
        | "procedimentos"
        | "marketing"
        | "vendas"
        | "outros"
      conversation_sentiment: "positivo" | "neutro" | "negativo"
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
      app_role: ["admin", "user", "gerente", "agente"],
      conversation_category: [
        "usabilidade",
        "procedimentos",
        "marketing",
        "vendas",
        "outros",
      ],
      conversation_sentiment: ["positivo", "neutro", "negativo"],
    },
  },
} as const
