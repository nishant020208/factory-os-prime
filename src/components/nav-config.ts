import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Boxes,
  Package,
  Warehouse,
  Cog,
  Factory,
  ClipboardList,
  Wrench,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
  BrainCircuit,
  Settings,
  ScrollText,
  Landmark,
  UserRound,
  FileCheck2,
  Building2,
  TreePine,
  Layers3,
  Calendar,
  Gauge,
  ArrowLeftRight,
  PackageCheck,
  PackageOpen,
  ClipboardCheck,
  FileSearch,
  HeartPulse,
  Timer,
  Receipt,
  DollarSign,
  Wallet,
  PiggyBank,
  UserPlus,
  GraduationCap,
  BadgeCheck,
  ListTodo,
  MessageSquare,
  FileText,
  Truck as TruckIcon,
  CreditCard,
  Star,
  Shield,
  LineChart,
  BookOpen,
  User,
  AlertOctagon,
  ClipboardX,
  Route as RouteIcon,
  Send,
  Files,
  Database,
  ClipboardPen,
  UserCheck,
  Bell,
  QrCode,
} from "lucide-react";
import type { AppRole } from "@/lib/roles";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  bold?: boolean;
}
export interface NavSection {
  label: string;
  items: NavItem[];
}

const commonSettings: NavItem[] = [{ to: "/settings", label: "Settings", icon: Settings }];

