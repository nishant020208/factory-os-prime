# FactoryOS AI — Complete Database Schema Audit

> Last Verified: September 6, 2026 (generated from the live Supabase project)
> Project Ref: `ytawmeiylkrzjzmauvhf`
> Total Tables/Views Exposed via PostgREST: **90**
> Migrations Applied: 122 (all recorded in supabase/migrations/)

This document is generated from the **live database OpenAPI spec**, so it reflects
the real current schema — not local intentions. Column lists show every exposed
column with its type and nullability.

## Table of Contents

1. Identity & Tenancy
2. Master Data
3. Manufacturing & Inventory
4. Commerce & Procurement
5. Quality
6. People / HR
7. System & Support
8. Other Tables

## Identity & Tenancy (8 tables)

### `companies`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| name | text | NO |
| legal_name | text | YES |
| industry | text | YES |
| country | text | YES |
| currency | text | YES |
| timezone | text | YES |
| logo_url | text | YES |
| status | text | NO |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |
| invoice_qr_at_approval | boolean | YES |
| gst_number | text | YES |
| registration_number | text | YES |
| plan_tier | text | YES |
| address | text | YES |

### `company_registrations`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_name | text | NO |
| legal_name | text | YES |
| email | text | NO |
| phone | text | YES |
| country | text | YES |
| industry | text | YES |
| registration_data | jsonb | YES |
| status | text | NO |
| reviewed_by | uuid | YES |
| reviewed_at | timestamp with time zone | YES |
| created_at | timestamp with time zone | NO |

### `plants`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| name | text | NO |
| code | text | NO |
| address | text | YES |
| city | text | YES |
| country | text | YES |
| status | text | NO |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |
| latitude | numeric | YES |
| longitude | numeric | YES |

### `profiles`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | YES |
| plant_id | uuid | YES |
| email | text | NO |
| full_name | text | YES |
| phone | text | YES |
| avatar_url | text | YES |
| job_title | text | YES |
| status | text | NO |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |
| preferences | jsonb | YES |
| is_main_admin | boolean | NO |
| department | text | YES |
| certifications | text | YES |

### `user_roles`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| user_id | uuid | NO |
| role | public.app_role | NO |
| company_id | uuid | YES |
| plant_id | uuid | YES |
| created_at | timestamp with time zone | NO |

### `whitelist`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| email | text | NO |
| role | public.app_role | NO |
| company_id | uuid | YES |
| plant_id | uuid | YES |
| status | public.whitelist_status | NO |
| expires_at | timestamp with time zone | YES |
| created_by | uuid | YES |
| created_at | timestamp with time zone | NO |
| accepted_at | timestamp with time zone | YES |

### `platform_settings`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| key | text | NO |
| value | jsonb | NO |
| description | text | YES |
| updated_by | uuid | YES |
| updated_at | timestamp with time zone | NO |

### `access_logs`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | YES |
| user_id | uuid | YES |
| email | text | YES |
| role | text | YES |
| action | text | NO |
| status | text | NO |
| ip_address | text | YES |
| created_at | timestamp with time zone | NO |

## Master Data (12 tables)

### `materials`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| name | text | NO |
| unit | text | NO |
| unit_cost | numeric | YES |
| department_id | uuid | YES |
| is_active | boolean | YES |
| created_at | timestamp with time zone | YES |
| description | text | YES |

### `products`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| sku | text | NO |
| name | text | NO |
| description | text | YES |
| category_id | uuid | YES |
| unit | text | YES |
| unit_cost | numeric | YES |
| unit_price | numeric | YES |
| reorder_level | numeric | YES |
| status | text | NO |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |

### `product_categories`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| name | text | NO |
| description | text | YES |
| created_at | timestamp with time zone | NO |

### `warehouses`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| plant_id | uuid | YES |
| name | text | NO |
| code | text | NO |
| created_at | timestamp with time zone | NO |
| status | text | NO |
| address | text | YES |

### `suppliers`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| name | text | NO |
| contact_email | text | YES |
| contact_phone | text | YES |
| rating | numeric | YES |
| status | text | NO |
| created_at | timestamp with time zone | NO |
| user_id | uuid | YES |
| payment_terms | text | YES |
| category | text | YES |
| contact_person | text | YES |
| gst_number | text | YES |
| address | text | YES |
| materials_supplied | text | YES |
| bank_details | text | YES |

