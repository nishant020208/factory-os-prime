/**
 * src/lib/rag/confidentiality.ts
 *
 * Single source of truth for RAG Knowledge Confidentiality Classification.
 * Implements the 3-tier classification hierarchy (Public | Internal | Restricted)
 * with explicit role-visibility arrays for all 15 FactoryOS roles.
 */

export type ConfidentialityLevel = "public" | "internal" | "restricted";

export const ALL_15_ROLES = [
  "root_super_admin",
  "company_admin",
  "plant_admin",
  "plant_manager",
  "production_manager",
  "production_operator",
  "warehouse_manager",
  "procurement_manager",
  "quality_inspector",
  "maintenance_engineer",
  "finance_manager",
  "hr_manager",
  "customer_portal",
  "supplier_portal",
  "auditor",
] as const;

export type AppRole = (typeof ALL_15_ROLES)[number];

/** Roles that can view standard public company information */
export const PUBLIC_ROLES: AppRole[] = [...ALL_15_ROLES];

/** Roles that can view factory internal operational scheduling, inventory, and production */
export const INTERNAL_OPERATIONAL_ROLES: AppRole[] = [
  "root_super_admin",
  "company_admin",
  "plant_admin",
  "plant_manager",
  "production_manager",
  "warehouse_manager",
  "procurement_manager",
  "quality_inspector",
  "maintenance_engineer",
  "auditor",
];

/** Roles that can view restricted financial data (P&L, invoices, pricing, payroll totals, taxes) */
export const RESTRICTED_FINANCIAL_ROLES: AppRole[] = [
  "root_super_admin",
  "company_admin",
  "finance_manager",
  "auditor",
];

/** Roles that can view restricted HR employee personal data (salaries, compensation, bank details) */
export const RESTRICTED_HR_ROLES: AppRole[] = [
  "root_super_admin",
  "company_admin",
  "hr_manager",
  "auditor",
];

export interface TaggingRule {
  sourceTable: string;
  category: string;
  confidentialityLevel: ConfidentialityLevel;
  roleVisibility: AppRole[];
  description: string;
}

/**
 * Explicit matrix of confidentiality levels and role visibility by source table and category.
 */
