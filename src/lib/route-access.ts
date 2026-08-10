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
  "/settings": ONLY(
    "company_admin",
    "plant_admin",
    "customer_portal",
    "supplier_portal",
    "auditor",
  ),

  // NEW: Materials (Company Admin + Production Manager read)
  "/materials": ONLY("company_admin", "production_manager"),
  "/customer-requests": ONLY("company_admin"),
  "/approved-orders": ONLY("production_manager", "company_admin"),

  "/dashboard": ALL_COMPANY,

  "/employees": ONLY("company_admin", "plant_admin", "hr_manager"),
  "/attendance": ONLY("company_admin", "hr_manager", "plant_manager"),
  "/leaves": ONLY("company_admin", "hr_manager"),
  "/recruitment": ONLY("company_admin", "hr_manager"),
  "/training": ONLY("company_admin", "hr_manager"),
  "/performance": ONLY("company_admin", "hr_manager"),
  "/hr-reports": ONLY("company_admin", "hr_manager"),
  "/payroll": ONLY("company_admin", "hr_manager", "finance_manager"),
  "/team": ONLY("company_admin", "plant_admin", "hr_manager"),

  "/production": ONLY(
    "company_admin",
    "plant_admin",
    "plant_manager",
    "production_manager",
    "production_operator",
  ),
  "/production-planning": ONLY(
    "company_admin",
    "plant_admin",
    "plant_manager",
    "production_manager",
  ),
  "/scheduling": ONLY("company_admin", "plant_manager", "production_manager"),
  "/capacity-planning": ONLY("company_admin", "plant_manager", "production_manager"),
  "/production-reports": ONLY(
    "company_admin",
    "plant_admin",
    "plant_manager",
    "production_manager",
  ),
  "/work-orders": ONLY("company_admin", "plant_manager", "production_manager"),
  "/bom": ONLY("company_admin", "production_manager"),
  "/assigned-work-orders": ONLY("production_operator", "company_admin"),
  "/assigned-machines": ONLY("production_operator", "company_admin"),
  "/tasks": ONLY("production_operator", "company_admin"),
  "/production-logs": ONLY("production_operator", "company_admin", "production_manager"),
  "/issue-reporting": ONLY("production_operator", "company_admin", "maintenance_engineer"),

  "/inventory": ONLY(
    "company_admin",
    "plant_admin",
    "plant_manager",
    "warehouse_manager",
    "production_manager",
  ),
  "/warehouse": ONLY("company_admin", "plant_admin", "plant_manager", "warehouse_manager"),
  "/stock-movement": ONLY("company_admin", "warehouse_manager"),
  "/transfers": ONLY("company_admin", "warehouse_manager"),
  "/receiving": ONLY("company_admin", "warehouse_manager"),
  "/dispatch": ONLY("company_admin", "warehouse_manager"),
  "/cycle-count": ONLY("company_admin", "warehouse_manager"),
  "/products": ONLY("company_admin", "plant_admin", "production_manager", "warehouse_manager"),

  "/procurement": ONLY("company_admin", "procurement_manager"),
  "/suppliers": ONLY("company_admin", "procurement_manager", "plant_admin"),
  "/purchase-requests": ONLY("company_admin", "procurement_manager"),
  "/rfq": ONLY("company_admin", "procurement_manager"),
  "/vendor-comparison": ONLY("company_admin", "procurement_manager"),
  "/goods-receipt": ONLY("company_admin", "procurement_manager", "warehouse_manager"),

  "/quality": ONLY("company_admin", "plant_admin", "plant_manager", "quality_inspector"),
  "/incoming-inspection": ONLY("company_admin", "quality_inspector"),
  "/in-process-inspection": ONLY("company_admin", "quality_inspector"),
  "/final-inspection": ONLY("company_admin", "quality_inspector"),
  "/defects": ONLY("company_admin", "quality_inspector"),
  "/capa": ONLY("company_admin", "quality_inspector"),
  "/quality-reports": ONLY("company_admin", "quality_inspector", "plant_manager"),

  "/machines": ONLY(
    "company_admin",
    "plant_admin",
    "plant_manager",
    "maintenance_engineer",
    "production_manager",
  ),
  "/maintenance": ONLY("company_admin", "plant_admin", "plant_manager", "maintenance_engineer"),
  "/schedules": ONLY("company_admin", "maintenance_engineer"),
  "/machine-history": ONLY("company_admin", "maintenance_engineer", "plant_manager"),
  "/breakdowns": ONLY("company_admin", "maintenance_engineer"),
  "/spare-parts": ONLY("company_admin", "maintenance_engineer", "warehouse_manager"),
  "/maintenance-reports": ONLY("company_admin", "maintenance_engineer"),

  "/finance": ONLY("company_admin", "finance_manager"),
  "/invoices": ONLY("company_admin", "finance_manager"),
  "/expenses": ONLY("company_admin", "finance_manager"),
  "/taxes": ONLY("company_admin", "finance_manager"),
  "/budgets": ONLY("company_admin", "finance_manager"),
  "/profit-loss": ONLY("company_admin", "finance_manager"),
  "/finance-reports": ONLY("company_admin", "finance_manager"),

  "/customers": ONLY("company_admin", "plant_admin"),
  "/crm": ONLY("company_admin"),

  "/orders": ONLY("customer_portal", "company_admin"),
  "/customer-invoices": ONLY("customer_portal", "company_admin"),
  "/shipments": ONLY("customer_portal", "company_admin"),
  "/support": ONLY("customer_portal", "company_admin"),
  "/documents": ONLY("customer_portal", "supplier_portal", "auditor", "company_admin"),

  "/supplier-pos": ONLY("supplier_portal", "company_admin"),
  "/deliveries": ONLY("supplier_portal", "company_admin"),
  "/supplier-invoices": ONLY("supplier_portal", "company_admin"),
  "/payments": ONLY("supplier_portal", "company_admin", "finance_manager"),
  "/supplier-performance": ONLY("supplier_portal", "company_admin", "procurement_manager"),

  "/audit": NON_EXTERNAL.concat(["auditor"]),
  "/compliance": ONLY("auditor", "company_admin"),

  "/reports": NON_EXTERNAL,
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
