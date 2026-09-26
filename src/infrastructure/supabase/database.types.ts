export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      additional_services: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name_ar: string
          name_en: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name_ar: string
          name_en: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name_ar?: string
          name_en?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "additional_services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          assigned_by: string | null
          created_at: string
          driver_id: string | null
          ended_at: string | null
          execution_active: boolean
          id: string
          market_id: string
          organization_id: string
          reason: string
          team_id: string | null
          trip_id: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          driver_id?: string | null
          ended_at?: string | null
          execution_active?: boolean
          id?: string
          market_id: string
          organization_id: string
          reason?: string
          team_id?: string | null
          trip_id: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          driver_id?: string | null
          ended_at?: string | null
          execution_active?: boolean
          id?: string
          market_id?: string
          organization_id?: string
          reason?: string
          team_id?: string | null
          trip_id?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_driver_id_market_fk"
            columns: ["organization_id", "market_id", "driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
          {
            foreignKeyName: "assignments_market_fk"
            columns: ["organization_id", "market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_parent_market_fk"
            columns: ["organization_id", "market_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
          {
            foreignKeyName: "assignments_team_id_market_fk"
            columns: ["organization_id", "market_id", "team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
          {
            foreignKeyName: "assignments_vehicle_id_market_fk"
            columns: ["organization_id", "market_id", "vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          occurred_at: string
          organization_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          occurred_at?: string
          organization_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_number: string | null
          active: boolean
          bank_name_ar: string
          bank_name_en: string
          beneficiary_ar: string
          beneficiary_en: string
          bic: string | null
          created_at: string
          created_by: string
          currency: string
          iban: string | null
          id: string
          instructions_ar: string
          instructions_en: string
          is_primary: boolean
          market_id: string
          organization_id: string
          revision: number
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          active?: boolean
          bank_name_ar: string
          bank_name_en: string
          beneficiary_ar: string
          beneficiary_en: string
          bic?: string | null
          created_at?: string
          created_by: string
          currency: string
          iban?: string | null
          id?: string
          instructions_ar?: string
          instructions_en?: string
          is_primary?: boolean
          market_id: string
          organization_id: string
          revision?: number
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          active?: boolean
          bank_name_ar?: string
          bank_name_en?: string
          beneficiary_ar?: string
          beneficiary_en?: string
          bic?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          iban?: string | null
          id?: string
          instructions_ar?: string
          instructions_en?: string
          is_primary?: boolean
          market_id?: string
          organization_id?: string
          revision?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_organization_id_market_id_currency_fkey"
            columns: ["organization_id", "market_id", "currency"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["organization_id", "id", "currency"]
          },
        ]
      }
      bank_transfer_attempts: {
        Row: {
          attempt_number: number
          bank_account_id: string
          bank_reference: string | null
          bank_snapshot: Json
          created_at: string
          file_id: string
          finance_note: string | null
          id: string
          market_id: string
          organization_id: string
          payment_id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          state: string
          submitted_at: string | null
          submitted_by: string
        }
        Insert: {
          attempt_number: number
          bank_account_id: string
          bank_reference?: string | null
          bank_snapshot: Json
          created_at?: string
          file_id: string
          finance_note?: string | null
          id?: string
          market_id: string
          organization_id: string
          payment_id: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: string
          submitted_at?: string | null
          submitted_by: string
        }
        Update: {
          attempt_number?: number
          bank_account_id?: string
          bank_reference?: string | null
          bank_snapshot?: Json
          created_at?: string
          file_id?: string
          finance_note?: string | null
          id?: string
          market_id?: string
          organization_id?: string
          payment_id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: string
          submitted_at?: string | null
          submitted_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transfer_attempts_organization_id_file_id_fkey"
            columns: ["organization_id", "file_id"]
            isOneToOne: false
            referencedRelation: "file_objects"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "bank_transfer_attempts_organization_id_market_id_bank_acco_fkey"
            columns: ["organization_id", "market_id", "bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
          {
            foreignKeyName: "bank_transfer_attempts_organization_id_market_id_payment_i_fkey"
            columns: ["organization_id", "market_id", "payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
          {
            foreignKeyName: "bank_transfer_attempts_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transfer_attempts_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          created_at: string
          id: string
          market_id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          market_id: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          market_id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_market_fk"
            columns: ["organization_id", "market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "branches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          id: string
          identity_kind: string
          organization_id: string
          profile_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          identity_kind?: string
          organization_id: string
          profile_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          identity_kind?: string
          organization_id?: string
          profile_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_organization_id_profile_id_fkey"
            columns: ["organization_id", "profile_id"]
            isOneToOne: true
            referencedRelation: "organization_memberships"
            referencedColumns: ["organization_id", "profile_id"]
          },
        ]
      }
      distance_snapshots: {
        Row: {
          created_at: string
          distance_km: number
          id: string
          market_id: string
          organization_id: string
          request_id: string
          revision: number
          source_note: string | null
          source_type: string
          unit: string
          verified_at: string
          verified_by: string
        }
        Insert: {
          created_at?: string
          distance_km: number
          id?: string
          market_id: string
          organization_id: string
          request_id: string
          revision: number
          source_note?: string | null
          source_type: string
          unit?: string
          verified_at?: string
          verified_by: string
        }
        Update: {
          created_at?: string
          distance_km?: number
          id?: string
          market_id?: string
          organization_id?: string
          request_id?: string
          revision?: number
          source_note?: string | null
          source_type?: string
          unit?: string
          verified_at?: string
          verified_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "distance_snapshots_market_fk"
            columns: ["organization_id", "market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "distance_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distance_snapshots_organization_id_verified_by_fkey"
            columns: ["organization_id", "verified_by"]
            isOneToOne: false
            referencedRelation: "organization_memberships"
            referencedColumns: ["organization_id", "profile_id"]
          },
          {
            foreignKeyName: "distance_snapshots_parent_market_fk"
            columns: ["organization_id", "market_id", "request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
        ]
      }
      drivers: {
        Row: {
          active: boolean
          branch_id: string | null
          created_at: string
          display_name: string | null
          driver_type: string
          id: string
          market_id: string
          organization_id: string
          profile_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          branch_id?: string | null
          created_at?: string
          display_name?: string | null
          driver_type?: string
          id?: string
          market_id: string
          organization_id: string
          profile_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          branch_id?: string | null
          created_at?: string
          display_name?: string | null
          driver_type?: string
          id?: string
          market_id?: string
          organization_id?: string
          profile_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drivers_branch_id_market_fk"
            columns: ["organization_id", "market_id", "branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
          {
            foreignKeyName: "drivers_market_fk"
            columns: ["organization_id", "market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "drivers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_organization_id_profile_id_fkey"
            columns: ["organization_id", "profile_id"]
            isOneToOne: true
            referencedRelation: "organization_memberships"
            referencedColumns: ["organization_id", "profile_id"]
          },
        ]
      }
      file_objects: {
        Row: {
          bucket_id: string
          created_at: string
          guest_customer_id: string | null
          id: string
          mime_type: string | null
          object_name: string
          organization_id: string
          owner_profile_id: string | null
          purpose: string
          size_bytes: number | null
          updated_at: string
          upload_state: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          guest_customer_id?: string | null
          id?: string
          mime_type?: string | null
          object_name?: string
          organization_id: string
          owner_profile_id?: string | null
          purpose?: string
          size_bytes?: number | null
          updated_at?: string
          upload_state?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          guest_customer_id?: string | null
          id?: string
          mime_type?: string | null
          object_name?: string
          organization_id?: string
          owner_profile_id?: string | null
          purpose?: string
          size_bytes?: number | null
          updated_at?: string
          upload_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_guest_customer_fk"
            columns: ["organization_id", "guest_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "file_objects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_objects_organization_id_owner_profile_id_fkey"
            columns: ["organization_id", "owner_profile_id"]
            isOneToOne: false
            referencedRelation: "organization_memberships"
            referencedColumns: ["organization_id", "profile_id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          currency: string | null
          customer_id: string | null
          id: string
          issued_at: string | null
          issued_by: string | null
          kind: string | null
          market_id: string | null
          order_id: string
          organization_id: string
          payment_id: string | null
          reference: string | null
          status: string | null
          subtotal_minor: number | null
          tax_amount_minor: number | null
          tax_code: string | null
          tax_label_ar: string | null
          tax_label_en: string | null
          tax_rate_bps: number | null
          total_minor: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string | null
          customer_id?: string | null
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          kind?: string | null
          market_id?: string | null
          order_id: string
          organization_id: string
          payment_id?: string | null
          reference?: string | null
          status?: string | null
          subtotal_minor?: number | null
          tax_amount_minor?: number | null
          tax_code?: string | null
          tax_label_ar?: string | null
          tax_label_en?: string | null
          tax_rate_bps?: number | null
          total_minor?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string | null
          customer_id?: string | null
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          kind?: string | null
          market_id?: string | null
          order_id?: string
          organization_id?: string
          payment_id?: string | null
          reference?: string | null
          status?: string | null
          subtotal_minor?: number | null
          tax_amount_minor?: number | null
          tax_code?: string | null
          tax_label_ar?: string | null
          tax_label_en?: string | null
          tax_rate_bps?: number | null
          total_minor?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_order_id_fkey"
            columns: ["organization_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "invoices_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_customer"
            columns: ["organization_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "receipt_market"
            columns: ["organization_id", "market_id", "currency"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["organization_id", "id", "currency"]
          },
        ]
      }
      issue_photos: {
        Row: {
          actor_id: string
          created_at: string
          finalized_at: string | null
          id: string
          issue_id: string
          mime_type: string
          object_name: string
          organization_id: string
          size_bytes: number
          state: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          finalized_at?: string | null
          id: string
          issue_id: string
          mime_type: string
          object_name: string
          organization_id: string
          size_bytes: number
          state?: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          finalized_at?: string | null
          id?: string
          issue_id?: string
          mime_type?: string
          object_name?: string
          organization_id?: string
          size_bytes?: number
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_photos_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_photos_organization_id_issue_id_fkey"
            columns: ["organization_id", "issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      issues: {
        Row: {
          actor_id: string | null
          category: string | null
          created_at: string
          id: string
          market_id: string | null
          mutation_id: string | null
          organization_id: string
          reason: string | null
          request_id: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          stop_id: string | null
          trip_id: string | null
          updated_at: string
        }
        Insert: {
          actor_id?: string | null
          category?: string | null
          created_at?: string
          id?: string
          market_id?: string | null
          mutation_id?: string | null
          organization_id: string
          reason?: string | null
          request_id: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          stop_id?: string | null
          trip_id?: string | null
          updated_at?: string
        }
        Update: {
          actor_id?: string | null
          category?: string | null
          created_at?: string
          id?: string
          market_id?: string | null
          mutation_id?: string | null
          organization_id?: string
          reason?: string | null
          request_id?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          stop_id?: string | null
          trip_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_stop_trip"
            columns: ["organization_id", "trip_id", "stop_id"]
            isOneToOne: false
            referencedRelation: "trip_stops"
            referencedColumns: ["organization_id", "trip_id", "id"]
          },
          {
            foreignKeyName: "issue_trip_market"
            columns: ["organization_id", "market_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
          {
            foreignKeyName: "issues_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_organization_id_request_id_fkey"
            columns: ["organization_id", "request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "issues_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          market_id: string
          order_id: string
          organization_id: string
          reference: string | null
          revision: number
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          market_id: string
          order_id: string
          organization_id: string
          reference?: string | null
          revision?: number
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          market_id?: string
          order_id?: string
          organization_id?: string
          reference?: string | null
          revision?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_market_fk"
            columns: ["organization_id", "market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_parent_market_fk"
            columns: ["organization_id", "market_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
        ]
      }
      market_cities: {
        Row: {
          code: string
          id: string
          market_id: string
          name_ar: string
          name_en: string
          organization_id: string
          region_id: string
        }
        Insert: {
          code: string
          id?: string
          market_id: string
          name_ar: string
          name_en: string
          organization_id: string
          region_id: string
        }
        Update: {
          code?: string
          id?: string
          market_id?: string
          name_ar?: string
          name_en?: string
          organization_id?: string
          region_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_cities_organization_id_market_id_region_id_fkey"
            columns: ["organization_id", "market_id", "region_id"]
            isOneToOne: false
            referencedRelation: "market_regions"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
        ]
      }
      market_regions: {
        Row: {
          administrative_type: string
          code: string
          id: string
          market_id: string
          name_ar: string
          name_en: string
          organization_id: string
        }
        Insert: {
          administrative_type: string
          code: string
          id?: string
          market_id: string
          name_ar: string
          name_en: string
          organization_id: string
        }
        Update: {
          administrative_type?: string
          code?: string
          id?: string
          market_id?: string
          name_ar?: string
          name_en?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_regions_organization_id_market_id_fkey"
            columns: ["organization_id", "market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      market_services: {
        Row: {
          active: boolean
          market_id: string
          organization_id: string
          service_id: string
        }
        Insert: {
          active?: boolean
          market_id: string
          organization_id: string
          service_id: string
        }
        Update: {
          active?: boolean
          market_id?: string
          organization_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_services_organization_id_market_id_fkey"
            columns: ["organization_id", "market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "market_services_organization_id_service_id_fkey"
            columns: ["organization_id", "service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      market_tax_versions: {
        Row: {
          active: boolean
          code: string
          configuration_kind: string
          created_at: string
          effective_from: string
          effective_until: string | null
          id: string
          label_ar: string
          label_en: string
          market_id: string
          organization_id: string
          rate_bps: number
          version: number
        }
        Insert: {
          active?: boolean
          code: string
          configuration_kind: string
          created_at?: string
          effective_from: string
          effective_until?: string | null
          id?: string
          label_ar: string
          label_en: string
          market_id: string
          organization_id: string
          rate_bps: number
          version: number
        }
        Update: {
          active?: boolean
          code?: string
          configuration_kind?: string
          created_at?: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          label_ar?: string
          label_en?: string
          market_id?: string
          organization_id?: string
          rate_bps?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "market_tax_versions_organization_id_market_id_fkey"
            columns: ["organization_id", "market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      markets: {
        Row: {
          active: boolean
          country_code: string
          created_at: string
          currency: string
          default_locale: string
          id: string
          name_ar: string
          name_en: string
          organization_id: string
          phone_country_code: string
          timezone: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          country_code: string
          created_at?: string
          currency: string
          default_locale?: string
          id?: string
          name_ar: string
          name_en: string
          organization_id: string
          phone_country_code: string
          timezone: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          country_code?: string
          created_at?: string
          currency?: string
          default_locale?: string
          id?: string
          name_ar?: string
          name_en?: string
          organization_id?: string
          phone_country_code?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "markets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          channel: string
          created_at: string
          id: string
          locale: string
          organization_id: string
          template_key: string
          updated_at: string
        }
        Insert: {
          channel: string
          created_at?: string
          id?: string
          locale: string
          organization_id: string
          template_key: string
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          locale?: string
          organization_id?: string
          template_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          audience: string | null
          created_at: string
          event_code: string | null
          id: string
          idempotency_key: string
          market_id: string | null
          organization_id: string
          payment_id: string | null
          read_at: string | null
          recipient_profile_id: string
          template_id: string | null
          trip_id: string | null
          updated_at: string
        }
        Insert: {
          audience?: string | null
          created_at?: string
          event_code?: string | null
          id?: string
          idempotency_key: string
          market_id?: string | null
          organization_id: string
          payment_id?: string | null
          read_at?: string | null
          recipient_profile_id: string
          template_id?: string | null
          trip_id?: string | null
          updated_at?: string
        }
        Update: {
          audience?: string | null
          created_at?: string
          event_code?: string | null
          id?: string
          idempotency_key?: string
          market_id?: string | null
          organization_id?: string
          payment_id?: string | null
          read_at?: string | null
          recipient_profile_id?: string
          template_id?: string | null
          trip_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_organization_id_recipient_profile_id_fkey"
            columns: ["organization_id", "recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "organization_memberships"
            referencedColumns: ["organization_id", "profile_id"]
          },
          {
            foreignKeyName: "notifications_organization_id_template_id_fkey"
            columns: ["organization_id", "template_id"]
            isOneToOne: false
            referencedRelation: "notification_templates"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "notifications_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          accepted_at: string | null
          accepted_quote_version_id: string
          created_at: string
          currency: string
          customer_id: string | null
          distance_km: number | null
          distance_source: string | null
          id: string
          idempotency_key: string
          market_id: string
          operational_completed_at: string | null
          operational_status: string
          organization_id: string
          quote_id: string
          reference: string | null
          request_id: string | null
          subtotal_minor: number
          tax_code: string | null
          tax_label_ar: string | null
          tax_label_en: string | null
          tax_rate_bps: number | null
          tax_version_id: string | null
          total_minor: number
          updated_at: string
          vat_amount_minor: number
        }
        Insert: {
          accepted_at?: string | null
          accepted_quote_version_id: string
          created_at?: string
          currency: string
          customer_id?: string | null
          distance_km?: number | null
          distance_source?: string | null
          id?: string
          idempotency_key: string
          market_id: string
          operational_completed_at?: string | null
          operational_status?: string
          organization_id: string
          quote_id: string
          reference?: string | null
          request_id?: string | null
          subtotal_minor?: number
          tax_code?: string | null
          tax_label_ar?: string | null
          tax_label_en?: string | null
          tax_rate_bps?: number | null
          tax_version_id?: string | null
          total_minor?: number
          updated_at?: string
          vat_amount_minor?: number
        }
        Update: {
          accepted_at?: string | null
          accepted_quote_version_id?: string
          created_at?: string
          currency?: string
          customer_id?: string | null
          distance_km?: number | null
          distance_source?: string | null
          id?: string
          idempotency_key?: string
          market_id?: string
          operational_completed_at?: string | null
          operational_status?: string
          organization_id?: string
          quote_id?: string
          reference?: string | null
          request_id?: string | null
          subtotal_minor?: number
          tax_code?: string | null
          tax_label_ar?: string | null
          tax_label_en?: string | null
          tax_rate_bps?: number | null
          tax_version_id?: string | null
          total_minor?: number
          updated_at?: string
          vat_amount_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_fk"
            columns: ["organization_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "orders_market_currency_fk"
            columns: ["organization_id", "market_id", "currency"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["organization_id", "id", "currency"]
          },
          {
            foreignKeyName: "orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_organization_id_market_id_tax_version_id_fkey"
            columns: ["organization_id", "market_id", "tax_version_id"]
            isOneToOne: false
            referencedRelation: "market_tax_versions"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
          {
            foreignKeyName: "orders_organization_id_quote_id_accepted_quote_version_id_fkey"
            columns: [
              "organization_id",
              "quote_id",
              "accepted_quote_version_id",
            ]
            isOneToOne: false
            referencedRelation: "quote_versions"
            referencedColumns: ["organization_id", "quote_id", "id"]
          },
          {
            foreignKeyName: "orders_parent_market_fk"
            columns: [
              "organization_id",
              "market_id",
              "accepted_quote_version_id",
            ]
            isOneToOne: false
            referencedRelation: "quote_versions"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
          {
            foreignKeyName: "orders_quote_id_market_fk"
            columns: ["organization_id", "market_id", "quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
          {
            foreignKeyName: "orders_request_id_market_fk"
            columns: ["organization_id", "market_id", "request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
        ]
      }
      organization_memberships: {
        Row: {
          branch_id: string | null
          created_at: string
          member_type: string
          organization_id: string
          profile_id: string
          status: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          member_type: string
          organization_id: string
          profile_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          member_type?: string
          organization_id?: string
          profile_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_organization_id_branch_id_fkey"
            columns: ["organization_id", "branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_memberships_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          actor_id: string | null
          amount_minor: number | null
          attempt_id: string | null
          created_at: string
          currency: string | null
          event_code: string | null
          id: string
          note: string | null
          organization_id: string
          payment_id: string
          provider: string
          provider_event_id: string
          reference: string | null
          updated_at: string
        }
        Insert: {
          actor_id?: string | null
          amount_minor?: number | null
          attempt_id?: string | null
          created_at?: string
          currency?: string | null
          event_code?: string | null
          id?: string
          note?: string | null
          organization_id: string
          payment_id: string
          provider: string
          provider_event_id: string
          reference?: string | null
          updated_at?: string
        }
        Update: {
          actor_id?: string | null
          amount_minor?: number | null
          attempt_id?: string | null
          created_at?: string
          currency?: string | null
          event_code?: string | null
          id?: string
          note?: string | null
          organization_id?: string
          payment_id?: string
          provider?: string
          provider_event_id?: string
          reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "bank_transfer_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_organization_id_payment_id_fkey"
            columns: ["organization_id", "payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_minor: number | null
          confirmed_by: string | null
          created_at: string
          currency: string | null
          customer_id: string | null
          id: string
          market_id: string | null
          method: string | null
          order_id: string
          organization_id: string
          paid_at: string | null
          revision: number
          status: string
          updated_at: string
        }
        Insert: {
          amount_minor?: number | null
          confirmed_by?: string | null
          created_at?: string
          currency?: string | null
          customer_id?: string | null
          id?: string
          market_id?: string | null
          method?: string | null
          order_id: string
          organization_id: string
          paid_at?: string | null
          revision?: number
          status?: string
          updated_at?: string
        }
        Update: {
          amount_minor?: number | null
          confirmed_by?: string | null
          created_at?: string
          currency?: string | null
          customer_id?: string | null
          id?: string
          market_id?: string | null
          method?: string | null
          order_id?: string
          organization_id?: string
          paid_at?: string | null
          revision?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_customer"
            columns: ["organization_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "payment_market"
            columns: ["organization_id", "market_id", "currency"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["organization_id", "id", "currency"]
          },
          {
            foreignKeyName: "payments_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_organization_id_order_id_fkey"
            columns: ["organization_id", "order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      permissions: {
        Row: {
          code: string
          id: string
        }
        Insert: {
          code: string
          id?: string
        }
        Update: {
          code?: string
          id?: string
        }
        Relationships: []
      }
      pricing_evaluation_components: {
        Row: {
          component_code: string
          created_at: string
          evaluation_id: string
          id: string
          label_ar: string
          label_en: string
          market_id: string
          organization_id: string
          position: number
          pricing_rule_id: string
          pricing_rule_version: number
          quantity: number
          total_amount_minor: number
          unit_amount_minor: number
        }
        Insert: {
          component_code: string
          created_at?: string
          evaluation_id: string
          id?: string
          label_ar: string
          label_en: string
          market_id: string
          organization_id: string
          position: number
          pricing_rule_id: string
          pricing_rule_version: number
          quantity: number
          total_amount_minor: number
          unit_amount_minor: number
        }
        Update: {
          component_code?: string
          created_at?: string
          evaluation_id?: string
          id?: string
          label_ar?: string
          label_en?: string
          market_id?: string
          organization_id?: string
          position?: number
          pricing_rule_id?: string
          pricing_rule_version?: number
          quantity?: number
          total_amount_minor?: number
          unit_amount_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pricing_evaluation_components_market_fk"
            columns: ["organization_id", "market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "pricing_evaluation_components_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_evaluation_components_parent_market_fk"
            columns: ["organization_id", "market_id", "evaluation_id"]
            isOneToOne: false
            referencedRelation: "pricing_evaluations"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
          {
            foreignKeyName: "pricing_evaluation_components_pricing_rule_id_market_fk"
            columns: ["organization_id", "market_id", "pricing_rule_id"]
            isOneToOne: false
            referencedRelation: "pricing_rules"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
        ]
      }
      pricing_evaluations: {
        Row: {
          calculated_at: string
          calculated_by: string
          calculated_subtotal_minor: number
          created_at: string
          currency: string
          distance_snapshot_id: string
          id: string
          market_id: string
          mutation_id: string
          organization_id: string
          request_id: string
          request_revision: number
          route_scope: string
          status: string
          tax_version_id: string | null
          vehicle_class_id: string
          worker_count: number
        }
        Insert: {
          calculated_at?: string
          calculated_by: string
          calculated_subtotal_minor: number
          created_at?: string
          currency: string
          distance_snapshot_id: string
          id?: string
          market_id: string
          mutation_id: string
          organization_id: string
          request_id: string
          request_revision: number
          route_scope: string
          status?: string
          tax_version_id?: string | null
          vehicle_class_id: string
          worker_count: number
        }
        Update: {
          calculated_at?: string
          calculated_by?: string
          calculated_subtotal_minor?: number
          created_at?: string
          currency?: string
          distance_snapshot_id?: string
          id?: string
          market_id?: string
          mutation_id?: string
          organization_id?: string
          request_id?: string
          request_revision?: number
          route_scope?: string
          status?: string
          tax_version_id?: string | null
          vehicle_class_id?: string
          worker_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "pricing_evaluations_distance_snapshot_id_market_fk"
            columns: ["organization_id", "market_id", "distance_snapshot_id"]
            isOneToOne: false
            referencedRelation: "distance_snapshots"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
          {
            foreignKeyName: "pricing_evaluations_market_currency_fk"
            columns: ["organization_id", "market_id", "currency"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["organization_id", "id", "currency"]
          },
          {
            foreignKeyName: "pricing_evaluations_organization_id_calculated_by_fkey"
            columns: ["organization_id", "calculated_by"]
            isOneToOne: false
            referencedRelation: "organization_memberships"
            referencedColumns: ["organization_id", "profile_id"]
          },
          {
            foreignKeyName: "pricing_evaluations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_evaluations_organization_id_market_id_tax_version__fkey"
            columns: ["organization_id", "market_id", "tax_version_id"]
            isOneToOne: false
            referencedRelation: "market_tax_versions"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
          {
            foreignKeyName: "pricing_evaluations_parent_market_fk"
            columns: ["organization_id", "market_id", "request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
          {
            foreignKeyName: "pricing_evaluations_vehicle_class_id_market_fk"
            columns: ["organization_id", "market_id", "vehicle_class_id"]
            isOneToOne: false
            referencedRelation: "vehicle_pricing_classes"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          active: boolean
          amount_minor: number
          calculation_method: string
          code: string
          component_code: string
          created_at: string
          effective_from: string
          effective_until: string | null
          id: string
          label_ar: string
          label_en: string
          market_id: string
          organization_id: string
          selector_code: string | null
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          amount_minor: number
          calculation_method: string
          code: string
          component_code: string
          created_at?: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          label_ar: string
          label_en: string
          market_id: string
          organization_id: string
          selector_code?: string | null
          updated_at?: string
          version: number
        }
        Update: {
          active?: boolean
          amount_minor?: number
          calculation_method?: string
          code?: string
          component_code?: string
          created_at?: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          label_ar?: string
          label_en?: string
          market_id?: string
          organization_id?: string
          selector_code?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_market_fk"
            columns: ["organization_id", "market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "pricing_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_settings: {
        Row: {
          created_at: string
          currency: string
          market_id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency: string
          market_id: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          market_id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_settings_market_currency_fk"
            columns: ["organization_id", "market_id", "currency"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["organization_id", "id", "currency"]
          },
          {
            foreignKeyName: "pricing_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          locale: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      quality_alerts: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_alerts_organization_id_trip_id_fkey"
            columns: ["organization_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      quote_items: {
        Row: {
          component_code: string
          created_at: string
          id: string
          label_ar: string
          label_en: string
          market_id: string
          organization_id: string
          position: number
          quantity: number
          quote_version_id: string
          total_amount_minor: number
          unit_amount_minor: number
          updated_at: string
        }
        Insert: {
          component_code?: string
          created_at?: string
          id?: string
          label_ar?: string
          label_en?: string
          market_id: string
          organization_id: string
          position?: number
          quantity?: number
          quote_version_id: string
          total_amount_minor?: number
          unit_amount_minor?: number
          updated_at?: string
        }
        Update: {
          component_code?: string
          created_at?: string
          id?: string
          label_ar?: string
          label_en?: string
          market_id?: string
          organization_id?: string
          position?: number
          quantity?: number
          quote_version_id?: string
          total_amount_minor?: number
          unit_amount_minor?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_market_fk"
            columns: ["organization_id", "market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "quote_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_parent_market_fk"
            columns: ["organization_id", "market_id", "quote_version_id"]
            isOneToOne: false
            referencedRelation: "quote_versions"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
        ]
      }
      quote_pricing_details: {
        Row: {
          adjustment_reason: string | null
          calculated_subtotal_minor: number
          created_at: string
          created_by: string
          evaluation_id: string
          manual_adjustment_minor: number
          market_id: string
          organization_id: string
          quote_version_id: string
          sent_by: string | null
        }
        Insert: {
          adjustment_reason?: string | null
          calculated_subtotal_minor: number
          created_at?: string
          created_by: string
          evaluation_id: string
          manual_adjustment_minor: number
          market_id: string
          organization_id: string
          quote_version_id: string
          sent_by?: string | null
        }
        Update: {
          adjustment_reason?: string | null
          calculated_subtotal_minor?: number
          created_at?: string
          created_by?: string
          evaluation_id?: string
          manual_adjustment_minor?: number
          market_id?: string
          organization_id?: string
          quote_version_id?: string
          sent_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_pricing_details_evaluation_id_market_fk"
            columns: ["organization_id", "market_id", "evaluation_id"]
            isOneToOne: false
            referencedRelation: "pricing_evaluations"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
          {
            foreignKeyName: "quote_pricing_details_market_fk"
            columns: ["organization_id", "market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "quote_pricing_details_organization_id_created_by_fkey"
            columns: ["organization_id", "created_by"]
            isOneToOne: false
            referencedRelation: "organization_memberships"
            referencedColumns: ["organization_id", "profile_id"]
          },
          {
            foreignKeyName: "quote_pricing_details_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_pricing_details_organization_id_sent_by_fkey"
            columns: ["organization_id", "sent_by"]
            isOneToOne: false
            referencedRelation: "organization_memberships"
            referencedColumns: ["organization_id", "profile_id"]
          },
          {
            foreignKeyName: "quote_pricing_details_parent_market_fk"
            columns: ["organization_id", "market_id", "quote_version_id"]
            isOneToOne: false
            referencedRelation: "quote_versions"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
        ]
      }
      quote_versions: {
        Row: {
          accepted_at: string | null
          created_at: string
          currency: string
          distance_km: number | null
          distance_source: string | null
          distance_verified_at: string | null
          expires_at: string | null
          final_subtotal_minor: number
          id: string
          market_id: string
          organization_id: string
          quote_id: string
          rejected_at: string | null
          rejection_reason: string | null
          sent_at: string | null
          status: string
          tax_code: string | null
          tax_label_ar: string | null
          tax_label_en: string | null
          tax_version_id: string | null
          total_minor: number
          updated_at: string
          validity_seconds: number
          vat_amount_minor: number
          vat_rate_bps: number
          version: number
          viewed_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          currency: string
          distance_km?: number | null
          distance_source?: string | null
          distance_verified_at?: string | null
          expires_at?: string | null
          final_subtotal_minor?: number
          id?: string
          market_id: string
          organization_id: string
          quote_id: string
          rejected_at?: string | null
          rejection_reason?: string | null
          sent_at?: string | null
          status?: string
          tax_code?: string | null
          tax_label_ar?: string | null
          tax_label_en?: string | null
          tax_version_id?: string | null
          total_minor?: number
          updated_at?: string
          validity_seconds?: number
          vat_amount_minor?: number
          vat_rate_bps?: number
          version: number
          viewed_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          currency?: string
          distance_km?: number | null
          distance_source?: string | null
          distance_verified_at?: string | null
          expires_at?: string | null
          final_subtotal_minor?: number
          id?: string
          market_id?: string
          organization_id?: string
          quote_id?: string
          rejected_at?: string | null
          rejection_reason?: string | null
          sent_at?: string | null
          status?: string
          tax_code?: string | null
          tax_label_ar?: string | null
          tax_label_en?: string | null
          tax_version_id?: string | null
          total_minor?: number
          updated_at?: string
          validity_seconds?: number
          vat_amount_minor?: number
          vat_rate_bps?: number
          version?: number
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_versions_market_currency_fk"
            columns: ["organization_id", "market_id", "currency"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["organization_id", "id", "currency"]
          },
          {
            foreignKeyName: "quote_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_versions_organization_id_market_id_tax_version_id_fkey"
            columns: ["organization_id", "market_id", "tax_version_id"]
            isOneToOne: false
            referencedRelation: "market_tax_versions"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
          {
            foreignKeyName: "quote_versions_parent_market_fk"
            columns: ["organization_id", "market_id", "quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
        ]
      }
      quotes: {
        Row: {
          created_at: string
          currency: string
          id: string
          market_id: string
          organization_id: string
          reference: string | null
          request_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency: string
          id?: string
          market_id: string
          organization_id: string
          reference?: string | null
          request_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          market_id?: string
          organization_id?: string
          reference?: string | null
          request_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_organization_id_market_id_currency_fkey"
            columns: ["organization_id", "market_id", "currency"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["organization_id", "id", "currency"]
          },
          {
            foreignKeyName: "quotes_parent_market_fk"
            columns: ["organization_id", "market_id", "request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
        ]
      }
      request_additional_services: {
        Row: {
          additional_service_id: string
          market_id: string
          organization_id: string
          request_id: string
        }
        Insert: {
          additional_service_id: string
          market_id: string
          organization_id: string
          request_id: string
        }
        Update: {
          additional_service_id?: string
          market_id?: string
          organization_id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_additional_services_market_fk"
            columns: ["organization_id", "market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "request_additional_services_organization_id_additional_ser_fkey"
            columns: ["organization_id", "additional_service_id"]
            isOneToOne: false
            referencedRelation: "additional_services"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "request_additional_services_parent_market_fk"
            columns: ["organization_id", "market_id", "request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
        ]
      }
      request_attachments: {
        Row: {
          created_at: string
          file_id: string
          id: string
          market_id: string
          organization_id: string
          request_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          file_id: string
          id?: string
          market_id: string
          organization_id: string
          request_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          file_id?: string
          id?: string
          market_id?: string
          organization_id?: string
          request_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_attachments_market_fk"
            columns: ["organization_id", "market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "request_attachments_organization_id_file_id_fkey"
            columns: ["organization_id", "file_id"]
            isOneToOne: false
            referencedRelation: "file_objects"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "request_attachments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_attachments_parent_market_fk"
            columns: ["organization_id", "market_id", "request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
        ]
      }
      request_items: {
        Row: {
          created_at: string
          description: string
          id: string
          market_id: string
          notes: string
          organization_id: string
          position: number
          quantity: number
          request_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          market_id: string
          notes?: string
          organization_id: string
          position?: number
          quantity?: number
          request_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          market_id?: string
          notes?: string
          organization_id?: string
          position?: number
          quantity?: number
          request_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_items_market_fk"
            columns: ["organization_id", "market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "request_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_items_parent_market_fk"
            columns: ["organization_id", "market_id", "request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
        ]
      }
      request_locations: {
        Row: {
          access_notes: string
          address: string
          building: string
          city: string
          city_id: string | null
          district: string
          elevator: boolean | null
          floor: number | null
          kind: string
          market_id: string
          notes: string
          organization_id: string
          postal_code: string
          request_id: string
          unit: string
        }
        Insert: {
          access_notes?: string
          address?: string
          building?: string
          city?: string
          city_id?: string | null
          district?: string
          elevator?: boolean | null
          floor?: number | null
          kind: string
          market_id: string
          notes?: string
          organization_id: string
          postal_code?: string
          request_id: string
          unit?: string
        }
        Update: {
          access_notes?: string
          address?: string
          building?: string
          city?: string
          city_id?: string | null
          district?: string
          elevator?: boolean | null
          floor?: number | null
          kind?: string
          market_id?: string
          notes?: string
          organization_id?: string
          postal_code?: string
          request_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_locations_market_fk"
            columns: ["organization_id", "market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "request_locations_organization_id_market_id_city_id_fkey"
            columns: ["organization_id", "market_id", "city_id"]
            isOneToOne: false
            referencedRelation: "market_cities"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
          {
            foreignKeyName: "request_locations_parent_market_fk"
            columns: ["organization_id", "market_id", "request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
        ]
      }
      requests: {
        Row: {
          contact_email: string
          contact_name: string
          contact_notes: string
          contact_phone: string
          created_at: string
          creation_key: string | null
          customer_id: string
          description: string
          id: string
          last_mutation_id: string | null
          market_id: string
          notes: string
          organization_id: string
          preferred_date: string | null
          reference: string | null
          revision: number
          service_id: string | null
          status: string
          submitted_at: string | null
          time_window: string | null
          updated_at: string
        }
        Insert: {
          contact_email?: string
          contact_name?: string
          contact_notes?: string
          contact_phone?: string
          created_at?: string
          creation_key?: string | null
          customer_id: string
          description?: string
          id?: string
          last_mutation_id?: string | null
          market_id: string
          notes?: string
          organization_id: string
          preferred_date?: string | null
          reference?: string | null
          revision?: number
          service_id?: string | null
          status?: string
          submitted_at?: string | null
          time_window?: string | null
          updated_at?: string
        }
        Update: {
          contact_email?: string
          contact_name?: string
          contact_notes?: string
          contact_phone?: string
          created_at?: string
          creation_key?: string | null
          customer_id?: string
          description?: string
          id?: string
          last_mutation_id?: string | null
          market_id?: string
          notes?: string
          organization_id?: string
          preferred_date?: string | null
          reference?: string | null
          revision?: number
          service_id?: string | null
          status?: string
          submitted_at?: string | null
          time_window?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requests_market_fk"
            columns: ["organization_id", "market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "requests_organization_id_customer_id_fkey"
            columns: ["organization_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_organization_id_market_id_service_id_fkey"
            columns: ["organization_id", "market_id", "service_id"]
            isOneToOne: false
            referencedRelation: "market_services"
            referencedColumns: ["organization_id", "market_id", "service_id"]
          },
          {
            foreignKeyName: "requests_service_fk"
            columns: ["organization_id", "service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      reviews: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          order_id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          order_id: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          order_id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_organization_id_customer_id_fkey"
            columns: ["organization_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "reviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_organization_id_order_id_fkey"
            columns: ["organization_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          id: string
          member_type: string
        }
        Insert: {
          code: string
          id?: string
          member_type: string
        }
        Update: {
          code?: string
          id?: string
          member_type?: string
        }
        Relationships: []
      }
      service_areas: {
        Row: {
          active: boolean
          city_id: string | null
          created_at: string
          id: string
          market_id: string
          organization_id: string
          service_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          city_id?: string | null
          created_at?: string
          id?: string
          market_id: string
          organization_id: string
          service_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          city_id?: string | null
          created_at?: string
          id?: string
          market_id?: string
          organization_id?: string
          service_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_areas_market_fk"
            columns: ["organization_id", "market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "service_areas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_areas_organization_id_market_id_city_id_fkey"
            columns: ["organization_id", "market_id", "city_id"]
            isOneToOne: false
            referencedRelation: "market_cities"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
          {
            foreignKeyName: "service_areas_organization_id_market_id_service_id_fkey"
            columns: ["organization_id", "market_id", "service_id"]
            isOneToOne: false
            referencedRelation: "market_services"
            referencedColumns: ["organization_id", "market_id", "service_id"]
          },
          {
            foreignKeyName: "service_areas_organization_id_service_id_fkey"
            columns: ["organization_id", "service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name_ar: string | null
          name_en: string | null
          organization_id: string
          property_required: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name_ar?: string | null
          name_en?: string | null
          organization_id: string
          property_required?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name_ar?: string | null
          name_en?: string | null
          organization_id?: string
          property_required?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      support_notes: {
        Row: {
          author_profile_id: string
          created_at: string
          id: string
          issue_id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          author_profile_id: string
          created_at?: string
          id?: string
          issue_id: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          author_profile_id?: string
          created_at?: string
          id?: string
          issue_id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_notes_organization_id_author_profile_id_fkey"
            columns: ["organization_id", "author_profile_id"]
            isOneToOne: false
            referencedRelation: "organization_memberships"
            referencedColumns: ["organization_id", "profile_id"]
          },
          {
            foreignKeyName: "support_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_notes_organization_id_issue_id_fkey"
            columns: ["organization_id", "issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      teams: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          market_id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          market_id: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          market_id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_branch_id_market_fk"
            columns: ["organization_id", "market_id", "branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
          {
            foreignKeyName: "teams_market_fk"
            columns: ["organization_id", "market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_event_locations: {
        Row: {
          accuracy_m: number | null
          actor_id: string
          captured_at: string
          event_id: string
          latitude: number
          longitude: number
          organization_id: string
          recorded_at: string
          trip_id: string
        }
        Insert: {
          accuracy_m?: number | null
          actor_id: string
          captured_at: string
          event_id: string
          latitude: number
          longitude: number
          organization_id: string
          recorded_at?: string
          trip_id: string
        }
        Update: {
          accuracy_m?: number | null
          actor_id?: string
          captured_at?: string
          event_id?: string
          latitude?: number
          longitude?: number
          organization_id?: string
          recorded_at?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_event_locations_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_event_locations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "trip_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_event_locations_organization_id_trip_id_fkey"
            columns: ["organization_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      trip_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          market_id: string
          metadata: Json
          occurred_at: string
          organization_id: string
          source: string
          stop_id: string | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          market_id: string
          metadata?: Json
          occurred_at?: string
          organization_id: string
          source?: string
          stop_id?: string | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          market_id?: string
          metadata?: Json
          occurred_at?: string
          organization_id?: string
          source?: string
          stop_id?: string | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_events_market_fk"
            columns: ["organization_id", "market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "trip_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_events_parent_market_fk"
            columns: ["organization_id", "market_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
          {
            foreignKeyName: "trip_events_stop_fk"
            columns: ["organization_id", "trip_id", "stop_id"]
            isOneToOne: false
            referencedRelation: "trip_stops"
            referencedColumns: ["organization_id", "trip_id", "id"]
          },
        ]
      }
      trip_live_locations: {
        Row: {
          accuracy_m: number | null
          active: boolean
          captured_at: string | null
          latitude: number | null
          longitude: number | null
          market_id: string
          organization_id: string
          received_at: string | null
          trip_id: string
          version: number
        }
        Insert: {
          accuracy_m?: number | null
          active?: boolean
          captured_at?: string | null
          latitude?: number | null
          longitude?: number | null
          market_id: string
          organization_id: string
          received_at?: string | null
          trip_id: string
          version?: number
        }
        Update: {
          accuracy_m?: number | null
          active?: boolean
          captured_at?: string | null
          latitude?: number | null
          longitude?: number | null
          market_id?: string
          organization_id?: string
          received_at?: string | null
          trip_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "trip_live_locations_organization_id_market_id_trip_id_fkey"
            columns: ["organization_id", "market_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
          {
            foreignKeyName: "trip_live_locations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: true
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_pods: {
        Row: {
          actor_id: string
          captured_at: string | null
          created_at: string
          id: string
          market_id: string
          mime_type: string
          notes: string
          object_name: string
          organization_id: string
          recipient_name: string
          size_bytes: number
          state: string
          trip_id: string
        }
        Insert: {
          actor_id: string
          captured_at?: string | null
          created_at?: string
          id: string
          market_id: string
          mime_type: string
          notes?: string
          object_name: string
          organization_id: string
          recipient_name: string
          size_bytes: number
          state?: string
          trip_id: string
        }
        Update: {
          actor_id?: string
          captured_at?: string | null
          created_at?: string
          id?: string
          market_id?: string
          mime_type?: string
          notes?: string
          object_name?: string
          organization_id?: string
          recipient_name?: string
          size_bytes?: number
          state?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_pods_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_pods_market_fk"
            columns: ["organization_id", "market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "trip_pods_parent_market_fk"
            columns: ["organization_id", "market_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
        ]
      }
      trip_stop_dependencies: {
        Row: {
          delivery_stop_id: string
          organization_id: string
          pickup_stop_id: string
          trip_id: string
        }
        Insert: {
          delivery_stop_id: string
          organization_id: string
          pickup_stop_id: string
          trip_id: string
        }
        Update: {
          delivery_stop_id?: string
          organization_id?: string
          pickup_stop_id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_stop_dependencies_organization_id_trip_id_delivery_st_fkey"
            columns: ["organization_id", "trip_id", "delivery_stop_id"]
            isOneToOne: false
            referencedRelation: "trip_stops"
            referencedColumns: ["organization_id", "trip_id", "id"]
          },
          {
            foreignKeyName: "trip_stop_dependencies_organization_id_trip_id_pickup_stop_fkey"
            columns: ["organization_id", "trip_id", "pickup_stop_id"]
            isOneToOne: false
            referencedRelation: "trip_stops"
            referencedColumns: ["organization_id", "trip_id", "id"]
          },
        ]
      }
      trip_stops: {
        Row: {
          address: string | null
          arrived_at: string | null
          city_id: string | null
          completed_at: string | null
          created_at: string
          driver_instructions: string
          id: string
          kind: string | null
          market_id: string
          notes: string
          organization_id: string
          position: number
          status: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          arrived_at?: string | null
          city_id?: string | null
          completed_at?: string | null
          created_at?: string
          driver_instructions?: string
          id?: string
          kind?: string | null
          market_id: string
          notes?: string
          organization_id: string
          position: number
          status?: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          arrived_at?: string | null
          city_id?: string | null
          completed_at?: string | null
          created_at?: string
          driver_instructions?: string
          id?: string
          kind?: string | null
          market_id?: string
          notes?: string
          organization_id?: string
          position?: number
          status?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_stops_market_fk"
            columns: ["organization_id", "market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "trip_stops_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_stops_organization_id_market_id_city_id_fkey"
            columns: ["organization_id", "market_id", "city_id"]
            isOneToOne: false
            referencedRelation: "market_cities"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
          {
            foreignKeyName: "trip_stops_parent_market_fk"
            columns: ["organization_id", "market_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
        ]
      }
      trips: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          job_id: string
          market_id: string
          organization_id: string
          planned_end: string | null
          planned_start: string | null
          reference: string | null
          revision: number
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          job_id: string
          market_id: string
          organization_id: string
          planned_end?: string | null
          planned_start?: string | null
          reference?: string | null
          revision?: number
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          job_id?: string
          market_id?: string
          organization_id?: string
          planned_end?: string | null
          planned_start?: string | null
          reference?: string | null
          revision?: number
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_market_fk"
            columns: ["organization_id", "market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "trips_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_parent_market_fk"
            columns: ["organization_id", "market_id", "job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          organization_id: string
          profile_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          profile_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          profile_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_profile_id_fkey"
            columns: ["organization_id", "profile_id"]
            isOneToOne: false
            referencedRelation: "organization_memberships"
            referencedColumns: ["organization_id", "profile_id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_pricing_classes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          market_id: string
          name_ar: string
          name_en: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          market_id: string
          name_ar: string
          name_en: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          market_id?: string
          name_ar?: string
          name_en?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_pricing_classes_market_fk"
            columns: ["organization_id", "market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "vehicle_pricing_classes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          active: boolean
          branch_id: string | null
          created_at: string
          id: string
          identifier: string | null
          market_id: string
          organization_id: string
          updated_at: string
          vehicle_type: string | null
        }
        Insert: {
          active?: boolean
          branch_id?: string | null
          created_at?: string
          id?: string
          identifier?: string | null
          market_id: string
          organization_id: string
          updated_at?: string
          vehicle_type?: string | null
        }
        Update: {
          active?: boolean
          branch_id?: string | null
          created_at?: string
          id?: string
          identifier?: string | null
          market_id?: string
          organization_id?: string
          updated_at?: string
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_branch_id_market_fk"
            columns: ["organization_id", "market_id", "branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["organization_id", "market_id", "id"]
          },
          {
            foreignKeyName: "vehicles_market_fk"
            columns: ["organization_id", "market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "vehicles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_preliminary_price: {
        Args: {
          p_distance_km: number
          p_mutation_id: string
          p_request_id: string
          p_source_note: string
          p_vehicle_class_id: string
          p_worker_count: number
        }
        Returns: Json
      }
      configure_bank_account: {
        Args: {
          p_details: Json
          p_id: string
          p_market: string
          p_mutation: string
          p_org: string
          p_revision: number
        }
        Returns: Json
      }
      create_customer_request: {
        Args: { p_key: string; p_market_id: string }
        Returns: Json
      }
      create_quote_draft: {
        Args: {
          p_adjustment_minor: number
          p_adjustment_reason: string
          p_evaluation_id: string
          p_mutation_id: string
          p_validity_seconds: number
        }
        Returns: Json
      }
      customer_enrollment_state: { Args: never; Returns: string }
      customer_order_progress: { Args: { p_order_id: string }; Returns: Json }
      driver_evidence_path: {
        Args: { p_id: string; p_kind: string }
        Returns: Json
      }
      driver_execute: {
        Args: {
          p_action: string
          p_location?: Json
          p_mutation: string
          p_payload?: Json
          p_revision: number
          p_trip: string
        }
        Returns: Json
      }
      driver_finalize_pod: {
        Args: { p_file: string; p_location?: Json; p_trip: string }
        Returns: Json
      }
      driver_identity: { Args: never; Returns: Json }
      driver_trip: { Args: { p_trip: string }; Returns: Json }
      driver_trips: {
        Args: { p_offset?: number; p_view?: string }
        Returns: Json
      }
      finance_queue: {
        Args: { p_offset?: number; p_org: string; p_status?: string }
        Returns: Json
      }
      guest_access_state: { Args: never; Returns: Json }
      guest_catalogue_visible: { Args: { p_org: string }; Returns: boolean }
      guest_customer_visible: {
        Args: { p_customer: string; p_org: string }
        Returns: boolean
      }
      guest_preliminary_price: { Args: never; Returns: Json }
      guest_quote_version_visible: {
        Args: { p_org: string; p_version: string }
        Returns: boolean
      }
      guest_quote_visible: {
        Args: { p_org: string; p_quote: string }
        Returns: boolean
      }
      guest_request_file_visible: {
        Args: { p_file: string; p_org: string }
        Returns: boolean
      }
      guest_request_storage: {
        Args: {
          p_bucket: string
          p_metadata?: Json
          p_operation: string
          p_path: string
        }
        Returns: boolean
      }
      guest_request_visible: {
        Args: { p_org: string; p_request: string }
        Returns: boolean
      }
      has_permission: {
        Args: { organization_id: string; permission_code: string }
        Returns: boolean
      }
      issue_photo_command: {
        Args: {
          p_action: string
          p_file: string
          p_issue: string
          p_mime?: string
          p_size?: number
        }
        Returns: Json
      }
      onboard_customer: {
        Args: { p_locale: string; p_name: string; p_phone: string }
        Returns: string
      }
      operational_job_summary: { Args: { p_job_id: string }; Returns: Json }
      operations_command: {
        Args: {
          p_action: string
          p_entity_id: string
          p_mutation_id: string
          p_organization_id: string
          p_payload?: Json
          p_revision: number
        }
        Returns: Json
      }
      payment_clearance: { Args: { p_trip: string }; Returns: Json }
      payment_command: {
        Args: {
          p_action: string
          p_mutation: string
          p_order: string
          p_payload?: Json
          p_revision: number
        }
        Returns: Json
      }
      payment_details: { Args: { p_order: string }; Returns: Json }
      public_market_catalogue: { Args: never; Returns: Json }
      publish_trip_location: {
        Args: { p_location: Json; p_sample: string; p_trip: string }
        Returns: Json
      }
      read_notification: {
        Args: { p_notification: string }
        Returns: undefined
      }
      report_driver_issue: {
        Args: {
          p_category: string
          p_mutation: string
          p_reason: string
          p_stop: string
          p_trip: string
        }
        Returns: Json
      }
      request_command: {
        Args: {
          p_mutation_id: string
          p_operation: string
          p_payload?: Json
          p_request_id: string
          p_revision: number
        }
        Returns: Json
      }
      request_file_command: {
        Args: {
          p_file_id: string
          p_mime?: string
          p_operation: string
          p_request_id: string
          p_size?: number
        }
        Returns: Json
      }
      resolve_driver_issue: {
        Args: { p_issue: string; p_reason: string }
        Returns: Json
      }
      respond_to_quote: {
        Args: {
          p_action: string
          p_idempotency_key: string
          p_quote_version_id: string
          p_reason?: string
        }
        Returns: Json
      }
      send_quote: { Args: { p_quote_version_id: string }; Returns: Json }
      start_guest_request: { Args: { p_country: string }; Returns: Json }
      tracking_feed: {
        Args: {
          p_driver?: string
          p_market?: string
          p_offset?: number
          p_order?: string
          p_trip?: string
        }
        Returns: Json
      }
      tracking_policy: { Args: never; Returns: Json }
      transfer_proof_path: { Args: { p_attempt: string }; Returns: Json }
      trip_pod_command: {
        Args: {
          p_action: string
          p_file_id: string
          p_mime?: string
          p_notes?: string
          p_recipient?: string
          p_size?: number
          p_trip_id: string
        }
        Returns: Json
      }
      view_customer_quote: {
        Args: { p_quote_version_id: string }
        Returns: Json
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
    Enums: {},
  },
} as const