### `customers`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| name | text | NO |
| contact_email | text | YES |
| contact_phone | text | YES |
| segment | text | YES |
| status | text | NO |
| created_at | timestamp with time zone | NO |
| user_id | uuid | YES |
| business_name | text | YES |
| contact_person | text | YES |
| gst_number | text | YES |
| billing_address | text | YES |
| shipping_address | text | YES |
| credit_limit | numeric | YES |
| is_active | boolean | YES |
| email | text | YES |
| phone | text | YES |
| billing_city | text | YES |
| billing_state | text | YES |
| billing_country | text | YES |
| billing_postal | text | YES |
| latitude | numeric | YES |
| longitude | numeric | YES |
| plant_id | uuid | YES |

### `supplier_materials`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| supplier_id | uuid | NO |
| material_id | uuid | NO |
| unit_price | numeric | NO |
| status | text | NO |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |

### `machines`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| plant_id | uuid | YES |
| name | text | NO |
| code | text | NO |
| type | text | YES |
| status | text | NO |
| utilization | numeric | YES |
| last_maintenance | timestamp with time zone | YES |
| created_at | timestamp with time zone | NO |
| status_reason | text | YES |

### `spare_parts`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| name | text | NO |
| part_code | text | YES |
| quantity | numeric | NO |
| reorder_threshold | numeric | NO |
| unit_cost | numeric | YES |
| machine_ids | uuid[] | YES |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |

### `departments`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| plant_id | uuid | YES |
| name | text | NO |
| code | text | YES |
| created_at | timestamp with time zone | NO |

### `employee_departments`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| employee_id | uuid | NO |
| department_id | uuid | NO |
| is_primary | boolean | YES |
| created_at | timestamp with time zone | NO |

### `taxes`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| period | text | NO |
| tax_type | text | NO |
| amount | numeric | NO |
| filing_status | text | NO |
| filed_at | timestamp with time zone | YES |
| created_at | timestamp with time zone | NO |

## Manufacturing & Inventory (17 tables)

### `bom`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| product_id | uuid | NO |
| version | text | NO |
| status | text | NO |
| notes | text | YES |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |

### `bom_items`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| bom_id | uuid | NO |
| component_product_id | uuid | NO |
| quantity | numeric | NO |
| unit | text | YES |
| created_at | timestamp with time zone | NO |

### `sales_orders`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| so_number | text | NO |
| customer_id | uuid | NO |
| status | text | NO |
| priority | text | YES |
| total_amount | numeric | NO |
| currency | text | YES |
| order_date | timestamp with time zone | NO |
| due_date | timestamp with time zone | YES |
| progress | numeric | YES |
| notes | text | YES |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |
| approved_by | uuid | YES |
| approved_at | timestamp with time zone | YES |
| rejection_reason | text | YES |
| advance_payment_percent | numeric | YES |
| advance_payment_status | text | YES |
| advance_qr_url | text | YES |
| balance_due | numeric | YES |
| plant_id | uuid | YES |

### `sales_order_items`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| sales_order_id | uuid | NO |
| product_id | uuid | NO |
| quantity | numeric | NO |
| unit_price | numeric | NO |
| line_total | numeric | NO |
| created_at | timestamp with time zone | NO |

### `production_orders`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| plant_id | uuid | YES |
| order_number | text | NO |
| product_id | uuid | YES |
| quantity | numeric | NO |
| status | text | NO |
| priority | text | YES |
| start_date | timestamp with time zone | YES |
| due_date | timestamp with time zone | YES |
| progress | numeric | YES |
| created_at | timestamp with time zone | NO |
| sales_order_id | uuid | YES |

### `production_planning`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| customer_order_id | uuid | YES |
| company_id | uuid | NO |
| order_number | text | NO |
| status | text | NO |
| priority | text | YES |
| material_id | uuid | YES |
| quantity | numeric | YES |
| start_date | date | YES |
| due_date | date | YES |
| created_by | uuid | YES |
| created_at | timestamp with time zone | YES |
| sales_order_id | uuid | YES |

### `production_progress`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| work_order_id | uuid | NO |
| operator_id | uuid | NO |
| progress_percent | integer | NO |
| notes | text | YES |
| created_at | timestamp with time zone | NO |

