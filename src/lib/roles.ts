import type { LucideIcon } from "lucide-react";
import {
  Crown, Building2, Factory, ClipboardList, Cog, Warehouse, ShoppingCart,
  ShieldCheck, Wrench, Landmark, Users, HardHat, UserRound, Truck, FileSearch,
} from "lucide-react";

export type AppRole =
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
  | "auditor";

export interface RoleMeta {
  id: AppRole;
  label: string;
  tagline: string;
  icon: LucideIcon;
  accent: string;
  ring: string;
  group: "platform" | "company" | "operations" | "external";
  demoEmail: string;
}

export const ROLES: RoleMeta[] = [
  { id: "root_super_admin", label: "Root Super Admin", tagline: "Platform owner", icon: Crown,
    accent: "from-amber-400 via-orange-500 to-rose-500", ring: "ring-amber-400/40",
    group: "platform", demoEmail: "root@factoryos.demo" },
  { id: "company_admin", label: "Company Admin", tagline: "Multi-plant tenant admin", icon: Building2,
    accent: "from-blue-500 via-indigo-500 to-violet-500", ring: "ring-blue-500/40",
    group: "company", demoEmail: "admin@abcmfg.demo" },
  { id: "plant_admin", label: "Plant Admin", tagline: "Owns a single plant", icon: Factory,
    accent: "from-cyan-500 via-sky-500 to-blue-600", ring: "ring-cyan-500/40",
    group: "company", demoEmail: "plantadmin@abcmfg.demo" },
  { id: "plant_manager", label: "Plant Manager", tagline: "Runs day-to-day plant ops", icon: ClipboardList,
    accent: "from-teal-500 to-emerald-500", ring: "ring-teal-500/40",
    group: "operations", demoEmail: "plantmanager@abcmfg.demo" },
  { id: "production_manager", label: "Production Manager", tagline: "Schedules & work orders", icon: Cog,
    accent: "from-violet-500 to-fuchsia-500", ring: "ring-violet-500/40",
    group: "operations", demoEmail: "production@abcmfg.demo" },
  { id: "warehouse_manager", label: "Warehouse Manager", tagline: "Inventory & logistics", icon: Warehouse,
    accent: "from-emerald-500 to-teal-500", ring: "ring-emerald-500/40",
    group: "operations", demoEmail: "warehouse@abcmfg.demo" },
  { id: "procurement_manager", label: "Procurement Manager", tagline: "POs, RFQs, suppliers", icon: ShoppingCart,
    accent: "from-orange-500 to-amber-500", ring: "ring-orange-500/40",
    group: "operations", demoEmail: "procurement@abcmfg.demo" },
  { id: "quality_inspector", label: "Quality Inspector", tagline: "QC, NCR & CAPA", icon: ShieldCheck,
    accent: "from-rose-500 to-pink-500", ring: "ring-rose-500/40",
    group: "operations", demoEmail: "quality@abcmfg.demo" },
  { id: "maintenance_engineer", label: "Maintenance Engineer", tagline: "Uptime & repairs", icon: Wrench,
    accent: "from-yellow-500 to-orange-500", ring: "ring-yellow-500/40",
    group: "operations", demoEmail: "maintenance@abcmfg.demo" },
  { id: "finance_manager", label: "Finance Manager", tagline: "GL, AP/AR & budgets", icon: Landmark,
    accent: "from-green-500 to-lime-500", ring: "ring-green-500/40",
    group: "operations", demoEmail: "finance@abcmfg.demo" },
  { id: "hr_manager", label: "HR Manager", tagline: "People, payroll & leave", icon: Users,
    accent: "from-pink-500 to-rose-500", ring: "ring-pink-500/40",
    group: "operations", demoEmail: "hr@abcmfg.demo" },
  { id: "production_operator", label: "Production Operator", tagline: "Shop-floor execution", icon: HardHat,
    accent: "from-slate-500 to-slate-700", ring: "ring-slate-500/40",
    group: "operations", demoEmail: "operator@abcmfg.demo" },
  { id: "customer_portal", label: "Customer Portal", tagline: "Orders & shipments", icon: UserRound,
    accent: "from-indigo-500 to-purple-500", ring: "ring-indigo-500/40",
    group: "external", demoEmail: "customer@abcmfg.demo" },
  { id: "supplier_portal", label: "Supplier Portal", tagline: "Deliveries & invoices", icon: Truck,
    accent: "from-sky-500 to-blue-500", ring: "ring-sky-500/40",
    group: "external", demoEmail: "supplier@abcmfg.demo" },
  { id: "auditor", label: "Auditor", tagline: "Read-only compliance", icon: FileSearch,
    accent: "from-zinc-400 to-zinc-600", ring: "ring-zinc-400/40",
    group: "external", demoEmail: "auditor@abcmfg.demo" },
];

export const ROLE_MAP = Object.fromEntries(ROLES.map(r => [r.id, r])) as Record<AppRole, RoleMeta>;
export const DEMO_PASSWORD = "Factory2026!";
