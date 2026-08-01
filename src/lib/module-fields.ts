/**
 * Per-module "New record" form schemas.
 *
 * Every `ref` field is resolved LIVE against a real Supabase table at render
 * time — there are no hardcoded entity lists anywhere in this file.
 * `select` options are only used for genuine fixed enumerations (status,
 * priority, units, shift names) that are constrained by the database itself.
 */

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldRef {
  /** real Supabase table the dropdown is populated from */
  table: string;
  /** column rendered as the option label */
  labelColumn: string;
  /** column stored as the value (defaults to id) */
  valueColumn?: string;
  /** optional equality filter applied to the lookup query */
  filter?: Record<string, string>;
  /** optional list of allowed values for a status-like column */
  filterIn?: { column: string; values: string[] };
}

export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "datetime" | "select" | "ref" | "checkbox";
  required?: boolean;
  options?: FieldOption[];
  ref?: FieldRef;
  placeholder?: string;
  defaultValue?: string;
  /** admin/finance-only fields are hidden from other roles */
  roles?: string[];
}

const opt = (...v: string[]): FieldOption[] =>
  v.map((x) => ({ value: x, label: x.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) }));

const PRIORITY: FieldDef = {
  key: "priority", label: "Priority", type: "select", required: true,
  options: opt("low", "medium", "high", "critical"), defaultValue: "medium",
};

