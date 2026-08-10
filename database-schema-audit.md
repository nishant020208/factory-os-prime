# FactoryOS AI — Complete Database Schema Audit

> Last Verified: July 27, 2026
> Project Ref: `ytawmeiylkrzjzmauvhf`
> Total Tables: **45**

---

## 📋 Table of Contents

1. [Core Platform Tables](#1-core-platform-tables)
2. [Business / Operational Tables](#2-business--operational-tables)
3. [Customer Order Lifecycle Tables](#3-customer-order-lifecycle-tables)
4. [Support & Auxiliary Tables](#4-support--auxiliary-tables)
5. [Configuration Tables](#5-configuration-tables)
6. [Enums & Custom Types](#6-enums--custom-types)
7. [Functions & Triggers](#7-functions--triggers)
8. [Demo Data Summary](#8-demo-data-summary)
9. [Full Lifecycle Workflow](#9-full-lifecycle-workflow)
10. [Validation Checklist](#10-validation-checklist)

---

## 1. Core Platform Tables

### `companies` — Multi-tenant companies

| Column                 | Type                 | Notes                                       |
| ---------------------- | -------------------- | ------------------------------------------- |
| id                     | UUID PK              | `gen_random_uuid()`                         |
| name                   | TEXT UNIQUE NOT NULL | Company display name                        |
| legal_name             | TEXT                 | Legal registered name                       |
| industry               | TEXT                 | Default 'Manufacturing'                     |
| country                | TEXT                 |                                             |
| currency               | TEXT                 | Default 'USD'                               |
| timezone               | TEXT                 | Default 'UTC'                               |
| logo_url               | TEXT                 | Company logo                                |
| status                 | TEXT NOT NULL        | Default 'active'                            |
| gst_number             | TEXT                 | Tax ID                                      |
| registration_number    | TEXT                 | Company reg. number                         |
| plan_tier              | TEXT                 | Default 'starter'                           |
| address                | TEXT                 | Physical address                            |
| invoice_qr_at_approval | BOOLEAN              | Default true — configures invoice QR timing |
| created_at             | TIMESTAMPTZ          | `now()`                                     |
| updated_at             | TIMESTAMPTZ          | `now()`                                     |

### `plants` — Physical factory locations

| Column     | Type                | Notes             |
| ---------- | ------------------- | ----------------- |
| id         | UUID PK             |                   |
| company_id | UUID FK → companies | ON DELETE CASCADE |
| name       | TEXT NOT NULL       |                   |
| code       | TEXT NOT NULL       |                   |
| address    | TEXT                |                   |
| city       | TEXT                |                   |
| country    | TEXT                |                   |
| status     | TEXT                | Default 'active'  |
| UNIQUE     | (company_id, code)  |                   |

### `departments` — Organizational units

| Column     | Type                | Notes              |
| ---------- | ------------------- | ------------------ |
| id         | UUID PK             |                    |
| company_id | UUID FK → companies | ON DELETE CASCADE  |
| plant_id   | UUID FK → plants    | ON DELETE SET NULL |
| name       | TEXT NOT NULL       |                    |
| code       | TEXT                |                    |
| created_at | TIMESTAMPTZ         |                    |

### `profiles` — User profiles (per auth.users)

| Column      | Type                    | Notes              |
| ----------- | ----------------------- | ------------------ |
| id          | UUID PK FK → auth.users | ON DELETE CASCADE  |
| company_id  | UUID FK → companies     | ON DELETE SET NULL |
| plant_id    | UUID FK → plants        | ON DELETE SET NULL |
| email       | TEXT NOT NULL           |                    |
| full_name   | TEXT                    |                    |
| phone       | TEXT                    |                    |
| avatar_url  | TEXT                    |                    |
| job_title   | TEXT                    |                    |
| status      | TEXT                    | Default 'active'   |
| preferences | JSONB                   | Default '{}'       |
| created_at  | TIMESTAMPTZ             |                    |
| updated_at  | TIMESTAMPTZ             |                    |

### `user_roles` — Role assignments (15 roles)

| Column     | Type                        | Notes              |
| ---------- | --------------------------- | ------------------ |
| id         | UUID PK                     |                    |
| user_id    | UUID FK → auth.users        | ON DELETE CASCADE  |
| role       | app_role ENUM               | One of 15 roles    |
| company_id | UUID FK → companies         | ON DELETE CASCADE  |
| plant_id   | UUID FK → plants            | ON DELETE SET NULL |
| created_at | TIMESTAMPTZ                 |                    |
| UNIQUE     | (user_id, role, company_id) |                    |

### `whitelist` — Email whitelist for signup control

| Column      | Type                   | Notes              |
| ----------- | ---------------------- | ------------------ |
| id          | UUID PK                |                    |
| email       | TEXT NOT NULL          |                    |
| role        | app_role ENUM NOT NULL |                    |
| company_id  | UUID FK → companies    | ON DELETE CASCADE  |
| plant_id    | UUID FK → plants       | ON DELETE SET NULL |
| status      | whitelist_status ENUM  | Default 'pending'  |
| expires_at  | TIMESTAMPTZ            |                    |
| created_by  | UUID FK → auth.users   | ON DELETE SET NULL |
| accepted_at | TIMESTAMPTZ            |                    |
| UNIQUE      | (email, role)          |                    |

### `audit_logs` — Activity trail (excludes Root Admin)

| Column     | Type                 | Notes                                                  |
| ---------- | -------------------- | ------------------------------------------------------ |
| id         | UUID PK              |                                                        |
| company_id | UUID FK → companies  | ON DELETE SET NULL                                     |
| user_id    | UUID FK → auth.users | ON DELETE SET NULL                                     |
| action     | TEXT NOT NULL        | e.g. 'production_completed'                            |
| entity     | TEXT                 | e.g. 'production_orders'                               |
| entity_id  | UUID                 |                                                        |
| metadata   | JSONB                | Flexible payload                                       |
| ip_address | TEXT                 |                                                        |
| created_at | TIMESTAMPTZ          |                                                        |
| **RLS**    |                      | Root + Company Admin + Auditor SELECT; user INSERT own |

### `employee_departments` — Many-to-many employee ↔ department

| Column        | Type                         | Notes         |
| ------------- | ---------------------------- | ------------- |
| id            | UUID PK                      |               |
| company_id    | UUID NOT NULL                |               |
| employee_id   | UUID NOT NULL                |               |
| department_id | UUID NOT NULL                |               |
| is_primary    | BOOLEAN                      | Default false |
| UNIQUE        | (employee_id, department_id) |               |

---

## 2. Business / Operational Tables

### `products` — Product master

| Column        | Type                         | Notes              |
| ------------- | ---------------------------- | ------------------ |
| id            | UUID PK                      |                    |
| company_id    | UUID FK → companies          | ON DELETE CASCADE  |
| sku           | TEXT NOT NULL                |                    |
| name          | TEXT NOT NULL                |                    |
| description   | TEXT                         |                    |
| category_id   | UUID FK → product_categories | ON DELETE SET NULL |
| unit          | TEXT                         | Default 'pcs'      |
| unit_cost     | NUMERIC(14,2)                | Default 0          |
| unit_price    | NUMERIC(14,2)                | Default 0          |
| reorder_level | NUMERIC(14,2)                | Default 0          |
| status        | TEXT                         | Default 'active'   |
| UNIQUE        | (company_id, sku)            |                    |

### `product_categories` — Product groupings

| Column      | Type                | Notes             |
| ----------- | ------------------- | ----------------- |
| id          | UUID PK             |                   |
| company_id  | UUID FK → companies | ON DELETE CASCADE |
| name        | TEXT NOT NULL       |                   |
| description | TEXT                |                   |

### `bom` — Bill of Materials headers

| Column     | Type          | Notes            |
| ---------- | ------------- | ---------------- |
| id         | UUID PK       |                  |
| company_id | UUID NOT NULL |                  |
| product_id | UUID NOT NULL |                  |
| version    | TEXT          | Default 'v1'     |
| status     | TEXT          | Default 'active' |
| notes      | TEXT          |                  |
| created_at | TIMESTAMPTZ   |                  |
| updated_at | TIMESTAMPTZ   |                  |

### `bom_items` — BOM line items

| Column               | Type          | Notes             |
| -------------------- | ------------- | ----------------- |
| id                   | UUID PK       |                   |
| company_id           | UUID NOT NULL |                   |
| bom_id               | UUID FK → bom | ON DELETE CASCADE |
| component_product_id | UUID NOT NULL |                   |
| quantity             | NUMERIC       | Default 1         |
| unit                 | TEXT          | Default 'pcs'     |

### `materials` — Company Admin owned material masterlist

| Column        | Type                  | Notes              |
| ------------- | --------------------- | ------------------ |
| id            | UUID PK               |                    |
| company_id    | UUID FK → companies   | ON DELETE CASCADE  |
| name          | TEXT NOT NULL         |                    |
| unit          | TEXT                  | Default 'pcs'      |
| unit_cost     | NUMERIC(12,2)         | Default 0          |
| department_id | UUID FK → departments | ON DELETE SET NULL |
| is_active     | BOOLEAN               | Default true       |

### `warehouses` — Physical storage locations

| Column     | Type                | Notes              |
| ---------- | ------------------- | ------------------ |
| id         | UUID PK             |                    |
| company_id | UUID FK → companies | ON DELETE CASCADE  |
| plant_id   | UUID FK → plants    | ON DELETE SET NULL |
| name       | TEXT NOT NULL       |                    |
| code       | TEXT NOT NULL       |                    |
| UNIQUE     | (company_id, code)  |                    |

### `inventory` — Stock levels

| Column       | Type                       | Notes              |
| ------------ | -------------------------- | ------------------ |
| id           | UUID PK                    |                    |
| company_id   | UUID FK → companies        | ON DELETE CASCADE  |
| warehouse_id | UUID FK → warehouses       | ON DELETE CASCADE  |
| product_id   | UUID FK → products         | ON DELETE CASCADE  |
| material_id  | UUID FK → materials        | ON DELETE SET NULL |
| quantity     | NUMERIC(14,2)              | Default 0          |
| UNIQUE       | (warehouse_id, product_id) |                    |

### `inventory_adjustments` — Stock change log (Bug A fix)

| Column       | Type                 | Notes              |
| ------------ | -------------------- | ------------------ |
| id           | UUID PK              |                    |
| company_id   | UUID NOT NULL        |                    |
| product_id   | UUID FK → products   | ON DELETE RESTRICT |
| warehouse_id | UUID FK → warehouses | ON DELETE RESTRICT |
| old_quantity | NUMERIC NOT NULL     |                    |
| new_quantity | NUMERIC NOT NULL     |                    |
| delta        | NUMERIC NOT NULL     |                    |
| reason       | TEXT NOT NULL        |                    |
| adjusted_by  | UUID NOT NULL        |                    |
| created_at   | TIMESTAMPTZ          |                    |

### `suppliers` — Vendor directory

| Column        | Type                | Notes             |
| ------------- | ------------------- | ----------------- |
| id            | UUID PK             |                   |
| company_id    | UUID FK → companies | ON DELETE CASCADE |
| name          | TEXT NOT NULL       |                   |
| contact_email | TEXT                |                   |
| contact_phone | TEXT                |                   |
| rating        | NUMERIC(3,2)        | Default 0         |
| status        | TEXT                | Default 'active'  |

### `customers` — Customer master (activated after approval)

| Column           | Type                 | Notes                         |
| ---------------- | -------------------- | ----------------------------- |
| id               | UUID PK              |                               |
| user_id          | UUID FK → auth.users | ON DELETE SET NULL            |
| company_id       | UUID FK → companies  | ON DELETE CASCADE             |
| name             | TEXT NOT NULL        | Used as business_name display |
| business_name    | TEXT                 |                               |
| contact_person   | TEXT                 |                               |
| email            | TEXT                 |                               |
| phone            | TEXT                 |                               |
| contact_email    | TEXT                 | Legacy, migrated to email     |
| contact_phone    | TEXT                 | Legacy, migrated to phone     |
| gst_number       | TEXT                 |                               |
| billing_address  | TEXT                 |                               |
| shipping_address | TEXT                 |                               |
| credit_limit     | NUMERIC(14,2)        | Default 0                     |
| is_active        | BOOLEAN              | Default true                  |
| segment          | TEXT                 |                               |
| status           | TEXT                 | Default 'active'              |

### `machines` — Factory equipment

| Column           | Type                | Notes                 |
| ---------------- | ------------------- | --------------------- |
| id               | UUID PK             |                       |
| company_id       | UUID FK → companies | ON DELETE CASCADE     |
| plant_id         | UUID FK → plants    | ON DELETE SET NULL    |
| name             | TEXT NOT NULL       |                       |
| code             | TEXT NOT NULL       |                       |
| type             | TEXT                |                       |
| status           | TEXT                | Default 'operational' |
| utilization      | NUMERIC(5,2)        | Default 0             |
| last_maintenance | TIMESTAMPTZ         |                       |
| UNIQUE           | (company_id, code)  |                       |

### `employees` — HR employee records

| Column        | Type                  | Notes              |
| ------------- | --------------------- | ------------------ |
| id            | UUID PK               |                    |
| company_id    | UUID NOT NULL         |                    |
| employee_code | TEXT                  |                    |
| full_name     | TEXT                  |                    |
| email         | TEXT                  |                    |
| job_title     | TEXT                  |                    |
| department    | TEXT                  |                    |
| plant_id      | UUID FK → plants      | ON DELETE SET NULL |
| department_id | UUID FK → departments | ON DELETE SET NULL |
| status        | TEXT                  | Default 'active'   |
| hire_date     | TIMESTAMPTZ           |                    |

### `attendance` — Daily attendance

| Column       | Type    | Notes |
| ------------ | ------- | ----- |
| id           | UUID PK |       |
| company_id   | UUID    |       |
| employee_id  | UUID    |       |
| date         | DATE    |       |
| check_in     | TIME    |       |
| check_out    | TIME    |       |
| hours_worked | NUMERIC |       |
| status       | TEXT    |       |

### `payroll` — Payroll records

| Column         | Type        | Notes             |
| -------------- | ----------- | ----------------- |
| id             | UUID PK     |                   |
| company_id     | UUID        |                   |
| employee_id    | UUID        |                   |
| period         | TEXT        |                   |
| base_salary    | NUMERIC     |                   |
| overtime_hours | NUMERIC     |                   |
| overtime_rate  | NUMERIC     |                   |
| deductions     | NUMERIC     |                   |
| net_amount     | NUMERIC     |                   |
| status         | TEXT        | Default 'pending' |
| paid_at        | TIMESTAMPTZ |                   |

---

## 3. Customer Order Lifecycle Tables

### `customer_requests` — Pre-approval customer signup

| Column           | Type                 | Notes                               |
| ---------------- | -------------------- | ----------------------------------- |
| id               | UUID PK              |                                     |
| company_id       | UUID FK → companies  | ON DELETE CASCADE                   |
| business_name    | TEXT NOT NULL        |                                     |
| contact_person   | TEXT NOT NULL        |                                     |
| email            | TEXT NOT NULL        |                                     |
| phone            | TEXT                 |                                     |
| gst_number       | TEXT                 |                                     |
| address          | TEXT                 |                                     |
| status           | TEXT                 | 'pending' / 'approved' / 'rejected' |
| rejection_reason | TEXT                 |                                     |
| reviewed_by      | UUID FK → auth.users | ON DELETE SET NULL                  |
| reviewed_at      | TIMESTAMPTZ          |                                     |

### `customer_orders` — Full lifecycle order tracking

| Column                  | Type                 | Notes                                             |
| ----------------------- | -------------------- | ------------------------------------------------- |
| id                      | UUID PK              |                                                   |
| order_number            | TEXT UNIQUE NOT NULL |                                                   |
| company_id              | UUID FK → companies  | ON DELETE CASCADE                                 |
| customer_id             | UUID FK → customers  | ON DELETE CASCADE                                 |
| product                 | TEXT NOT NULL        |                                                   |
| material_id             | UUID FK → materials  | ON DELETE SET NULL                                |
| quantity                | NUMERIC(12,2)        | Default 1                                         |
| delivery_date           | DATE                 |                                                   |
| priority                | TEXT                 | 'low' / 'normal' / 'high' / 'urgent'              |
| file_upload_url         | TEXT                 |                                                   |
| notes                   | TEXT                 |                                                   |
| **status**              | TEXT                 | 17 status values (see below)                      |
| rejection_reason        | TEXT                 |                                                   |
| order_total             | NUMERIC(12,2)        |                                                   |
| advance_payment_percent | NUMERIC(5,2)         | Default 20.00                                     |
| advance_amount          | NUMERIC(12,2)        |                                                   |
| advance_payment_status  | TEXT                 | 'unpaid' / 'paid' / 'refund_pending' / 'refunded' |
| advance_qr_url          | TEXT                 | QR code for advance payment                       |
| balance_due             | NUMERIC(12,2)        |                                                   |
| approved_by             | UUID FK → auth.users | ON DELETE SET NULL                                |
| approved_at             | TIMESTAMPTZ          |                                                   |
| created_at              | TIMESTAMPTZ          |                                                   |

**Status values (17 states):**
`pending_approval` → `approved` → `rejected` → `changes_requested` → `material_confirmed` → `awaiting_advance_payment` → `advance_paid` → `in_production` → `material_reserved` → `procurement_pending` → `quality_failed` → `dispatch_ready` → `out_for_delivery` → `delivered` → `completed` → `cancelled` → `refund_pending`

### `production_planning` — Production runs (customer-linked or internal)

| Column            | Type                      | Notes                                                                                 |
| ----------------- | ------------------------- | ------------------------------------------------------------------------------------- |
| id                | UUID PK                   |                                                                                       |
| customer_order_id | UUID FK → customer_orders | ON DELETE SET NULL                                                                    |
| company_id        | UUID FK → companies       | ON DELETE CASCADE                                                                     |
| order_number      | TEXT NOT NULL             |                                                                                       |
| status            | TEXT                      | 'planned' / 'material_reserved' / 'procurement_pending' / 'in_progress' / 'completed' |
| priority          | TEXT                      | Default 'normal'                                                                      |
| material_id       | UUID FK → materials       | ON DELETE SET NULL                                                                    |
| quantity          | NUMERIC(12,2)             |                                                                                       |
| start_date        | DATE                      |                                                                                       |
| due_date          | DATE                      |                                                                                       |
| created_by        | UUID FK → auth.users      | ON DELETE SET NULL                                                                    |

### `production_orders` — (Legacy) Production orders

| Column         | Type                       | Notes                         |
| -------------- | -------------------------- | ----------------------------- |
| id             | UUID PK                    |                               |
| company_id     | UUID FK → companies        | ON DELETE CASCADE             |
| plant_id       | UUID FK → plants           | ON DELETE SET NULL            |
| sales_order_id | UUID                       | Links to customer sales_order |
| order_number   | TEXT NOT NULL              |                               |
| product_id     | UUID FK → products         | ON DELETE SET NULL            |
| quantity       | NUMERIC(14,2)              |                               |
| status         | TEXT                       | Default 'planned'             |
| priority       | TEXT                       | Default 'medium'              |
| start_date     | TIMESTAMPTZ                |                               |
| due_date       | TIMESTAMPTZ                |                               |
| progress       | NUMERIC(5,2)               | Default 0                     |
| UNIQUE         | (company_id, order_number) |                               |

### `work_orders` — Shop-floor execution

| Column              | Type                        | Notes                   |
| ------------------- | --------------------------- | ----------------------- |
| id                  | UUID PK                     |                         |
| company_id          | UUID NOT NULL               |                         |
| wo_number           | TEXT NOT NULL               |                         |
| production_order_id | UUID FK → production_orders | ON DELETE SET NULL      |
| machine_id          | UUID FK → machines          | ON DELETE SET NULL      |
| operator_id         | UUID FK → profiles          | ON DELETE SET NULL      |
| operation           | TEXT                        |                         |
| status              | TEXT                        | Default 'pending'       |
| quantity            | NUMERIC                     | Default 0               |
| start_time          | TIMESTAMPTZ                 |                         |
| end_time            | TIMESTAMPTZ                 |                         |
| progress_percent    | INTEGER                     | 0/25/50/75/100 via code |
| rejection_notes     | TEXT                        | For quality failures    |

### `sales_orders` — Customer-facing sales orders

| Column           | Type                | Notes              |
| ---------------- | ------------------- | ------------------ |
| id               | UUID PK             |                    |
| company_id       | UUID NOT NULL       |                    |
| so_number        | TEXT NOT NULL       |                    |
| customer_id      | UUID FK → customers | ON DELETE RESTRICT |
| status           | TEXT                | Default 'draft'    |
| priority         | TEXT                | Default 'medium'   |
| total_amount     | NUMERIC             | Default 0          |
| currency         | TEXT                | Default 'USD'      |
| order_date       | TIMESTAMPTZ         |                    |
| due_date         | TIMESTAMPTZ         |                    |
| progress         | NUMERIC             | Default 0          |
| approved_by      | UUID                | Who approved       |
| approved_at      | TIMESTAMPTZ         |                    |
| rejection_reason | TEXT                |                    |
| notes            | TEXT                |                    |

### `sales_order_items` — Sales order line items

| Column                | Type                   | Notes              |
| --------------------- | ---------------------- | ------------------ |
| id                    | UUID PK                |                    |
| company_id            | UUID NOT NULL          |                    |
| sales_order_id        | UUID FK → sales_orders | ON DELETE CASCADE  |
| product_id            | UUID FK → products     | ON DELETE RESTRICT |
| quantity              | NUMERIC                | Default 1          |
| unit_price            | NUMERIC                | Default 0          |
| line_total (or total) | NUMERIC                | Default 0          |

### `purchase_requisitions` — Purchasing requests (auto-created on stock shortfall)

| Column                 | Type                          | Notes                              |
| ---------------------- | ----------------------------- | ---------------------------------- |
| id                     | UUID PK                       |                                    |
| company_id             | UUID FK → companies           | ON DELETE CASCADE                  |
| production_planning_id | UUID FK → production_planning | ON DELETE SET NULL                 |
| pr_number              | TEXT NOT NULL                 |                                    |
| material_id            | UUID FK → materials           | ON DELETE SET NULL                 |
| quantity               | NUMERIC(12,2)                 |                                    |
| status                 | TEXT                          | 'pending' / 'approved' / 'ordered' |
| notes                  | TEXT                          |                                    |
| created_by             | UUID FK → auth.users          |                                    |
| created_at             | TIMESTAMPTZ                   |                                    |

### `purchase_orders` — Supplier-facing purchase orders

| Column        | Type                    | Notes              |
| ------------- | ----------------------- | ------------------ |
| id            | UUID PK                 |                    |
| company_id    | UUID FK → companies     | ON DELETE CASCADE  |
| po_number     | TEXT NOT NULL           |                    |
| supplier_id   | UUID FK → suppliers     | ON DELETE SET NULL |
| status        | TEXT                    | Default 'draft'    |
| total_amount  | NUMERIC(14,2)           | Default 0          |
| expected_date | TIMESTAMPTZ             |                    |
| UNIQUE        | (company_id, po_number) |                    |

### `shipments` — Customer order shipping

| Column          | Type                   | Notes              |
| --------------- | ---------------------- | ------------------ |
| id              | UUID PK                |                    |
| company_id      | UUID NOT NULL          |                    |
| shipment_number | TEXT NOT NULL          |                    |
| sales_order_id  | UUID FK → sales_orders | ON DELETE SET NULL |
| customer_id     | UUID FK → customers    | ON DELETE SET NULL |
| carrier         | TEXT                   |                    |
| tracking_number | TEXT                   |                    |
| status          | TEXT                   | Default 'pending'  |
| shipped_date    | TIMESTAMPTZ            |                    |
| delivered_date  | TIMESTAMPTZ            |                    |
| destination     | TEXT                   |                    |

### `invoices` — Billing documents

| Column         | Type                   | Notes               |
| -------------- | ---------------------- | ------------------- |
| id             | UUID PK                |                     |
| company_id     | UUID NOT NULL          |                     |
| invoice_number | TEXT NOT NULL          |                     |
| sales_order_id | UUID FK → sales_orders | ON DELETE SET NULL  |
| customer_id    | UUID FK → customers    | ON DELETE RESTRICT  |
| total_amount   | NUMERIC                | Default 0           |
| tax_amount     | NUMERIC                | Default 0           |
| currency       | TEXT                   | Default 'USD'       |
| status         | TEXT                   | Default 'draft'     |
| qr_code_url    | TEXT                   | QR code for payment |
| qr_code_data   | TEXT                   |                     |
| issue_date     | TIMESTAMPTZ            |                     |
| due_date       | TIMESTAMPTZ            |                     |
| paid_date      | TIMESTAMPTZ            |                     |

### `payments` — Payment records

| Column         | Type                | Notes                   |
| -------------- | ------------------- | ----------------------- |
| id             | UUID PK             |                         |
| company_id     | UUID NOT NULL       |                         |
| payment_number | TEXT NOT NULL       |                         |
| invoice_id     | UUID FK → invoices  | ON DELETE SET NULL      |
| customer_id    | UUID FK → customers | ON DELETE SET NULL      |
| amount         | NUMERIC             | Default 0               |
| method         | TEXT                | Default 'bank_transfer' |
| status         | TEXT                | Default 'completed'     |
| paid_at        | TIMESTAMPTZ         |                         |
| reference      | TEXT                |                         |

### `finished_goods` — Quality-passed batches

| Column                  | Type                          | Notes              |
| ----------------------- | ----------------------------- | ------------------ |
| id                      | UUID PK                       |                    |
| company_id              | UUID FK → companies           | ON DELETE CASCADE  |
| work_order_id           | UUID                          |                    |
| production_planning_id  | UUID FK → production_planning | ON DELETE SET NULL |
| customer_order_id       | UUID FK → customer_orders     | ON DELETE SET NULL |
| product                 | TEXT NOT NULL                 |                    |
| quantity                | NUMERIC(12,2)                 |                    |
| quality_certificate_url | TEXT                          | QR-linked          |
| qr_code_url             | TEXT                          |                    |
| notes                   | TEXT                          |                    |

### `packing` — Packing entries for finished goods

| Column            | Type                     | Notes              |
| ----------------- | ------------------------ | ------------------ |
| id                | UUID PK                  |                    |
| company_id        | UUID FK → companies      | ON DELETE CASCADE  |
| finished_goods_id | UUID FK → finished_goods | ON DELETE SET NULL |
| package_number    | TEXT NOT NULL            |                    |
| quantity          | NUMERIC(12,2)            |                    |
| package_qr_url    | TEXT                     |                    |
| notes             | TEXT                     |                    |

### `quality_inspections` — QC inspection records

| Column              | Type                        | Notes                |
| ------------------- | --------------------------- | -------------------- |
| id                  | UUID PK                     |                      |
| company_id          | UUID NOT NULL               |                      |
| inspection_number   | TEXT NOT NULL               |                      |
| inspection_type     | TEXT                        | Default 'in_process' |
| production_order_id | UUID FK → production_orders | ON DELETE SET NULL   |
| product_id          | UUID FK → products          | ON DELETE SET NULL   |
| inspector_id        | UUID FK → profiles          | ON DELETE SET NULL   |
| result              | TEXT                        | Default 'pending'    |
| defects_found       | INTEGER                     | Default 0            |
| quantity_checked    | NUMERIC                     | Default 0            |
| notes               | TEXT                        |                      |

---

## 4. Support & Auxiliary Tables

### `support_tickets` — Customer support requests

| Column        | Type                | Notes              |
| ------------- | ------------------- | ------------------ |
| id            | UUID PK             |                    |
| company_id    | UUID NOT NULL       |                    |
| ticket_number | TEXT NOT NULL       |                    |
| customer_id   | UUID FK → customers | ON DELETE SET NULL |
| subject       | TEXT NOT NULL       |                    |
| status        | TEXT                |                    |
| priority      | TEXT                |                    |
| created_at    | TIMESTAMPTZ         |                    |
| resolved_at   | TIMESTAMPTZ         |                    |

### `tasks` — Operations tasks

| Column     | Type        | Notes            |
| ---------- | ----------- | ---------------- |
| id         | UUID PK     |                  |
| company_id | UUID        |                  |
| title      | TEXT        |                  |
| status     | TEXT        |                  |
| priority   | TEXT        |                  |
| due_date   | TIMESTAMPTZ |                  |
| entity     | TEXT        | Module reference |

### `documents` — File/document management

| Column     | Type    | Notes |
| ---------- | ------- | ----- |
| id         | UUID PK |       |
| company_id | UUID    |       |
| title      | TEXT    |       |
| category   | TEXT    |       |
| file_type  | TEXT    |       |
| version    | TEXT    |       |
| status     | TEXT    |       |

### `knowledge_articles` — Knowledge base

| Column     | Type    | Notes |
| ---------- | ------- | ----- |
| id         | UUID PK |       |
| company_id | UUID    |       |
| title      | TEXT    |       |
| category   | TEXT    |       |
| content    | TEXT    |       |
| views      | INTEGER |       |
| status     | TEXT    |       |

### `approvals` — Approval tracking

| Column      | Type        | Notes |
| ----------- | ----------- | ----- |
| id          | UUID PK     |       |
| company_id  | UUID        |       |
| entity      | TEXT        |       |
| entity_id   | UUID        |       |
| status      | TEXT        |       |
| notes       | TEXT        |       |
| created_at  | TIMESTAMPTZ |       |
| resolved_at | TIMESTAMPTZ |       |

### `customer_documents` — Customer-uploaded files (Step 3 fix)

| Column      | Type          | Notes |
| ----------- | ------------- | ----- |
| id          | UUID PK       |       |
| company_id  | UUID NOT NULL |       |
| customer_id | UUID NOT NULL |       |
| title       | TEXT NOT NULL |       |
| description | TEXT          |       |
| file_url    | TEXT NOT NULL |       |
| file_type   | TEXT          |       |
| file_size   | INTEGER       |       |
| uploaded_by | UUID          |       |
| created_at  | TIMESTAMPTZ   |       |

### `profile_change_requests` — Employee profile change requests

| Column          | Type          | Notes             |
| --------------- | ------------- | ----------------- |
| id              | UUID PK       |                   |
| company_id      | UUID NOT NULL |                   |
| user_id         | UUID NOT NULL |                   |
| field_name      | TEXT NOT NULL |                   |
| current_value   | TEXT          |                   |
| requested_value | TEXT NOT NULL |                   |
| status          | TEXT          | Default 'pending' |
| approver_id     | UUID          |                   |
| notes           | TEXT          |                   |
| created_at      | TIMESTAMPTZ   |                   |
| resolved_at     | TIMESTAMPTZ   |                   |

---

## 5. Configuration Tables

### `notifications` — Role-targeted notification system

| Column              | Type                 | Notes                                                                                  |
| ------------------- | -------------------- | -------------------------------------------------------------------------------------- |
| id                  | UUID PK              |                                                                                        |
| company_id          | UUID FK → companies  | ON DELETE CASCADE                                                                      |
| from_user           | UUID FK → auth.users | ON DELETE SET NULL                                                                     |
| to_role             | TEXT NOT NULL        | Default 'company_admin'                                                                |
| to_user             | UUID FK → auth.users | ON DELETE SET NULL                                                                     |
| title               | TEXT NOT NULL        |                                                                                        |
| body                | TEXT DEFAULT ''      |                                                                                        |
| severity            | TEXT DEFAULT 'info'  | 'info' / 'warning' / 'success' / 'error'                                               |
| related_entity_type | TEXT                 |                                                                                        |
| related_entity_id   | UUID                 |                                                                                        |
| is_read             | BOOLEAN              | Default false                                                                          |
| user_id             | UUID FK → auth.users | Legacy — keep for backward compat                                                      |
| created_at          | TIMESTAMPTZ          |                                                                                        |
| **Indexes**         |                      | idx_notifications_role_access (company_id, to_role, to_user, is_read, created_at DESC) |
|                     |                      | idx_notification_target (company_id, to_role, to_user, is_read)                        |
|                     |                      | idx_notif_created (created_at DESC)                                                    |

### `company_registrations` — OAuth company registration requests

| Column            | Type          | Notes                                 |
| ----------------- | ------------- | ------------------------------------- |
| id                | UUID PK       |                                       |
| company_name      | TEXT NOT NULL |                                       |
| legal_name        | TEXT          |                                       |
| email             | TEXT NOT NULL |                                       |
| phone             | TEXT          |                                       |
| country           | TEXT          | Default 'US'                          |
| industry          | TEXT          |                                       |
| registration_data | JSONB         |                                       |
| status            | TEXT          | Default 'pending'                     |
| reviewed_by       | UUID          |                                       |
| reviewed_at       | TIMESTAMPTZ   |                                       |
| **RLS**           |               | anon INSERT allowed; root UPDATE only |

### `platform_settings` — Root Super Admin global config

| Column      | Type                 | Notes                               |
| ----------- | -------------------- | ----------------------------------- |
| id          | UUID PK              |                                     |
| key         | TEXT UNIQUE NOT NULL |                                     |
| value       | JSONB NOT NULL       |                                     |
| description | TEXT                 |                                     |
| updated_by  | UUID                 |                                     |
| **RLS**     |                      | SELECT all; INSERT/UPDATE root only |

### `qr_codes` — QR code storage

| Column      | Type          | Notes                               |
| ----------- | ------------- | ----------------------------------- |
| id          | UUID PK       |                                     |
| company_id  | UUID NOT NULL |                                     |
| entity_type | TEXT NOT NULL | 'invoice', 'packing', 'certificate' |
| entity_id   | UUID NOT NULL |                                     |
| qr_data     | TEXT NOT NULL |                                     |
| qr_url      | TEXT          |                                     |
| expires_at  | TIMESTAMPTZ   |                                     |

### `order_status_history` — Status transition log

| Column      | Type          | Notes                 |
| ----------- | ------------- | --------------------- |
| id          | UUID PK       |                       |
| company_id  | UUID NOT NULL |                       |
| order_id    | UUID NOT NULL |                       |
| order_type  | TEXT          | Default 'sales_order' |
| from_status | TEXT          |                       |
| to_status   | TEXT NOT NULL |                       |
| changed_by  | UUID          |                       |
| notes       | TEXT          |                       |

### `dashboard_notes` — AI Copilot persistent notes (Bug B fix)

| Column         | Type          | Notes                               |
| -------------- | ------------- | ----------------------------------- |
| id             | UUID PK       |                                     |
| company_id     | UUID NOT NULL |                                     |
| user_id        | UUID NOT NULL |                                     |
| dashboard_type | TEXT NOT NULL | 'company_admin', 'production', etc. |
| content        | TEXT NOT NULL |                                     |
| source         | TEXT          | Default 'ai'                        |
| is_pinned      | BOOLEAN       | Default false                       |

---

## 6. Enums & Custom Types

| Type               | Values                                                                                                                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app_role`         | root_super_admin, company_admin, plant_admin, plant_manager, production_manager, warehouse_manager, procurement_manager, quality_inspector, maintenance_engineer, finance_manager, hr_manager, production_operator, customer_portal, supplier_portal, auditor |
| `whitelist_status` | pending, accepted, revoked, expired                                                                                                                                                                                                                           |

---

## 7. Functions & Triggers

### Security Functions

| Function                   | Returns | Purpose                              |
| -------------------------- | ------- | ------------------------------------ |
| `has_role(uuid, app_role)` | BOOLEAN | Check if user has specific role      |
| `is_root_admin(uuid)`      | BOOLEAN | Check if user is Root Super Admin    |
| `is_auditor()`             | BOOLEAN | Check if user is Auditor (read-only) |
| `current_company_id()`     | UUID    | Get current user's company           |

### Notification Functions

| Function                                                                                                 | Purpose                           |
| -------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `emit_notification(company_id, title, body, severity)`                                                   | Insert company-wide notification  |
| `create_order_notification(company_id, user_id, title, body, severity, entity, entity_id, action)`       | Insert notification + audit log   |
| `create_targeted_notification(company_id, from_user, to_role, to_user, entity_type, entity_id, message)` | Insert role-targeted notification |
| `record_status_transition(company_id, order_id, order_type, from_status, to_status, changed_by, notes)`  | Log status change                 |

### Automations (Triggers)

| Trigger                   | Table             | Event                           | Action                                                       |
| ------------------------- | ----------------- | ------------------------------- | ------------------------------------------------------------ |
| `on_auth_user_created`    | auth.users        | AFTER INSERT                    | Auto-creates profile + user_roles from whitelist             |
| `on_production_completed` | production_orders | AFTER UPDATE                    | Emits notification + audit log on status='completed'         |
| `on_machine_status`       | machines          | AFTER UPDATE                    | Emits notification if status changed to 'down'/'maintenance' |
| `on_po_received`          | purchase_orders   | AFTER UPDATE                    | Emits notification on status='received'                      |
| `on_inventory_low`        | inventory         | AFTER INSERT/UPDATE of quantity | Emits low-stock alert when quantity <= reorder_level         |

### Realtime Subscriptions

Tables included in `supabase_realtime` publication: notifications, production_orders, machines, purchase_orders, inventory, profile_change_requests, order_status_history, inventory_adjustments, dashboard_notes, customer_documents, company_registrations, employee_departments, qr_codes, platform_settings, customer_orders, customer_requests, materials, production_planning, finished_goods, packing

---

## 8. Demo Data Summary

### Company: ABC Manufacturing (ID: `11111111-1111-1111-1111-111111111111`)

### Plant: Detroit Assembly Plant (ID: `22222222-2222-2222-2222-222222222222`)

| Table               |    Demo Records     | Notes                                        |
| ------------------- | :-----------------: | -------------------------------------------- |
| companies           |          1          | ABC Manufacturing                            |
| plants              |     2 + 2 N-08      | Detroit + Chicago                            |
| departments         |     9 + 7 N-08      | Production, QC, Maintenance, Warehouse, etc. |
| whitelist           |         15          | All 15 demo roles                            |
| profiles            | (created on signup) | Linked via trigger                           |
| user_roles          | (created on signup) | Linked via trigger                           |
| products            |     5 + 5 N-08      | TB-500, AH-220, PB-88, SM-3000, CB-X1        |
| product_categories  |          3          | Precision, Assemblies, Raw                   |
| warehouses          |     2 + 3 N-08      | Main, Raw, Finished Goods                    |
| inventory           |     7 + 7 N-08      | Stock levels for all products                |
| suppliers           |     3 + 3 N-08      | Nordic Steel, Kyoto Precision, Bavarian      |
| customers           |     3 + 3 N-08      | AeroSpace, VoltDrive, MediCore               |
| machines            |     5 + 10 N-08     | CNC Mill, Lathe, Robot, Molder, Laser        |
| employees           |    10 + 10 N-08     | All roles                                    |
| attendance          |    15 + 15 N-08     | Last 5 days                                  |
| payroll             |    10 + 10 N-08     | July 2026 period                             |
| production_orders   |     6 + 6 N-08      | 4 completed, 2 in-progress/planned           |
| sales_orders        |     6 + 6 N-08      | 4 completed, 2 in-progress/planned           |
| sales_order_items   |     8 + 8 N-08      | Line items per order                         |
| purchase_orders     |     5 + 4 N-08      | Multi-status                                 |
| work_orders         |     7 + 7 N-08      | Multi-status, tied to production             |
| quality_inspections |     8 + 8 N-08      | 7 pass, 1 fail                               |
| invoices            |     6 + 6 N-08      | 3 paid, 1 sent, 2 draft                      |
| payments            |     3 + 3 N-08      | Completed                                    |
| shipments           |     6 + 6 N-08      | 3 delivered, 1 in_transit, 2 pending         |
| support_tickets     |     4 + 4 N-08      | 2 resolved, 2 open                           |
| tasks               |     8 + 8 N-08      | All statuses                                 |
| documents           |    10 + 10 N-08     | Compliance, contracts, safety                |
| knowledge_articles  |     8 + 8 N-08      | Production guides, SOPs                      |
| approvals           |     5 + 5 N-08      | PO, budget, CAPA approvals                   |
| materials           |          8          | Stainless Steel, Aluminum, Titanium, etc.    |
| customer_requests   |          1          | Test Customer Corp (pending)                 |
| customer_orders     |          1          | ORD-ABC-001 (pending_approval)               |
| audit_logs          |    12 + 12 N-08     | Lifecycle events                             |
| notifications       |    15 + 15 N-08     | Lifecycle events                             |

---

## 9. Full Lifecycle Workflow

```
CUSTOMER REGISTRATION (customer_requests)
  → Company Admin approves → customers row created
  → Customer logs in → places order (customer_orders)
  → status: pending_approval
  → NOTIFIES: Company Admin

COMPANY ADMIN APPROVES (customer_orders)
  → Approve → status: approved, notify Production Manager
  → Reject → status: rejected, notify Customer
  → Changes Requested → status: changes_requested, notify Customer

PRODUCTION MANAGER (customer_orders + production_planning)
  → Confirms material + quantity
  → Sets advance_payment_percent
  → Generates QR code for advance payment
  → status: awaiting_advance_payment
  → NOTIFIES: Customer (with QR)

ADVANCE PAYMENT (payments)
  → Customer pays (or Finance confirms)
  → status: advance_paid/paid
  → "Start Production" enabled
  → NOTIFIES: Production Manager + Finance Manager

PRODUCTION PLANNING (production_planning)
  → Creates production run (customer_order_id optional)
  → status: planned
  → AUTO inventory check:
    → Sufficient → material_reserved → work_orders created
    → Insufficient → procurement_pending
    → NOTIFIES: Warehouse Manager (reservation) or Procurement Manager (shortfall)

WORK ORDERS (work_orders)
  → Auto-created from production_planning
  → Routed by department match
  → NOTIFIES: Production Operator (assigned)

PRODUCTION OPERATOR
  → Updates progress: 25/50/75/100
  → At 100%: status = completed
  → NOTIFIES: Production Manager + Quality Inspector

QUALITY INSPECTOR (quality_inspections + finished_goods)
  → Pass: insert finished_goods, generate QC certificate QR
  → NOTIFIES: Warehouse Manager + Production Manager
  → Fail: status = quality_failed, rejection_notes required
  → NOTIFIES: Production Manager + Production Operator

WAREHOUSE (packing + shipments)
  → Finished Goods → Packing entry → Package QR
  → Shipment → dispatch_ready → out_for_delivery
  → NOTIFIES: Customer (shipment tracking) + Finance Manager (invoice trigger)

FINANCE (invoices + payments)
  → Auto-generate invoice at dispatch_ready (or approval)
  → invoice_amount = order_total - advance_amount
  → QR on invoice
  → Track payment status: pending/partial/paid
  → NOTIFIES: Customer (invoice + payment status)

CUSTOMER SEES ALL
  → Order Tracking (live progress from work_orders)
  → Shipment Tracking (live from shipments)
  → Documents (Invoice, QC Certificate, Warranty)
  → Status: delivered → completed (final payment reconciled)
  → NOTIFIES: Customer at every step

NOTIFICATIONS (targeted, never broadcast)
  → Each trigger sets to_role + to_user (optional)
  → to_role = 'company_admin' | 'production_manager' | etc.
  → Roles only see notifications where to_role matches their role
  → Real-time via Supabase subscription
```

---

## 10. Validation Checklist

### Schema Completeness

|  #  | Table                   | Found in Migrations | Notes                            |
| :-: | ----------------------- | :-----------------: | -------------------------------- |
|  1  | companies               |         ✅          | Core tenant table                |
|  2  | plants                  |         ✅          |                                  |
|  3  | departments             |         ✅          |                                  |
|  4  | profiles                |         ✅          |                                  |
|  5  | user_roles              |         ✅          | 15 role enum                     |
|  6  | whitelist               |         ✅          | Email-based signup control       |
|  7  | audit_logs              |         ✅          |                                  |
|  8  | products                |         ✅          |                                  |
|  9  | product_categories      |         ✅          |                                  |
| 10  | bom                     |         ✅          | Bill of Materials                |
| 11  | bom_items               |         ✅          |                                  |
| 12  | materials               |         ✅          | Customer order material dropdown |
| 13  | warehouses              |         ✅          |                                  |
| 14  | inventory               |         ✅          |                                  |
| 15  | inventory_adjustments   |         ✅          | Bug A fix                        |
| 16  | suppliers               |         ✅          |                                  |
| 17  | customers               |         ✅          | Extended columns for lifecycle   |
| 18  | machines                |         ✅          |                                  |
| 19  | employees               |         ✅          |                                  |
| 20  | attendance              |         ✅          |                                  |
| 21  | payroll                 |         ✅          |                                  |
| 22  | customer_requests       |         ✅          | Pre-approval signup              |
| 23  | customer_orders         |         ✅          | Full lifecycle (17 statuses)     |
| 24  | production_planning     |         ✅          | Auto-inventory-check trigger     |
| 25  | production_orders       |         ✅          | Legacy production orders         |
| 26  | work_orders             |         ✅          | Shop-floor execution             |
| 27  | sales_orders            |         ✅          | Customer-facing                  |
| 28  | sales_order_items       |         ✅          |                                  |
| 29  | purchase_requisitions   |         ✅          | Auto-created on shortfall        |
| 30  | purchase_orders         |         ✅          |                                  |
| 31  | shipments               |         ✅          |                                  |
| 32  | invoices                |         ✅          | QR codes attached                |
| 33  | payments                |         ✅          |                                  |
| 34  | finished_goods          |         ✅          | Quality-passed batches           |
| 35  | packing                 |         ✅          | Package QR                       |
| 36  | quality_inspections     |         ✅          |                                  |
| 37  | support_tickets         |         ✅          |                                  |
| 38  | tasks                   |         ✅          |                                  |
| 39  | documents               |         ✅          |                                  |
| 40  | knowledge_articles      |         ✅          |                                  |
| 41  | approvals               |         ✅          |                                  |
| 42  | notifications           |         ✅          | Role-targeted (to_role, to_user) |
| 43  | company_registrations   |         ✅          | OAuth flow                       |
| 44  | platform_settings       |         ✅          | Root Admin config                |
| 45  | profile_change_requests |         ✅          | Profile edit approval            |
| 46  | order_status_history    |         ✅          | Status transition log            |
| 47  | qr_codes                |         ✅          | QR code storage                  |
| 48  | employee_departments    |         ✅          | Many-to-many                     |
| 49  | customer_documents      |         ✅          | Customer file uploads            |
| 50  | dashboard_notes         |         ✅          | Bug B fix (AI Copilot)           |

### Data Status

| Metric                   | Value                                      |
| ------------------------ | ------------------------------------------ |
| **Total Tables**         | **50** (all defined in migrations)         |
| **Total Migrations**     | **15** sequential files                    |
| **FK Constraints Fixed** | **19** (in `fix_missing_foreign_keys.sql`) |
| **RLS Policies Active**  | All 50 tables have RLS enabled             |
| **Auditor Read-Only**    | All 50 tables have auditor SELECT policy   |
| **Realtime Tables**      | ~20 tables in supabase_realtime            |
| **Demo Customers**       | 6 total (3 original + 3 N-08)              |
| **Demo Work Orders**     | 14 total                                   |
| **Demo Records**         | 400+ across all tables                     |

### Workflow Status

| Workflow Step                | Status | Notes                                                              |
| :--------------------------- | :----: | ------------------------------------------------------------------ |
| Company Registration (OAuth) |   ✅   | `company_registrations` table, Root Admin approves                 |
| Customer Registration        |   ✅   | `customer_requests` → Company Admin approves                       |
| Customer Places Order        |   ✅   | `customer_orders` → status: pending_approval                       |
| Company Admin Approves       |   ✅   | Three actions: Approve/Reject/Changes Requested                    |
| Production Manager Confirms  |   ✅   | Material + advance payment %, QR generated                         |
| Advance Payment              |   ✅   | QR code, status tracking, refund path                              |
| Production Planning          |   ✅   | Auto inventory check; supports internal runs                       |
| Inventory Check (Auto)       |   ✅   | Sufficient → material_reserved; Insufficient → procurement_pending |
| Procurement Loop             |   ✅   | PR → PO → Supplier → GRN → Inventory Update                        |
| Work Orders → Operator       |   ✅   | Department-routed, progress 25/50/75/100                           |
| Quality Inspection           |   ✅   | Pass → Finished Goods; Fail → rejection notes + rework             |
| Warehouse → Packing          |   ✅   | Package QR, shipment creation                                      |
| Dispatch → Shipment          |   ✅   | Live tracking for Customer                                         |
| Invoice Generation           |   ✅   | Auto at dispatch_ready (or approval), QR embedded                  |
| Payment Tracking             |   ✅   | Pending/Partial/Paid; advance + balance math correct               |
| Customer Final View          |   ✅   | Order Tracking, Shipment Tracking, Documents                       |
| Notifications (Targeted)     |   ✅   | `to_role` + `to_user` — never broadcast                            |
| Reports (Role-scoped)        |   ✅   | Each role sees only their data                                     |
| Inventory Adjust Stock       |   ✅   | Bug A fixed — `inventory_adjustments` table                        |
| AI Copilot Notes             |   ✅   | Bug B fixed — `dashboard_notes` table persists                     |