### `work_orders`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| wo_number | text | NO |
| production_order_id | uuid | YES |
| machine_id | uuid | YES |
| operator_id | uuid | YES |
| operation | text | YES |
| status | text | NO |
| quantity | numeric | YES |
| start_time | timestamp with time zone | YES |
| end_time | timestamp with time zone | YES |
| created_at | timestamp with time zone | NO |
| progress_percent | integer | NO |
| department_id | uuid | YES |
| notes | text | YES |
| checklist | jsonb | NO |
| materials | jsonb | NO |
| design_image_url | text | YES |
| assigned_by | uuid | YES |
| assigned_at | timestamp with time zone | YES |
| due_date | date | YES |
| progress_image_url | text | YES |
| progress_pending | boolean | YES |
| progress_approved_by | uuid | YES |
| progress_approved_at | timestamp with time zone | YES |

### `inventory`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| warehouse_id | uuid | NO |
| product_id | uuid | YES |
| quantity | numeric | NO |
| updated_at | timestamp with time zone | NO |
| material_id | uuid | YES |
| status | text | NO |
| quarantined_quantity | numeric | NO |
| reserved_quantity | numeric | NO |

### `inventory_adjustments`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| product_id | uuid | NO |
| warehouse_id | uuid | NO |
| old_quantity | numeric | NO |
| new_quantity | numeric | NO |
| delta | numeric | NO |
| reason | text | NO |
| adjusted_by | uuid | NO |
| created_at | timestamp with time zone | NO |

### `stock_transfers`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| from_warehouse_id | uuid | YES |
| to_warehouse_id | uuid | YES |
| material_id | uuid | YES |
| product_id | uuid | YES |
| quantity | numeric | NO |
| status | text | NO |
| created_by | uuid | YES |
| created_at | timestamp with time zone | NO |
| notes | text | YES |

### `goods_receipts`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| purchase_order_id | uuid | YES |
| grn_number | text | YES |
| material_id | uuid | YES |
| warehouse_id | uuid | YES |
| quantity_received | numeric | NO |
| condition_notes | text | YES |
| received_by | uuid | YES |
| created_at | timestamp with time zone | NO |
| inspection_status | text | NO |
| inspector_id | uuid | YES |
| inspected_at | timestamp with time zone | YES |

### `finished_goods`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| work_order_id | uuid | YES |
| production_planning_id | uuid | YES |
| customer_order_id | uuid | YES |
| product | text | NO |
| quantity | numeric | NO |
| quality_certificate_url | text | YES |
| qr_code_url | text | YES |
| notes | text | YES |
| created_at | timestamp with time zone | YES |

### `cycle_counts`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| warehouse_id | uuid | YES |
| count_date | date | NO |
| status | text | NO |
| created_by | uuid | YES |
| created_at | timestamp with time zone | NO |

### `cycle_count_items`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| cycle_count_id | uuid | NO |
| material_id | uuid | YES |
| product_id | uuid | YES |
| expected_qty | numeric | NO |
| actual_qty | numeric | NO |
| discrepancy | numeric | YES |
| created_at | timestamp with time zone | NO |

### `qr_codes`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| entity_type | text | NO |
| entity_id | uuid | NO |
| qr_data | text | NO |
| qr_url | text | YES |
| created_at | timestamp with time zone | NO |
| expires_at | timestamp with time zone | YES |
| token | uuid | NO |
| type | text | NO |
| status | text | NO |
| label | text | YES |
| sub_label | text | YES |
| used_at | timestamp with time zone | YES |

### `daily_reports`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| plant_id | uuid | YES |
| submitted_by | uuid | YES |
| report_date | date | NO |
| units_completed | integer | NO |
| attendance_summary | text | YES |
| downtime_minutes | numeric | NO |
| issues | text | YES |
| notes | text | YES |
| status | text | NO |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |

## Commerce & Procurement (20 tables)

