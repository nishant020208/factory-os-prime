/**
 * role-scope.ts — Shared utility for role-scoped AI Copilot access.
 * Single source of truth for ROLE_DOMAIN_MAP, ROLE_BLOCKED_MESSAGE,
 * DOMAIN_LABELS, and checkRoleScope(). Imported by both ModuleCopilot
 * and the AI Center page.
 *
 * Any permission change should be made here — never in two places.
 */

/** Maps each role to the data domains they are ALLOWED to access */
export const ROLE_DOMAIN_MAP: Record<string, string[]> = {
  root_super_admin: ["platform", "settings", "audit", "companies"],
  company_admin: [
    "production", "inventory", "quality", "maintenance", "finance", "hr",
    "customers", "suppliers", "orders", "procurement", "dispatch", "documents",
    "crm", "analytics", "plants", "departments", "products", "bom", "settings",
    "whitelist", "capa", "defects", "leaves", "training", "performance",
    "payroll", "attendance", "recruitment",
  ],
  plant_admin: ["production", "inventory", "quality", "maintenance", "machines", "orders", "plants", "departments"],
  plant_manager: ["production", "inventory", "quality", "maintenance", "machines", "orders"],
  production_manager: ["production", "orders", "machines", "inventory", "maintenance", "quality", "products", "bom"],
  production_operator: ["orders", "machines", "maintenance"],
  warehouse_manager: ["inventory", "dispatch", "products"],
  procurement_manager: ["procurement", "suppliers", "inventory"],
  quality_inspector: ["quality", "defects", "capa", "incoming-inspection", "final-inspection"],
  maintenance_engineer: ["maintenance", "machines", "breakdowns", "spare-parts"],
  finance_manager: ["finance", "invoices", "payments", "expenses", "budgets", "taxes", "profit-loss", "suppliers"],
  hr_manager: ["hr", "leaves", "training", "performance", "payroll", "attendance", "recruitment"],
  customer_portal: ["orders", "dispatch", "finance", "documents", "crm", "support"],
  supplier_portal: ["suppliers", "inventory", "dispatch", "finance"],
  auditor: [
    "production", "inventory", "quality", "maintenance", "finance", "hr",
    "customers", "suppliers", "orders", "procurement", "dispatch", "documents",
    "crm", "analytics", "plants", "departments", "products", "bom", "audit",
    "capa", "defects", "leaves", "training", "performance", "payroll",
    "attendance", "recruitment",
  ],
};

/** Role-friendly messages when a question is about a restricted domain */
export const ROLE_BLOCKED_MESSAGE: Record<string, string> = {
  root_super_admin:
    "This operational data is outside the Platform Console scope. Navigate to a specific company's instance to view operational records.",
  company_admin:
    "You have read-only oversight of this module. Detailed cross-module operational drill-down is available on the respective role dashboards.",
  plant_admin:
    "This data is outside your plant's scope. You can view plant-level production, warehouse, maintenance, and quality data only.",
  plant_manager:
    "This data is outside your plant scope. You can view plant-level production, warehouse, maintenance, and quality data only.",
  production_manager:
    "This information is managed by the Warehouse or Finance team. I can only show production, orders, machines, inventory, and maintenance data.",
  production_operator:
    "You can view your assigned work orders, machines, and maintenance flags only.",
  warehouse_manager:
    "I can show inventory, dispatch/shipments, and product data only. Production orders and financial data are managed by other teams.",
  procurement_manager:
    "I can show procurement, supplier, and inventory data only. Production and financial details are managed by other teams.",
  quality_inspector:
    "I can show quality inspections, defects, and CAPA data only. Production and warehouse details are managed by other teams.",
  maintenance_engineer:
    "I can show maintenance tickets, machine status, breakdowns, and spare parts only. Production scheduling is managed by the Production team.",
  finance_manager:
    "I can show financial data only — invoices, payments, expenses, budgets, taxes, and supplier payments. Production details are managed by the Production team.",
  hr_manager:
    "I can show employee, leave, training, performance, payroll, attendance, and recruitment data only.",
  customer_portal:
    "You can view your own orders, shipments, invoices, payments, documents, and support tickets only.",
  supplier_portal:
    "You can view your received POs, shipments, invoices, and payments only.",
  auditor:
    "You have read-only access to all modules. No create/edit/delete actions are available for any data.",
};