export const MODULE_FIELDS: Record<string, FieldDef[]> = {
  // ── Maintenance ────────────────────────────────────────────
  "/maintenance": [
    { key: "machine_id", label: "Machine", type: "ref", required: true,
      ref: { table: "machines", labelColumn: "name" } },
    { key: "issue_description", label: "Issue Description", type: "textarea", required: true,
      placeholder: "Describe the fault or symptom" },
    PRIORITY,
    { key: "status", label: "Status", type: "select", required: true,
      options: opt("open", "in_progress", "resolved"), defaultValue: "open" },
  ],
  "/breakdowns": [
    { key: "machine_id", label: "Machine", type: "ref", required: true,
      ref: { table: "machines", labelColumn: "name" } },
    { key: "downtime_start", label: "Downtime Start", type: "datetime", required: true },
    { key: "downtime_end", label: "Downtime End", type: "datetime" },
    { key: "cause", label: "Cause", type: "textarea", required: true },
  ],
  "/schedules": [
    { key: "machine_id", label: "Machine", type: "ref", required: true,
      ref: { table: "machines", labelColumn: "name" } },
    { key: "recurrence", label: "Recurrence", type: "select", required: true,
      options: opt("weekly", "monthly", "quarterly"), defaultValue: "monthly" },
    { key: "assigned_to", label: "Assigned Technician", type: "ref",
      ref: { table: "employees", labelColumn: "full_name" } },
    { key: "next_due", label: "Next Due", type: "date", required: true },
  ],
  "/spare-parts": [
    { key: "name", label: "Part Name", type: "text", required: true },
    { key: "part_code", label: "Part Code", type: "text" },
    { key: "quantity", label: "Quantity in Stock", type: "number", required: true, defaultValue: "0" },
    { key: "reorder_threshold", label: "Reorder Threshold", type: "number", required: true, defaultValue: "0" },
    { key: "unit_cost", label: "Unit Cost", type: "number" },
  ],

  // ── Finance ────────────────────────────────────────────────
  "/expenses": [
    { key: "category", label: "Category", type: "select", required: true,
      options: opt("utilities", "raw_material", "logistics", "salaries", "maintenance", "other") },
    { key: "amount", label: "Amount", type: "number", required: true },
    { key: "expense_date", label: "Date", type: "date", required: true },
    { key: "description", label: "Description", type: "textarea" },
    { key: "receipt_url", label: "Receipt URL", type: "text" },
  ],
  "/budgets": [
    { key: "department_id", label: "Department", type: "ref", required: true,
      ref: { table: "departments", labelColumn: "name" } },
    { key: "period", label: "Period", type: "text", required: true, placeholder: "e.g. 2026-Q3" },
    { key: "allocated_amount", label: "Allocated Amount", type: "number", required: true },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  "/taxes": [
    { key: "period", label: "Period", type: "text", required: true, placeholder: "e.g. 2026-07" },
    { key: "tax_type", label: "Tax Type", type: "select", required: true,
      options: opt("gst", "vat", "income_tax", "customs", "other") },
    { key: "amount", label: "Amount", type: "number", required: true },
    { key: "filing_status", label: "Filing Status", type: "select", required: true,
      options: opt("pending", "filed", "paid"), defaultValue: "pending" },
  ],

  // ── HR ─────────────────────────────────────────────────────
  "/leaves": [
    { key: "employee_id", label: "Employee", type: "ref", required: true,
      ref: { table: "employees", labelColumn: "full_name" } },
    { key: "start_date", label: "Start Date", type: "date", required: true },
    { key: "end_date", label: "End Date", type: "date", required: true },
    { key: "leave_type", label: "Type", type: "select", required: true,
      options: opt("casual", "sick", "earned", "unpaid"), defaultValue: "casual" },
    { key: "reason", label: "Reason", type: "textarea" },
  ],
  "/recruitment": [
    { key: "title", label: "Job Title", type: "text", required: true },
    { key: "department_id", label: "Department", type: "ref", required: true,
      ref: { table: "departments", labelColumn: "name" } },
    { key: "openings", label: "Openings", type: "number", required: true, defaultValue: "1" },
    { key: "status", label: "Status", type: "select", required: true,
      options: opt("open", "on_hold", "closed"), defaultValue: "open" },
    { key: "description", label: "Description", type: "textarea" },
  ],
  "/training": [
    { key: "employee_id", label: "Employee", type: "ref", required: true,
      ref: { table: "employees", labelColumn: "full_name" } },
    { key: "course_name", label: "Course Name", type: "text", required: true },
    { key: "completion_date", label: "Completion Date", type: "date" },
    { key: "status", label: "Status", type: "select", required: true,
      options: opt("assigned", "in_progress", "completed"), defaultValue: "assigned" },
  ],
  "/performance": [
    { key: "employee_id", label: "Employee", type: "ref", required: true,
      ref: { table: "employees", labelColumn: "full_name" } },
    { key: "period", label: "Review Period", type: "text", required: true, placeholder: "e.g. 2026-H1" },
    { key: "rating", label: "Rating (1-5)", type: "number", required: true },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  "/attendance": [
    { key: "employee_id", label: "Employee", type: "ref", required: true,
      ref: { table: "employees", labelColumn: "full_name" } },
    { key: "date", label: "Date", type: "date", required: true },
    { key: "check_in", label: "Check In", type: "datetime" },
    { key: "check_out", label: "Check Out", type: "datetime" },
    { key: "status", label: "Status", type: "select", required: true,
      options: opt("present", "absent", "leave", "half_day"), defaultValue: "present" },
  ],

  // ── Procurement ────────────────────────────────────────────
  "/rfq": [
    { key: "title", label: "RFQ Title", type: "text", required: true },
    { key: "material_id", label: "Material", type: "ref", required: true,
      ref: { table: "materials", labelColumn: "name" } },
    { key: "quantity", label: "Quantity", type: "number", required: true },
    { key: "response_deadline", label: "Response Deadline", type: "date", required: true },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  "/purchase-requests": [
    { key: "material_id", label: "Material", type: "ref", required: true,
      ref: { table: "materials", labelColumn: "name" } },
    { key: "quantity", label: "Quantity Needed", type: "number", required: true },
    { key: "production_planning_id", label: "Linked Production Order", type: "ref",
      ref: { table: "production_planning", labelColumn: "order_number" } },
    { key: "notes", label: "Notes / Urgency", type: "textarea" },
  ],
  "/suppliers": [
    { key: "name", label: "Company Name", type: "text", required: true },
    { key: "contact_email", label: "Email", type: "text", required: true },
    { key: "contact_phone", label: "Phone", type: "text" },
    { key: "category", label: "Category / Supplies", type: "text" },
    { key: "payment_terms", label: "Payment Terms", type: "text", placeholder: "e.g. Net 30" },
  ],

  // ── Warehouse ──────────────────────────────────────────────
  "/warehouse": [
    { key: "name", label: "Warehouse Name", type: "text", required: true },
    { key: "code", label: "Code", type: "text", required: true },
    { key: "plant_id", label: "Plant", type: "ref",
      ref: { table: "plants", labelColumn: "name" } },
  ],
  "/transfers": [
    { key: "from_warehouse_id", label: "From Warehouse", type: "ref", required: true,
      ref: { table: "warehouses", labelColumn: "name" } },
    { key: "to_warehouse_id", label: "To Warehouse", type: "ref", required: true,
      ref: { table: "warehouses", labelColumn: "name" } },
    { key: "material_id", label: "Material", type: "ref", required: true,
      ref: { table: "materials", labelColumn: "name" } },
    { key: "quantity", label: "Quantity", type: "number", required: true },
  ],
  "/cycle-count": [
    { key: "warehouse_id", label: "Warehouse", type: "ref", required: true,
      ref: { table: "warehouses", labelColumn: "name" } },
    { key: "count_date", label: "Count Date", type: "date", required: true },
    { key: "status", label: "Status", type: "select", required: true,
      options: opt("draft", "confirmed"), defaultValue: "draft" },
  ],
  "/receiving": [
    { key: "purchase_order_id", label: "Purchase Order", type: "ref", required: true,
      ref: { table: "purchase_orders", labelColumn: "po_number", filterIn: { column: "status", values: ["accepted", "sent"] } } },
    { key: "material_id", label: "Material", type: "ref",
      ref: { table: "materials", labelColumn: "name" } },
    { key: "warehouse_id", label: "Warehouse", type: "ref", required: true,
      ref: { table: "warehouses", labelColumn: "name" } },
    { key: "quantity_received", label: "Quantity Received", type: "number", required: true },
    { key: "condition_notes", label: "Condition Notes", type: "textarea" },
  ],

  // ── Quality ────────────────────────────────────────────────
  "/quality": [
    { key: "production_order_id", label: "Production Order", type: "ref",
      ref: { table: "production_orders", labelColumn: "order_number" } },
    { key: "inspection_type", label: "Inspection Type", type: "select", required: true,
      options: opt("incoming", "in_process", "final"), defaultValue: "final" },
    { key: "result", label: "Result", type: "select", required: true,
      options: opt("pass", "fail"), defaultValue: "pass" },
    { key: "quantity_checked", label: "Quantity Checked", type: "number", required: true },
    { key: "defects_found", label: "Defects Found", type: "number", defaultValue: "0" },
    { key: "notes", label: "Notes", type: "textarea" },
  ],

  // ── Plant ops ──────────────────────────────────────────────
  "/plants": [
    { key: "name", label: "Plant Name", type: "text", required: true },
    { key: "code", label: "Plant Code", type: "text", required: true },
    { key: "address", label: "Address", type: "text" },
    { key: "city", label: "City", type: "text" },
    { key: "country", label: "Country", type: "text" },
  ],
  "/departments": [
    { key: "name", label: "Department Name", type: "text", required: true },
    { key: "code", label: "Code", type: "text" },
    { key: "plant_id", label: "Linked Plant", type: "ref", required: true,
      ref: { table: "plants", labelColumn: "name" } },
  ],

  // ── Compliance ─────────────────────────────────────────────
  "/compliance": [
    { key: "title", label: "Title", type: "text", required: true },
    { key: "standard", label: "Standard", type: "text", placeholder: "e.g. ISO 9001" },
    { key: "status", label: "Status", type: "select", required: true,
      options: opt("compliant", "at_risk", "expired"), defaultValue: "compliant" },
    { key: "valid_from", label: "Valid From", type: "date" },
    { key: "expires_at", label: "Expires", type: "date" },
    { key: "document_url", label: "Document URL", type: "text" },
  ],

  // ── Work orders ────────────────────────────────────────────
  "/work-orders": [
    { key: "production_order_id", label: "Production Order", type: "ref", required: true,
      ref: { table: "production_orders", labelColumn: "order_number" } },
    { key: "department_id", label: "Department", type: "ref", required: true,
      ref: { table: "departments", labelColumn: "name" } },
    { key: "machine_id", label: "Machine", type: "ref",
      ref: { table: "machines", labelColumn: "name" } },
    { key: "operation", label: "Operation", type: "text", required: true },
    { key: "quantity", label: "Quantity", type: "number", required: true },
  ],
};

export function fieldsForPath(path: string): FieldDef[] | undefined {
  return MODULE_FIELDS[path];
}