### `customer_orders`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| order_number | text | NO |
| company_id | uuid | NO |
| customer_id | uuid | NO |
| product | text | NO |
| material_id | uuid | YES |
| quantity | numeric | NO |
| delivery_date | date | YES |
| priority | text | YES |
| file_upload_url | text | YES |
| notes | text | YES |
| status | text | NO |
| rejection_reason | text | YES |
| order_total | numeric | YES |
| advance_payment_percent | numeric | YES |
| advance_amount | numeric | YES |
| advance_payment_status | text | YES |
| advance_qr_url | text | YES |
| balance_due | numeric | YES |
| approved_by | uuid | YES |
| approved_at | timestamp with time zone | YES |
| created_at | timestamp with time zone | YES |
| updated_at | timestamp with time zone | YES |

### `customer_requests`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| business_name | text | NO |
| contact_person | text | NO |
| email | text | NO |
| phone | text | YES |
| gst_number | text | YES |
| address | text | YES |
| status | text | NO |
| rejection_reason | text | YES |
| created_at | timestamp with time zone | YES |
| reviewed_by | uuid | YES |
| reviewed_at | timestamp with time zone | YES |
| latitude | numeric | YES |
| longitude | numeric | YES |
| city | text | YES |
| plant_id | uuid | YES |

### `purchase_orders`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| po_number | text | NO |
| supplier_id | uuid | YES |
| status | text | NO |
| total_amount | numeric | YES |
| expected_date | timestamp with time zone | YES |
| created_at | timestamp with time zone | NO |
| requisition_id | uuid | YES |
| carrier | text | YES |
| tracking_number | text | YES |
| supplier_note | text | YES |
| created_by | uuid | YES |
| delivery_warehouse_id | uuid | YES |

### `purchase_order_items`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| purchase_order_id | uuid | NO |
| material_id | uuid | YES |
| description | text | YES |
| quantity | numeric | NO |
| unit_price | numeric | NO |
| line_total | numeric | NO |
| created_at | timestamp with time zone | NO |

### `purchase_requisitions`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| production_planning_id | uuid | YES |
| pr_number | text | NO |
| material_id | uuid | YES |
| quantity | numeric | NO |
| status | text | NO |
| notes | text | YES |
| created_by | uuid | YES |
| created_at | timestamp with time zone | YES |

### `rfqs`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| rfq_number | text | YES |
| title | text | NO |
| material_id | uuid | YES |
| quantity | numeric | NO |
| supplier_ids | uuid[] | YES |
| response_deadline | date | YES |
| status | text | NO |
| notes | text | YES |
| created_by | uuid | YES |
| created_at | timestamp with time zone | NO |
| target_delivery_date | date | YES |
| auto_generated | boolean | NO |
| source_order_id | uuid | YES |

### `rfq_recipients`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| rfq_id | uuid | NO |
| supplier_id | uuid | NO |
| status | text | NO |
| sent_at | timestamp with time zone | YES |
| responded_at | timestamp with time zone | YES |
| created_at | timestamp with time zone | YES |

### `rfq_responses`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| rfq_id | uuid | NO |
| supplier_id | uuid | NO |
| unit_price | numeric | NO |
| delivery_days | integer | YES |
| notes | text | YES |
| status | text | NO |
| created_at | timestamp with time zone | NO |

### `rfq_quotes`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| rfq_id | uuid | NO |
| supplier_id | uuid | NO |
| quoted_unit_price | numeric | NO |
| currency | text | YES |
| minimum_order_quantity | numeric | YES |
| estimated_delivery_days | integer | YES |
| notes | text | YES |
| submitted_at | timestamp with time zone | YES |
| created_at | timestamp with time zone | YES |

### `rfq_quote_comparison`

| Column | Type | Nullable |
|---|---|---|
| rfq_id | uuid | YES |
| rfq_number | text | YES |
| material_name | text | YES |
| quantity | numeric | YES |
| rfq_status | text | YES |
| supplier_name | text | YES |
| supplier_id | uuid | YES |
| quoted_unit_price | numeric | YES |
| currency | text | YES |
| minimum_order_quantity | numeric | YES |
| estimated_delivery_days | integer | YES |
| quote_notes | text | YES |
| submitted_at | timestamp with time zone | YES |
| recipient_status | text | YES |

### `invoices`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| invoice_number | text | NO |
| sales_order_id | uuid | YES |
| customer_id | uuid | YES |
| total_amount | numeric | NO |
| tax_amount | numeric | YES |
| currency | text | YES |
| status | text | NO |
| issue_date | timestamp with time zone | NO |
| due_date | timestamp with time zone | YES |
| paid_date | timestamp with time zone | YES |
| created_at | timestamp with time zone | NO |
| qr_code_url | text | YES |
| qr_code_data | text | YES |