/** Domain slug → human-readable label */
export const DOMAIN_LABELS: Record<string, string> = {
  production: "Production",
  inventory: "Inventory/Warehouse",
  quality: "Quality",
  maintenance: "Maintenance",
  finance: "Finance",
  hr: "Human Resources",
  customers: "Customers",
  suppliers: "Suppliers",
  orders: "Orders/Work Orders",
  procurement: "Procurement",
  dispatch: "Dispatch/Shipments",
  documents: "Documents",
  crm: "CRM",
  analytics: "Analytics",
  machines: "Machines",
  plants: "Plants",
  departments: "Departments",
  products: "Products",
  bom: "Bill of Materials",
  settings: "Settings",
  whitelist: "Whitelist",
  audit: "Audit Logs",
  companies: "Companies",
  platform: "Platform",
  capa: "CAPA",
  defects: "Defects",
  leaves: "Leaves",
  training: "Training",
  performance: "Performance",
  payroll: "Payroll",
  attendance: "Attendance",
  recruitment: "Recruitment",
  "incoming-inspection": "Incoming Inspection",
  "final-inspection": "Final Inspection",
  breakdowns: "Breakdowns",
  "spare-parts": "Spare Parts",
  expenses: "Expenses",
  budgets: "Budgets",
  taxes: "Taxes",
  "profit-loss": "Profit & Loss",
  invoices: "Invoices",
  payments: "Payments",
  support: "Support Tickets",
};

/**
 * Check if a user's question mentions a domain outside their role's allowed scope.
 * Returns the blocked domain name (slug) if found, or null if the question is within scope.
 *
 * Uses keyword matching. It is intentionally strict: a match on a restricted domain
 * blocks the answer. The only exception is for roles that have "orders" in their
 * scope — the bare word "order" is skipped to avoid false-positives.
 */
export function checkRoleScope(role: string | null, question: string): string | null {
  const allowed = ROLE_DOMAIN_MAP[role ?? ""] ?? [];
  const allowedSet = new Set(allowed);

  // Keywords that indicate which domain the user is asking about.
  // The broader a keyword list, the more likely a false-positive — but
  // we prefer a safe block over an accidental data leak across roles.
  const domainKeywords: Record<string, string[]> = {
    production: ["production", "manufacturing", "batch", "oee", "throughput", "work order"],
    inventory: ["inventory", "stock", "warehouse", "sku", "reorder level", "bin location", "material"],
    quality: ["quality", "inspection", "defect", "yield", "ncr", "capa", "pass rate", "rejection"],
    maintenance: ["maintenance", "repair", "breakdown", "mtbf", "mttr", "machine downtime", "spare part"],
    finance: ["revenue", "invoice", "payment", "budget", "cash flow", "profit", "expense", "tax"],
    hr: ["employee", "headcount", "payroll", "leave", "training", "attendance", "recruitment", "onboarding"],
    customers: ["customer", "client"],
    suppliers: ["supplier", "vendor"],
    orders: ["sales order", "so-", "wo-", "purchase order"],
    procurement: ["procurement", "purchase order", "requisition", "rfq"],
    dispatch: ["dispatch", "shipment", "delivery", "tracking", "carrier", "out for delivery"],
    machines: ["cnc", "robot", "equipment", "asset"],
    products: ["product", "sku", "catalog", "bom", "bill of material"],
  };

  const lowerQ = question.toLowerCase();

  for (const [domain, keywords] of Object.entries(domainKeywords)) {
    if (keywords.some((kw) => lowerQ.includes(kw))) {
      if (!allowedSet.has(domain)) {
        return domain;
      }
    }
  }

  return null;
}

/**
 * Get a user-friendly block message for a given role.
 * Falls back to a generic message if no custom message is defined.
 */
export function getBlockMessage(role: string | null): string {
  return ROLE_BLOCKED_MESSAGE[role ?? ""] ?? "This information is not available for your role.";
}

/**
 * Get the list of human-readable domain labels a role can access.
 */
export function getAllowedLabels(role: string | null): string[] {
  const domains = ROLE_DOMAIN_MAP[role ?? ""] ?? [];
  return domains.map((d) => DOMAIN_LABELS[d] ?? d);
}

/* ────────────────────────────────────────────────────────── */
/*  ROLE IDENTITY — "which role are you Copilot for?"          */
/* ────────────────────────────────────────────────────────── */

