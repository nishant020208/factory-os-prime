import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Boxes, Package, Warehouse, Cog, Factory, ClipboardList,
  Wrench, ShieldCheck, ShoppingCart, Truck, Users, BrainCircuit, Settings,
  ScrollText, Landmark, UserRound, FileCheck2,
} from "lucide-react";

export interface NavItem { to: string; label: string; icon: LucideIcon; badge?: string }
export interface NavSection { label: string; items: NavItem[] }

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Operations",
    items: [
      { to: "/dashboard",   label: "Dashboard",         icon: LayoutDashboard },
      { to: "/production",  label: "Production Orders", icon: Factory, badge: "AI" },
      { to: "/machines",    label: "Machines",          icon: Cog },
      { to: "/quality",     label: "Quality",           icon: ShieldCheck },
      { to: "/maintenance", label: "Maintenance",       icon: Wrench },
    ],
  },
  {
    label: "Supply Chain",
    items: [
      { to: "/inventory",   label: "Inventory",     icon: Boxes },
      { to: "/warehouse",   label: "Warehouses",    icon: Warehouse },
      { to: "/products",    label: "Products",      icon: Package },
      { to: "/procurement", label: "Procurement",   icon: ShoppingCart },
      { to: "/suppliers",   label: "Suppliers",     icon: Truck },
      { to: "/customers",   label: "Customers",     icon: UserRound },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { to: "/ai-center",   label: "AI Center",     icon: BrainCircuit, badge: "New" },
      { to: "/reports",     label: "Reports",       icon: ClipboardList },
      { to: "/finance",     label: "Finance",       icon: Landmark },
    ],
  },
  {
    label: "Administration",
    items: [
      { to: "/whitelist",   label: "Whitelist",     icon: FileCheck2 },
      { to: "/audit",       label: "Audit Logs",    icon: ScrollText },
      { to: "/team",        label: "Team",          icon: Users },
      { to: "/settings",    label: "Settings",      icon: Settings },
    ],
  },
];