### `payments`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| payment_number | text | NO |
| invoice_id | uuid | YES |
| customer_id | uuid | YES |
| amount | numeric | NO |
| method | text | YES |
| status | text | NO |
| paid_at | timestamp with time zone | NO |
| reference | text | YES |
| created_at | timestamp with time zone | NO |

### `supplier_invoices`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| supplier_id | uuid | NO |
| po_id | uuid | YES |
| invoice_number | text | NO |
| gst_amount | numeric | YES |
| total_amount | numeric | YES |
| status | text | NO |
| file_url | text | YES |
| created_at | timestamp with time zone | NO |

### `supplier_payments`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| supplier_id | uuid | NO |
| invoice_id | uuid | YES |
| po_id | uuid | YES |
| amount | numeric | YES |
| transaction_id | text | YES |
| method | text | YES |
| status | text | NO |
| receipt_url | text | YES |
| paid_at | timestamp with time zone | YES |
| created_at | timestamp with time zone | NO |

### `supplier_deliveries`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| po_id | uuid | NO |
| supplier_id | uuid | YES |
| dispatch_date | date | YES |
| carrier | text | YES |
| vehicle_number | text | YES |
| expected_arrival | date | YES |
| tracking_number | text | YES |
| status | text | NO |
| created_at | timestamp with time zone | NO |

### `expenses`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| category | text | NO |
| amount | numeric | NO |
| expense_date | date | NO |
| description | text | YES |
| receipt_url | text | YES |
| created_by | uuid | YES |
| created_at | timestamp with time zone | NO |

### `budgets`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| department_id | uuid | YES |
| period | text | NO |
| allocated_amount | numeric | NO |
| notes | text | YES |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |

### `packing`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| finished_goods_id | uuid | YES |
| package_number | text | NO |
| quantity | numeric | NO |
| package_qr_url | text | YES |
| notes | text | YES |
| created_at | timestamp with time zone | YES |

### `shipments`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| shipment_number | text | NO |
| sales_order_id | uuid | YES |
| customer_id | uuid | YES |
| carrier | text | YES |
| tracking_number | text | YES |
| status | text | NO |
| shipped_date | timestamp with time zone | YES |
| delivered_date | timestamp with time zone | YES |
| destination | text | YES |
| created_at | timestamp with time zone | NO |

### `tasks`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| title | text | NO |
| description | text | YES |
| assignee_id | uuid | YES |
| status | text | NO |
| priority | text | YES |
| due_date | timestamp with time zone | YES |
| entity | text | YES |
| entity_id | uuid | YES |
| created_at | timestamp with time zone | NO |

## Quality (7 tables)

### `quality_inspections`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| inspection_number | text | NO |
| inspection_type | text | NO |
| production_order_id | uuid | YES |
| product_id | uuid | YES |
| inspector_id | uuid | YES |
| result | text | NO |
| defects_found | integer | YES |
| quantity_checked | numeric | YES |
| notes | text | YES |
| created_at | timestamp with time zone | NO |
| batch_reference | text | YES |
| customer_order_id | uuid | YES |
| overall_notes | text | YES |

### `quality_inspection_parameters`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| inspection_id | uuid | NO |
| category | text | NO |
| parameter_name | text | NO |
| measured_value | text | YES |
| unit | text | YES |
| acceptable_range | text | YES |
| result | text | NO |
| notes | text | YES |
| photo_url | text | YES |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |

### `incoming_material_inspections`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| plant_id | uuid | YES |
| goods_receipt_id | uuid | YES |
| purchase_order_id | uuid | YES |
| material_id | uuid | NO |
| warehouse_id | uuid | YES |
| quantity | numeric | NO |
| status | text | NO |
| result | text | YES |
| inspector_id | uuid | YES |
| inspection_notes | text | YES |
| rejection_reason | text | YES |
| inspected_at | timestamp with time zone | YES |
| created_at | timestamp with time zone | YES |

