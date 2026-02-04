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
      payments: {
        Row: {
          amount: number
          created_at: string | null
          failed_ach_fee_applied: boolean | null
          failed_at: string | null
          fee_amount: number | null
          id: string
          paid_at: string | null
          payment_method: string
          statement_id: string | null
          statement_amount: number | null
          status: string
          stripe_payment_id: string | null
          unit_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          failed_ach_fee_applied?: boolean | null
          failed_at?: string | null
          fee_amount?: number | null
          id?: string
          paid_at?: string | null
          payment_method: string
          statement_id?: string | null
          statement_amount?: number | null
          status?: string
          stripe_payment_id?: string | null
          unit_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          failed_ach_fee_applied?: boolean | null
          failed_at?: string | null
          fee_amount?: number | null
          id?: string
          paid_at?: string | null
          payment_method?: string
          statement_id?: string | null
          statement_amount?: number | null
          status?: string
          stripe_payment_id?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          phone: string | null
          role: string
          stripe_account_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role: string
          stripe_account_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: string
          stripe_account_id?: string | null
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          created_at: string | null
          id: string
          landlord_id: string
          name: string
        }
        Insert: {
          address: string
          created_at?: string | null
          id?: string
          landlord_id: string
          name: string
        }
        Update: {
          address?: string
          created_at?: string | null
          id?: string
          landlord_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      statements: {
        Row: {
          additional_fees: number | null
          base_rent: number
          created_at: string | null
          id: string
          late_fee: number | null
          pdf_url: string | null
          period_month: string
          split_fee: number | null
          status: string
          total_due: number
          unit_id: string
        }
        Insert: {
          additional_fees?: number | null
          base_rent: number
          created_at?: string | null
          id?: string
          late_fee?: number | null
          pdf_url?: string | null
          period_month: string
          split_fee?: number | null
          status?: string
          total_due: number
          unit_id: string
        }
        Update: {
          additional_fees?: number | null
          base_rent?: number
          created_at?: string | null
          id?: string
          late_fee?: number | null
          pdf_url?: string | null
          period_month?: string
          split_fee?: number | null
          status?: string
          total_due?: number
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "statements_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          allow_split_payment: boolean | null
          created_at: string | null
          daily_late_fee: number
          due_day: number
          id: string
          late_fee_amount: number
          late_fee_type: string
          lease_pdf_url: string | null
          monthly_rent: number
          move_in_date: string | null
          property_id: string
          tenant_id: string | null
          unit_number: string
        }
        Insert: {
          allow_split_payment?: boolean | null
          created_at?: string | null
          daily_late_fee?: number
          due_day: number
          id?: string
          late_fee_amount?: number
          late_fee_type?: string
          lease_pdf_url?: string | null
          monthly_rent: number
          move_in_date?: string | null
          property_id: string
          tenant_id?: string | null
          unit_number: string
        }
        Update: {
          allow_split_payment?: boolean | null
          created_at?: string | null
          daily_late_fee?: number
          due_day?: number
          id?: string
          late_fee_amount?: number
          late_fee_type?: string
          lease_pdf_url?: string | null
          monthly_rent?: number
          move_in_date?: string | null
          property_id?: string
          tenant_id?: string | null
          unit_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          id: string
          landlord_id: string | null
          name: string
          type: string
          is_system: boolean
          created_at: string | null
        }
        Insert: {
          id?: string
          landlord_id?: string | null
          name: string
          type: string
          is_system?: boolean
          created_at?: string | null
        }
        Update: {
          id?: string
          landlord_id?: string | null
          name?: string
          type?: string
          is_system?: boolean
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      expenses: {
        Row: {
          id: string
          landlord_id: string
          property_id: string
          unit_id: string | null
          amount: number
          expense_date: string
          category_id: string
          description: string | null
          receipt_url: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          landlord_id: string
          property_id: string
          unit_id?: string | null
          amount: number
          expense_date: string
          category_id: string
          description?: string | null
          receipt_url?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          landlord_id?: string
          property_id?: string
          unit_id?: string | null
          amount?: number
          expense_date?: string
          category_id?: string
          description?: string | null
          receipt_url?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          }
        ]
      }
      payouts: {
        Row: {
          id: string
          landlord_id: string
          amount: number
          payout_date: string
          stripe_payout_id: string | null
          status: string
          created_at: string | null
        }
        Insert: {
          id?: string
          landlord_id: string
          amount: number
          payout_date: string
          stripe_payout_id?: string | null
          status?: string
          created_at?: string | null
        }
        Update: {
          id?: string
          landlord_id?: string
          amount?: number
          payout_date?: string
          stripe_payout_id?: string | null
          status?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payouts_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      tenant_notifications: {
        Row: {
          id: string
          tenant_id: string
          type: string
          title: string
          message: string
          metadata: Json | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          type?: string
          title: string
          message: string
          metadata?: Json | null
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          type?: string
          title?: string
          message?: string
          metadata?: Json | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      fix_tenant_unit_assignment_by_email: { Args: never; Returns: string | null }
      tenant_claim_profile_by_email: { Args: { p_email: string }; Returns: boolean }
      sync_unit_tenant_to_profile_by_email: { Args: { p_unit_id: string; p_tenant_email?: string | null; p_tenant_id?: string | null }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      landlord_owns_unit: { Args: { unit_id_text: string }; Returns: boolean }
      tenant_assigned_to_unit: {
        Args: { unit_id_text: string }
        Returns: boolean
      }
      tenant_has_access_to_property: {
        Args: { property_id: string }
        Returns: boolean
      }
      get_ledger_entries: {
        Args: {
          p_landlord_id: string
          p_date_from?: string | null
          p_date_to?: string | null
          p_property_id?: string | null
          p_unit_id?: string | null
          p_entry_types?: string[] | null
        }
        Returns: {
          entry_type: string
          entry_date: string
          amount: number
          category_id: string | null
          category_name: string | null
          property_id: string | null
          property_name: string | null
          unit_id: string | null
          unit_number: string | null
          tenant_id: string | null
          tenant_name: string | null
          description: string | null
          reference_id: string
          reference_type: string
          created_at: string | null
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
