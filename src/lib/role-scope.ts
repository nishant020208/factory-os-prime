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
    "production",
    "inventory",
    "quality",
    "maintenance",
    "finance",
    "hr",
    "customers",
    "suppliers",
    "orders",
    "procurement",
    "dispatch",
    "documents",
    "crm",
    "analytics",
    "plants",
    "departments",
    "products",
    "bom",
    "settings",
    "whitelist",
    "capa",
    "defects",
    "leaves",
    "training",
    "performance",
    "payroll",
    "attendance",
    "recruitment",
    "company",
    "companies",
  ],
  plant_admin: [
    "production",
    "inventory",
    "quality",
    "maintenance",
    "machines",
    "orders",
    "plants",
    "departments",
    "products",
    "company",
    "companies",
  ],
  plant_manager: [
    "production",
    "inventory",
    "quality",
    "maintenance",
    "machines",
    "orders",
    "products",
    "company",
    "companies",
  ],
  production_manager: [
    "production",
    "orders",
    "machines",
    "inventory",
    "maintenance",
    "quality",
    "products",
    "bom",
    "company",
    "companies",
  ],
  production_operator: [
    "orders",
    "machines",
    "maintenance",
    "products",
    "company",
    "companies",
  ],
  warehouse_manager: [
    "inventory",
    "dispatch",
    "products",
    "company",
    "companies",
  ],
  procurement_manager: [
    "procurement",
    "suppliers",
    "inventory",
    "products",
    "company",
    "companies",
  ],
  quality_inspector: [
    "quality",
    "defects",
    "capa",
    "incoming-inspection",
    "final-inspection",
    "products",
    "company",
    "companies",
  ],
  maintenance_engineer: [
    "maintenance",
    "machines",
    "breakdowns",
    "spare-parts",
    "company",
    "companies",
  ],
  finance_manager: [
    "finance",
    "invoices",
    "payments",
    "expenses",
    "budgets",
    "taxes",
    "profit-loss",
    "suppliers",
    "products",
    "company",
    "companies",
  ],
  hr_manager: [
    "hr",
    "leaves",
    "training",
    "performance",
    "payroll",
    "attendance",
    "recruitment",
    "company",
    "companies",
  ],
  customer_portal: [
    "orders",
    "dispatch",
    "finance",
    "documents",
    "crm",
    "support",
    "company",
    "companies",
    "plants",
    "departments",
    "products",
  ],
  supplier_portal: [
    "suppliers",
    "inventory",
    "dispatch",
    "finance",
    "orders",
    "procurement",
    "company",
    "companies",
    "plants",
    "departments",
    "products",
  ],
  auditor: [
    "production",
    "inventory",
    "quality",
    "maintenance",
    "finance",
    "hr",
    "customers",
    "suppliers",
    "orders",
    "procurement",
    "dispatch",
    "documents",
    "crm",
    "analytics",
    "plants",
    "departments",
    "products",
    "bom",
    "audit",
    "capa",
    "defects",
    "leaves",
    "training",
    "performance",
    "payroll",
    "attendance",
    "recruitment",
    "company",
    "companies",
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
    "You can view your assigned work orders, machines, maintenance flags, and public company info.",
  warehouse_manager:
    "I can show inventory, dispatch/shipments, product catalog, and public company data.",
  procurement_manager:
    "I can show procurement, supplier, inventory, and public company data.",
  quality_inspector:
    "I can show quality inspections, defects, and CAPA data only. Production and warehouse details are managed by other teams.",
  maintenance_engineer:
    "I can show maintenance tickets, machine status, breakdowns, and spare parts only. Production scheduling is managed by the Production team.",
  finance_manager:
    "I can show financial data only — invoices, payments, expenses, budgets, taxes, and supplier payments.",
  hr_manager:
    "I can show employee, leave, training, performance, payroll, attendance, and recruitment data only.",
  customer_portal:
    "You can view company overview, product catalog, and your own orders, shipments, invoices, payments, documents, and support tickets.",
  supplier_portal:
    "You can view company overview, product catalog, and your received POs, shipments, invoices, and payments.",
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
  customers: "Other Customers' Confidential Data",
  suppliers: "Other Suppliers' Confidential Data",
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
  company: "Company Overview",
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
 */
export function checkRoleScope(role: string | null, question: string): string | null {
  const allowed = ROLE_DOMAIN_MAP[role ?? ""] ?? [];
  const allowedSet = new Set(allowed);

  // Keywords that firmly identify a domain question.
  // NOTE: "company" domain is NOT listed here because ALL employees can ask about
  // their own company (it's public information). The company_id isolation is enforced
  // at the RAG retrieval (pgvector SQL) level — not at keyword gate level.
  // Only truly cross-boundary or confidential domain keywords are gated here.
  const domainKeywords: Record<string, string[]> = {
    finance: [
      "total company revenue",
      "net profit",
      "gross margin",
      "company cash flow",
      "ebitda",
      "tax liability",
      "payroll expense",
      "financial p&l",
      "balance sheet",
      "quarterly profit",
      "annual revenue",
    ],
    hr: [
      "employee salary",
      "manager salary",
      "employee compensation",
      "payroll total",
      "employee home address",
      "leave reason",
      "medical leave",
      "annual ctc",
    ],
    customers: [
      "another customer",
      "other customer",
      "other clients",
      "customer database",
      "all customers' addresses",
      "all customer gst",
    ],
    suppliers: [
      "other supplier",
      "another supplier",
      "supplier margin",
      "negotiated contract rate",
      "all suppliers' bank",
    ],
  };

  const lowerQ = question.toLowerCase();

  const matchedDomains = [];
  for (const [domain, keywords] of Object.entries(domainKeywords)) {
    if (keywords.some((kw) => lowerQ.includes(kw))) {
      matchedDomains.push(domain);
    }
  }

  if (matchedDomains.length > 0 && !matchedDomains.some((d) => allowedSet.has(d))) {
    return matchedDomains[0];
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
  root_super_admin:
    "the platform console only — companies, registrations, whitelisting and platform audit. I never see any company's operational ERP data.",
  company_admin:
    "your own company's full operational picture across every module — but only your company, never another tenant.",
  plant_admin: "your plant's production, inventory, quality, maintenance and machines.",
  plant_manager:
    "day-to-day plant operations: production, inventory, quality, maintenance and machines.",
  production_manager:
    "production planning, work orders, machines, material availability, maintenance and quality feedback.",
  production_operator:
    "the work orders assigned to you, the machines you run, and maintenance flags you raise.",
  warehouse_manager: "inventory, stock movement, products and dispatch/shipments.",
  procurement_manager: "purchase orders, requisitions, RFQs, suppliers and material stock levels.",
  quality_inspector: "inspections, defects, CAPA and incoming/final inspection records.",
  maintenance_engineer: "maintenance tickets, machine status, breakdowns and spare parts.",
  finance_manager: "invoices, payments, expenses, budgets, taxes, P&L and supplier payments.",
  hr_manager: "employees, leaves, training, performance, payroll, attendance and recruitment.",
  customer_portal:
    "your own orders, shipments, invoices, payments, documents and support tickets — never another customer's.",
  supplier_portal:
    "the purchase orders sent to you, your deliveries, invoices and payments — never another supplier's.",
  auditor:
    "read-only visibility across every module in your company, plus the audit trail. I can never create, edit or delete anything.",
};

/** Domains a role explicitly cannot ask about (everything outside its map) */
export function getBlockedLabels(role: string | null): string[] {
  const allowed = new Set(ROLE_DOMAIN_MAP[role ?? ""] ?? []);
  const core = [
    "production",
    "inventory",
    "quality",
    "maintenance",
    "finance",
    "hr",
    "suppliers",
    "procurement",
    "orders",
    "dispatch",
    "customers",
    "audit",
    "platform",
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
  const tenant =
    key === "root_super_admin"
      ? "Platform scope (no company ERP data)"
      : companyName
        ? `Company scope: ${companyName} only`
        : "Company scope: your own company only";

  return [
    `🤖 I am the Copilot for exactly one role: **${label}**.`,
    ``,
    `I'm scoped to ${scope}`,
    ``,
    `| Aspect | Details |`,
    `|--------|---------|`,
    `| Tenant isolation | ${tenant} |`,
    `| Can answer about | ${allowed.join(", ") || "—"} |`,
    `| Cannot answer about | ${blocked.length ? blocked.join(", ") : "nothing outside your scope"} |`,
    `| Actions | ${isReadOnlyRole(role) ? "read-only — never create/edit/approve/delete" : "advisory only — read live data, guide you"} |`,
    ``,
    `No God-mode: I don't switch roles, and I can't read another role's or another company's records.`,
  ].join("\n");
}