### `ncr`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| ncr_number | text | NO |
| work_order_id | uuid | YES |
| inspection_id | uuid | YES |
| batch_number | text | YES |
| defect_category | text | NO |
| description | text | YES |
| severity | text | NO |
| status | text | NO |
| assigned_to | uuid | YES |
| created_by | uuid | NO |
| created_at | timestamp with time zone | NO |
| failed_parameters | jsonb | YES |

### `capa`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| capa_number | text | NO |
| ncr_id | uuid | YES |
| corrective_action | text | YES |
| preventive_action | text | YES |
| assigned_to | uuid | YES |
| due_date | date | YES |
| status | text | NO |
| resolved_inspection_id | uuid | YES |
| created_by | uuid | NO |
| created_at | timestamp with time zone | NO |

### `quality_certificates`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| certificate_number | text | NO |
| inspection_id | uuid | YES |
| finished_goods_id | uuid | YES |
| customer_order_id | uuid | YES |
| qr_data | text | YES |
| qr_url | text | YES |
| issued_by | uuid | YES |
| created_at | timestamp with time zone | NO |

### `compliance_records`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| title | text | NO |
| standard | text | YES |
| status | text | NO |
| valid_from | date | YES |
| expires_at | date | YES |
| document_url | text | YES |
| created_at | timestamp with time zone | NO |

## People / HR (10 tables)

### `employees`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| plant_id | uuid | YES |
| department_id | uuid | YES |
| employee_code | text | NO |
| full_name | text | NO |
| email | text | YES |
| phone | text | YES |
| job_title | text | YES |
| department | text | YES |
| status | text | NO |
| hire_date | date | YES |
| salary | numeric | YES |
| created_at | timestamp with time zone | NO |

### `attendance`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| employee_id | uuid | NO |
| date | date | NO |
| check_in | timestamp with time zone | YES |
| check_out | timestamp with time zone | YES |
| hours_worked | numeric | YES |
| status | text | NO |
| created_at | timestamp with time zone | NO |
| correction_reason | text | YES |

### `leaves`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| employee_id | uuid | YES |
| start_date | date | NO |
| end_date | date | NO |
| leave_type | text | NO |
| reason | text | YES |
| status | text | NO |
| approver_id | uuid | YES |
| resolved_at | timestamp with time zone | YES |
| created_at | timestamp with time zone | NO |
| rejection_reason | text | YES |

### `payroll`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| employee_id | uuid | NO |
| period | text | NO |
| gross_amount | numeric | NO |
| deductions | numeric | YES |
| net_amount | numeric | NO |
| status | text | NO |
| paid_at | timestamp with time zone | YES |
| created_at | timestamp with time zone | NO |

### `performance_reviews`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| employee_id | uuid | YES |
| period | text | NO |
| rating | numeric | YES |
| notes | text | YES |
| reviewer_id | uuid | YES |
| created_at | timestamp with time zone | NO |

### `job_postings`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| title | text | NO |
| department | text | YES |
| location | text | YES |
| status | text | NO |
| openings | integer | NO |
| created_at | timestamp with time zone | NO |

### `job_openings`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| title | text | NO |
| department_id | uuid | YES |
| status | text | NO |
| description | text | YES |
| openings | integer | NO |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |

### `candidates`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| job_posting_id | uuid | YES |
| name | text | NO |
| email | text | YES |
| phone | text | YES |
| position | text | YES |
| status | text | NO |
| notes | text | YES |
| created_at | timestamp with time zone | NO |

### `trainings`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| employee_id | uuid | YES |
| course_name | text | NO |
| completion_date | date | YES |
| status | text | NO |
| created_at | timestamp with time zone | NO |

### `shift_schedules`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| plant_id | uuid | YES |
| department_id | uuid | YES |
| shift | text | NO |
| shift_date | date | NO |
| operator_ids | uuid[] | YES |
| notes | text | YES |
| created_by | uuid | YES |
| created_at | timestamp with time zone | NO |

## System & Support (16 tables)

### `notifications`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | YES |
| user_id | uuid | YES |
| title | text | NO |
| body | text | YES |
| severity | text | YES |
| read_at | timestamp with time zone | YES |
| created_at | timestamp with time zone | NO |
| from_user | uuid | YES |
| to_role | text | YES |
| to_user | uuid | YES |
| related_entity_type | text | YES |
| related_entity_id | uuid | YES |
| is_read | boolean | YES |