/** Human label for every app role */
export const ROLE_LABELS: Record<string, string> = {
  root_super_admin: "Root Super Admin",
  company_admin: "Company Admin",
  plant_admin: "Plant Admin",
  plant_manager: "Plant Manager",
  production_manager: "Production Manager",
  production_operator: "Production Operator",
  warehouse_manager: "Warehouse Manager",
  procurement_manager: "Procurement Manager",
  quality_inspector: "Quality Inspector",
  maintenance_engineer: "Maintenance Engineer",
  finance_manager: "Finance Manager",
  hr_manager: "HR Manager",
  customer_portal: "Customer (Portal)",
  supplier_portal: "Supplier (Portal)",
  auditor: "Auditor",
};

/** One-line description of what each role's Copilot is for */
export const ROLE_SCOPE_SUMMARY: Record<string, string> = {
  root_super_admin: "the platform console only — companies, registrations, whitelisting and platform audit. I never see any company's operational ERP data.",
  company_admin: "your own company's full operational picture across every module — but only your company, never another tenant.",
  plant_admin: "your plant's production, inventory, quality, maintenance and machines.",
  plant_manager: "day-to-day plant operations: production, inventory, quality, maintenance and machines.",
  production_manager: "production planning, work orders, machines, material availability, maintenance and quality feedback.",
  production_operator: "the work orders assigned to you, the machines you run, and maintenance flags you raise.",
  warehouse_manager: "inventory, stock movement, products and dispatch/shipments.",
  procurement_manager: "purchase orders, requisitions, RFQs, suppliers and material stock levels.",
  quality_inspector: "inspections, defects, CAPA and incoming/final inspection records.",
  maintenance_engineer: "maintenance tickets, machine status, breakdowns and spare parts.",
  finance_manager: "invoices, payments, expenses, budgets, taxes, P&L and supplier payments.",
  hr_manager: "employees, leaves, training, performance, payroll, attendance and recruitment.",
  customer_portal: "your own orders, shipments, invoices, payments, documents and support tickets — never another customer's.",
  supplier_portal: "the purchase orders sent to you, your deliveries, invoices and payments — never another supplier's.",
  auditor: "read-only visibility across every module in your company, plus the audit trail. I can never create, edit or delete anything.",
};

/** Domains a role explicitly cannot ask about (everything outside its map) */
export function getBlockedLabels(role: string | null): string[] {
  const allowed = new Set(ROLE_DOMAIN_MAP[role ?? ""] ?? []);
  const core = [
    "production", "inventory", "quality", "maintenance", "finance", "hr",
    "suppliers", "procurement", "orders", "dispatch", "customers", "audit", "platform",
  ];
  return core.filter((d) => !allowed.has(d)).map((d) => DOMAIN_LABELS[d] ?? d);
}

/** Every role is read-only advisory in Copilot; auditor is read-only app-wide. */
export function isReadOnlyRole(role: string | null): boolean {
  return role === "auditor";
}

/**
 * The exact answer to "you are copilot for which role?" — precise for all 15
 * roles, with allowed scope, blocked scope and the no-God-mode guarantee.
 */
export function getRoleIdentityCard(role: string | null, companyName?: string | null): string {
  const key = role ?? "";
  const label = ROLE_LABELS[key];
  if (!label) {
    return `I'm the FactoryOS Copilot, but no role is currently assigned to your account, so I have **no data scope**. Ask your Company Admin to assign your role, then I can help.`;
  }
  const allowed = getAllowedLabels(role);
  const blocked = getBlockedLabels(role);
  const scope = ROLE_SCOPE_SUMMARY[key] ?? "your assigned modules.";
  const tenant = key === "root_super_admin"
    ? "Platform scope (no company ERP data)"
    : companyName
      ? `Company scope: ${companyName} only`
      : "Company scope: your own company only";

  return [
    `🤖 I am the Copilot for exactly one role: **${label}**.`,
    ``,
    `I'm scoped to ${scope}`,
    ``,
    `- **Tenant isolation:** ${tenant}`,
    `- **I can answer about:** ${allowed.join(", ") || "—"}`,
    `- **I cannot answer about:** ${blocked.length ? blocked.join(", ") : "nothing outside your scope — you have full-module visibility for your company"}`,
    `- **Actions:** ${isReadOnlyRole(role) ? "read-only — I never create, edit, approve or delete anything" : "advisory only — I read live data and guide you; you perform actions in the module UI"}`,
    ``,
    `No God-mode: I don't switch roles, and I can't read another role's or another company's records.`,
  ].join("\n");
}

