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
      customers: {
        Row: {
          company_id: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          segment: string | null
          status: string
        }
        Insert: {
          company_id: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          segment?: string | null
          status?: string
        }
        Update: {
          company_id?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          segment?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: []
      }
      inventory: {
        Row: {
          company_id: string
          id: string
          product_id: string
          quantity: number
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          company_id: string
          id?: string
          product_id: string
          quantity?: number
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          company_id?: string
          id?: string
          product_id?: string
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
        Relationships: []
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
      notifications: {
        Row: {
          body: string | null
          company_id: string | null
          created_at: string
          id: string
          read_at: string | null
          severity: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          severity?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          severity?: string | null
          title?: string
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
        Relationships: []
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
      plants: {
        Row: {
          address: string | null
          city: string | null
          code: string
          company_id: string
          country: string | null
          created_at: string
          id: string
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
      profiles: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          job_title: string | null
          phone: string | null
          plant_id: string | null
          preferences: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          job_title?: string | null
          phone?: string | null
          plant_id?: string | null
          preferences?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
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
      purchase_orders: {
        Row: {
          company_id: string
          created_at: string
          expected_date: string | null
          id: string
          po_number: string
          status: string
          supplier_id: string | null
          total_amount: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          expected_date?: string | null
          id?: string
          po_number: string
          status?: string
          supplier_id?: string | null
          total_amount?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          expected_date?: string | null
          id?: string
          po_number?: string
          status?: string
          supplier_id?: string | null
          total_amount?: number | null
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
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_inspections: {
        Row: {
          company_id: string
          created_at: string
          defects_found: number | null
          id: string
          inspection_number: string
          inspection_type: string
          inspector_id: string | null
          notes: string | null
          product_id: string | null
          production_order_id: string | null
          quantity_checked: number | null
          result: string
        }
        Insert: {
          company_id: string
          created_at?: string
          defects_found?: number | null
          id?: string
          inspection_number: string
          inspection_type?: string
          inspector_id?: string | null
          notes?: string | null
          product_id?: string | null
          production_order_id?: string | null
          quantity_checked?: number | null
          result?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          defects_found?: number | null
          id?: string
          inspection_number?: string
          inspection_type?: string
          inspector_id?: string | null
          notes?: string | null
          product_id?: string | null
          production_order_id?: string | null
          quantity_checked?: number | null
          result?: string
        }
        Relationships: []
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
          approved_at: string | null
          approved_by: string | null
          company_id: string
          created_at: string
          currency: string | null
          customer_id: string
          due_date: string | null
          id: string
          notes: string | null
          order_date: string
          priority: string | null
          progress: number | null
          rejection_reason: string | null
          so_number: string
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          created_at?: string
          currency?: string | null
          customer_id: string
          due_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          priority?: string | null
          progress?: number | null
          rejection_reason?: string | null
          so_number: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string
          currency?: string | null
          customer_id?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          priority?: string | null
          progress?: number | null
          rejection_reason?: string | null
          so_number?: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
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
        Relationships: []
      }
      suppliers: {
        Row: {
          company_id: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          rating: number | null
          status: string
        }
        Insert: {
          company_id: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          rating?: number | null
          status?: string
        }
        Update: {
          company_id?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          rating?: number | null
          status?: string
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
      support_tickets: {
        Row: {
          assignee_id: string | null
          company_id: string
          created_at: string
          customer_id: string | null
          description: string | null
          id: string
          priority: string | null
          resolved_at: string | null
          status: string
          subject: string
          ticket_number: string
        }
        Insert: {
          assignee_id?: string | null
          company_id: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          id?: string
          priority?: string | null
          resolved_at?: string | null
          status?: string
          subject: string
          ticket_number: string
        }
        Update: {
          assignee_id?: string | null
          company_id?: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          id?: string
          priority?: string | null
          resolved_at?: string | null
          status?: string
          subject?: string
          ticket_number?: string
        }
        Relationships: []
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
          company_id: string
          created_at: string
          end_time: string | null
          id: string
          machine_id: string | null
          operation: string | null
          operator_id: string | null
          production_order_id: string | null
          quantity: number | null
          start_time: string | null
          status: string
          wo_number: string
        }
        Insert: {
          company_id: string
          created_at?: string
          end_time?: string | null
          id?: string
          machine_id?: string | null
          operation?: string | null
          operator_id?: string | null
          production_order_id?: string | null
          quantity?: number | null
          start_time?: string | null
          status?: string
          wo_number: string
        }
        Update: {
          company_id?: string
          created_at?: string
          end_time?: string | null
          id?: string
          machine_id?: string | null
          operation?: string | null
          operator_id?: string | null
          production_order_id?: string | null
          quantity?: number | null
          start_time?: string | null
          status?: string
          wo_number?: string
        }
        Relationships: []
      }
      profile_change_requests: {
        Row: {
          id: string
          company_id: string
          user_id: string
          field_name: string
          current_value: string | null
          requested_value: string
          status: string
          approver_id: string | null
          notes: string | null
          created_at: string
          resolved_at: string | null
        }
        Insert: {
          id?: string
          company_id: string
          user_id: string
          field_name: string
          current_value?: string | null
          requested_value: string
          status?: string
          approver_id?: string | null
          notes?: string | null
          created_at?: string
          resolved_at?: string | null
        }
        Update: {
          id?: string
          company_id?: string
          user_id?: string
          field_name?: string
          current_value?: string | null
          requested_value?: string
          status?: string
          approver_id?: string | null
          notes?: string | null
          created_at?: string
          resolved_at?: string | null
        }
        Relationships: []
      }
      order_status_history: {
        Row: {
          id: string
          company_id: string
          order_id: string
          order_type: string
          from_status: string | null
          to_status: string
          changed_by: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          order_id: string
          order_type?: string
          from_status?: string | null
          to_status: string
          changed_by?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          order_id?: string
          order_type?: string
          from_status?: string | null
          to_status?: string
          changed_by?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      qr_codes: {
        Row: {
          id: string
          company_id: string
          entity_type: string
          entity_id: string
          qr_data: string
          qr_url: string | null
          created_at: string
          expires_at: string | null
        }
        Insert: {
          id?: string
          company_id: string
          entity_type: string
          entity_id: string
          qr_data: string
          qr_url?: string | null
          created_at?: string
          expires_at?: string | null
        }
        Update: {
          id?: string
          company_id?: string
          entity_type?: string
          entity_id?: string
          qr_data?: string
          qr_url?: string | null
          created_at?: string
          expires_at?: string | null
        }
        Relationships: []
      }
      company_registrations: {
        Row: {
          id: string
          company_name: string
          legal_name: string | null
          email: string
          phone: string | null
          country: string | null
          industry: string | null
          registration_data: Json | null
          status: string
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_name: string
          legal_name?: string | null
          email: string
          phone?: string | null
          country?: string | null
          industry?: string | null
          registration_data?: Json | null
          status?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          company_name?: string
          legal_name?: string | null
          email?: string
          phone?: string | null
          country?: string | null
          industry?: string | null
          registration_data?: Json | null
          status?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          id: string
          key: string
          value: Json
          description: string | null
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          value: Json
          description?: string | null
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          key?: string
          value?: Json
          description?: string | null
          updated_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      customer_documents: {
        Row: {
          id: string
          company_id: string
          customer_id: string
          title: string
          description: string | null
          file_url: string
          file_type: string | null
          file_size: number | null
          uploaded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          customer_id: string
          title: string
          description?: string | null
          file_url: string
          file_type?: string | null
          file_size?: number | null
          uploaded_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          customer_id?: string
          title?: string
          description?: string | null
          file_url?: string
          file_type?: string | null
          file_size?: number | null
          uploaded_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      employee_departments: {
        Row: {
          id: string
          company_id: string
          employee_id: string
          department_id: string
          is_primary: boolean | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          employee_id: string
          department_id: string
          is_primary?: boolean | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          employee_id?: string
          department_id?: string
          is_primary?: boolean | null
          created_at?: string
        }
        Relationships: []
      }
      inventory_adjustments: {
        Row: {
          id: string
          company_id: string
          product_id: string
          warehouse_id: string
          old_quantity: number
          new_quantity: number
          delta: number
          reason: string
          adjusted_by: string
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          product_id: string
          warehouse_id: string
          old_quantity: number
          new_quantity: number
          delta: number
          reason: string
          adjusted_by: string
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          product_id?: string
          warehouse_id?: string
          old_quantity?: number
          new_quantity?: number
          delta?: number
          reason?: string
          adjusted_by?: string
          created_at?: string
        }
        Relationships: []
      }
      dashboard_notes: {
        Row: {
          id: string
          company_id: string
          user_id: string
          dashboard_type: string
          content: string
          source: string | null
          is_pinned: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          user_id: string
          dashboard_type: string
          content: string
          source?: string | null
          is_pinned?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          user_id?: string
          dashboard_type?: string
          content?: string
          source?: string | null
          is_pinned?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_company_id: { Args: never; Returns: string }
      emit_notification: {
        Args: {
          _body: string
          _company_id: string
          _severity: string
          _title: string
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_root_admin: { Args: { _user_id: string }; Returns: boolean }
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