### `audit_logs`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | YES |
| user_id | uuid | YES |
| action | text | NO |
| entity | text | YES |
| entity_id | uuid | YES |
| metadata | jsonb | YES |
| ip_address | text | YES |
| created_at | timestamp with time zone | NO |

### `order_status_history`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| order_id | uuid | NO |
| order_type | text | NO |
| from_status | text | YES |
| to_status | text | NO |
| changed_by | uuid | YES |
| notes | text | YES |
| created_at | timestamp with time zone | NO |

### `approvals`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| entity | text | NO |
| entity_id | uuid | YES |
| requester_id | uuid | YES |
| approver_id | uuid | YES |
| status | text | NO |
| notes | text | YES |
| created_at | timestamp with time zone | NO |
| resolved_at | timestamp with time zone | YES |

### `documents`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| title | text | NO |
| description | text | YES |
| category | text | YES |
| tags | text[] | YES |
| file_url | text | YES |
| file_type | text | YES |
| uploaded_by | uuid | YES |
| visibility | text | YES |
| version | text | YES |
| status | text | YES |
| created_at | timestamp with time zone | NO |

### `customer_documents`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| customer_id | uuid | NO |
| title | text | NO |
| description | text | YES |
| file_url | text | NO |
| file_type | text | YES |
| file_size | integer | YES |
| uploaded_by | uuid | YES |
| created_at | timestamp with time zone | NO |

### `dashboard_notes`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| user_id | uuid | NO |
| dashboard_type | text | NO |
| content | text | NO |
| source | text | YES |
| is_pinned | boolean | YES |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |

### `knowledge_articles`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| title | text | NO |
| body | text | YES |
| category | text | YES |
| tags | text[] | YES |
| author_id | uuid | YES |
| status | text | YES |
| views | integer | YES |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |

### `support_tickets`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| ticket_number | text | YES |
| customer_id | uuid | YES |
| subject | text | NO |
| description | text | YES |
| priority | text | YES |
| status | text | NO |
| assignee_id | uuid | YES |
| created_at | timestamp with time zone | NO |
| resolved_at | timestamp with time zone | YES |
| user_id | uuid | YES |
| message | text | YES |
| updated_at | timestamp with time zone | NO |

### `support_ticket_replies`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| ticket_id | uuid | NO |
| user_id | uuid | YES |
| message | text | NO |
| is_admin | boolean | NO |
| created_at | timestamp with time zone | NO |

### `supplier_messages`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| po_id | uuid | YES |
| supplier_id | uuid | YES |
| sender_role | text | NO |
| sender_id | uuid | YES |
| message | text | NO |
| created_at | timestamp with time zone | NO |

### `machine_breakdowns`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| machine_id | uuid | YES |
| downtime_start | timestamp with time zone | NO |
| downtime_end | timestamp with time zone | YES |
| cause | text | NO |
| reported_by | uuid | YES |
| created_at | timestamp with time zone | NO |

### `machine_status_log`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| machine_id | uuid | YES |
| from_status | text | YES |
| to_status | text | NO |
| reason | text | YES |
| changed_by | uuid | YES |
| created_at | timestamp with time zone | NO |

### `maintenance_schedules`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| machine_id | uuid | YES |
| recurrence | text | NO |
| assigned_to | uuid | YES |
| next_due | date | YES |
| last_done | date | YES |
| status | text | NO |
| notes | text | YES |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |

### `maintenance_tickets`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| machine_id | uuid | YES |
| work_order_id | uuid | YES |
| ticket_number | text | YES |
| issue_description | text | NO |
| priority | text | NO |
| status | text | NO |
| reported_by | uuid | YES |
| assigned_to | uuid | YES |
| resolution_notes | text | YES |
| resolved_by | uuid | YES |
| resolved_at | timestamp with time zone | YES |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |
| issue_type | text | NO |
| target_user_id | uuid | YES |

### `profile_change_requests`

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| company_id | uuid | NO |
| user_id | uuid | NO |
| field_name | text | NO |
| old_value | text | YES |
| new_value | text | NO |
| status | text | NO |
| reviewed_by | uuid | YES |
| notes | text | YES |
| created_at | timestamp with time zone | NO |
| reviewed_at | timestamp with time zone | YES |
| requested_by | uuid | NO |
| rejection_reason | text | YES |