export const NAV_BY_ROLE: Record<AppRole, NavSection[]> = {
  root_super_admin: [
    {
      label: "Platform",
      items: [
        { to: "/platform", label: "Dashboard", icon: LayoutDashboard },
        { to: "/notifications", label: "Notifications", icon: Bell, badge: "!" },
        { to: "/platform/whitelist", label: "Admin Whitelist", icon: FileCheck2 },
        { to: "/platform/pending", label: "Pending Requests", icon: Timer, badge: "!" },
        { to: "/platform/companies", label: "Approved Companies", icon: Building2 },
        { to: "/platform/suspended", label: "Suspended", icon: ClipboardX },
      ],
    },
    {
      label: "System",
      items: [
        { to: "/platform/audit", label: "Audit Logs", icon: ScrollText },
        { to: "/platform/settings", label: "Platform Settings", icon: Settings },
        { to: "/platform/profile", label: "Profile", icon: User },
      ],
    },
  ],

  company_admin: [
    {
      label: "Overview",
      items: [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { to: "/notifications", label: "Notifications", icon: Bell, badge: "!" },
        { to: "/company", label: "My Company", icon: Building2, badge: "New" },
        { to: "/plants", label: "Plants", icon: Factory },
        { to: "/departments", label: "Departments", icon: TreePine },
        { to: "/orders", label: "Order Approvals", icon: ShoppingCart, badge: "!" },
      ],
    },
    {
      label: "Customers",
      items: [
        {
          to: "/customer-requests",
          label: "Customer Requests",
          icon: UserPlus,
          badge: "!",
          bold: true,
        },
        { to: "/customers", label: "Customers", icon: UserRound },
        { to: "/materials", label: "Materials", icon: Database },
      ],
    },
    {
      label: "People",
      items: [
        { to: "/employees", label: "Employees", icon: Users },
        { to: "/roles", label: "Roles", icon: Shield },
        { to: "/whitelist", label: "Whitelist", icon: FileCheck2 },
      ],
    },
    {
      label: "Operations",
      items: [
        { to: "/inventory", label: "Inventory", icon: Boxes },
        { to: "/warehouse", label: "Warehouse", icon: Warehouse },
        { to: "/production", label: "Production", icon: Factory, badge: "AI" },
        { to: "/products", label: "Products", icon: Package },
        { to: "/bom", label: "BOM", icon: Layers3 },
        { to: "/machines", label: "Machines", icon: Cog },
        { to: "/maintenance", label: "Maintenance", icon: Wrench },
        { to: "/quality", label: "Quality", icon: ShieldCheck },
        { to: "/qr-codes", label: "QR Codes", icon: QrCode },
      ],
    },
    {
      label: "Commerce",
      items: [
        { to: "/procurement", label: "Procurement", icon: ShoppingCart },
        { to: "/suppliers", label: "Suppliers", icon: Truck },
        { to: "/crm", label: "CRM", icon: HeartPulse },
        { to: "/finance", label: "Finance", icon: Landmark },
        { to: "/hr-reports", label: "HR", icon: Users },
      ],
    },
    {
      label: "Intelligence",
      items: [
        { to: "/reports", label: "Reports", icon: ClipboardList },
        { to: "/analytics", label: "Analytics", icon: LineChart },
        { to: "/ai-center", label: "AI Center", icon: BrainCircuit, badge: "New" },
        { to: "/knowledge", label: "Knowledge Center", icon: BookOpen },
      ],
    },
    { label: "System", items: commonSettings },
  ],

  plant_admin: [
    {
      label: "Plant",
      items: [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { to: "/notifications", label: "Notifications", icon: Bell, badge: "!" },
        { to: "/plant-overview", label: "Plant Overview", icon: Factory },
        { to: "/departments", label: "Departments", icon: TreePine },
        { to: "/employees", label: "Employees", icon: Users },
      ],
    },
    {
      label: "Operations",
      items: [
        { to: "/production", label: "Production", icon: Factory },
        { to: "/warehouse", label: "Warehouse", icon: Warehouse },
        { to: "/machines", label: "Machines", icon: Cog },
        { to: "/quality", label: "Quality", icon: ShieldCheck },
        { to: "/maintenance", label: "Maintenance", icon: Wrench },
      ],
    },
    { label: "Reports", items: [{ to: "/reports", label: "Reports", icon: ClipboardList }] },
  ],

  plant_manager: [
    {
      label: "Plant",
      items: [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { to: "/notifications", label: "Notifications", icon: Bell, badge: "!" },
        { to: "/plant-performance", label: "Plant Performance", icon: Gauge },
      ],
    },
    {
      label: "Operations",
      items: [
        { to: "/production", label: "Production", icon: Factory },
        { to: "/machines", label: "Machines", icon: Cog },
        { to: "/warehouse", label: "Warehouse", icon: Warehouse },
        { to: "/maintenance", label: "Maintenance", icon: Wrench },
        { to: "/quality", label: "Quality", icon: ShieldCheck },
      ],
    },
    { label: "Reports", items: [{ to: "/reports", label: "Reports", icon: ClipboardList }] },
  ],

  production_manager: [
    {
      label: "Planning",
      items: [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { to: "/notifications", label: "Notifications", icon: Bell, badge: "!" },
        { to: "/approved-orders", label: "Approved Orders", icon: ClipboardPen, badge: "!" },
        { to: "/production-planning", label: "Production Planning", icon: Calendar },
        { to: "/production", label: "Production Orders", icon: Factory },
        { to: "/work-orders", label: "Work Orders", icon: ListTodo },
        { to: "/bom", label: "BOM", icon: Layers3 },
        { to: "/scheduling", label: "Scheduling", icon: Calendar },
        { to: "/capacity-planning", label: "Capacity Planning", icon: Gauge },
        { to: "/qr-codes", label: "QR Codes", icon: QrCode },
      ],
    },
    {
      label: "Reports",
      items: [{ to: "/production-reports", label: "Production Reports", icon: ClipboardList }],
    },
  ],

  warehouse_manager: [
    {
      label: "Warehouse",
      items: [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { to: "/notifications", label: "Notifications", icon: Bell, badge: "!" },
        { to: "/inventory", label: "Inventory", icon: Boxes },
        { to: "/warehouse", label: "Warehouses", icon: Warehouse },
        { to: "/stock-movement", label: "Stock Movement", icon: ArrowLeftRight },
        { to: "/transfers", label: "Transfers", icon: ArrowLeftRight },
        { to: "/receiving", label: "Receiving", icon: PackageOpen },
        { to: "/dispatch", label: "Dispatch", icon: Send },
        { to: "/cycle-count", label: "Cycle Count", icon: PackageCheck },
        { to: "/qr-codes", label: "QR Codes", icon: QrCode },
      ],
    },
    { label: "Reports", items: [{ to: "/reports", label: "Reports", icon: ClipboardList }] },
  ],

  procurement_manager: [
    {
      label: "Procurement",
      items: [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { to: "/notifications", label: "Notifications", icon: Bell, badge: "!" },
        { to: "/suppliers", label: "Suppliers", icon: Truck },
        { to: "/purchase-requests", label: "Purchase Requests", icon: FileText },
        { to: "/procurement", label: "Purchase Orders", icon: ShoppingCart },
        { to: "/rfq", label: "RFQ", icon: FileSearch },
        { to: "/vendor-comparison", label: "Vendor Comparison", icon: LineChart },
        { to: "/goods-receipt", label: "Goods Receipt", icon: PackageOpen },
      ],
    },
    { label: "Reports", items: [{ to: "/reports", label: "Reports", icon: ClipboardList }] },
  ],

  quality_inspector: [
    {
      label: "Quality",
      items: [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { to: "/notifications", label: "Notifications", icon: Bell, badge: "!" },
        { to: "/incoming-inspection", label: "Incoming Inspection", icon: PackageOpen },
        { to: "/in-process-inspection", label: "In-Process Inspection", icon: ClipboardCheck },
        { to: "/final-inspection", label: "Final Inspection", icon: BadgeCheck },
        { to: "/defects", label: "Defects", icon: AlertOctagon },
        { to: "/capa", label: "CAPA", icon: ShieldCheck },
      ],
    },
    {
      label: "Reports",
      items: [{ to: "/quality-reports", label: "Quality Reports", icon: ClipboardList }],
    },
  ],

  maintenance_engineer: [
    {
      label: "Maintenance",
      items: [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { to: "/notifications", label: "Notifications", icon: Bell, badge: "!" },
        { to: "/machines", label: "Machines", icon: Cog },
        { to: "/maintenance", label: "Maintenance", icon: Wrench },
        { to: "/schedules", label: "Schedules", icon: Calendar },
        { to: "/machine-history", label: "Machine History", icon: ScrollText },
        { to: "/breakdowns", label: "Breakdowns", icon: AlertOctagon },
        { to: "/spare-parts", label: "Spare Parts", icon: Boxes },
      ],
    },
    {
      label: "Reports",
      items: [{ to: "/maintenance-reports", label: "Reports", icon: ClipboardList }],
    },
  ],

  finance_manager: [
    {
      label: "Finance",
      items: [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { to: "/notifications", label: "Notifications", icon: Bell, badge: "!" },
        { to: "/invoices", label: "Invoices", icon: Receipt },
        { to: "/expenses", label: "Expenses", icon: DollarSign },
        { to: "/payroll", label: "Payroll", icon: Wallet },
        { to: "/taxes", label: "Taxes", icon: FileText },
        { to: "/budgets", label: "Budgets", icon: PiggyBank },
        { to: "/profit-loss", label: "Profit & Loss", icon: LineChart },
        { to: "/qr-codes", label: "QR Codes", icon: QrCode },
      ],
    },
    {
      label: "Reports",
      items: [{ to: "/finance-reports", label: "Reports", icon: ClipboardList }],
    },
  ],

  hr_manager: [
    {
      label: "People",
      items: [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { to: "/notifications", label: "Notifications", icon: Bell, badge: "!" },
        { to: "/employees", label: "Employees", icon: Users },
        { to: "/attendance", label: "Attendance", icon: Timer },
        { to: "/leaves", label: "Leaves", icon: Calendar },
        { to: "/recruitment", label: "Recruitment", icon: UserPlus },
        { to: "/training", label: "Training", icon: GraduationCap },
        { to: "/performance", label: "Performance", icon: Star },
        { to: "/payroll", label: "Payroll", icon: Wallet },
      ],
    },
    { label: "Reports", items: [{ to: "/hr-reports", label: "Reports", icon: ClipboardList }] },
  ],

  production_operator: [
    {
      label: "My Shift",
      items: [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { to: "/notifications", label: "Notifications", icon: Bell, badge: "!" },
        { to: "/assigned-work-orders", label: "Work Orders", icon: ListTodo },
        { to: "/assigned-machines", label: "My Machines", icon: Cog },
        { to: "/tasks", label: "Tasks", icon: ClipboardCheck },
        { to: "/production-logs", label: "Production Logs", icon: ScrollText },
        { to: "/issue-reporting", label: "Report Issue", icon: AlertOctagon },
      ],
    },
  ],

  customer_portal: [
    {
      label: "My Account",
      items: [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { to: "/notifications", label: "Notifications", icon: Bell, badge: "!" },
        { to: "/orders", label: "Orders", icon: ShoppingCart },
        { to: "/customer-invoices", label: "Invoices", icon: Receipt },
        { to: "/shipments", label: "Shipments", icon: TruckIcon },
        { to: "/support", label: "Support", icon: MessageSquare },
        { to: "/documents", label: "Documents", icon: Files },
        { to: "/settings", label: "Settings", icon: Settings },
      ],
    },
  ],

  supplier_portal: [
    {
      label: "My Account",
      items: [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { to: "/notifications", label: "Notifications", icon: Bell, badge: "!" },
        { to: "/supplier-pos", label: "Purchase Orders", icon: ShoppingCart },
        { to: "/deliveries", label: "Deliveries", icon: TruckIcon },
        { to: "/supplier-invoices", label: "Invoices", icon: Receipt },
        { to: "/payments", label: "Payments", icon: CreditCard },
        { to: "/supplier-performance", label: "Performance", icon: Star },
        { to: "/settings", label: "Settings", icon: Settings },
      ],
    },
  ],

  auditor: [
    {
      label: "Audit",
      items: [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        // Auditor receives zero notifications by design — no badge.
        { to: "/notifications", label: "Notifications", icon: Bell },
        { to: "/audit", label: "Audit Logs", icon: ScrollText },
        { to: "/compliance", label: "Compliance Reports", icon: Shield },
        { to: "/access-logs", label: "Access Logs", icon: Timer },
        { to: "/export", label: "Data Export", icon: Database },
        { to: "/documents", label: "Documents", icon: Files },
        { to: "/settings", label: "Settings", icon: Settings },
      ],
    },
  ],
};

export const NAV_SECTIONS: NavSection[] = NAV_BY_ROLE.company_admin;

export function navForRole(role: AppRole | null): NavSection[] {
  if (!role) return [];
  return NAV_BY_ROLE[role] ?? NAV_BY_ROLE.company_admin;
}
