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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          daily_scan_limit: number
          id: number
          scanner_enabled: boolean
          updated_at: string
        }
        Insert: {
          daily_scan_limit?: number
          id?: number
          scanner_enabled?: boolean
          updated_at?: string
        }
        Update: {
          daily_scan_limit?: number
          id?: number
          scanner_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      bots: {
        Row: {
          account_id: string
          bridge_token_hash: string | null
          created_at: string
          default_lot: number
          demo_only: boolean
          emergency_close_ack_at: string | null
          emergency_close_requested_at: string | null
          emergency_close_result: string | null
          id: string
          last_decision: string | null
          last_error: string | null
          last_heartbeat: string | null
          live_confirmed_at: string | null
          max_daily_loss: number
          max_lot: number
          max_open_trades: number
          risk_per_trade_pct: number
          status: string
          stop_ack_at: string | null
          stop_requested_at: string | null
          strategy: string
          terminal_info: Json | null
          trading_mode: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          bridge_token_hash?: string | null
          created_at?: string
          default_lot?: number
          demo_only?: boolean
          emergency_close_ack_at?: string | null
          emergency_close_requested_at?: string | null
          emergency_close_result?: string | null
          id?: string
          last_decision?: string | null
          last_error?: string | null
          last_heartbeat?: string | null
          live_confirmed_at?: string | null
          max_daily_loss?: number
          max_lot?: number
          max_open_trades?: number
          risk_per_trade_pct?: number
          status?: string
          stop_ack_at?: string | null
          stop_requested_at?: string | null
          strategy?: string
          terminal_info?: Json | null
          trading_mode?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          bridge_token_hash?: string | null
          created_at?: string
          default_lot?: number
          demo_only?: boolean
          emergency_close_ack_at?: string | null
          emergency_close_requested_at?: string | null
          emergency_close_result?: string | null
          id?: string
          last_decision?: string | null
          last_error?: string | null
          last_heartbeat?: string | null
          live_confirmed_at?: string | null
          max_daily_loss?: number
          max_lot?: number
          max_open_trades?: number
          risk_per_trade_pct?: number
          status?: string
          stop_ack_at?: string | null
          stop_requested_at?: string | null
          strategy?: string
          terminal_info?: Json | null
          trading_mode?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mentor_assignments: {
        Row: {
          client_id: string
          created_at: string
          id: string
          mentor_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          mentor_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          mentor_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read: boolean
          sender_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          sender_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          sender_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          mentor_requested: boolean
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          mentor_requested?: boolean
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          mentor_requested?: boolean
        }
        Relationships: []
      }
      scans: {
        Row: {
          analysis: Json | null
          created_at: string
          error: string | null
          id: string
          image_path: string | null
          instrument: string
          saved: boolean
          status: string
          timeframe: string
          trading_style: string
          user_id: string
        }
        Insert: {
          analysis?: Json | null
          created_at?: string
          error?: string | null
          id?: string
          image_path?: string | null
          instrument: string
          saved?: boolean
          status?: string
          timeframe: string
          trading_style: string
          user_id: string
        }
        Update: {
          analysis?: Json | null
          created_at?: string
          error?: string | null
          id?: string
          image_path?: string | null
          instrument?: string
          saved?: boolean
          status?: string
          timeframe?: string
          trading_style?: string
          user_id?: string
        }
        Relationships: []
      }
      trade_signals: {
        Row: {
          bot_id: string
          close_price: number | null
          closed_at: string | null
          comment: string | null
          created_at: string
          error: string | null
          fill_price: number | null
          filled_at: string | null
          id: string
          profit: number | null
          sent_at: string | null
          side: string
          signal_key: string | null
          status: string
          stop_loss: number | null
          strategy: string | null
          symbol: string
          take_profit: number | null
          ticket: string | null
          user_id: string
          volume: number
        }
        Insert: {
          bot_id: string
          close_price?: number | null
          closed_at?: string | null
          comment?: string | null
          created_at?: string
          error?: string | null
          fill_price?: number | null
          filled_at?: string | null
          id?: string
          profit?: number | null
          sent_at?: string | null
          side: string
          signal_key?: string | null
          status?: string
          stop_loss?: number | null
          strategy?: string | null
          symbol: string
          take_profit?: number | null
          ticket?: string | null
          user_id: string
          volume: number
        }
        Update: {
          bot_id?: string
          close_price?: number | null
          closed_at?: string | null
          comment?: string | null
          created_at?: string
          error?: string | null
          fill_price?: number | null
          filled_at?: string | null
          id?: string
          profit?: number | null
          sent_at?: string | null
          side?: string
          signal_key?: string | null
          status?: string
          stop_loss?: number | null
          strategy?: string | null
          symbol?: string
          take_profit?: number | null
          ticket?: string | null
          user_id?: string
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "trade_signals_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_accounts: {
        Row: {
          account_login: string
          broker_server: string
          connection_status: string
          created_at: string
          id: string
          label: string | null
          platform: string
          user_id: string
        }
        Insert: {
          account_login: string
          broker_server: string
          connection_status?: string
          created_at?: string
          id?: string
          label?: string | null
          platform: string
          user_id: string
        }
        Update: {
          account_login?: string
          broker_server?: string
          connection_status?: string
          created_at?: string
          id?: string
          label?: string | null
          platform?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      watchlist: {
        Row: {
          created_at: string
          id: string
          instrument: string
          note: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instrument: string
          note?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instrument?: string
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_stats: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_mentor_of: {
        Args: { _client: string; _mentor: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "mentor" | "client"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "mentor", "client"],
    },
  },
} as const
