import type { AppRole } from "@/lib/roles";

const ROLE_PRIORITY: AppRole[] = [
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
  "auditor",
  "customer_portal",
  "supplier_portal",
];

export function primaryRole(roles: AppRole[]): AppRole | null {
  for (const r of ROLE_PRIORITY) if (roles.includes(r)) return r;
  return roles[0] ?? null;
}

export function homeForRole(role: AppRole | null): string {
  if (!role) return "/auth";
  if (role === "root_super_admin") return "/platform";
  return "/dashboard";
}

const ALL_COMPANY: AppRole[] = ROLE_PRIORITY.filter((r) => r !== "root_super_admin");

const NON_EXTERNAL: AppRole[] = ALL_COMPANY.filter(
  (r) => r !== "customer_portal" && r !== "supplier_portal" && r !== "auditor",
);

const ONLY: (...rs: AppRole[]) => AppRole[] = (...rs) => rs;

export const ROUTE_ACCESS: Record<string, AppRole[]> = {
  "/platform": ONLY("root_super_admin"),

  "/company": ONLY("company_admin"),
  "/plants": ONLY("company_admin", "plant_admin"),
  "/departments": ONLY("company_admin", "plant_admin"),
  "/roles": ONLY("company_admin"),
  "/whitelist": ONLY("company_admin"),
  "/knowledge": ALL_COMPANY,
  "/notifications": ALL_COMPANY,
  "/analytics": ONLY("company_admin", "plant_admin", "plant_manager", "finance_manager"),
  // Profile is available to EVERY role. Root lands on /platform/profile for
  // their own profile but uses /settings to review Company Admin requests.
  // Each role sees only its own self-editable vs approval-gated fields.
  "/settings": [...ALL_COMPANY, "customer_portal", "supplier_portal", "root_super_admin"],

  // NEW: Materials (Company Admin + Production Manager read; Auditor read-only)
  "/materials": ONLY("company_admin", "production_manager", "auditor"),
  "/customer-requests": ONLY("company_admin"),
  "/approved-orders": ONLY("production_manager", "company_admin"),

  "/dashboard": ALL_COMPANY,

  "/employees": ONLY("company_admin", "plant_admin", "hr_manager", "auditor"),
  "/attendance": ONLY(
    "company_admin",
    "hr_manager",
    "plant_manager",
    "auditor",
    "production_operator",
  ),
  "/leaves": ONLY("company_admin", "hr_manager", "auditor"),
  "/recruitment": ONLY("company_admin", "hr_manager", "auditor"),
  "/training": ONLY("company_admin", "hr_manager", "auditor"),
  "/performance": ONLY("company_admin", "hr_manager", "auditor"),
  "/hr-reports": ONLY("company_admin", "hr_manager", "auditor"),
  "/payroll": ONLY("company_admin", "hr_manager", "finance_manager", "auditor"),
  "/team": ONLY("company_admin", "plant_admin", "hr_manager", "auditor"),

  "/production": ONLY(
    "company_admin",
    "plant_admin",
    "plant_manager",
    "production_manager",
    "production_operator",
    "auditor",
  ),
  "/production-planning": ONLY(
    "company_admin",
    "plant_admin",
    "plant_manager",
    "production_manager",
    "auditor",
  ),
  "/scheduling": ONLY("company_admin", "plant_manager", "production_manager"),
  "/capacity-planning": ONLY("company_admin", "plant_manager", "production_manager"),
  "/production-reports": ONLY(
    "company_admin",
    "plant_admin",
    "plant_manager",
    "production_manager",
  ),
  "/work-orders": ONLY("company_admin", "plant_manager", "production_manager", "auditor"),
  "/bom": ONLY("company_admin", "production_manager", "auditor"),
  "/assigned-work-orders": ONLY("production_operator", "company_admin"),
  "/assigned-machines": ONLY("production_operator", "company_admin"),
  "/tasks": ONLY("production_operator", "company_admin"),
  "/production-logs": ONLY("production_operator", "company_admin", "production_manager", "auditor"),
  "/issue-reporting": ONLY("production_operator", "company_admin", "maintenance_engineer"),

  "/inventory": ONLY(
    "company_admin",
    "plant_admin",
    "plant_manager",
    "warehouse_manager",
    "production_manager",
    "auditor",
  ),
  "/warehouse": ONLY(
    "company_admin",
    "plant_admin",
    "plant_manager",
    "warehouse_manager",
    "auditor",
  ),
  "/stock-movement": ONLY("company_admin", "warehouse_manager", "auditor"),
  "/transfers": ONLY("company_admin", "warehouse_manager", "auditor"),
  "/receiving": ONLY("company_admin", "warehouse_manager", "auditor"),
  "/dispatch": ONLY("company_admin", "warehouse_manager", "auditor"),
  "/cycle-count": ONLY("company_admin", "warehouse_manager", "auditor"),
  "/products": ONLY(
    "company_admin",
    "plant_admin",
    "production_manager",
    "warehouse_manager",
    "auditor",
  ),

  "/procurement": ONLY("company_admin", "procurement_manager", "auditor"),
  "/suppliers": ONLY("company_admin", "procurement_manager", "plant_admin", "auditor"),
  "/purchase-requests": ONLY("company_admin", "procurement_manager", "auditor"),
  "/rfq": ONLY("company_admin", "procurement_manager", "auditor"),
  "/vendor-comparison": ONLY("company_admin", "procurement_manager", "auditor"),
  "/goods-receipt": ONLY("company_admin", "procurement_manager", "warehouse_manager", "auditor"),

  "/quality": ONLY("company_admin", "plant_admin", "plant_manager", "quality_inspector", "auditor"),
  "/incoming-inspection": ONLY("company_admin", "quality_inspector", "auditor"),
  "/in-process-inspection": ONLY("company_admin", "quality_inspector", "auditor"),
  "/final-inspection": ONLY("company_admin", "quality_inspector", "auditor"),
  "/defects": ONLY("company_admin", "quality_inspector", "auditor"),
  "/capa": ONLY("company_admin", "quality_inspector", "auditor"),
  "/quality-reports": ONLY("company_admin", "quality_inspector", "plant_manager", "auditor"),

  "/machines": ONLY(
    "company_admin",
    "plant_admin",
    "plant_manager",
    "maintenance_engineer",
    "production_manager",
    "auditor",
  ),
  "/maintenance": ONLY(
    "company_admin",
    "plant_admin",
    "plant_manager",
    "maintenance_engineer",
    "auditor",
  ),
  "/schedules": ONLY("company_admin", "maintenance_engineer", "auditor"),
  "/machine-history": ONLY("company_admin", "maintenance_engineer", "plant_manager", "auditor"),
  "/breakdowns": ONLY("company_admin", "maintenance_engineer", "auditor"),
  "/spare-parts": ONLY("company_admin", "maintenance_engineer", "warehouse_manager", "auditor"),
  "/maintenance-reports": ONLY("company_admin", "maintenance_engineer", "auditor"),

  "/finance": ONLY("company_admin", "finance_manager", "auditor"),
  "/invoices": ONLY("company_admin", "finance_manager", "auditor"),
  "/expenses": ONLY("company_admin", "finance_manager", "auditor"),
  "/taxes": ONLY("company_admin", "finance_manager", "auditor"),
  "/budgets": ONLY("company_admin", "finance_manager", "auditor"),
  "/profit-loss": ONLY("company_admin", "finance_manager", "auditor"),
  "/finance-reports": ONLY("company_admin", "finance_manager", "auditor"),

  "/customers": ONLY("company_admin", "plant_admin", "auditor"),
  "/crm": ONLY("company_admin"),

  "/orders": ONLY("customer_portal", "company_admin", "auditor"),
  "/customer-invoices": ONLY("customer_portal", "company_admin", "auditor"),
  "/shipments": ONLY("customer_portal", "company_admin", "auditor"),
  "/support": ONLY("customer_portal", "company_admin", "auditor"),
  "/documents": ONLY("customer_portal", "supplier_portal", "auditor", "company_admin"),

  "/supplier-pos": ONLY("supplier_portal", "company_admin", "auditor"),
  "/deliveries": ONLY("supplier_portal", "company_admin", "auditor"),
  "/supplier-invoices": ONLY("supplier_portal", "company_admin", "auditor"),
  "/payments": ONLY("supplier_portal", "company_admin", "finance_manager", "auditor"),
  "/supplier-performance": ONLY(
    "supplier_portal",
    "company_admin",
    "procurement_manager",
    "auditor",
  ),
  "/messages": ONLY("supplier_portal", "procurement_manager", "company_admin", "auditor"),

  "/qr-codes": ONLY(
    "company_admin",
    "plant_admin",
    "production_manager",
    "warehouse_manager",
    "finance_manager",
    "auditor",
  ),

  "/audit": NON_EXTERNAL.concat(["auditor"]),
  "/compliance": ONLY("auditor", "company_admin"),
  "/access-logs": ONLY("auditor", "company_admin"),
  "/export": ONLY("auditor", "company_admin"),

  // Reports: every company role plus the two external portals (customer +
  // supplier get personal-scope reports). Auditor's reports live in their own
  // Compliance/Audit/Export tabs.
  "/reports": ONLY(
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
  ),
  "/ai-center": NON_EXTERNAL,

  "/plant-overview": ONLY("plant_admin", "company_admin"),
  "/plant-performance": ONLY("plant_manager", "plant_admin", "company_admin"),
};

export function canAccess(pathname: string, roles: AppRole[]): boolean {
  if (!roles.length) return false;
  if (roles.includes("root_super_admin")) {
    // Root super admin can access /platform/* AND /notifications
    if (pathname === "/notifications" || pathname.startsWith("/notifications/")) return true;
    return pathname.startsWith("/platform");
  }
  let matched: AppRole[] | null = null;
  let matchedLen = -1;
  for (const [prefix, allowed] of Object.entries(ROUTE_ACCESS)) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      if (prefix.length > matchedLen) {
        matched = allowed;
        matchedLen = prefix.length;
      }
    }
  }
  if (!matched) return true;
  return matched.some((r) => roles.includes(r));
}