export const CONFIDENTIALITY_RULES: TaggingRule[] = [
  // ─── PUBLIC TIER ──────────────────────────────────────────────────
  {
    sourceTable: "companies",
    category: "company_profile",
    confidentialityLevel: "public",
    roleVisibility: PUBLIC_ROLES,
    description: "Company legal name, industry, headquarters, active status",
  },
  {
    sourceTable: "plants",
    category: "plant_info",
    confidentialityLevel: "public",
    roleVisibility: PUBLIC_ROLES,
    description: "Plant locations, plant codes, addresses, cities, general overview",
  },
  {
    sourceTable: "departments",
    category: "department_list",
    confidentialityLevel: "public",
    roleVisibility: PUBLIC_ROLES,
    description: "Department names, codes, and general functions across plants",
  },
  {
    sourceTable: "products",
    category: "product_catalog",
    confidentialityLevel: "public",
    roleVisibility: PUBLIC_ROLES,
    description: "Product catalog, names, SKUs, descriptions, dimensions, finish specifications",
  },
  {
    sourceTable: "machines",
    category: "machine_catalog",
    confidentialityLevel: "public",
    roleVisibility: PUBLIC_ROLES,
    description: "Equipment list, machine names, model types, plant installation locations",
  },
  {
    sourceTable: "warehouses",
    category: "warehouse_list",
    confidentialityLevel: "public",
    roleVisibility: PUBLIC_ROLES,
    description: "Warehouse names, storage locations, plant assignments",
  },

  // ─── INTERNAL TIER ────────────────────────────────────────────────
  {
    sourceTable: "bom_items",
    category: "bom_structure",
    confidentialityLevel: "internal",
    roleVisibility: [
      "root_super_admin",
      "company_admin",
      "plant_admin",
      "plant_manager",
      "production_manager",
      "production_operator",
      "warehouse_manager",
      "procurement_manager",
      "quality_inspector",
      "auditor",
    ],
    description: "Bill of Materials raw material recipes, unit quantities, sub-assemblies",
  },
  {
    sourceTable: "inventory",
    category: "stock_levels",
    confidentialityLevel: "internal",
    roleVisibility: [
      "root_super_admin",
      "company_admin",
      "plant_admin",
      "plant_manager",
      "production_manager",
      "warehouse_manager",
      "procurement_manager",
      "quality_inspector",
      "auditor",
    ],
    description: "Inventory stock quantities on hand, reorder thresholds, warehouse bin locations",
  },
  {
    sourceTable: "work_orders",
    category: "production_operations",
    confidentialityLevel: "internal",
    roleVisibility: [
      "root_super_admin",
      "company_admin",
      "plant_admin",
      "plant_manager",
      "production_manager",
      "production_operator",
      "quality_inspector",
      "auditor",
    ],
    description: "Work orders, scheduled tasks, machine assignments, status (scheduled, in_progress, completed)",
  },
  {
    sourceTable: "quality_inspections",
    category: "quality_checks",
    confidentialityLevel: "internal",
    roleVisibility: [
      "root_super_admin",
      "company_admin",
      "plant_admin",
      "plant_manager",
      "production_manager",
      "quality_inspector",
      "warehouse_manager",
      "auditor",
    ],
    description: "Quality inspection logs, defect descriptions, pass/fail status, corrective actions",
  },
  {
    sourceTable: "maintenance_tickets",
    category: "maintenance_logs",
    confidentialityLevel: "internal",
    roleVisibility: [
      "root_super_admin",
      "company_admin",
      "plant_admin",
      "plant_manager",
      "production_manager",
      "maintenance_engineer",
      "auditor",
    ],
    description: "Machine maintenance logs, repair tickets, priority, technical notes",
  },
  {
    sourceTable: "sales_orders",
    category: "order_status",
    confidentialityLevel: "internal",
    roleVisibility: [
      "root_super_admin",
      "company_admin",
      "plant_admin",
      "plant_manager",
      "production_manager",
      "warehouse_manager",
      "finance_manager",
      "auditor",
      "customer_portal",
    ],
    description: "Customer sales order statuses, order milestones, shipment progress (non-financial)",
  },
  {
    sourceTable: "purchase_orders",
    category: "po_status",
    confidentialityLevel: "internal",
    roleVisibility: [
      "root_super_admin",
      "company_admin",
      "plant_admin",
      "plant_manager",
      "procurement_manager",
      "warehouse_manager",
      "finance_manager",
      "auditor",
      "supplier_portal",
    ],
    description: "Purchase order numbers, vendor delivery milestones, material line quantities",
  },

  // ─── RESTRICTED TIER ──────────────────────────────────────────────
  {
    sourceTable: "invoices",
    category: "financial_invoices",
    confidentialityLevel: "restricted",
    roleVisibility: RESTRICTED_FINANCIAL_ROLES,
    description: "Customer sales invoices, subtotal, tax amounts, total due, payment statuses",
  },
  {
    sourceTable: "payments",
    category: "financial_payments",
    confidentialityLevel: "restricted",
    roleVisibility: RESTRICTED_FINANCIAL_ROLES,
    description: "Customer payment transactions, receipts, payment modes, amounts credited",
  },
  {
    sourceTable: "supplier_invoices",
    category: "financial_supplier_bills",
    confidentialityLevel: "restricted",
    roleVisibility: RESTRICTED_FINANCIAL_ROLES,
    description: "Supplier incoming bills, pricing, GST, payment due dates, accounts payable",
  },
  {
    sourceTable: "supplier_payments",
    category: "financial_disbursements",
    confidentialityLevel: "restricted",
    roleVisibility: RESTRICTED_FINANCIAL_ROLES,
    description: "Disbursements and payments to suppliers, transaction IDs, bank references",
  },
  {
    sourceTable: "company_financials",
    category: "profit_loss",
    confidentialityLevel: "restricted",
    roleVisibility: RESTRICTED_FINANCIAL_ROLES,
    description: "Quarterly and monthly revenue totals, gross margin, net profit, EBITDA, tax obligations",
  },
  {
    sourceTable: "employees",
    category: "hr_compensation",
    confidentialityLevel: "restricted",
    roleVisibility: RESTRICTED_HR_ROLES,
    description: "Employee salaries, CTC, bonuses, bank account details, personal phone, emergency contacts",
  },
  {
    sourceTable: "leaves",
    category: "hr_leaves",
    confidentialityLevel: "restricted",
    roleVisibility: RESTRICTED_HR_ROLES,
    description: "Confidential employee leave reasons, medical certificates, leave history",
  },
  {
    sourceTable: "customers",
    category: "customer_confidential",
    confidentialityLevel: "restricted",
    roleVisibility: [
      "root_super_admin",
      "company_admin",
      "finance_manager",
      "auditor",
    ],
    description: "Customer GST number, commercial terms, billing address, bank account details",
  },
  {
    sourceTable: "suppliers",
    category: "supplier_confidential",
    confidentialityLevel: "restricted",
    roleVisibility: [
      "root_super_admin",
      "company_admin",
      "finance_manager",
      "procurement_manager",
      "auditor",
    ],
    description: "Supplier GST number, negotiated commercial terms, bank account details",
  },
];

/**
 * Returns the confidentiality level and permitted roles for a given table and category/field.
 */
export function getClassification(
  sourceTable: string,
  category: string,
  extraRoles: AppRole[] = []
): { confidentialityLevel: ConfidentialityLevel; roleVisibility: string[] } {
  const match = CONFIDENTIALITY_RULES.find(
    (r) => r.sourceTable === sourceTable && r.category === category
  );

  if (match) {
    const roles = Array.from(new Set([...match.roleVisibility, ...extraRoles]));
    return {
      confidentialityLevel: match.confidentialityLevel,
      roleVisibility: roles,
    };
  }

  // Safe fallback: if not explicitly classified, treat as internal restricted to company admin + auditor
  return {
    confidentialityLevel: "internal",
    roleVisibility: ["root_super_admin", "company_admin", "auditor", ...extraRoles],
  };
}
