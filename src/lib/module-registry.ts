/**
 * Registry mapping every "stub" route to a real Supabase table + column config
 * so the LiveModule renders real data instead of a placeholder.
 */
export interface ColumnDef {
  key: string;
  label: string;
  kind?: "text" | "number" | "currency" | "date" | "datetime" | "status" | "badge";
}

export interface ModuleConfig {
  table: string;
  title: string;
  eyebrow: string;
  sub: string;
  columns: ColumnDef[];
  /** filter equals { column: value } — applied client side after fetch */
  filter?: Record<string, string>;
  /** default order */
  orderBy?: { column: string; ascending?: boolean };
  /** columns pre-filled when creating a new record */
  createDefaults?: Record<string, unknown>;
  /** field to use as the "title" prompt for New */
  titleField?: string;
  /** friendly singular name */
  singular?: string;
}

const COL = {
  id:        { key: "id",              label: "ID",           kind: "text" as const },
  createdAt: { key: "created_at",      label: "Created",      kind: "datetime" as const },
  status:    { key: "status",          label: "Status",       kind: "status" as const },
  priority:  { key: "priority",        label: "Priority",     kind: "badge" as const },
};

export const MODULE_REGISTRY: Record<string, ModuleConfig> = {
  // ── Sales / customer lifecycle ──────────────────────────────
  "/orders": {
    table: "sales_orders", title: "Sales Orders", eyebrow: "Sales",
    sub: "Customer purchase orders driving production, dispatch and invoicing.",
    singular: "Sales Order", titleField: "so_number",
    columns: [
      { key: "so_number", label: "SO #" },
      { key: "customer_id", label: "Customer", kind: "text" },
      COL.status, COL.priority,
      { key: "total_amount", label: "Total", kind: "currency" },
      { key: "order_date", label: "Ordered", kind: "date" },
      { key: "due_date", label: "Due", kind: "date" },
      { key: "progress", label: "Progress", kind: "number" },
    ],
    orderBy: { column: "order_date", ascending: false },
    createDefaults: { status: "draft", priority: "medium", total_amount: 0, progress: 0 },
  },
  "/sales": {
    table: "sales_orders", title: "Sales", eyebrow: "Sales",
    sub: "All sales orders across customers.",
    singular: "Sales Order", titleField: "so_number",
    columns: [
      { key: "so_number", label: "SO #" }, COL.status, COL.priority,
      { key: "total_amount", label: "Amount", kind: "currency" },
      { key: "order_date", label: "Ordered", kind: "date" },
      { key: "progress", label: "%", kind: "number" },
    ],
    orderBy: { column: "order_date", ascending: false },
    createDefaults: { status: "draft", priority: "medium" },
  },

  "/customer-invoices": {
    table: "invoices", title: "Invoices", eyebrow: "Customer",
    sub: "Invoices raised against your orders.",
    singular: "Invoice", titleField: "invoice_number",
    columns: [
      { key: "invoice_number", label: "Invoice #" },
      COL.status, { key: "total_amount", label: "Amount", kind: "currency" },
      { key: "issue_date", label: "Issued", kind: "date" },
      { key: "due_date", label: "Due", kind: "date" },
      { key: "paid_date", label: "Paid", kind: "date" },
    ],
    orderBy: { column: "issue_date", ascending: false },
  },
  "/invoices": {
    table: "invoices", title: "Invoices", eyebrow: "Finance",
    sub: "All customer invoices — AR aging, payments and dunning.",
    singular: "Invoice", titleField: "invoice_number",
    columns: [
      { key: "invoice_number", label: "Invoice #" }, COL.status,
      { key: "total_amount", label: "Amount", kind: "currency" },
      { key: "tax_amount", label: "Tax", kind: "currency" },
      { key: "issue_date", label: "Issued", kind: "date" },
      { key: "due_date", label: "Due", kind: "date" },
    ],
    orderBy: { column: "issue_date", ascending: false },
    createDefaults: { status: "draft", total_amount: 0 },
  },
  "/payments": {
    table: "payments", title: "Payments", eyebrow: "Finance",
    sub: "Incoming customer payments applied against invoices.",
    singular: "Payment", titleField: "payment_number",
    columns: [
      { key: "payment_number", label: "Payment #" }, COL.status,
      { key: "amount", label: "Amount", kind: "currency" },
      { key: "method", label: "Method" },
      { key: "reference", label: "Reference" },
      { key: "paid_at", label: "Paid at", kind: "datetime" },
    ],
    orderBy: { column: "paid_at", ascending: false },
    createDefaults: { status: "completed", method: "bank_transfer" },
  },

  "/shipments": {
    table: "shipments", title: "Shipments", eyebrow: "Logistics",
    sub: "Outbound shipments to customers — carrier, tracking and delivery status.",
    singular: "Shipment", titleField: "shipment_number",
    columns: [
      { key: "shipment_number", label: "Shipment #" }, COL.status,
      { key: "carrier", label: "Carrier" },
      { key: "tracking_number", label: "Tracking" },
      { key: "destination", label: "Destination" },
      { key: "shipped_date", label: "Shipped", kind: "date" },
      { key: "delivered_date", label: "Delivered", kind: "date" },
    ],
    orderBy: { column: "shipped_date", ascending: false },
    createDefaults: { status: "pending" },
  },
  "/deliveries": {
    table: "shipments", title: "Deliveries", eyebrow: "Supplier",
    sub: "Deliveries you've made to the buyer.",
    singular: "Delivery", titleField: "shipment_number",
    columns: [
      { key: "shipment_number", label: "Delivery #" }, COL.status,
      { key: "carrier", label: "Carrier" },
      { key: "destination", label: "Destination" },
      { key: "delivered_date", label: "Delivered", kind: "date" },
    ],
    orderBy: { column: "created_at", ascending: false },
  },
  "/dispatch": {
    table: "shipments", title: "Dispatch", eyebrow: "Warehouse",
    sub: "Prepare and dispatch finished goods to customers.",
    singular: "Dispatch", titleField: "shipment_number",
    columns: [
      { key: "shipment_number", label: "Dispatch #" }, COL.status,
      { key: "destination", label: "Destination" },
      { key: "carrier", label: "Carrier" },
      { key: "shipped_date", label: "Shipped", kind: "date" },
    ],
    orderBy: { column: "created_at", ascending: false },
    createDefaults: { status: "pending" },
  },

  "/support": {
    table: "support_tickets", title: "Support", eyebrow: "Customer",
    sub: "Raise and track support tickets.",
    singular: "Ticket", titleField: "subject",
    columns: [
      { key: "ticket_number", label: "Ticket #" },
      { key: "subject", label: "Subject" }, COL.status, COL.priority,
      { key: "created_at", label: "Opened", kind: "datetime" },
      { key: "resolved_at", label: "Resolved", kind: "datetime" },
    ],
    orderBy: { column: "created_at", ascending: false },
    createDefaults: { status: "open", priority: "medium" },
  },
  "/issue-reporting": {
    table: "support_tickets", title: "Report Issue", eyebrow: "Operator",
    sub: "Report shop-floor issues to plant management.",
    singular: "Issue", titleField: "subject",
    columns: [
      { key: "ticket_number", label: "Issue #" },
      { key: "subject", label: "Subject" }, COL.status, COL.priority,
      { key: "created_at", label: "Reported", kind: "datetime" },
    ],
    orderBy: { column: "created_at", ascending: false },
    createDefaults: { status: "open", priority: "high" },
  },

  "/documents": {
    table: "documents", title: "Documents", eyebrow: "Knowledge",
    sub: "SOPs, manuals, policies, delivery notes and shared documents.",
    singular: "Document", titleField: "title",
    columns: [
      { key: "title", label: "Title" },
      { key: "category", label: "Category" },
      { key: "file_type", label: "Type" },
      { key: "version", label: "Version" }, COL.status,
      { key: "created_at", label: "Uploaded", kind: "date" },
    ],
    orderBy: { column: "created_at", ascending: false },
    createDefaults: { category: "general", file_type: "pdf", version: "v1", status: "published" },
  },
  "/knowledge": {
    table: "knowledge_articles", title: "Knowledge Center", eyebrow: "AI Brain",
    sub: "Company knowledge base — SOPs, procedures and best practices.",
    singular: "Article", titleField: "title",
    columns: [
      { key: "title", label: "Title" },
      { key: "category", label: "Category" }, COL.status,
      { key: "views", label: "Views", kind: "number" },
      { key: "updated_at", label: "Updated", kind: "date" },
    ],
    orderBy: { column: "views", ascending: false },
    createDefaults: { category: "general", status: "published", views: 0 },
  },
  "/training": {
    table: "trainings", title: "Training", eyebrow: "HR",
    sub: "Training records and certifications for the workforce.",
    singular: "Training Record",
    columns: [
      { key: "course_name", label: "Course" },
      { key: "employee_id", label: "Employee" }, COL.status,
      { key: "completion_date", label: "Completed", kind: "date" },
      { key: "created_at", label: "Added", kind: "date" },
    ],
    orderBy: { column: "created_at", ascending: false },
    createDefaults: { status: "assigned" },
  },


  // ── Tasks, approvals, calendar ──────────────────────────────
  "/tasks": {
    table: "tasks", title: "My Tasks", eyebrow: "Workflow",
    sub: "Daily tasks and completion status.",
    singular: "Task", titleField: "title",
    columns: [
      { key: "title", label: "Task" }, COL.status, COL.priority,
      { key: "due_date", label: "Due", kind: "date" },
      { key: "entity", label: "Linked to" },
    ],
    orderBy: { column: "due_date", ascending: true },
    createDefaults: { status: "todo", priority: "medium" },
  },
  "/schedules": {
    table: "maintenance_schedules", title: "PM Schedules", eyebrow: "Maintenance",
    sub: "Preventive maintenance schedules per machine.",
    singular: "PM Schedule",
    columns: [
      { key: "machine_id", label: "Machine" },
      { key: "recurrence", label: "Recurrence" }, COL.status,
      { key: "next_due", label: "Next Due", kind: "date" },
      { key: "last_done", label: "Last Done", kind: "date" },
    ],
    orderBy: { column: "next_due", ascending: true },
    createDefaults: { status: "scheduled", recurrence: "monthly" },
  },
  "/leaves": {
    table: "leaves", title: "Leaves", eyebrow: "HR",
    sub: "Employee leave requests and approvals.",
    singular: "Leave Request",
    columns: [
      { key: "employee_id", label: "Employee" },
      { key: "leave_type", label: "Type" }, COL.status,
      { key: "start_date", label: "From", kind: "date" },
      { key: "end_date", label: "To", kind: "date" },
    ],
    orderBy: { column: "created_at", ascending: false },
    createDefaults: { status: "pending", leave_type: "casual" },
  },


  // ── HR ──────────────────────────────────────────────────────
  "/attendance": {
    table: "attendance", title: "Attendance", eyebrow: "HR",
    sub: "Daily attendance across employees.",
    singular: "Record", titleField: "employee_id",
    columns: [
      { key: "employee_id", label: "Employee" },
      { key: "date", label: "Date", kind: "date" },
      { key: "check_in", label: "In", kind: "datetime" },
      { key: "check_out", label: "Out", kind: "datetime" },
      { key: "hours_worked", label: "Hours", kind: "number" }, COL.status,
    ],
    orderBy: { column: "date", ascending: false },
    createDefaults: { status: "present" },
  },
  "/payroll": {
    table: "payroll", title: "Payroll", eyebrow: "HR / Finance",
    sub: "Payroll runs and disbursements.",
    singular: "Payroll Item", titleField: "period",
    columns: [
      { key: "employee_id", label: "Employee" },
      { key: "period", label: "Period" },
      { key: "gross_amount", label: "Gross", kind: "currency" },
      { key: "deductions", label: "Deductions", kind: "currency" },
      { key: "net_amount", label: "Net", kind: "currency" }, COL.status,
      { key: "paid_at", label: "Paid", kind: "date" },
    ],
    orderBy: { column: "period", ascending: false },
    createDefaults: { status: "pending" },
  },
  "/recruitment": {
    table: "job_openings", title: "Recruitment", eyebrow: "HR",
    sub: "Open positions and hiring pipeline.",
    singular: "Job Opening", titleField: "title",
    columns: [
      { key: "title", label: "Title" },
      { key: "department_id", label: "Department" },
      { key: "openings", label: "Openings", kind: "number" }, COL.status,
      { key: "created_at", label: "Posted", kind: "date" },
    ],
    orderBy: { column: "created_at", ascending: false },
    createDefaults: { status: "open", openings: 1 },
  },
  "/performance": {
    table: "performance_reviews", title: "Performance", eyebrow: "HR",
    sub: "Performance reviews and ratings.",
    singular: "Review",
    columns: [
      { key: "employee_id", label: "Employee" },
      { key: "period", label: "Period" },
      { key: "rating", label: "Rating", kind: "number" },
      { key: "notes", label: "Notes" },
      { key: "created_at", label: "Reviewed", kind: "date" },
    ],
    orderBy: { column: "created_at", ascending: false },
  },


  // ── Production execution ────────────────────────────────────
  "/bom": {
    table: "bom", title: "Bill of Materials", eyebrow: "Engineering",
    sub: "BOMs — components and quantities per finished product.",
    singular: "BOM",
    columns: [
      { key: "product_id", label: "Product" },
      { key: "version", label: "Version" }, COL.status,
      { key: "notes", label: "Notes" },
      { key: "updated_at", label: "Updated", kind: "date" },
    ],
    orderBy: { column: "updated_at", ascending: false },
    createDefaults: { version: "v1", status: "active" },
  },
  "/work-orders": {
    table: "work_orders", title: "Work Orders", eyebrow: "Production",
    sub: "Machine-level work orders under each production order.",
    singular: "Work Order", titleField: "wo_number",
    columns: [
      { key: "wo_number", label: "WO #" },
      { key: "operation", label: "Operation" }, COL.status,
      { key: "quantity", label: "Qty", kind: "number" },
      { key: "start_time", label: "Start", kind: "datetime" },
      { key: "end_time", label: "End", kind: "datetime" },
    ],
    orderBy: { column: "start_time", ascending: false },
    createDefaults: { status: "pending", quantity: 0 },
  },
  "/assigned-work-orders": {
    table: "work_orders", title: "My Work Orders", eyebrow: "Operator",
    sub: "Work orders assigned to you.",
    singular: "Work Order", titleField: "wo_number",
    columns: [
      { key: "wo_number", label: "WO #" },
      { key: "operation", label: "Operation" }, COL.status,
      { key: "quantity", label: "Qty", kind: "number" },
      { key: "start_time", label: "Start", kind: "datetime" },
    ],
    orderBy: { column: "start_time", ascending: false },
  },
  "/production-planning": {
    table: "production_orders", title: "Production Planning", eyebrow: "Production",
    sub: "Plan production against capacity and demand.",
    singular: "Plan", titleField: "order_number",
    columns: [
      { key: "order_number", label: "Order #" }, COL.status, COL.priority,
      { key: "quantity", label: "Qty", kind: "number" },
      { key: "start_date", label: "Start", kind: "date" },
      { key: "due_date", label: "Due", kind: "date" },
      { key: "progress", label: "%", kind: "number" },
    ],
    orderBy: { column: "due_date", ascending: true },
    createDefaults: { status: "planned", priority: "medium", progress: 0 },
  },
  "/production-logs": {
    table: "work_orders", title: "Production Logs", eyebrow: "Operator",
    sub: "Shift-level production activity.",
    singular: "Log Entry",
    columns: [
      { key: "wo_number", label: "WO #" },
      { key: "operation", label: "Operation" }, COL.status,
      { key: "start_time", label: "Start", kind: "datetime" },
      { key: "end_time", label: "End", kind: "datetime" },
    ],
    orderBy: { column: "start_time", ascending: false },
  },
  "/capacity-planning": {
    table: "machines", title: "Capacity Planning", eyebrow: "Production",
    sub: "Machine capacity and utilization.",
    singular: "Machine",
    columns: [
      { key: "name", label: "Machine" },
      { key: "code", label: "Code" },
      { key: "type", label: "Type" }, COL.status,
      { key: "utilization", label: "Utilization %", kind: "number" },
    ],
    orderBy: { column: "utilization", ascending: false },
  },
  "/scheduling": {
    table: "production_orders", title: "Scheduling", eyebrow: "Production",
    sub: "Schedule and sequence production orders.",
    singular: "Order", titleField: "order_number",
    columns: [
      { key: "order_number", label: "Order #" }, COL.status, COL.priority,
      { key: "start_date", label: "Start", kind: "date" },
      { key: "due_date", label: "Due", kind: "date" },
    ],
    orderBy: { column: "start_date", ascending: true },
  },
  "/assigned-machines": {
    table: "machines", title: "My Machines", eyebrow: "Operator",
    sub: "Machines assigned to your shift.",
    singular: "Machine",
    columns: [
      { key: "name", label: "Machine" },
      { key: "code", label: "Code" }, COL.status,
      { key: "utilization", label: "Utilization %", kind: "number" },
    ],
    orderBy: { column: "name", ascending: true },
  },

  // ── Quality ─────────────────────────────────────────────────
  "/incoming-inspection": {
    table: "quality_inspections", title: "Incoming Inspection", eyebrow: "Quality",
    sub: "Inspect raw material and component receipts.",
    singular: "Inspection", titleField: "inspection_number",
    filter: { inspection_type: "incoming" },
    columns: [
      { key: "inspection_number", label: "Inspection #" },
      { key: "result", label: "Result", kind: "status" },
      { key: "defects_found", label: "Defects", kind: "number" },
      { key: "quantity_checked", label: "Qty", kind: "number" },
      { key: "created_at", label: "Inspected", kind: "datetime" },
    ],
    orderBy: { column: "created_at", ascending: false },
    createDefaults: { inspection_type: "incoming", result: "pending", defects_found: 0 },
  },
  "/in-process-inspection": {
    table: "quality_inspections", title: "In-Process Inspection", eyebrow: "Quality",
    sub: "Mid-production quality checks.",
    singular: "Inspection", titleField: "inspection_number",
    filter: { inspection_type: "in_process" },
    columns: [
      { key: "inspection_number", label: "Inspection #" },
      { key: "result", label: "Result", kind: "status" },
      { key: "defects_found", label: "Defects", kind: "number" },
      { key: "quantity_checked", label: "Qty", kind: "number" },
      { key: "created_at", label: "Checked", kind: "datetime" },
    ],
    orderBy: { column: "created_at", ascending: false },
    createDefaults: { inspection_type: "in_process", result: "pending", defects_found: 0 },
  },
  "/final-inspection": {
    table: "quality_inspections", title: "Final Inspection", eyebrow: "Quality",
    sub: "Pre-dispatch quality gate.",
    singular: "Inspection", titleField: "inspection_number",
    filter: { inspection_type: "final" },
    columns: [
      { key: "inspection_number", label: "Inspection #" },
      { key: "result", label: "Result", kind: "status" },
      { key: "defects_found", label: "Defects", kind: "number" },
      { key: "quantity_checked", label: "Qty", kind: "number" },
      { key: "created_at", label: "Checked", kind: "datetime" },
    ],
    orderBy: { column: "created_at", ascending: false },
    createDefaults: { inspection_type: "final", result: "pending", defects_found: 0 },
  },
  "/defects": {
    table: "quality_inspections", title: "Defects", eyebrow: "Quality",
    sub: "Defect records identified during inspection.",
    singular: "Defect Record",
    columns: [
      { key: "inspection_number", label: "Ref #" },
      { key: "inspection_type", label: "Stage" },
      { key: "result", label: "Result", kind: "status" },
      { key: "defects_found", label: "Defects", kind: "number" },
      { key: "created_at", label: "Logged", kind: "datetime" },
    ],
    orderBy: { column: "defects_found", ascending: false },
  },
  "/capa": {
    table: "approvals", title: "CAPA", eyebrow: "Quality",
    sub: "Corrective and preventive actions.",
    singular: "CAPA", titleField: "notes",
    filter: { entity: "capa" },
    columns: [
      { key: "entity", label: "Type" }, COL.status,
      { key: "notes", label: "Description" },
      { key: "created_at", label: "Raised", kind: "date" },
      { key: "resolved_at", label: "Resolved", kind: "date" },
    ],
    orderBy: { column: "created_at", ascending: false },
    createDefaults: { entity: "capa", status: "pending" },
  },

  // ── Maintenance / spares ────────────────────────────────────
  "/breakdowns": {
    table: "machine_breakdowns", title: "Breakdowns", eyebrow: "Maintenance",
    sub: "Logged machine breakdowns and downtime.",
    singular: "Breakdown",
    columns: [
      { key: "machine_id", label: "Machine" },
      { key: "cause", label: "Cause" },
      { key: "downtime_start", label: "Down From", kind: "datetime" },
      { key: "downtime_end", label: "Restored", kind: "datetime" },
    ],
    orderBy: { column: "downtime_start", ascending: false },
  },
  "/machine-history": {
    table: "machine_status_log", title: "Machine History", eyebrow: "Maintenance",
    sub: "Chronological status history per machine.",
    singular: "Entry",
    columns: [
      { key: "machine_id", label: "Machine" },
      { key: "from_status", label: "From" },
      { key: "to_status", label: "To", kind: "status" },
      { key: "reason", label: "Reason" },
      { key: "created_at", label: "Changed", kind: "datetime" },
    ],
    orderBy: { column: "created_at", ascending: false },
  },
  "/spare-parts": {
    table: "spare_parts", title: "Spare Parts", eyebrow: "Maintenance",
    sub: "Spare parts inventory tied to machines.",
    singular: "Part", titleField: "name",
    columns: [
      { key: "part_code", label: "Code" },
      { key: "name", label: "Name" },
      { key: "quantity", label: "In Stock", kind: "number" },
      { key: "reorder_threshold", label: "Reorder At", kind: "number" },
      { key: "unit_cost", label: "Cost", kind: "currency" },
    ],
    orderBy: { column: "name", ascending: true },
  },


  // ── Warehouse ops ───────────────────────────────────────────
  "/cycle-count": {
    table: "cycle_counts", title: "Cycle Count", eyebrow: "Warehouse",
    sub: "Physical stock counts and variance reconciliation.",
    singular: "Count",
    columns: [
      { key: "warehouse_id", label: "Warehouse" },
      { key: "count_date", label: "Count Date", kind: "date" }, COL.status,
      { key: "created_at", label: "Created", kind: "datetime" },
    ],
    orderBy: { column: "count_date", ascending: false },
    createDefaults: { status: "draft" },
  },

  "/stock-movement": {
    table: "inventory", title: "Stock Movement", eyebrow: "Warehouse",
    sub: "Realtime inventory levels by warehouse.",
    singular: "Movement",
    columns: [
      { key: "product_id", label: "Product" },
      { key: "warehouse_id", label: "Warehouse" },
      { key: "quantity", label: "Qty", kind: "number" },
      { key: "updated_at", label: "Updated", kind: "datetime" },
    ],
    orderBy: { column: "updated_at", ascending: false },
  },
  "/transfers": {
    table: "inventory", title: "Transfers", eyebrow: "Warehouse",
    sub: "Inter-warehouse and inter-plant transfers.",
    singular: "Transfer",
    columns: [
      { key: "product_id", label: "Product" },
      { key: "warehouse_id", label: "Warehouse" },
      { key: "quantity", label: "Qty", kind: "number" },
    ],
    orderBy: { column: "updated_at", ascending: false },
  },
  "/receiving": {
    table: "purchase_orders", title: "Receiving", eyebrow: "Warehouse",
    sub: "Receive inbound goods against purchase orders.",
    singular: "Receipt", titleField: "po_number",
    columns: [
      { key: "po_number", label: "PO #" }, COL.status,
      { key: "total_amount", label: "Value", kind: "currency" },
      { key: "expected_date", label: "Expected", kind: "date" },
    ],
    orderBy: { column: "expected_date", ascending: true },
  },
  "/goods-receipt": {
    table: "purchase_orders", title: "Goods Receipt", eyebrow: "Procurement",
    sub: "Confirm goods received against POs.",
    singular: "Receipt", titleField: "po_number",
    columns: [
      { key: "po_number", label: "PO #" }, COL.status,
      { key: "total_amount", label: "Value", kind: "currency" },
      { key: "expected_date", label: "Expected", kind: "date" },
    ],
    orderBy: { column: "expected_date", ascending: false },
  },

  // ── Procurement ─────────────────────────────────────────────
  "/purchase-requests": {
    table: "approvals", title: "Purchase Requests", eyebrow: "Procurement",
    sub: "Internal requests pending PO conversion.",
    singular: "Request", titleField: "notes",
    filter: { entity: "purchase_requests" },
    columns: [
      { key: "notes", label: "Request" }, COL.status,
      { key: "created_at", label: "Raised", kind: "date" },
    ],
    orderBy: { column: "created_at", ascending: false },
    createDefaults: { entity: "purchase_requests", status: "pending" },
  },
  "/rfq": {
    table: "suppliers", title: "RFQ", eyebrow: "Procurement",
    sub: "Request for quotations across suppliers.",
    singular: "Supplier",
    columns: [
      { key: "name", label: "Supplier" },
      { key: "contact_email", label: "Contact" },
      { key: "rating", label: "Rating", kind: "number" }, COL.status,
    ],
    orderBy: { column: "rating", ascending: false },
  },
  "/vendor-comparison": {
    table: "suppliers", title: "Vendor Comparison", eyebrow: "Procurement",
    sub: "Compare suppliers by price, quality and lead time.",
    singular: "Supplier",
    columns: [
      { key: "name", label: "Supplier" },
      { key: "rating", label: "Rating", kind: "number" }, COL.status,
    ],
    orderBy: { column: "rating", ascending: false },
  },

  // ── Supplier portal ─────────────────────────────────────────
  "/supplier-pos": {
    table: "purchase_orders", title: "Purchase Orders", eyebrow: "Supplier",
    sub: "POs you have received from the buyer.",
    singular: "PO", titleField: "po_number",
    columns: [
      { key: "po_number", label: "PO #" }, COL.status,
      { key: "total_amount", label: "Amount", kind: "currency" },
      { key: "expected_date", label: "Expected", kind: "date" },
    ],
    orderBy: { column: "created_at", ascending: false },
  },
  "/supplier-invoices": {
    table: "invoices", title: "Invoices", eyebrow: "Supplier",
    sub: "Invoices you have raised.",
    singular: "Invoice", titleField: "invoice_number",
    columns: [
      { key: "invoice_number", label: "Invoice #" }, COL.status,
      { key: "total_amount", label: "Amount", kind: "currency" },
      { key: "issue_date", label: "Issued", kind: "date" },
    ],
    orderBy: { column: "issue_date", ascending: false },
  },
  "/supplier-performance": {
    table: "suppliers", title: "Performance", eyebrow: "Supplier",
    sub: "Your on-time delivery and quality ratings.",
    singular: "Metric",
    columns: [
      { key: "name", label: "Supplier" },
      { key: "rating", label: "Rating", kind: "number" }, COL.status,
    ],
    orderBy: { column: "rating", ascending: false },
  },

  // ── Finance extras ──────────────────────────────────────────
  "/expenses": {
    table: "payments", title: "Expenses", eyebrow: "Finance",
    sub: "Outgoing payments and operating expenses.",
    singular: "Expense",
    columns: [
      { key: "payment_number", label: "Ref #" }, COL.status,
      { key: "amount", label: "Amount", kind: "currency" },
      { key: "method", label: "Method" },
      { key: "paid_at", label: "Paid", kind: "date" },
    ],
    orderBy: { column: "paid_at", ascending: false },
  },
  "/taxes": {
    table: "invoices", title: "Taxes", eyebrow: "Finance",
    sub: "Tax obligations by invoice.",
    singular: "Entry",
    columns: [
      { key: "invoice_number", label: "Invoice #" },
      { key: "tax_amount", label: "Tax", kind: "currency" },
      { key: "total_amount", label: "Total", kind: "currency" }, COL.status,
      { key: "issue_date", label: "Issued", kind: "date" },
    ],
    orderBy: { column: "issue_date", ascending: false },
  },
  "/budgets": {
    table: "approvals", title: "Budgets", eyebrow: "Finance",
    sub: "Budget requests and approvals.",
    singular: "Budget",
    filter: { entity: "budgets" },
    titleField: "notes",
    columns: [
      { key: "notes", label: "Budget" }, COL.status,
      { key: "created_at", label: "Raised", kind: "date" },
    ],
    orderBy: { column: "created_at", ascending: false },
    createDefaults: { entity: "budgets", status: "pending" },
  },
  "/profit-loss": {
    table: "invoices", title: "Profit & Loss", eyebrow: "Finance",
    sub: "Revenue and cost accumulation.",
    singular: "Entry",
    columns: [
      { key: "invoice_number", label: "Invoice #" }, COL.status,
      { key: "total_amount", label: "Amount", kind: "currency" },
      { key: "issue_date", label: "Date", kind: "date" },
    ],
    orderBy: { column: "issue_date", ascending: false },
  },

  // ── Reports (list a compact recent activity view) ───────────
  "/production-reports": {
    table: "production_orders", title: "Production Reports", eyebrow: "Reports",
    sub: "Production orders history and completion.",
    singular: "Report",
    columns: [
      { key: "order_number", label: "Order #" }, COL.status,
      { key: "quantity", label: "Qty", kind: "number" },
      { key: "progress", label: "%", kind: "number" },
      { key: "due_date", label: "Due", kind: "date" },
    ],
    orderBy: { column: "due_date", ascending: false },
  },
  "/quality-reports": {
    table: "quality_inspections", title: "Quality Reports", eyebrow: "Reports",
    sub: "Inspection results across your product portfolio.",
    singular: "Report",
    columns: [
      { key: "inspection_number", label: "Ref #" },
      { key: "inspection_type", label: "Stage" },
      { key: "result", label: "Result", kind: "status" },
      { key: "defects_found", label: "Defects", kind: "number" },
      { key: "created_at", label: "Date", kind: "datetime" },
    ],
    orderBy: { column: "created_at", ascending: false },
  },
  "/maintenance-reports": {
    table: "work_orders", title: "Maintenance Reports", eyebrow: "Reports",
    sub: "Maintenance activity across machines.",
    singular: "Report",
    columns: [
      { key: "wo_number", label: "WO #" },
      { key: "operation", label: "Operation" }, COL.status,
      { key: "start_time", label: "Start", kind: "datetime" },
    ],
    orderBy: { column: "start_time", ascending: false },
  },
  "/finance-reports": {
    table: "invoices", title: "Finance Reports", eyebrow: "Reports",
    sub: "Revenue, invoicing and payment activity.",
    singular: "Report",
    columns: [
      { key: "invoice_number", label: "Invoice #" }, COL.status,
      { key: "total_amount", label: "Amount", kind: "currency" },
      { key: "issue_date", label: "Issued", kind: "date" },
    ],
    orderBy: { column: "issue_date", ascending: false },
  },
  "/hr-reports": {
    table: "employees", title: "HR Reports", eyebrow: "Reports",
    sub: "Workforce composition and status.",
    singular: "Employee",
    columns: [
      { key: "employee_code", label: "Code" },
      { key: "full_name", label: "Name" },
      { key: "department", label: "Dept" },
      { key: "job_title", label: "Role" }, COL.status,
    ],
    orderBy: { column: "full_name", ascending: true },
  },

  // ── Plant management ────────────────────────────────────────
  "/plant-overview": {
    table: "machines", title: "Plant Overview", eyebrow: "Plant",
    sub: "Machines and status across the plant floor.",
    singular: "Asset",
    columns: [
      { key: "name", label: "Machine" }, { key: "code", label: "Code" },
      { key: "type", label: "Type" }, COL.status,
      { key: "utilization", label: "Utilization %", kind: "number" },
    ],
    orderBy: { column: "name", ascending: true },
  },
  "/plant-performance": {
    table: "production_orders", title: "Plant Performance", eyebrow: "Plant",
    sub: "Output, on-time delivery and quality across shifts.",
    singular: "Order",
    columns: [
      { key: "order_number", label: "Order #" }, COL.status,
      { key: "progress", label: "%", kind: "number" },
      { key: "due_date", label: "Due", kind: "date" },
    ],
    orderBy: { column: "due_date", ascending: false },
  },

  // ── Compliance ──────────────────────────────────────────────
  "/compliance": {
    table: "documents", title: "Compliance", eyebrow: "Auditor",
    sub: "Compliance documents and ISO evidence.",
    singular: "Document",
    filter: { category: "iso" },
    columns: [
      { key: "title", label: "Document" },
      { key: "category", label: "Category" },
      { key: "version", label: "Version" }, COL.status,
      { key: "created_at", label: "Filed", kind: "date" },
    ],
    orderBy: { column: "created_at", ascending: false },
  },
};

export function moduleForPath(path: string): ModuleConfig | null {
  return MODULE_REGISTRY[path] ?? null;
}
