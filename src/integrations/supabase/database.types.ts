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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
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
  public: {
    Tables: {
      access_logs: {
        Row: {
          action: string
          company_id: string | null
          created_at: string
          email: string | null
          id: string
          ip_address: string | null
          role: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          ip_address?: string | null
          role?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          ip_address?: string | null
          role?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      approvals: {
        Row: {
          approver_id: string | null
          company_id: string
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          notes: string | null
          requester_id: string | null
          resolved_at: string | null
          status: string
        }
        Insert: {
          approver_id?: string | null
          company_id: string
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          notes?: string | null
          requester_id?: string | null
          resolved_at?: string | null
          status?: string
        }
        Update: {
          approver_id?: string | null
          company_id?: string
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          notes?: string | null
          requester_id?: string | null
          resolved_at?: string | null
          status?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          check_in: string | null
          check_out: string | null
          company_id: string
          correction_reason: string | null
          created_at: string
          date: string
          employee_id: string
          hours_worked: number | null
          id: string
          status: string
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          company_id: string
          correction_reason?: string | null
          created_at?: string
          date?: string
          employee_id: string
          hours_worked?: number | null
          id?: string
          status?: string
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          company_id?: string
          correction_reason?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          hours_worked?: number | null
          id?: string
          status?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          company_id: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bom: {
        Row: {
          company_id: string
          created_at: string
          id: string
          notes: string | null
          product_id: string
          status: string
          updated_at: string
          version: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          status?: string
          updated_at?: string
          version?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          status?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      bom_items: {
        Row: {
          bom_id: string
          company_id: string
          component_product_id: string
          created_at: string
          id: string
          quantity: number
          unit: string | null
        }
        Insert: {
          bom_id: string
          company_id: string
          component_product_id: string
          created_at?: string
          id?: string
          quantity?: number
          unit?: string | null
        }
        Update: {
          bom_id?: string
          company_id?: string
          component_product_id?: string
          created_at?: string
          id?: string
          quantity?: number
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bom_items_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bom"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          allocated_amount: number
          company_id: string
          created_at: string
          department_id: string | null
          id: string
          notes: string | null
          period: string
          updated_at: string
        }
        Insert: {
          allocated_amount?: number
          company_id: string
          created_at?: string
          department_id?: string | null
          id?: string
          notes?: string | null
          period: string
          updated_at?: string
        }
        Update: {
          allocated_amount?: number
          company_id?: string
          created_at?: string
          department_id?: string | null
          id?: string
          notes?: string | null
          period?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          company_id: string
          created_at: string
          email: string | null
          id: string
          job_posting_id: string | null
          name: string
          notes: string | null
          phone: string | null
          position: string | null
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          email?: string | null
          id?: string
          job_posting_id?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          job_posting_id?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_job_posting_id_fkey"
            columns: ["job_posting_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      capa: {
        Row: {
          assigned_to: string | null
          capa_number: string
          company_id: string
          corrective_action: string | null
          created_at: string
          created_by: string
          due_date: string | null
          id: string
          ncr_id: string | null
          preventive_action: string | null
          resolved_inspection_id: string | null
          status: string
        }
        Insert: {
          assigned_to?: string | null
          capa_number: string
          company_id: string
          corrective_action?: string | null
          created_at?: string
          created_by: string
          due_date?: string | null
          id?: string
          ncr_id?: string | null
          preventive_action?: string | null
          resolved_inspection_id?: string | null
          status?: string
        }
        Update: {
          assigned_to?: string | null
          capa_number?: string
          company_id?: string
          corrective_action?: string | null
          created_at?: string
          created_by?: string
          due_date?: string | null
          id?: string
          ncr_id?: string | null
          preventive_action?: string | null
          resolved_inspection_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "capa_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          country: string | null
          created_at: string
          currency: string | null
          gst_number: string | null
          id: string
          industry: string | null
          invoice_qr_at_approval: boolean | null
          legal_name: string | null
          logo_url: string | null
          name: string
          plan_tier: string | null
          registration_number: string | null
          status: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          gst_number?: string | null
          id?: string
          industry?: string | null
          invoice_qr_at_approval?: boolean | null
          legal_name?: string | null
          logo_url?: string | null
          name: string
          plan_tier?: string | null
          registration_number?: string | null
          status?: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          gst_number?: string | null
          id?: string
          industry?: string | null
          invoice_qr_at_approval?: boolean | null
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          plan_tier?: string | null
          registration_number?: string | null
          status?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_registrations: {
        Row: {
          company_name: string
          country: string | null
          created_at: string
          email: string
          id: string
          industry: string | null
          legal_name: string | null
          phone: string | null
          registration_data: Json | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          company_name: string
          country?: string | null
          created_at?: string
          email: string
          id?: string
          industry?: string | null
          legal_name?: string | null
          phone?: string | null
          registration_data?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          company_name?: string
          country?: string | null
          created_at?: string
          email?: string
          id?: string
          industry?: string | null
          legal_name?: string | null
          phone?: string | null
          registration_data?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: []
      }
      compliance_records: {
        Row: {
          company_id: string
          created_at: string
          document_url: string | null
          expires_at: string | null
          id: string
          standard: string | null
          status: string
          title: string
          valid_from: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          document_url?: string | null
          expires_at?: string | null
          id?: string
          standard?: string | null
          status?: string
          title: string
          valid_from?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          document_url?: string | null
          expires_at?: string | null
          id?: string
          standard?: string | null
          status?: string
          title?: string
          valid_from?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_documents: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string
          description: string | null
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          title: string
          uploaded_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id: string
          description?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          title: string
          uploaded_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string
          description?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          title?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      customer_orders: {
        Row: {
          advance_amount: number | null
          advance_payment_percent: number | null
          advance_payment_status: string | null
          advance_qr_url: string | null
          approved_at: string | null
          approved_by: string | null
          balance_due: number | null
          company_id: string
          created_at: string | null
          customer_id: string
          delivery_date: string | null
          file_upload_url: string | null
          id: string
          material_id: string | null
          notes: string | null
          order_number: string
          order_total: number | null
          priority: string | null
          product: string
          quantity: number
          rejection_reason: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          advance_amount?: number | null
          advance_payment_percent?: number | null
          advance_payment_status?: string | null
          advance_qr_url?: string | null
          approved_at?: string | null
          approved_by?: string | null
          balance_due?: number | null
          company_id: string
          created_at?: string | null
          customer_id: string
          delivery_date?: string | null
          file_upload_url?: string | null
          id?: string
          material_id?: string | null
          notes?: string | null
          order_number: string
          order_total?: number | null
          priority?: string | null
          product: string
          quantity?: number
          rejection_reason?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          advance_amount?: number | null
          advance_payment_percent?: number | null
          advance_payment_status?: string | null
          advance_qr_url?: string | null
          approved_at?: string | null
          approved_by?: string | null
          balance_due?: number | null
          company_id?: string
          created_at?: string | null
          customer_id?: string
          delivery_date?: string | null
          file_upload_url?: string | null
          id?: string
          material_id?: string | null
          notes?: string | null
          order_number?: string
          order_total?: number | null
          priority?: string | null
          product?: string
          quantity?: number
          rejection_reason?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_orders_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_requests: {
        Row: {
          address: string | null
          business_name: string
          city: string | null
          company_id: string
          contact_person: string
          created_at: string | null
          email: string
          gst_number: string | null
          id: string
          latitude: number | null
          longitude: number | null
          phone: string | null
          plant_id: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          address?: string | null
          business_name: string
          city?: string | null
          company_id: string
          contact_person: string
          created_at?: string | null
          email: string
          gst_number?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          phone?: string | null
          plant_id?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          address?: string | null
          business_name?: string
          city?: string | null
          company_id?: string
          contact_person?: string
          created_at?: string | null
          email?: string
          gst_number?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          phone?: string | null
          plant_id?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_requests_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          billing_address: string | null
          billing_city: string | null
          billing_country: string | null
          billing_postal: string | null
          billing_state: string | null
          business_name: string | null
          company_id: string
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          credit_limit: number | null
          email: string | null
          gst_number: string | null
          id: string
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          name: string
          phone: string | null
          plant_id: string | null
          segment: string | null
          shipping_address: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          billing_address?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_postal?: string | null
          billing_state?: string | null
          business_name?: string | null
          company_id: string
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          credit_limit?: number | null
          email?: string | null
          gst_number?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name: string
          phone?: string | null
          plant_id?: string | null
          segment?: string | null
          shipping_address?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          billing_address?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_postal?: string | null
          billing_state?: string | null
          business_name?: string | null
          company_id?: string
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          credit_limit?: number | null
          email?: string | null
          gst_number?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          phone?: string | null
          plant_id?: string | null
          segment?: string | null
          shipping_address?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_count_items: {
        Row: {
          actual_qty: number
          company_id: string
          created_at: string
          cycle_count_id: string
          discrepancy: number | null
          expected_qty: number
          id: string
          material_id: string | null
          product_id: string | null
        }
        Insert: {
          actual_qty?: number
          company_id: string
          created_at?: string
          cycle_count_id: string
          discrepancy?: number | null
          expected_qty?: number
          id?: string
          material_id?: string | null
          product_id?: string | null
        }
        Update: {
          actual_qty?: number
          company_id?: string
          created_at?: string
          cycle_count_id?: string
          discrepancy?: number | null
          expected_qty?: number
          id?: string
          material_id?: string | null
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cycle_count_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_count_items_cycle_count_id_fkey"
            columns: ["cycle_count_id"]
            isOneToOne: false
            referencedRelation: "cycle_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_count_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_count_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_counts: {
        Row: {
          company_id: string
          count_date: string
          created_at: string
          created_by: string | null
          id: string
          status: string
          warehouse_id: string | null
        }
        Insert: {
          company_id: string
          count_date?: string
          created_at?: string
          created_by?: string | null
          id?: string
          status?: string
          warehouse_id?: string | null
        }
        Update: {
          company_id?: string
          count_date?: string
          created_at?: string
          created_by?: string | null
          id?: string
          status?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cycle_counts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_counts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_reports: {
        Row: {
          attendance_summary: string | null
          company_id: string
          created_at: string
          downtime_minutes: number
          id: string
          issues: string | null
          notes: string | null
          plant_id: string | null
          report_date: string
          status: string
          submitted_by: string | null
          units_completed: number
          updated_at: string
        }
        Insert: {
          attendance_summary?: string | null
          company_id: string
          created_at?: string
          downtime_minutes?: number
          id?: string
          issues?: string | null
          notes?: string | null
          plant_id?: string | null
          report_date?: string
          status?: string
          submitted_by?: string | null
          units_completed?: number
          updated_at?: string
        }
        Update: {
          attendance_summary?: string | null
          company_id?: string
          created_at?: string
          downtime_minutes?: number
          id?: string
          issues?: string | null
          notes?: string | null
          plant_id?: string | null
          report_date?: string
          status?: string
          submitted_by?: string | null
          units_completed?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reports_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reports_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_notes: {
        Row: {
          company_id: string
          content: string
          created_at: string
          dashboard_type: string
          id: string
          is_pinned: boolean | null
          source: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          content: string
          created_at?: string
          dashboard_type: string
          id?: string
          is_pinned?: boolean | null
          source?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          content?: string
          created_at?: string
          dashboard_type?: string
          id?: string
          is_pinned?: boolean | null
          source?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          code: string | null
          company_id: string
          created_at: string
          id: string
          name: string
          plant_id: string | null
        }
        Insert: {
          code?: string | null
          company_id: string
          created_at?: string
          id?: string
          name: string
          plant_id?: string | null
        }
        Update: {
          code?: string | null
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          plant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string | null
          company_id: string
          created_at: string
          description: string | null
          file_type: string | null
          file_url: string | null
          id: string
          status: string | null
          tags: string[] | null
          title: string
          uploaded_by: string | null
          version: string | null
          visibility: string | null
        }
        Insert: {
          category?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          status?: string | null
          tags?: string[] | null
          title: string
          uploaded_by?: string | null
          version?: string | null
          visibility?: string | null
        }
        Update: {
          category?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          status?: string | null
          tags?: string[] | null
          title?: string
          uploaded_by?: string | null
          version?: string | null
          visibility?: string | null
        }
        Relationships: []
      }
      employee_departments: {
        Row: {
          company_id: string
          created_at: string
          department_id: string
          employee_id: string
          id: string
          is_primary: boolean | null
        }
        Insert: {
          company_id: string
          created_at?: string
          department_id: string
          employee_id: string
          id?: string
          is_primary?: boolean | null
        }
        Update: {
          company_id?: string
          created_at?: string
          department_id?: string
          employee_id?: string
          id?: string
          is_primary?: boolean | null
        }
        Relationships: []
      }
      employees: {
        Row: {
          company_id: string
          created_at: string
          department: string | null
          department_id: string | null
          email: string | null
          employee_code: string
          full_name: string
          hire_date: string | null
          id: string
          job_title: string | null
          phone: string | null
          plant_id: string | null
          salary: number | null
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          department?: string | null
          department_id?: string | null
          email?: string | null
          employee_code: string
          full_name: string
          hire_date?: string | null
          id?: string
          job_title?: string | null
          phone?: string | null
          plant_id?: string | null
          salary?: number | null
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          department?: string | null
          department_id?: string | null
          email?: string | null
          employee_code?: string
          full_name?: string
          hire_date?: string | null
          id?: string
          job_title?: string | null
          phone?: string | null
          plant_id?: string | null
          salary?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          expense_date: string
          id: string
          receipt_url: string | null
        }
        Insert: {
          amount?: number
          category: string
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          receipt_url?: string | null
        }
        Update: {
          amount?: number
          category?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          receipt_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      finished_goods: {
        Row: {
          company_id: string
          created_at: string | null
          customer_order_id: string | null
          id: string
          notes: string | null
          product: string
          production_planning_id: string | null
          qr_code_url: string | null
          quality_certificate_url: string | null
          quantity: number
          work_order_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          customer_order_id?: string | null
          id?: string
          notes?: string | null
          product: string
          production_planning_id?: string | null
          qr_code_url?: string | null
          quality_certificate_url?: string | null
          quantity: number
          work_order_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          customer_order_id?: string | null
          id?: string
          notes?: string | null
          product?: string
          production_planning_id?: string | null
          qr_code_url?: string | null
          quality_certificate_url?: string | null
          quantity?: number
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finished_goods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finished_goods_customer_order_id_fkey"
            columns: ["customer_order_id"]
            isOneToOne: false
            referencedRelation: "customer_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finished_goods_production_planning_id_fkey"
            columns: ["production_planning_id"]
            isOneToOne: false
            referencedRelation: "production_planning"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipts: {
        Row: {
          company_id: string
          condition_notes: string | null
          created_at: string
          grn_number: string | null
          id: string
          material_id: string | null
          purchase_order_id: string | null
          quantity_received: number
          received_by: string | null
          warehouse_id: string | null
        }
        Insert: {
          company_id: string
          condition_notes?: string | null
          created_at?: string
          grn_number?: string | null
          id?: string
          material_id?: string | null
          purchase_order_id?: string | null
          quantity_received?: number
          received_by?: string | null
          warehouse_id?: string | null
        }
        Update: {
          company_id?: string
          condition_notes?: string | null
          created_at?: string
          grn_number?: string | null
          id?: string
          material_id?: string | null
          purchase_order_id?: string | null
          quantity_received?: number
          received_by?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          company_id: string
          id: string
          material_id: string | null
          product_id: string | null
          quantity: number
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          company_id: string
          id?: string
          material_id?: string | null
          product_id?: string | null
          quantity?: number
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          company_id?: string
          id?: string
          material_id?: string | null
          product_id?: string | null
          quantity?: number
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_adjustments: {
        Row: {
          adjusted_by: string
          company_id: string
          created_at: string
          delta: number
          id: string
          new_quantity: number
          old_quantity: number
          product_id: string
          reason: string
          warehouse_id: string
        }
        Insert: {
          adjusted_by: string
          company_id: string
          created_at?: string
          delta: number
          id?: string
          new_quantity: number
          old_quantity: number
          product_id: string
          reason: string
          warehouse_id: string
        }
        Update: {
          adjusted_by?: string
          company_id?: string
          created_at?: string
          delta?: number
          id?: string
          new_quantity?: number
          old_quantity?: number
          product_id?: string
          reason?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjustments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustments_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          company_id: string
          created_at: string
          currency: string | null
          customer_id: string | null
          due_date: string | null
          id: string
          invoice_number: string
          issue_date: string
          paid_date: string | null
          qr_code_data: string | null
          qr_code_url: string | null
          sales_order_id: string | null
          status: string
          tax_amount: number | null
          total_amount: number
        }
        Insert: {
          company_id: string
          created_at?: string
          currency?: string | null
          customer_id?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          issue_date?: string
          paid_date?: string | null
          qr_code_data?: string | null
          qr_code_url?: string | null
          sales_order_id?: string | null
          status?: string
          tax_amount?: number | null
          total_amount?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          currency?: string | null
          customer_id?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          paid_date?: string | null
          qr_code_data?: string | null
          qr_code_url?: string | null
          sales_order_id?: string | null
          status?: string
          tax_amount?: number | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      job_openings: {
        Row: {
          company_id: string
          created_at: string
          department_id: string | null
          description: string | null
          id: string
          openings: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          openings?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          openings?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_openings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_openings_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      job_postings: {
        Row: {
          company_id: string
          created_at: string
          department: string | null
          id: string
          location: string | null
          openings: number
          status: string
          title: string
        }
        Insert: {
          company_id: string
          created_at?: string
          department?: string | null
          id?: string
          location?: string | null
          openings?: number
          status?: string
          title: string
        }
        Update: {
          company_id?: string
          created_at?: string
          department?: string | null
          id?: string
          location?: string | null
          openings?: number
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_postings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_articles: {
        Row: {
          author_id: string | null
          body: string | null
          category: string | null
          company_id: string
          created_at: string
          id: string
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string
          views: number | null
        }
        Insert: {
          author_id?: string | null
          body?: string | null
          category?: string | null
          company_id: string
          created_at?: string
          id?: string
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          views?: number | null
        }
        Update: {
          author_id?: string | null
          body?: string | null
          category?: string | null
          company_id?: string
          created_at?: string
          id?: string
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          views?: number | null
        }
        Relationships: []
      }
      leaves: {
        Row: {
          approver_id: string | null
          company_id: string
          created_at: string
          employee_id: string | null
          end_date: string
          id: string
          leave_type: string
          reason: string | null
          rejection_reason: string | null
          resolved_at: string | null
          start_date: string
          status: string
        }
        Insert: {
          approver_id?: string | null
          company_id: string
          created_at?: string
          employee_id?: string | null
          end_date: string
          id?: string
          leave_type?: string
          reason?: string | null
          rejection_reason?: string | null
          resolved_at?: string | null
          start_date: string
          status?: string
        }
        Update: {
          approver_id?: string | null
          company_id?: string
          created_at?: string
          employee_id?: string | null
          end_date?: string
          id?: string
          leave_type?: string
          reason?: string | null
          rejection_reason?: string | null
          resolved_at?: string | null
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaves_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaves_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_breakdowns: {
        Row: {
          cause: string
          company_id: string
          created_at: string
          downtime_end: string | null
          downtime_start: string
          id: string
          machine_id: string | null
          reported_by: string | null
        }
        Insert: {
          cause: string
          company_id: string
          created_at?: string
          downtime_end?: string | null
          downtime_start?: string
          id?: string
          machine_id?: string | null
          reported_by?: string | null
        }
        Update: {
          cause?: string
          company_id?: string
          created_at?: string
          downtime_end?: string | null
          downtime_start?: string
          id?: string
          machine_id?: string | null
          reported_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_breakdowns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_breakdowns_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_status_log: {
        Row: {
          changed_by: string | null
          company_id: string
          created_at: string
          from_status: string | null
          id: string
          machine_id: string | null
          reason: string | null
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          company_id: string
          created_at?: string
          from_status?: string | null
          id?: string
          machine_id?: string | null
          reason?: string | null
          to_status: string
        }
        Update: {
          changed_by?: string | null
          company_id?: string
          created_at?: string
          from_status?: string | null
          id?: string
          machine_id?: string | null
          reason?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_status_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_status_log_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machines: {
        Row: {
          code: string
          company_id: string
          created_at: string
          id: string
          last_maintenance: string | null
          name: string
          plant_id: string | null
          status: string
          status_reason: string | null
          type: string | null
          utilization: number | null
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          id?: string
          last_maintenance?: string | null
          name: string
          plant_id?: string | null
          status?: string
          status_reason?: string | null
          type?: string | null
          utilization?: number | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          last_maintenance?: string | null
          name?: string
          plant_id?: string | null
          status?: string
          status_reason?: string | null
          type?: string | null
          utilization?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "machines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machines_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_schedules: {
        Row: {
          assigned_to: string | null
          company_id: string
          created_at: string
          id: string
          last_done: string | null
          machine_id: string | null
          next_due: string | null
          notes: string | null
          recurrence: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          company_id: string
          created_at?: string
          id?: string
          last_done?: string | null
          machine_id?: string | null
          next_due?: string | null
          notes?: string | null
          recurrence?: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          company_id?: string
          created_at?: string
          id?: string
          last_done?: string | null
          machine_id?: string | null
          next_due?: string | null
          notes?: string | null
          recurrence?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_schedules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_schedules_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_tickets: {
        Row: {
          assigned_to: string | null
          company_id: string
          created_at: string
          id: string
          issue_description: string
          issue_type: string
          machine_id: string | null
          priority: string
          reported_by: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          target_user_id: string | null
          ticket_number: string | null
          updated_at: string
          work_order_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          company_id: string
          created_at?: string
          id?: string
          issue_description: string
          issue_type?: string
          machine_id?: string | null
          priority?: string
          reported_by?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_user_id?: string | null
          ticket_number?: string | null
          updated_at?: string
          work_order_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          company_id?: string
          created_at?: string
          id?: string
          issue_description?: string
          issue_type?: string
          machine_id?: string | null
          priority?: string
          reported_by?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_user_id?: string | null
          ticket_number?: string | null
          updated_at?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tickets_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tickets_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tickets_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          company_id: string
          created_at: string | null
          department_id: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          unit: string
          unit_cost: number | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          unit?: string
          unit_cost?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          unit?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "materials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      ncr: {
        Row: {
          assigned_to: string | null
          batch_number: string | null
          company_id: string
          created_at: string
          created_by: string
          defect_category: string
          description: string | null
          failed_parameters: Json | null
          id: string
          inspection_id: string | null
          ncr_number: string
          severity: string
          status: string
          work_order_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          batch_number?: string | null
          company_id: string
          created_at?: string
          created_by: string
          defect_category: string
          description?: string | null
          failed_parameters?: Json | null
          id?: string
          inspection_id?: string | null
          ncr_number: string
          severity?: string
          status?: string
          work_order_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          batch_number?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          defect_category?: string
          description?: string | null
          failed_parameters?: Json | null
          id?: string
          inspection_id?: string | null
          ncr_number?: string
          severity?: string
          status?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ncr_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          company_id: string | null
          created_at: string
          from_user: string | null
          id: string
          is_read: boolean | null
          read_at: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          severity: string | null
          title: string
          to_role: string | null
          to_user: string | null
          user_id: string | null
        }
        Insert: {
          body?: string | null
          company_id?: string | null
          created_at?: string
          from_user?: string | null
          id?: string
          is_read?: boolean | null
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          severity?: string | null
          title: string
          to_role?: string | null
          to_user?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string | null
          company_id?: string | null
          created_at?: string
          from_user?: string | null
          id?: string
          is_read?: boolean | null
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          severity?: string | null
          title?: string
          to_role?: string | null
          to_user?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          company_id: string
          created_at: string
          from_status: string | null
          id: string
          notes: string | null
          order_id: string
          order_type: string
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          company_id: string
          created_at?: string
          from_status?: string | null
          id?: string
          notes?: string | null
          order_id: string
          order_type?: string
          to_status: string
        }
        Update: {
          changed_by?: string | null
          company_id?: string
          created_at?: string
          from_status?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          order_type?: string
          to_status?: string
        }
        Relationships: []
      }
      packing: {
        Row: {
          company_id: string
          created_at: string | null
          finished_goods_id: string | null
          id: string
          notes: string | null
          package_number: string
          package_qr_url: string | null
          quantity: number
        }
        Insert: {
          company_id: string
          created_at?: string | null
          finished_goods_id?: string | null
          id?: string
          notes?: string | null
          package_number: string
          package_qr_url?: string | null
          quantity: number
        }
        Update: {
          company_id?: string
          created_at?: string | null
          finished_goods_id?: string | null
          id?: string
          notes?: string | null
          package_number?: string
          package_qr_url?: string | null
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "packing_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packing_finished_goods_id_fkey"
            columns: ["finished_goods_id"]
            isOneToOne: false
            referencedRelation: "finished_goods"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          customer_id: string | null
          id: string
          invoice_id: string | null
          method: string | null
          paid_at: string
          payment_number: string
          reference: string | null
          status: string
        }
        Insert: {
          amount?: number
          company_id: string
          created_at?: string
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          method?: string | null
          paid_at?: string
          payment_number: string
          reference?: string | null
          status?: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          method?: string | null
          paid_at?: string
          payment_number?: string
          reference?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll: {
        Row: {
          company_id: string
          created_at: string
          deductions: number | null
          employee_id: string
          gross_amount: number
          id: string
          net_amount: number
          paid_at: string | null
          period: string
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          deductions?: number | null
          employee_id: string
          gross_amount?: number
          id?: string
          net_amount?: number
          paid_at?: string | null
          period: string
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          deductions?: number | null
          employee_id?: string
          gross_amount?: number
          id?: string
          net_amount?: number
          paid_at?: string | null
          period?: string
          status?: string
        }
        Relationships: []
      }
      performance_reviews: {
        Row: {
          company_id: string
          created_at: string
          employee_id: string | null
          id: string
          notes: string | null
          period: string
          rating: number | null
          reviewer_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          employee_id?: string | null
          id?: string
          notes?: string | null
          period: string
          rating?: number | null
          reviewer_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          employee_id?: string | null
          id?: string
          notes?: string | null
          period?: string
          rating?: number | null
          reviewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_reviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      plants: {
        Row: {
          address: string | null
          city: string | null
          code: string
          company_id: string
          country: string | null
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          code: string
          company_id: string
          country?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string
          company_id?: string
          country?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plants_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      production_orders: {
        Row: {
          company_id: string
          created_at: string
          due_date: string | null
          id: string
          order_number: string
          plant_id: string | null
          priority: string | null
          product_id: string | null
          progress: number | null
          quantity: number
          sales_order_id: string | null
          start_date: string | null
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          order_number: string
          plant_id?: string | null
          priority?: string | null
          product_id?: string | null
          progress?: number | null
          quantity?: number
          sales_order_id?: string | null
          start_date?: string | null
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          order_number?: string
          plant_id?: string | null
          priority?: string | null
          product_id?: string | null
          progress?: number | null
          quantity?: number
          sales_order_id?: string | null
          start_date?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_planning: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string | null
          customer_order_id: string | null
          due_date: string | null
          id: string
          material_id: string | null
          order_number: string
          priority: string | null
          quantity: number | null
          sales_order_id: string | null
          start_date: string | null
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by?: string | null
          customer_order_id?: string | null
          due_date?: string | null
          id?: string
          material_id?: string | null
          order_number: string
          priority?: string | null
          quantity?: number | null
          sales_order_id?: string | null
          start_date?: string | null
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          customer_order_id?: string | null
          due_date?: string | null
          id?: string
          material_id?: string | null
          order_number?: string
          priority?: string | null
          quantity?: number | null
          sales_order_id?: string | null
          start_date?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_planning_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_planning_customer_order_id_fkey"
            columns: ["customer_order_id"]
            isOneToOne: false
            referencedRelation: "customer_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_planning_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_planning_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_progress: {
        Row: {
          company_id: string
          created_at: string
          id: string
          notes: string | null
          operator_id: string
          progress_percent: number
          work_order_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          operator_id: string
          progress_percent: number
          work_order_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          operator_id?: string
          progress_percent?: number
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_progress_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_progress_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_progress_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          reorder_level: number | null
          sku: string
          status: string
          unit: string | null
          unit_cost: number | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          reorder_level?: number | null
          sku: string
          status?: string
          unit?: string | null
          unit_cost?: number | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          reorder_level?: number | null
          sku?: string
          status?: string
          unit?: string | null
          unit_cost?: number | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_change_requests: {
        Row: {
          company_id: string
          created_at: string
          field_name: string
          id: string
          new_value: string
          notes: string | null
          old_value: string | null
          rejection_reason: string | null
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          field_name: string
          id?: string
          new_value: string
          notes?: string | null
          old_value?: string | null
          rejection_reason?: string | null
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          field_name?: string
          id?: string
          new_value?: string
          notes?: string | null
          old_value?: string | null
          rejection_reason?: string | null
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          certifications: string | null
          company_id: string | null
          created_at: string
          department: string | null
          email: string
          full_name: string | null
          id: string
          is_main_admin: boolean
          job_title: string | null
          phone: string | null
          plant_id: string | null
          preferences: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          certifications?: string | null
          company_id?: string | null
          created_at?: string
          department?: string | null
          email: string
          full_name?: string | null
          id: string
          is_main_admin?: boolean
          job_title?: string | null
          phone?: string | null
          plant_id?: string | null
          preferences?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          certifications?: string | null
          company_id?: string | null
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_main_admin?: boolean
          job_title?: string | null
          phone?: string | null
          plant_id?: string | null
          preferences?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          line_total: number
          material_id: string | null
          purchase_order_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          line_total?: number
          material_id?: string | null
          purchase_order_id: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          line_total?: number
          material_id?: string | null
          purchase_order_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          carrier: string | null
          company_id: string
          created_at: string
          created_by: string | null
          expected_date: string | null
          id: string
          po_number: string
          requisition_id: string | null
          status: string
          supplier_id: string | null
          supplier_note: string | null
          total_amount: number | null
          tracking_number: string | null
        }
        Insert: {
          carrier?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          expected_date?: string | null
          id?: string
          po_number: string
          requisition_id?: string | null
          status?: string
          supplier_id?: string | null
          supplier_note?: string | null
          total_amount?: number | null
          tracking_number?: string | null
        }
        Update: {
          carrier?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          expected_date?: string | null
          id?: string
          po_number?: string
          requisition_id?: string | null
          status?: string
          supplier_id?: string | null
          supplier_note?: string | null
          total_amount?: number | null
          tracking_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "purchase_requisitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "rfq_quote_comparison"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requisitions: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          material_id: string | null
          notes: string | null
          pr_number: string
          production_planning_id: string | null
          quantity: number
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          material_id?: string | null
          notes?: string | null
          pr_number: string
          production_planning_id?: string | null
          quantity: number
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          material_id?: string | null
          notes?: string | null
          pr_number?: string
          production_planning_id?: string | null
          quantity?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requisitions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requisitions_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requisitions_production_planning_id_fkey"
            columns: ["production_planning_id"]
            isOneToOne: false
            referencedRelation: "production_planning"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_codes: {
        Row: {
          company_id: string
          created_at: string
          entity_id: string
          entity_type: string
          expires_at: string | null
          id: string
          label: string | null
          qr_data: string
          qr_url: string | null
          status: string
          sub_label: string | null
          token: string
          type: string
          used_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          expires_at?: string | null
          id?: string
          label?: string | null
          qr_data: string
          qr_url?: string | null
          status?: string
          sub_label?: string | null
          token?: string
          type?: string
          used_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          expires_at?: string | null
          id?: string
          label?: string | null
          qr_data?: string
          qr_url?: string | null
          status?: string
          sub_label?: string | null
          token?: string
          type?: string
          used_at?: string | null
        }
        Relationships: []
      }
      quality_certificates: {
        Row: {
          certificate_number: string
          company_id: string
          created_at: string
          customer_order_id: string | null
          finished_goods_id: string | null
          id: string
          inspection_id: string | null
          issued_by: string | null
          qr_data: string | null
          qr_url: string | null
        }
        Insert: {
          certificate_number: string
          company_id: string
          created_at?: string
          customer_order_id?: string | null
          finished_goods_id?: string | null
          id?: string
          inspection_id?: string | null
          issued_by?: string | null
          qr_data?: string | null
          qr_url?: string | null
        }
        Update: {
          certificate_number?: string
          company_id?: string
          created_at?: string
          customer_order_id?: string | null
          finished_goods_id?: string | null
          id?: string
          inspection_id?: string | null
          issued_by?: string | null
          qr_data?: string | null
          qr_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_certificates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_certificates_customer_order_id_fkey"
            columns: ["customer_order_id"]
            isOneToOne: false
            referencedRelation: "customer_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_certificates_finished_goods_id_fkey"
            columns: ["finished_goods_id"]
            isOneToOne: false
            referencedRelation: "finished_goods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_certificates_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "quality_inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_inspection_parameters: {
        Row: {
          acceptable_range: string | null
          category: string
          company_id: string
          created_at: string
          id: string
          inspection_id: string
          measured_value: string | null
          notes: string | null
          parameter_name: string
          photo_url: string | null
          result: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          acceptable_range?: string | null
          category: string
          company_id: string
          created_at?: string
          id?: string
          inspection_id: string
          measured_value?: string | null
          notes?: string | null
          parameter_name: string
          photo_url?: string | null
          result?: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          acceptable_range?: string | null
          category?: string
          company_id?: string
          created_at?: string
          id?: string
          inspection_id?: string
          measured_value?: string | null
          notes?: string | null
          parameter_name?: string
          photo_url?: string | null
          result?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_inspection_parameters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_inspection_parameters_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "quality_inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_inspections: {
        Row: {
          batch_reference: string | null
          company_id: string
          created_at: string
          customer_order_id: string | null
          defects_found: number | null
          id: string
          inspection_number: string
          inspection_type: string
          inspector_id: string | null
          notes: string | null
          overall_notes: string | null
          product_id: string | null
          production_order_id: string | null
          quantity_checked: number | null
          result: string
        }
        Insert: {
          batch_reference?: string | null
          company_id: string
          created_at?: string
          customer_order_id?: string | null
          defects_found?: number | null
          id?: string
          inspection_number: string
          inspection_type?: string
          inspector_id?: string | null
          notes?: string | null
          overall_notes?: string | null
          product_id?: string | null
          production_order_id?: string | null
          quantity_checked?: number | null
          result?: string
        }
        Update: {
          batch_reference?: string | null
          company_id?: string
          created_at?: string
          customer_order_id?: string | null
          defects_found?: number | null
          id?: string
          inspection_number?: string
          inspection_type?: string
          inspector_id?: string | null
          notes?: string | null
          overall_notes?: string | null
          product_id?: string | null
          production_order_id?: string | null
          quantity_checked?: number | null
          result?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_inspections_customer_order_id_fkey"
            columns: ["customer_order_id"]
            isOneToOne: false
            referencedRelation: "customer_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_inspections_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_inspections_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_inspections_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_quotes: {
        Row: {
          created_at: string | null
          currency: string | null
          estimated_delivery_days: number | null
          id: string
          minimum_order_quantity: number | null
          notes: string | null
          quoted_unit_price: number
          rfq_id: string
          submitted_at: string | null
          supplier_id: string
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          estimated_delivery_days?: number | null
          id?: string
          minimum_order_quantity?: number | null
          notes?: string | null
          quoted_unit_price?: number
          rfq_id: string
          submitted_at?: string | null
          supplier_id: string
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          estimated_delivery_days?: number | null
          id?: string
          minimum_order_quantity?: number | null
          notes?: string | null
          quoted_unit_price?: number
          rfq_id?: string
          submitted_at?: string | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfq_quotes_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfq_quote_comparison"
            referencedColumns: ["rfq_id"]
          },
          {
            foreignKeyName: "rfq_quotes_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_quotes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "rfq_quote_comparison"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "rfq_quotes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_recipients: {
        Row: {
          created_at: string | null
          id: string
          responded_at: string | null
          rfq_id: string
          sent_at: string | null
          status: string
          supplier_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          responded_at?: string | null
          rfq_id: string
          sent_at?: string | null
          status?: string
          supplier_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          responded_at?: string | null
          rfq_id?: string
          sent_at?: string | null
          status?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfq_recipients_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfq_quote_comparison"
            referencedColumns: ["rfq_id"]
          },
          {
            foreignKeyName: "rfq_recipients_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_recipients_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "rfq_quote_comparison"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "rfq_recipients_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_responses: {
        Row: {
          created_at: string
          delivery_days: number | null
          id: string
          notes: string | null
          rfq_id: string
          status: string
          supplier_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          delivery_days?: number | null
          id?: string
          notes?: string | null
          rfq_id: string
          status?: string
          supplier_id: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          delivery_days?: number | null
          id?: string
          notes?: string | null
          rfq_id?: string
          status?: string
          supplier_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "rfq_responses_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfq_quote_comparison"
            referencedColumns: ["rfq_id"]
          },
          {
            foreignKeyName: "rfq_responses_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_responses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "rfq_quote_comparison"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "rfq_responses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      rfqs: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          material_id: string | null
          notes: string | null
          quantity: number
          response_deadline: string | null
          rfq_number: string | null
          status: string
          supplier_ids: string[] | null
          target_delivery_date: string | null
          title: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          material_id?: string | null
          notes?: string | null
          quantity?: number
          response_deadline?: string | null
          rfq_number?: string | null
          status?: string
          supplier_ids?: string[] | null
          target_delivery_date?: string | null
          title: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          material_id?: string | null
          notes?: string | null
          quantity?: number
          response_deadline?: string | null
          rfq_number?: string | null
          status?: string
          supplier_ids?: string[] | null
          target_delivery_date?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfqs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_items: {
        Row: {
          company_id: string
          created_at: string
          id: string
          line_total: number
          product_id: string
          quantity: number
          sales_order_id: string
          unit_price: number
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          line_total?: number
          product_id: string
          quantity?: number
          sales_order_id: string
          unit_price?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          line_total?: number
          product_id?: string
          quantity?: number
          sales_order_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          advance_payment_percent: number | null
          advance_payment_status: string | null
          advance_qr_url: string | null
          approved_at: string | null
          approved_by: string | null
          balance_due: number | null
          company_id: string
          created_at: string
          currency: string | null
          customer_id: string
          due_date: string | null
          id: string
          notes: string | null
          order_date: string
          plant_id: string | null
          priority: string | null
          progress: number | null
          rejection_reason: string | null
          so_number: string
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          advance_payment_percent?: number | null
          advance_payment_status?: string | null
          advance_qr_url?: string | null
          approved_at?: string | null
          approved_by?: string | null
          balance_due?: number | null
          company_id: string
          created_at?: string
          currency?: string | null
          customer_id: string
          due_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          plant_id?: string | null
          priority?: string | null
          progress?: number | null
          rejection_reason?: string | null
          so_number: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          advance_payment_percent?: number | null
          advance_payment_status?: string | null
          advance_qr_url?: string | null
          approved_at?: string | null
          approved_by?: string | null
          balance_due?: number | null
          company_id?: string
          created_at?: string
          currency?: string | null
          customer_id?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          plant_id?: string | null
          priority?: string | null
          progress?: number | null
          rejection_reason?: string | null
          so_number?: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_schedules: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          department_id: string | null
          id: string
          notes: string | null
          operator_ids: string[] | null
          plant_id: string | null
          shift: string
          shift_date: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          notes?: string | null
          operator_ids?: string[] | null
          plant_id?: string | null
          shift?: string
          shift_date?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          notes?: string | null
          operator_ids?: string[] | null
          plant_id?: string | null
          shift?: string
          shift_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_schedules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_schedules_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_schedules_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          carrier: string | null
          company_id: string
          created_at: string
          customer_id: string | null
          delivered_date: string | null
          destination: string | null
          id: string
          sales_order_id: string | null
          shipment_number: string
          shipped_date: string | null
          status: string
          tracking_number: string | null
        }
        Insert: {
          carrier?: string | null
          company_id: string
          created_at?: string
          customer_id?: string | null
          delivered_date?: string | null
          destination?: string | null
          id?: string
          sales_order_id?: string | null
          shipment_number: string
          shipped_date?: string | null
          status?: string
          tracking_number?: string | null
        }
        Update: {
          carrier?: string | null
          company_id?: string
          created_at?: string
          customer_id?: string | null
          delivered_date?: string | null
          destination?: string | null
          id?: string
          sales_order_id?: string | null
          shipment_number?: string
          shipped_date?: string | null
          status?: string
          tracking_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      spare_parts: {
        Row: {
          company_id: string
          created_at: string
          id: string
          machine_ids: string[] | null
          name: string
          part_code: string | null
          quantity: number
          reorder_threshold: number
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          machine_ids?: string[] | null
          name: string
          part_code?: string | null
          quantity?: number
          reorder_threshold?: number
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          machine_ids?: string[] | null
          name?: string
          part_code?: string | null
          quantity?: number
          reorder_threshold?: number
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spare_parts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          from_warehouse_id: string | null
          id: string
          material_id: string | null
          notes: string | null
          product_id: string | null
          quantity: number
          status: string
          to_warehouse_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          from_warehouse_id?: string | null
          id?: string
          material_id?: string | null
          notes?: string | null
          product_id?: string | null
          quantity?: number
          status?: string
          to_warehouse_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          from_warehouse_id?: string | null
          id?: string
          material_id?: string | null
          notes?: string | null
          product_id?: string | null
          quantity?: number
          status?: string
          to_warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_from_warehouse_id_fkey"
            columns: ["from_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_warehouse_id_fkey"
            columns: ["to_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_deliveries: {
        Row: {
          carrier: string | null
          company_id: string
          created_at: string
          dispatch_date: string | null
          expected_arrival: string | null
          id: string
          po_id: string
          status: string
          supplier_id: string | null
          tracking_number: string | null
          vehicle_number: string | null
        }
        Insert: {
          carrier?: string | null
          company_id: string
          created_at?: string
          dispatch_date?: string | null
          expected_arrival?: string | null
          id?: string
          po_id: string
          status?: string
          supplier_id?: string | null
          tracking_number?: string | null
          vehicle_number?: string | null
        }
        Update: {
          carrier?: string | null
          company_id?: string
          created_at?: string
          dispatch_date?: string | null
          expected_arrival?: string | null
          id?: string
          po_id?: string
          status?: string
          supplier_id?: string | null
          tracking_number?: string | null
          vehicle_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_deliveries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_deliveries_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_deliveries_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "rfq_quote_comparison"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "supplier_deliveries_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_invoices: {
        Row: {
          company_id: string
          created_at: string
          file_url: string | null
          gst_amount: number | null
          id: string
          invoice_number: string
          po_id: string | null
          status: string
          supplier_id: string
          total_amount: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          file_url?: string | null
          gst_amount?: number | null
          id?: string
          invoice_number: string
          po_id?: string | null
          status?: string
          supplier_id: string
          total_amount?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          file_url?: string | null
          gst_amount?: number | null
          id?: string
          invoice_number?: string
          po_id?: string | null
          status?: string
          supplier_id?: string
          total_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "rfq_quote_comparison"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "supplier_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_materials: {
        Row: {
          company_id: string
          created_at: string
          id: string
          material_id: string
          status: string
          supplier_id: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          material_id: string
          status?: string
          supplier_id: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          material_id?: string
          status?: string
          supplier_id?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_materials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_materials_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_materials_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "rfq_quote_comparison"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "supplier_materials_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_messages: {
        Row: {
          company_id: string
          created_at: string
          id: string
          message: string
          po_id: string | null
          sender_id: string | null
          sender_role: string
          supplier_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          message: string
          po_id?: string | null
          sender_id?: string | null
          sender_role: string
          supplier_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          message?: string
          po_id?: string | null
          sender_id?: string | null
          sender_role?: string
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_messages_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_messages_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "rfq_quote_comparison"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "supplier_messages_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          amount: number | null
          company_id: string
          created_at: string
          id: string
          invoice_id: string | null
          method: string | null
          paid_at: string | null
          po_id: string | null
          receipt_url: string | null
          status: string
          supplier_id: string
          transaction_id: string | null
        }
        Insert: {
          amount?: number | null
          company_id: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          method?: string | null
          paid_at?: string | null
          po_id?: string | null
          receipt_url?: string | null
          status?: string
          supplier_id: string
          transaction_id?: string | null
        }
        Update: {
          amount?: number | null
          company_id?: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          method?: string | null
          paid_at?: string | null
          po_id?: string | null
          receipt_url?: string | null
          status?: string
          supplier_id?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "supplier_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "rfq_quote_comparison"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          bank_details: string | null
          category: string | null
          company_id: string
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          gst_number: string | null
          id: string
          materials_supplied: string | null
          name: string
          payment_terms: string | null
          rating: number | null
          status: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          bank_details?: string | null
          category?: string | null
          company_id: string
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          gst_number?: string | null
          id?: string
          materials_supplied?: string | null
          name: string
          payment_terms?: string | null
          rating?: number | null
          status?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          bank_details?: string | null
          category?: string | null
          company_id?: string
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          gst_number?: string | null
          id?: string
          materials_supplied?: string | null
          name?: string
          payment_terms?: string | null
          rating?: number | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_replies: {
        Row: {
          created_at: string
          id: string
          is_admin: boolean
          message: string
          ticket_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_admin?: boolean
          message: string
          ticket_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_admin?: boolean
          message?: string
          ticket_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assignee_id: string | null
          company_id: string
          created_at: string
          customer_id: string | null
          description: string | null
          id: string
          message: string | null
          priority: string | null
          resolved_at: string | null
          status: string
          subject: string
          ticket_number: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          assignee_id?: string | null
          company_id: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          id?: string
          message?: string | null
          priority?: string | null
          resolved_at?: string | null
          status?: string
          subject: string
          ticket_number?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          assignee_id?: string | null
          company_id?: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          id?: string
          message?: string | null
          priority?: string | null
          resolved_at?: string | null
          status?: string
          subject?: string
          ticket_number?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          company_id: string
          created_at: string
          description: string | null
          due_date: string | null
          entity: string | null
          entity_id: string | null
          id: string
          priority: string | null
          status: string
          title: string
        }
        Insert: {
          assignee_id?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          priority?: string | null
          status?: string
          title: string
        }
        Update: {
          assignee_id?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          priority?: string | null
          status?: string
          title?: string
        }
        Relationships: []
      }
      taxes: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          filed_at: string | null
          filing_status: string
          id: string
          period: string
          tax_type: string
        }
        Insert: {
          amount?: number
          company_id: string
          created_at?: string
          filed_at?: string | null
          filing_status?: string
          id?: string
          period: string
          tax_type: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          filed_at?: string | null
          filing_status?: string
          id?: string
          period?: string
          tax_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "taxes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      trainings: {
        Row: {
          company_id: string
          completion_date: string | null
          course_name: string
          created_at: string
          employee_id: string | null
          id: string
          status: string
        }
        Insert: {
          company_id: string
          completion_date?: string | null
          course_name: string
          created_at?: string
          employee_id?: string | null
          id?: string
          status?: string
        }
        Update: {
          company_id?: string
          completion_date?: string | null
          course_name?: string
          created_at?: string
          employee_id?: string | null
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          plant_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          plant_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          plant_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          code: string
          company_id: string
          created_at: string
          id: string
          name: string
          plant_id: string | null
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          id?: string
          name: string
          plant_id?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          plant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouses_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      whitelist: {
        Row: {
          accepted_at: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          email: string
          expires_at: string | null
          id: string
          plant_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["whitelist_status"]
        }
        Insert: {
          accepted_at?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          expires_at?: string | null
          id?: string
          plant_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["whitelist_status"]
        }
        Update: {
          accepted_at?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          plant_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["whitelist_status"]
        }
        Relationships: [
          {
            foreignKeyName: "whitelist_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whitelist_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          checklist: Json
          company_id: string
          created_at: string
          department_id: string | null
          design_image_url: string | null
          due_date: string | null
          end_time: string | null
          id: string
          machine_id: string | null
          materials: Json
          notes: string | null
          operation: string | null
          operator_id: string | null
          production_order_id: string | null
          progress_approved_at: string | null
          progress_approved_by: string | null
          progress_image_url: string | null
          progress_pending: boolean | null
          progress_percent: number
          quantity: number | null
          start_time: string | null
          status: string
          wo_number: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          checklist?: Json
          company_id: string
          created_at?: string
          department_id?: string | null
          design_image_url?: string | null
          due_date?: string | null
          end_time?: string | null
          id?: string
          machine_id?: string | null
          materials?: Json
          notes?: string | null
          operation?: string | null
          operator_id?: string | null
          production_order_id?: string | null
          progress_approved_at?: string | null
          progress_approved_by?: string | null
          progress_image_url?: string | null
          progress_pending?: boolean | null
          progress_percent?: number
          quantity?: number | null
          start_time?: string | null
          status?: string
          wo_number: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          checklist?: Json
          company_id?: string
          created_at?: string
          department_id?: string | null
          design_image_url?: string | null
          due_date?: string | null
          end_time?: string | null
          id?: string
          machine_id?: string | null
          materials?: Json
          notes?: string | null
          operation?: string | null
          operator_id?: string | null
          production_order_id?: string | null
          progress_approved_at?: string | null
          progress_approved_by?: string | null
          progress_image_url?: string | null
          progress_pending?: boolean | null
          progress_percent?: number
          quantity?: number | null
          start_time?: string | null
          status?: string
          wo_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      rfq_quote_comparison: {
        Row: {
          currency: string | null
          estimated_delivery_days: number | null
          material_name: string | null
          minimum_order_quantity: number | null
          quantity: number | null
          quote_notes: string | null
          quoted_unit_price: number | null
          recipient_status: string | null
          rfq_id: string | null
          rfq_number: string | null
          rfq_status: string | null
          submitted_at: string | null
          supplier_id: string | null
          supplier_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      create_order_notification: {
        Args: {
          _action?: string
          _body: string
          _company_id: string
          _entity?: string
          _entity_id?: string
          _severity?: string
          _title: string
          _user_id: string
        }
        Returns: undefined
      }
      create_purchase_order_with_items: {
        Args: {
          p_company_id: string
          p_expected_date: string
          p_items: Json
          p_po_number: string
          p_supplier_id: string
        }
        Returns: Json
      }
      create_targeted_notification: {
        Args: {
          _company_id: string
          _entity_id: string
          _entity_type: string
          _from_user: string
          _message: string
          _to_role: string
          _to_user: string
        }
        Returns: undefined
      }
      current_company_id: { Args: never; Returns: string }
      current_supplier_company: { Args: never; Returns: string }
      current_supplier_id: { Args: never; Returns: string }
      current_user_plant_id: { Args: never; Returns: string }
      find_nearest_plant: {
        Args: { p_company_id: string; p_lat: number; p_lng: number }
        Returns: string
      }
      get_active_companies: { Args: never; Returns: Json }
      get_platform_stats: { Args: never; Returns: Json }
      get_root_user_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      in_company: { Args: { _cid: string }; Returns: boolean }
      in_company_ops: { Args: { _cid: string }; Returns: boolean }
      is_auditor: { Args: never; Returns: boolean }
      is_customer_portal: { Args: never; Returns: boolean }
      is_finance_manager: { Args: never; Returns: boolean }
      is_hr_manager: { Args: never; Returns: boolean }
      is_main_admin: { Args: never; Returns: boolean }
      is_maintenance_engineer: { Args: never; Returns: boolean }
      is_plant_admin: { Args: never; Returns: boolean }
      is_plant_manager: { Args: never; Returns: boolean }
      is_production_manager: { Args: never; Returns: boolean }
      is_production_operator: { Args: never; Returns: boolean }
      is_root_admin: { Args: { _user_id?: string }; Returns: boolean }
      is_supplier_portal: { Args: never; Returns: boolean }
      is_tenant_admin: { Args: never; Returns: boolean }
      public_scan_qr: {
        Args: { p_token: string }
        Returns: {
          entity_type: string
          found: boolean
          label: string
          qr_status: string
          qr_type: string
          scanned_at: string
          sub_label: string
        }[]
      }
      record_access_log: {
        Args: { p_action: string; p_email: string; p_status?: string }
        Returns: undefined
      }
      record_customer_payment: {
        Args: {
          p_amount: number
          p_invoice_id: string
          p_method?: string
          p_reference?: string
        }
        Returns: Json
      }
      record_status_transition: {
        Args: {
          _changed_by: string
          _company_id: string
          _from_status: string
          _notes?: string
          _order_id: string
          _order_type: string
          _to_status: string
        }
        Returns: undefined
      }
      resume_orders_when_stocked: {
        Args: { p_company_id: string }
        Returns: Json
      }
      transfer_stock: {
        Args: {
          p_company_id: string
          p_from_warehouse_id: string
          p_notes?: string
          p_product_id: string
          p_quantity: number
          p_to_warehouse_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role:
        | "root_super_admin"
        | "company_admin"
        | "plant_admin"
        | "plant_manager"
        | "production_manager"
        | "warehouse_manager"
        | "procurement_manager"
        | "quality_inspector"
        | "maintenance_engineer"
        | "finance_manager"
        | "hr_manager"
        | "production_operator"
        | "customer_portal"
        | "supplier_portal"
        | "auditor"
      whitelist_status: "pending" | "accepted" | "revoked" | "expired"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: [
        "root_super_admin",
        "company_admin",
        "plant_admin",
        "plant_manager",
        "production_manager",
        "warehouse_manager",
        "procurement_manager",
        "quality_inspector",
        "maintenance_engineer",
        "finance_manager",
        "hr_manager",
        "production_operator",
        "customer_portal",
        "supplier_portal",
        "auditor",
      ],
      whitelist_status: ["pending", "accepted", "revoked", "expired"],
    },
  },
} as const
