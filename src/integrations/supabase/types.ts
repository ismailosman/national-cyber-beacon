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
      alerts: {
        Row: {
          created_at: string | null
          description: string
          id: string
          is_read: boolean | null
          organization_id: string | null
          severity: Database["public"]["Enums"]["severity_type"]
          source: string
          status: string
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string
          id?: string
          is_read?: boolean | null
          organization_id?: string | null
          severity?: Database["public"]["Enums"]["severity_type"]
          source?: string
          status?: string
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          is_read?: boolean | null
          organization_id?: string | null
          severity?: Database["public"]["Enums"]["severity_type"]
          source?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      anomalies: {
        Row: {
          confidence: number
          created_at: string | null
          expected: number | null
          explanation: string
          id: string
          metric_name: string
          observed: number
          organization_id: string
          severity: Database["public"]["Enums"]["severity_type"]
          status: Database["public"]["Enums"]["anomaly_status"]
        }
        Insert: {
          confidence?: number
          created_at?: string | null
          expected?: number | null
          explanation?: string
          id?: string
          metric_name: string
          observed: number
          organization_id: string
          severity?: Database["public"]["Enums"]["severity_type"]
          status?: Database["public"]["Enums"]["anomaly_status"]
        }
        Update: {
          confidence?: number
          created_at?: string | null
          expected?: number | null
          explanation?: string
          id?: string
          metric_name?: string
          observed?: number
          organization_id?: string
          severity?: Database["public"]["Enums"]["severity_type"]
          status?: Database["public"]["Enums"]["anomaly_status"]
        }
        Relationships: [
          {
            foreignKeyName: "anomalies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          asset_type: string
          created_at: string | null
          id: string
          ip_address: string | null
          is_critical: boolean | null
          organization_id: string
          url: string
        }
        Insert: {
          asset_type?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          is_critical?: boolean | null
          organization_id: string
          url: string
        }
        Update: {
          asset_type?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          is_critical?: boolean | null
          organization_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cert_advisories: {
        Row: {
          affected_sectors: Database["public"]["Enums"]["sector_type"][]
          created_by: string | null
          id: string
          iocs: Json
          published_at: string | null
          severity: Database["public"]["Enums"]["severity_type"]
          summary: string
          title: string
        }
        Insert: {
          affected_sectors?: Database["public"]["Enums"]["sector_type"][]
          created_by?: string | null
          id?: string
          iocs?: Json
          published_at?: string | null
          severity?: Database["public"]["Enums"]["severity_type"]
          summary: string
          title: string
        }
        Update: {
          affected_sectors?: Database["public"]["Enums"]["sector_type"][]
          created_by?: string | null
          id?: string
          iocs?: Json
          published_at?: string | null
          severity?: Database["public"]["Enums"]["severity_type"]
          summary?: string
          title?: string
        }
        Relationships: []
      }
      compliance_frameworks: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      control_results: {
        Row: {
          assessed_at: string | null
          assessor_user_id: string | null
          control_id: string
          evidence: Json
          id: string
          organization_id: string
          status: Database["public"]["Enums"]["control_status"]
        }
        Insert: {
          assessed_at?: string | null
          assessor_user_id?: string | null
          control_id: string
          evidence?: Json
          id?: string
          organization_id: string
          status?: Database["public"]["Enums"]["control_status"]
        }
        Update: {
          assessed_at?: string | null
          assessor_user_id?: string | null
          control_id?: string
          evidence?: Json
          id?: string
          organization_id?: string
          status?: Database["public"]["Enums"]["control_status"]
        }
        Relationships: [
          {
            foreignKeyName: "control_results_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_results_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      controls: {
        Row: {
          control_code: string
          created_at: string | null
          description: string | null
          domain: string
          evidence_type: string
          framework_id: string
          id: string
          title: string
          weight: number
        }
        Insert: {
          control_code: string
          created_at?: string | null
          description?: string | null
          domain?: string
          evidence_type?: string
          framework_id: string
          id?: string
          title: string
          weight?: number
        }
        Update: {
          control_code?: string
          created_at?: string | null
          description?: string | null
          domain?: string
          evidence_type?: string
          framework_id?: string
          id?: string
          title?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "controls_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "compliance_frameworks"
            referencedColumns: ["id"]
          },
        ]
      }
      ddos_risk_logs: {
        Row: {
          availability_flapping: boolean
          cdn_provider: string | null
          checked_at: string
          extended_downtime: boolean
          has_cdn: boolean
          has_rate_limiting: boolean
          has_waf: boolean
          id: string
          organization_id: string | null
          organization_name: string
          origin_exposed: boolean
          protection_headers: string[]
          response_time_spike: boolean
          risk_factors: string[]
          risk_level: string
          server_header: string | null
          url: string
        }
        Insert: {
          availability_flapping?: boolean
          cdn_provider?: string | null
          checked_at?: string
          extended_downtime?: boolean
          has_cdn?: boolean
          has_rate_limiting?: boolean
          has_waf?: boolean
          id?: string
          organization_id?: string | null
          organization_name: string
          origin_exposed?: boolean
          protection_headers?: string[]
          response_time_spike?: boolean
          risk_factors?: string[]
          risk_level?: string
          server_header?: string | null
          url: string
        }
        Update: {
          availability_flapping?: boolean
          cdn_provider?: string | null
          checked_at?: string
          extended_downtime?: boolean
          has_cdn?: boolean
          has_rate_limiting?: boolean
          has_waf?: boolean
          id?: string
          organization_id?: string | null
          organization_name?: string
          origin_exposed?: boolean
          protection_headers?: string[]
          response_time_spike?: boolean
          risk_factors?: string[]
          risk_level?: string
          server_header?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "ddos_risk_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations_monitored"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_reports: {
        Row: {
          affected_assets: string | null
          assigned_to: string | null
          attachment_urls: string[]
          category: string
          created_at: string | null
          description: string
          id: string
          organization_id: string | null
          reporter_email: string | null
          reporter_type: string
          severity: Database["public"]["Enums"]["severity_type"]
          status: Database["public"]["Enums"]["incident_status"]
        }
        Insert: {
          affected_assets?: string | null
          assigned_to?: string | null
          attachment_urls?: string[]
          category?: string
          created_at?: string | null
          description: string
          id?: string
          organization_id?: string | null
          reporter_email?: string | null
          reporter_type?: string
          severity?: Database["public"]["Enums"]["severity_type"]
          status?: Database["public"]["Enums"]["incident_status"]
        }
        Update: {
          affected_assets?: string | null
          assigned_to?: string | null
          attachment_urls?: string[]
          category?: string
          created_at?: string | null
          description?: string
          id?: string
          organization_id?: string | null
          reporter_email?: string | null
          reporter_type?: string
          severity?: Database["public"]["Enums"]["severity_type"]
          status?: Database["public"]["Enums"]["incident_status"]
        }
        Relationships: [
          {
            foreignKeyName: "incident_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_timeline: {
        Row: {
          action: string
          created_at: string | null
          id: string
          incident_id: string
          notes: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          incident_id: string
          notes?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          incident_id?: string
          notes?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_timeline_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incident_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      ioc_matches: {
        Row: {
          advisory_id: string
          asset_id: string | null
          detected_at: string | null
          id: string
          matched_ioc: string
          organization_id: string
          status: string
        }
        Insert: {
          advisory_id: string
          asset_id?: string | null
          detected_at?: string | null
          id?: string
          matched_ioc: string
          organization_id: string
          status?: string
        }
        Update: {
          advisory_id?: string
          asset_id?: string | null
          detected_at?: string | null
          id?: string
          matched_ioc?: string
          organization_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ioc_matches_advisory_id_fkey"
            columns: ["advisory_id"]
            isOneToOne: false
            referencedRelation: "cert_advisories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ioc_matches_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ioc_matches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics_timeseries: {
        Row: {
          created_at: string | null
          id: string
          metric_name: string
          organization_id: string
          value: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          metric_name: string
          organization_id: string
          value: number
        }
        Update: {
          created_at?: string | null
          id?: string
          metric_name?: string
          organization_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "metrics_timeseries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          contact_email: string | null
          created_at: string | null
          domain: string
          id: string
          last_scan: string | null
          lat: number | null
          lng: number | null
          name: string
          region: string
          risk_score: number
          sector: Database["public"]["Enums"]["sector_type"]
          status: string
          updated_at: string | null
        }
        Insert: {
          contact_email?: string | null
          created_at?: string | null
          domain: string
          id?: string
          last_scan?: string | null
          lat?: number | null
          lng?: number | null
          name: string
          region?: string
          risk_score?: number
          sector?: Database["public"]["Enums"]["sector_type"]
          status?: string
          updated_at?: string | null
        }
        Update: {
          contact_email?: string | null
          created_at?: string | null
          domain?: string
          id?: string
          last_scan?: string | null
          lat?: number | null
          lng?: number | null
          name?: string
          region?: string
          risk_score?: number
          sector?: Database["public"]["Enums"]["sector_type"]
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      organizations_monitored: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sector: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sector?: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sector?: string
          url?: string
        }
        Relationships: []
      }
      risk_history: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          score: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id: string
          score: number
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "risk_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      security_checks: {
        Row: {
          asset_id: string
          check_type: string
          checked_at: string
          details: Json
          id: string
          score: number
          status: string
        }
        Insert: {
          asset_id: string
          check_type: string
          checked_at?: string
          details?: Json
          id?: string
          score?: number
          status?: string
        }
        Update: {
          asset_id?: string
          check_type?: string
          checked_at?: string
          details?: Json
          id?: string
          score?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_checks_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      ssl_logs: {
        Row: {
          checked_at: string
          days_until_expiry: number | null
          id: string
          is_expired: boolean
          is_expiring_soon: boolean
          is_valid: boolean
          issuer: string | null
          organization_id: string | null
          organization_name: string
          protocol: string | null
          url: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          checked_at?: string
          days_until_expiry?: number | null
          id?: string
          is_expired?: boolean
          is_expiring_soon?: boolean
          is_valid?: boolean
          issuer?: string | null
          organization_id?: string | null
          organization_name: string
          protocol?: string | null
          url: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          checked_at?: string
          days_until_expiry?: number | null
          id?: string
          is_expired?: boolean
          is_expiring_soon?: boolean
          is_valid?: boolean
          issuer?: string | null
          organization_id?: string | null
          organization_name?: string
          protocol?: string | null
          url?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ssl_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations_monitored"
            referencedColumns: ["id"]
          },
        ]
      }
      threat_events: {
        Row: {
          count: number
          created_at: string | null
          event_type: Database["public"]["Enums"]["event_type"]
          id: string
          lat: number | null
          lng: number | null
          meta: Json
          organization_id: string | null
          sector: Database["public"]["Enums"]["sector_type"]
          severity: Database["public"]["Enums"]["severity_type"]
          source_country: string | null
          target_region: string
        }
        Insert: {
          count?: number
          created_at?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          lat?: number | null
          lng?: number | null
          meta?: Json
          organization_id?: string | null
          sector?: Database["public"]["Enums"]["sector_type"]
          severity?: Database["public"]["Enums"]["severity_type"]
          source_country?: string | null
          target_region?: string
        }
        Update: {
          count?: number
          created_at?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          lat?: number | null
          lng?: number | null
          meta?: Json
          organization_id?: string | null
          sector?: Database["public"]["Enums"]["sector_type"]
          severity?: Database["public"]["Enums"]["severity_type"]
          source_country?: string | null
          target_region?: string
        }
        Relationships: [
          {
            foreignKeyName: "threat_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      uptime_logs: {
        Row: {
          checked_at: string
          id: string
          organization_id: string | null
          organization_name: string
          response_time_ms: number | null
          status: string
          status_code: number | null
          url: string
        }
        Insert: {
          checked_at?: string
          id?: string
          organization_id?: string | null
          organization_name: string
          response_time_ms?: number | null
          status?: string
          status_code?: number | null
          url: string
        }
        Update: {
          checked_at?: string
          id?: string
          organization_id?: string | null
          organization_name?: string
          response_time_ms?: number | null
          status?: string
          status_code?: number | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "uptime_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations_monitored"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          org_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          org_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          org_id?: string | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_authenticated_user: { Args: never; Returns: boolean }
    }
    Enums: {
      anomaly_status: "open" | "triaged" | "closed"
      app_role: "SuperAdmin" | "OrgAdmin" | "Analyst" | "Auditor"
      control_status: "pass" | "fail" | "partial" | "not_applicable"
      event_type:
        | "ddos"
        | "bruteforce"
        | "vuln_scan"
        | "phishing"
        | "malware"
        | "defacement"
        | "credential_stuffing"
        | "policy_violation"
        | "other"
      incident_status:
        | "new"
        | "triage"
        | "investigating"
        | "contained"
        | "resolved"
        | "closed"
      sector_type:
        | "government"
        | "bank"
        | "telecom"
        | "health"
        | "education"
        | "other"
      severity_type: "low" | "medium" | "high" | "critical"
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
      anomaly_status: ["open", "triaged", "closed"],
      app_role: ["SuperAdmin", "OrgAdmin", "Analyst", "Auditor"],
      control_status: ["pass", "fail", "partial", "not_applicable"],
      event_type: [
        "ddos",
        "bruteforce",
        "vuln_scan",
        "phishing",
        "malware",
        "defacement",
        "credential_stuffing",
        "policy_violation",
        "other",
      ],
      incident_status: [
        "new",
        "triage",
        "investigating",
        "contained",
        "resolved",
        "closed",
      ],
      sector_type: [
        "government",
        "bank",
        "telecom",
        "health",
        "education",
        "other",
      ],
      severity_type: ["low", "medium", "high", "critical"],
    },
  },
} as const
