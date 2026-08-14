import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { primaryRole } from "@/lib/route-access";
import { ROLE_MAP, type AppRole } from "@/lib/roles";
import { PageHeader, Panel, StatusBadge, EmptyState } from "@/components/ui-parts";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { Button } from "@/components/ui/button";
import { Download, FileText, Table2, ScrollText, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  downloadCsv,
  downloadPdf,
  money,
  num,
  pct,
  fmtDate,
  countBy,
  sumBy,
  avgBy,
  type Column,
} from "@/lib/report-utils";

/* ------------------------------------------------------------------ */
/* Data plumbing                                                       */
/* ------------------------------------------------------------------ */

type Row = Record<string, any>;

async function fetchAll(table: string): Promise<Row[]> {
  const { data, error } = await supabase.from(table as never).select("*");
  if (error) throw error;
  return (data ?? []) as Row[];
}

interface Lookups {
  products: Map<string, Row>;
  materials: Map<string, Row>;
  warehouses: Map<string, Row>;
  customers: Map<string, Row>;
  suppliers: Map<string, Row>;
  employees: Map<string, Row>;
  departments: Map<string, Row>;
  profiles: Map<string, Row>;
  invoices: Map<string, Row>;
  purchaseOrders: Map<string, Row>;
}

async function fetchLookups(): Promise<Lookups> {
  const [p, m, w, c, s, e, d, pf, i, po] = await Promise.all([
    fetchAll("products"),
    fetchAll("materials"),
    fetchAll("warehouses"),
    fetchAll("customers"),
    fetchAll("suppliers"),
    fetchAll("employees"),
    fetchAll("departments"),
    fetchAll("profiles"),
    fetchAll("invoices"),
    fetchAll("purchase_orders"),
  ]);
  const toMap = (rows: Row[]) => new Map(rows.map((r) => [r.id, r]));
  return {
    products: toMap(p),
    materials: toMap(m),
    warehouses: toMap(w),
    customers: toMap(c),
    suppliers: toMap(s),
    employees: toMap(e),
    departments: toMap(d),
    profiles: toMap(pf),
    invoices: toMap(i),
    purchaseOrders: toMap(po),
  };
}

interface ReportCtx {
  userId: string;
  lookups: Lookups;
}

export interface ReportSection {
  id: string;
  module: string;
  title: string;
  sub?: string;
  columns: Column[];
  rows: Row[];
  fileName: string;
  summary?: {
    label: string;
    value: string;
    tone?: "primary" | "success" | "warning" | "info" | "destructive";
  }[];
  pdf?: { meta?: [string, string][]; footer?: string; title: string; sub?: string };
  note?: string;
}

type Builder = (ctx: ReportCtx) => Promise<ReportSection>;

/* ------------------------------------------------------------------ */
/* Shared helpers for builders                                         */
/* ------------------------------------------------------------------ */

function itemName(r: Row, l: Lookups): { name: string; cost: number; kind: string } {
  if (r.product_id) {
    const p = l.products.get(r.product_id);
    return { name: p?.name ?? "—", cost: Number(p?.unit_cost ?? 0), kind: "Product" };
  }
  if (r.material_id) {
    const m = l.materials.get(r.material_id);
    return { name: m?.name ?? "—", cost: Number(m?.unit_cost ?? 0), kind: "Material" };
  }
  return { name: "—", cost: 0, kind: "—" };
}

function orderProducts(orders: Row[], items: Row[], l: Lookups): Map<string, string> {
  const byOrder = new Map<string, string[]>();
  for (const it of items) {
    const p = l.products.get(it.product_id);
    const name = p?.name ?? "—";
    const arr = byOrder.get(it.sales_order_id) ?? [];
    arr.push(it.quantity ? `${name} ×${it.quantity}` : name);
    byOrder.set(it.sales_order_id, arr);
  }
  const out = new Map<string, string>();
  for (const o of orders) out.set(o.id, (byOrder.get(o.id) ?? []).join(", ") || "—");
  return out;
}

const STATUS_TONES: Record<string, "success" | "warning" | "destructive" | "info"> = {
  paid: "success",
  completed: "success",
  received: "success",
  delivered: "success",
  approved: "success",
  accepted: "success",
  active: "success",
  operational: "success",
  pending: "warning",
  pending_approval: "warning",
  sent: "info",
  in_progress: "info",
  in_production: "info",
  dispatched: "info",
  open: "info",
  todo: "warning",
  rejected: "destructive",
  suspended: "destructive",
  failed: "destructive",
  overdue: "destructive",
  down: "destructive",
};

/* ------------------------------------------------------------------ */
/* Root Super Admin — platform-wide reports                            */
/* ------------------------------------------------------------------ */

const rootBuilders: Builder[] = [
  async (ctx) => {
    const companies = await fetchAll("companies");
    const rows = companies.map((c) => ({
      name: c.name,
      legal_name: c.legal_name ?? "—",
      status: c.status,
      plan_tier: c.plan_tier ?? "—",
      gst_number: c.gst_number ?? "—",
      created_at: c.created_at,
    }));
    return {
      id: "root-companies",
      module: "platform",
      title: "Companies on Platform",
      sub: "Every company registered on FactoryOS, with approval status.",
      columns: [
        { key: "name", label: "Company" },
        { key: "legal_name", label: "Legal Name" },
        { key: "status", label: "Status" },
        { key: "plan_tier", label: "Plan Tier" },
        { key: "gst_number", label: "GST Number" },
        { key: "created_at", label: "Registered" },
      ],
      rows,
      fileName: "platform-companies",
      summary: [
        { label: "Total Companies", value: num(rows.length), tone: "primary" },
        {
          label: "Active",
          value: num(rows.filter((r) => r.status === "active").length),
          tone: "success",
        },
        {
          label: "Pending Approval",
          value: num(rows.filter((r) => r.status === "pending").length),
          tone: "warning",
        },
        {
          label: "Suspended",
          value: num(rows.filter((r) => r.status === "suspended").length),
          tone: "destructive",
        },
      ],
    };
  },
  async () => {
    const regs = await fetchAll("company_registrations");
    const rows = regs.map((r) => ({
      company_name: r.company_name,
      email: r.email ?? "—",
      status: r.status,
      industry: r.industry ?? "—",
      created_at: r.created_at,
      reviewed_at: r.reviewed_at,
    }));
    return {
      id: "root-approvals",
      module: "platform",
      title: "Company Approvals",
      sub: "New company registration requests and their review status.",
      columns: [
        { key: "company_name", label: "Company" },
        { key: "email", label: "Contact Email" },
        { key: "industry", label: "Industry" },
        { key: "status", label: "Status" },
        { key: "created_at", label: "Requested" },
        { key: "reviewed_at", label: "Reviewed" },
      ],
      rows,
      fileName: "platform-company-approvals",
      summary: [
        { label: "Total Requests", value: num(rows.length), tone: "primary" },
        {
          label: "Approved",
          value: num(rows.filter((r) => r.status === "approved").length),
          tone: "success",
        },
        {
          label: "Rejected",
          value: num(rows.filter((r) => r.status === "rejected").length),
          tone: "destructive",
        },
      ],
    };
  },
  async () => {
    const roles = await fetchAll("user_roles");
    const counts = countBy(roles, "role");
    const rows = counts.map((c) => ({
      role: ROLE_MAP[c.value as AppRole]?.label ?? c.value,
      role_key: c.value,
      count: c.count,
    }));
    return {
      id: "root-users-by-role",
      module: "platform",
      title: "Platform-wide Users by Role",
      sub: "Every user account across all companies, grouped by role.",
      columns: [
        { key: "role", label: "Role" },
        { key: "count", label: "Users", align: "right" },
      ],
      rows,
      fileName: "platform-users-by-role",
      summary: [{ label: "Total Accounts", value: num(roles.length), tone: "primary" }],
    };
  },
  async () => {
    const audits = await fetchAll("audit_logs");
    const access = await fetchAll("access_logs");
    const entities = countBy(audits, "entity");
    const rows = entities.slice(0, 20).map((c) => ({
      entity: c.value,
      actions: c.count,
    }));
    const okLogins = access.filter(
      (a) => a.status === "success" || a.status === "succeeded",
    ).length;
    return {
      id: "root-system-health",
      module: "platform",
      title: "System Health & Audit Summary",
      sub: "Cross-tenant write activity (last 30 days) and login health across the platform.",
      columns: [
        { key: "entity", label: "Module / Entity" },
        { key: "actions", label: "Write Actions", align: "right" },
      ],
      rows,
      fileName: "platform-system-health",
      summary: [
        { label: "Audit Events", value: num(audits.length), tone: "primary" },
        { label: "Successful Logins", value: num(okLogins), tone: "success" },
        { label: "Failed / Blocked", value: num(access.length - okLogins), tone: "warning" },
      ],
    };
  },
];

/* ------------------------------------------------------------------ */
/* Company Admin — company-wide cross-module reports                   */
/* ------------------------------------------------------------------ */

const companyAdminBuilders: Builder[] = [
  async (ctx) => {
    const orders = await fetchAll("sales_orders");
    const counts = countBy(orders, "status");
    const rows = counts.map((c) => ({
      status: c.value,
      orders: c.count,
      value: sumBy(
        orders.filter((o) => o.status === c.value),
        "total_amount",
      ),
    }));
    return {
      id: "ca-orders-by-status",
      module: "production",
      title: "Customer Orders by Status",
      sub: "All customer orders for this company, grouped by current status.",
      columns: [
        { key: "status", label: "Status" },
        { key: "orders", label: "Orders", align: "right" },
        { key: "value", label: "Order Value", align: "right" },
      ],
      rows,
      fileName: "company-orders-by-status",
      summary: [
        { label: "Total Orders", value: num(orders.length), tone: "primary" },
        {
          label: "Pending Approval",
          value: num(orders.filter((o) => o.status === "pending_approval").length),
          tone: "warning",
        },
        {
          label: "Delivered",
          value: num(orders.filter((o) => o.status === "delivered").length),
          tone: "success",
        },
      ],
    };
  },
  async (ctx) => {
    const invoices = await fetchAll("invoices");
    const payments = await fetchAll("payments");
    const rows = invoices.map((i) => ({
      invoice_number: i.invoice_number,
      customer: ctx.lookups.customers.get(i.customer_id)?.name ?? "—",
      total_amount: i.total_amount,
      tax_amount: i.tax_amount ?? 0,
      status: i.status,
      issue_date: i.issue_date,
      due_date: i.due_date,
      paid_date: i.paid_date,
    }));
    const issued = sumBy(invoices, "total_amount");
    const paid = sumBy(
      invoices.filter((i) => i.status === "paid"),
      "total_amount",
    );
    return {
      id: "ca-revenue",
      module: "finance",
      title: "Revenue (Invoices & Payments)",
      sub: "Invoice revenue, GST and collection status for this company.",
      columns: [
        { key: "invoice_number", label: "Invoice #" },
        { key: "customer", label: "Customer" },
        { key: "total_amount", label: "Amount", align: "right" },
        { key: "tax_amount", label: "GST", align: "right" },
        { key: "status", label: "Status" },
        { key: "issue_date", label: "Issued" },
        { key: "due_date", label: "Due" },
        { key: "paid_date", label: "Paid" },
      ],
      rows,
      fileName: "company-revenue",
      summary: [
        { label: "Invoiced", value: money(issued), tone: "primary" },
        { label: "Collected", value: money(paid), tone: "success" },
        { label: "Outstanding", value: money(issued - paid), tone: "warning" },
        { label: "Payments Received", value: num(payments.length), tone: "info" },
      ],
    };
  },
  async (ctx) => {
    const orders = await fetchAll("sales_orders");
    const items = await fetchAll("sales_order_items");
    const products = orderProducts(orders, items, ctx.lookups);
    const rows = orders.map((o) => ({
      so_number: o.so_number,
      product: products.get(o.id),
      status: o.status,
      progress: o.progress ?? 0,
      total_amount: o.total_amount,
      due_date: o.due_date,
    }));
    const inFlight = orders.filter((o) => ["approved", "in_production"].includes(o.status));
    return {
      id: "ca-production-throughput",
      module: "production",
      title: "Production Throughput",
      sub: "Order pipeline — how many orders are in each stage of production.",
      columns: [
        { key: "so_number", label: "Order #" },
        { key: "product", label: "Product" },
        { key: "status", label: "Status" },
        { key: "progress", label: "Progress", align: "right" },
        { key: "total_amount", label: "Value", align: "right" },
        { key: "due_date", label: "Due" },
      ],
      rows,
      fileName: "company-production-throughput",
      summary: [
        { label: "In Flight", value: num(inFlight.length), tone: "info" },
        {
          label: "Delivered",
          value: num(orders.filter((o) => o.status === "delivered").length),
          tone: "success",
        },
        {
          label: "Avg Progress",
          value: `${avgBy(inFlight, "progress").toFixed(1)}%`,
          tone: "primary",
        },
      ],
    };
  },
  async (ctx) => {
    const inv = await fetchAll("inventory");
    const rows = inv.map((r) => {
      const it = itemName(r, ctx.lookups);
      return {
        item: it.name,
        kind: it.kind,
        warehouse: ctx.lookups.warehouses.get(r.warehouse_id)?.name ?? "—",
        quantity: r.quantity,
        unit_cost: it.cost,
        value: r.quantity * it.cost,
      };
    });
    return {
      id: "ca-inventory-value",
      module: "warehouse",
      title: "Inventory Value",
      sub: "Current stock on hand valued at unit cost (raw materials + finished goods).",
      columns: [
        { key: "item", label: "Item" },
        { key: "kind", label: "Type" },
        { key: "warehouse", label: "Warehouse" },
        { key: "quantity", label: "Qty", align: "right" },
        { key: "unit_cost", label: "Unit Cost", align: "right" },
        { key: "value", label: "Value", align: "right" },
      ],
      rows,
      fileName: "company-inventory-value",
      summary: [
        { label: "Total Stock Value", value: money(sumBy(rows, "value")), tone: "primary" },
      ],
    };
  },
  async () => {
    const orders = await fetchAll("sales_orders");
    const pcrs = await fetchAll("profile_change_requests");
    const reqs = await fetchAll("customer_requests");
    const pendingOrders = orders.filter((o) => o.status === "pending_approval").length;
    const pendingPcr = pcrs.filter((p) => p.status === "pending").length;
    const pendingReqs = reqs.filter((r) => r.status === "pending").length;
    const rows = [
      { type: "Customer Orders", count: pendingOrders, detail: "awaiting company admin approval" },
      { type: "Profile Change Requests", count: pendingPcr, detail: "awaiting admin review" },
      { type: "Customer Registrations", count: pendingReqs, detail: "awaiting whitelist approval" },
    ];
    return {
      id: "ca-pending-approvals",
      module: "production",
      title: "Pending Approvals",
      sub: "Every item waiting on this company's approval queue right now.",
      columns: [
        { key: "type", label: "Approval Type" },
        { key: "count", label: "Pending", align: "right" },
        { key: "detail", label: "Detail" },
      ],
      rows,
      fileName: "company-pending-approvals",
      summary: [
        {
          label: "Total Pending",
          value: num(pendingOrders + pendingPcr + pendingReqs),
          tone: "warning",
        },
      ],
    };
  },
  async (ctx) => {
    const roles = await fetchAll("user_roles");
    const counts = countBy(roles, "role");
    const rows = counts.map((c) => ({
      role: ROLE_MAP[c.value as AppRole]?.label ?? c.value,
      count: c.count,
    }));
    return {
      id: "ca-headcount-by-role",
      module: "hr",
      title: "Staff Headcount by Role",
      sub: "Active user accounts in this company, grouped by role.",
      columns: [
        { key: "role", label: "Role" },
        { key: "count", label: "Users", align: "right" },
      ],
      rows,
      fileName: "company-headcount-by-role",
      summary: [{ label: "Total Staff Accounts", value: num(roles.length), tone: "primary" }],
    };
  },
  async (ctx) => {
    const employees = await fetchAll("employees");
    const counts = countBy(employees, "department");
    const rows = counts.map((c) => ({
      department: c.value,
      headcount: c.count,
    }));
    return {
      id: "ca-headcount-by-dept",
      module: "hr",
      title: "Staff Headcount by Department",
      sub: "Employee directory grouped by department.",
      columns: [
        { key: "department", label: "Department" },
        { key: "headcount", label: "Employees", align: "right" },
      ],
      rows,
      fileName: "company-headcount-by-department",
    };
  },
];

/* ------------------------------------------------------------------ */
/* Plant Admin / Plant Manager — plant-level reports                   */
/* ------------------------------------------------------------------ */

const plantBuilders: Builder[] = [
  async (ctx) => {
    const depts = [...ctx.lookups.departments.values()];
    const wos = await fetchAll("work_orders");
    const pos = await fetchAll("production_orders");
    const rows = depts.map((d) => ({
      department: d.name,
      work_orders: wos.filter((w) => w.department_id === d.id).length,
      production_orders: pos.filter((p) => p.department_id === d.id).length,
    }));
    return {
      id: "plant-dept-output",
      module: "production",
      title: "Department Output",
      sub: "Work orders and production orders per department (Carpentry / Upholstery / Finishing / Assembly).",
      columns: [
        { key: "department", label: "Department" },
        { key: "work_orders", label: "Work Orders", align: "right" },
        { key: "production_orders", label: "Production Orders", align: "right" },
      ],
      rows,
      fileName: "plant-department-output",
      summary: [
        { label: "Departments", value: num(depts.length), tone: "primary" },
        { label: "Total Work Orders", value: num(wos.length), tone: "info" },
      ],
      note: "Work orders are created when production starts — zero counts mean no orders have started yet.",
    };
  },
  async (ctx) => {
    const attendance = await fetchAll("attendance");
    const employees = await fetchAll("employees");
    const rows = employees.map((e) => ({
      employee: e.full_name,
      department: e.department ?? ctx.lookups.departments.get(e.department_id)?.name ?? "—",
      records: attendance.filter((a) => a.employee_id === e.id).length,
      hours_worked: sumBy(
        attendance.filter((a) => a.employee_id === e.id),
        "hours_worked",
      ),
      present_days: attendance.filter((a) => a.employee_id === e.id && a.status === "present")
        .length,
    }));
    return {
      id: "plant-attendance",
      module: "hr",
      title: "Staff Attendance Summary",
      sub: "Attendance records per employee for this plant.",
      columns: [
        { key: "employee", label: "Employee" },
        { key: "department", label: "Department" },
        { key: "records", label: "Records", align: "right" },
        { key: "present_days", label: "Present Days", align: "right" },
        { key: "hours_worked", label: "Hours", align: "right" },
      ],
      rows,
      fileName: "plant-attendance-summary",
      summary: [
        { label: "Employees", value: num(employees.length), tone: "primary" },
        { label: "Attendance Records", value: num(attendance.length), tone: "info" },
      ],
    };
  },
  async (ctx) => {
    const machines = await fetchAll("machines");
    const rows = machines.map((m) => ({
      machine: m.name,
      code: m.code ?? "—",
      status: m.status,
      utilization: m.utilization ?? 0,
      last_maintenance: m.last_maintenance,
    }));
    const operational = machines.filter((m) => m.status === "operational").length;
    return {
      id: "plant-machine-uptime",
      module: "maintenance",
      title: "Machine Uptime",
      sub: "Machine fleet health and utilization for this plant.",
      columns: [
        { key: "machine", label: "Machine" },
        { key: "code", label: "Code" },
        { key: "status", label: "Status" },
        { key: "utilization", label: "Utilization", align: "right" },
        { key: "last_maintenance", label: "Last Maintenance" },
      ],
      rows,
      fileName: "plant-machine-uptime",
      summary: [
        { label: "Machines", value: num(machines.length), tone: "primary" },
        { label: "Operational", value: num(operational), tone: "success" },
        {
          label: "Avg Utilization",
          value: `${avgBy(machines, "utilization").toFixed(1)}%`,
          tone: "info",
        },
      ],
    };
  },
  async (ctx) => {
    const inv = await fetchAll("inventory");
    const rows = inv.map((r) => {
      const it = itemName(r, ctx.lookups);
      return {
        item: it.name,
        warehouse: ctx.lookups.warehouses.get(r.warehouse_id)?.name ?? "—",
        quantity: r.quantity,
        unit_cost: it.cost,
        value: r.quantity * it.cost,
      };
    });
    return {
      id: "plant-local-stock",
      module: "warehouse",
      title: "Local Stock Summary",
      sub: "Stock on hand per warehouse for this plant.",
      columns: [
        { key: "item", label: "Item" },
        { key: "warehouse", label: "Warehouse" },
        { key: "quantity", label: "Qty", align: "right" },
        { key: "unit_cost", label: "Unit Cost", align: "right" },
        { key: "value", label: "Value", align: "right" },
      ],
      rows,
      fileName: "plant-local-stock",
      summary: [
        { label: "Total Stock Value", value: money(sumBy(rows, "value")), tone: "primary" },
      ],
    };
  },
];

/* ------------------------------------------------------------------ */
/* Production Manager — production reports                             */
/* ------------------------------------------------------------------ */

const productionManagerBuilders: Builder[] = [
  async (ctx) => {
    const orders = await fetchAll("sales_orders");
    const items = await fetchAll("sales_order_items");
    const products = orderProducts(orders, items, ctx.lookups);
    const inScope = orders.filter((o) =>
      ["approved", "in_production", "delivered", "completed"].includes(o.status),
    );
    const rows = inScope.map((o) => ({
      so_number: o.so_number,
      product: products.get(o.id),
      status: o.status,
      progress: o.progress ?? 0,
      quantity: sumBy(
        items.filter((it) => it.sales_order_id === o.id),
        "quantity",
      ),
      due_date: o.due_date,
    }));
    return {
      id: "pm-pipeline",
      module: "production",
      title: "Production Pipeline",
      sub: "Approved and in-flight customer orders — the live production queue.",
      columns: [
        { key: "so_number", label: "Order #" },
        { key: "product", label: "Product" },
        { key: "status", label: "Status" },
        { key: "quantity", label: "Qty", align: "right" },
        { key: "progress", label: "Progress", align: "right" },
        { key: "due_date", label: "Due" },
      ],
      rows,
      fileName: "production-pipeline",
      summary: [
        { label: "In Flight", value: num(inScope.length), tone: "primary" },
        {
          label: "In Production",
          value: num(inScope.filter((o) => o.status === "in_production").length),
          tone: "info",
        },
        {
          label: "Avg Progress",
          value: `${avgBy(inScope, "progress").toFixed(1)}%`,
          tone: "success",
        },
      ],
    };
  },
  async (ctx) => {
    const wos = await fetchAll("work_orders");
    const counts = countBy(wos, "status");
    const rows = counts.map((c) => ({ status: c.value, count: c.count }));
    return {
      id: "pm-work-orders",
      module: "production",
      title: "Work Orders (Open / In-Progress / Completed)",
      sub: "Work order status breakdown across the shop floor.",
      columns: [
        { key: "status", label: "Status" },
        { key: "count", label: "Work Orders", align: "right" },
      ],
      rows,
      fileName: "production-work-orders",
      summary: [{ label: "Total Work Orders", value: num(wos.length), tone: "primary" }],
      note: "Work orders are created when production starts on an approved order.",
    };
  },
  async (ctx) => {
    const boms = await fetchAll("bom");
    const items = await fetchAll("bom_items");
    const rows: Row[] = [];
    for (const b of boms) {
      const product = ctx.lookups.products.get(b.product_id);
      const comps = items.filter((i) => i.bom_id === b.id);
      if (!comps.length) {
        rows.push({
          product: product?.name ?? "—",
          component: "—",
          quantity: "—",
          version: b.version ?? "—",
          status: b.status,
        });
      } else {
        for (const ci of comps) {
          const comp =
            ctx.lookups.products.get(ci.component_product_id) ??
            ctx.lookups.materials.get(ci.component_product_id);
          rows.push({
            product: product?.name ?? "—",
            component: comp?.name ?? "—",
            quantity: ci.quantity,
            version: b.version ?? "—",
            status: b.status,
          });
        }
      }
    }
    return {
      id: "pm-bom-plan",
      module: "production",
      title: "Material Usage vs BOM Plan",
      sub: "Planned component consumption per product from the Bill of Materials.",
      columns: [
        { key: "product", label: "Product" },
        { key: "component", label: "Component" },
        { key: "quantity", label: "Qty", align: "right" },
        { key: "version", label: "BOM Version" },
        { key: "status", label: "Status" },
      ],
      rows,
      fileName: "production-bom-plan",
      summary: [
        { label: "BOMs", value: num(boms.length), tone: "primary" },
        { label: "Components", value: num(items.length), tone: "info" },
      ],
      note: "Actual material consumption is recorded when work orders run; plan shown here is the BOM baseline.",
    };
  },
  async (ctx) => {
    const wos = await fetchAll("work_orders");
    const rows = wos.map((w) => {
      const op = ctx.lookups.profiles.get(w.operator_id);
      return {
        operator: op?.full_name ?? w.operator_id?.slice(0, 8) ?? "—",
        wo_number: w.wo_number,
        operation: w.operation ?? "—",
        status: w.status,
        quantity: w.quantity,
        progress_percent: w.progress_percent ?? 0,
      };
    });
    return {
      id: "pm-operator-productivity",
      module: "production",
      title: "Operator Productivity",
      sub: "Work orders completed per production operator.",
      columns: [
        { key: "operator", label: "Operator" },
        { key: "wo_number", label: "Work Order" },
        { key: "operation", label: "Operation" },
        { key: "status", label: "Status" },
        { key: "quantity", label: "Qty", align: "right" },
        { key: "progress_percent", label: "Progress", align: "right" },
      ],
      rows,
      fileName: "production-operator-productivity",
      summary: [{ label: "Work Orders Assigned", value: num(wos.length), tone: "primary" }],
    };
  },
  async (ctx) => {
    const inspections = await fetchAll("quality_inspections");
    const certs = await fetchAll("quality_certificates");
    const passed = inspections.filter((i) => i.result === "pass").length;
    const rows = certs.map((c) => ({
      certificate_number: c.certificate_number,
      customer_order: c.customer_order_id?.slice(0, 8) ?? "—",
      issued_by: ctx.lookups.profiles.get(c.issued_by)?.full_name ?? "—",
      created_at: c.created_at,
    }));
    return {
      id: "pm-rework-fail-rate",
      module: "quality",
      title: "Rework / Fail Rate",
      sub: "Inspection outcomes and quality certificates issued.",
      columns: [
        { key: "certificate_number", label: "Certificate #" },
        { key: "customer_order", label: "Order" },
        { key: "issued_by", label: "Issued By" },
        { key: "created_at", label: "Issued" },
      ],
      rows,
      fileName: "production-rework-fail-rate",
      summary: [
        { label: "Inspections", value: num(inspections.length), tone: "primary" },
        { label: "Pass Rate", value: pct(passed, inspections.length || 1), tone: "success" },
        { label: "Certificates Issued", value: num(certs.length), tone: "info" },
      ],
    };
  },
];

/* ------------------------------------------------------------------ */
/* Warehouse Manager — warehouse reports                               */
/* ------------------------------------------------------------------ */

const warehouseBuilders: Builder[] = [
  async (ctx) => {
    const inv = await fetchAll("inventory");
    const rows = inv.map((r) => {
      const it = itemName(r, ctx.lookups);
      const reorder =
        (r.product_id ? ctx.lookups.products.get(r.product_id)?.reorder_level : null) ?? 0;
      return {
        item: it.name,
        kind: it.kind,
        warehouse: ctx.lookups.warehouses.get(r.warehouse_id)?.name ?? "—",
        quantity: r.quantity,
        reorder_level: reorder,
        status: r.quantity <= reorder ? "low_stock" : "in_stock",
      };
    });
    return {
      id: "wh-stock-levels",
      module: "warehouse",
      title: "Stock Levels",
      sub: "Raw material and finished-goods stock on hand, flagged against reorder levels.",
      columns: [
        { key: "item", label: "Item" },
        { key: "kind", label: "Type" },
        { key: "warehouse", label: "Warehouse" },
        { key: "quantity", label: "On Hand", align: "right" },
        { key: "reorder_level", label: "Reorder Level", align: "right" },
        { key: "status", label: "Status" },
      ],
      rows,
      fileName: "warehouse-stock-levels",
      summary: [
        { label: "Stock Items", value: num(inv.length), tone: "primary" },
        {
          label: "Below Reorder",
          value: num(rows.filter((r) => r.status === "low_stock").length),
          tone: "destructive",
        },
      ],
    };
  },
  async (ctx) => {
    const adj = await fetchAll("inventory_adjustments");
    const transfers = await fetchAll("stock_transfers");
    const adjRows = adj.map((a) => {
      const it = itemName(a, ctx.lookups);
      return {
        date: a.created_at,
        type: "Adjustment",
        item: it.name,
        warehouse: ctx.lookups.warehouses.get(a.warehouse_id)?.name ?? "—",
        delta: a.delta,
        reason: a.reason ?? "—",
      };
    });
    const transferRows = transfers.map((t) => {
      const it = itemName(t, ctx.lookups);
      return {
        date: t.created_at,
        type: "Transfer",
        item: it.name,
        warehouse:
          (ctx.lookups.warehouses.get(t.from_warehouse_id)?.name ?? "—") +
          " → " +
          (ctx.lookups.warehouses.get(t.to_warehouse_id)?.name ?? "—"),
        delta: t.quantity,
        reason: t.status ?? "—",
      };
    });
    const rows = [...transferRows, ...adjRows].sort((a, b) =>
      String(b.date).localeCompare(String(a.date)),
    );
    return {
      id: "wh-stock-movement",
      module: "warehouse",
      title: "Stock Movement History",
      sub: "Transfers and adjustments across warehouses.",
      columns: [
        { key: "date", label: "Date" },
        { key: "type", label: "Type" },
        { key: "item", label: "Item" },
        { key: "warehouse", label: "Warehouse(s)" },
        { key: "delta", label: "Qty Δ", align: "right" },
        { key: "reason", label: "Reason / Status" },
      ],
      rows,
      fileName: "warehouse-stock-movement",
      summary: [{ label: "Movements", value: num(rows.length), tone: "primary" }],
    };
  },
  async (ctx) => {
    const inv = await fetchAll("inventory");
    const rows = inv
      .map((r) => {
        const it = itemName(r, ctx.lookups);
        const reorder =
          (r.product_id ? ctx.lookups.products.get(r.product_id)?.reorder_level : null) ?? 0;
        return {
          item: it.name,
          warehouse: ctx.lookups.warehouses.get(r.warehouse_id)?.name ?? "—",
          quantity: r.quantity,
          reorder_level: reorder,
        };
      })
      .filter((r) => r.quantity <= r.reorder_level);
    return {
      id: "wh-low-stock",
      module: "warehouse",
      title: "Low-Stock Alerts",
      sub: "Items at or below their reorder level — candidates for replenishment.",
      columns: [
        { key: "item", label: "Item" },
        { key: "warehouse", label: "Warehouse" },
        { key: "quantity", label: "On Hand", align: "right" },
        { key: "reorder_level", label: "Reorder Level", align: "right" },
      ],
      rows,
      fileName: "warehouse-low-stock-alerts",
      summary: [
        {
          label: "Low-Stock Items",
          value: num(rows.length),
          tone: rows.length ? "destructive" : "success",
        },
      ],
      note: "No items are currently below reorder level — replenishment not required.",
    };
  },
  async (ctx) => {
    const grns = await fetchAll("goods_receipts");
    const rows = grns.map((g) => {
      const it = itemName(g, ctx.lookups);
      return {
        grn_number: g.grn_number,
        po_number: ctx.lookups.purchaseOrders.get(g.purchase_order_id)?.po_number ?? "—",
        item: it.name,
        quantity_received: g.quantity_received,
        warehouse: ctx.lookups.warehouses.get(g.warehouse_id)?.name ?? "—",
        created_at: g.created_at,
      };
    });
    return {
      id: "wh-grn-history",
      module: "warehouse",
      title: "GRN History",
      sub: "Goods received notes — inbound receipts against purchase orders.",
      columns: [
        { key: "grn_number", label: "GRN #" },
        { key: "po_number", label: "PO" },
        { key: "item", label: "Item" },
        { key: "quantity_received", label: "Qty Received", align: "right" },
        { key: "warehouse", label: "Warehouse" },
        { key: "created_at", label: "Received" },
      ],
      rows,
      fileName: "warehouse-grn-history",
      summary: [{ label: "GRNs", value: num(grns.length), tone: "primary" }],
    };
  },
  async (ctx) => {
    const shipments = await fetchAll("shipments");
    const rows = shipments.map((s) => ({
      shipment_number: s.shipment_number,
      customer: ctx.lookups.customers.get(s.customer_id)?.name ?? "—",
      carrier: s.carrier ?? "—",
      tracking_number: s.tracking_number ?? "—",
      status: s.status,
      shipped_date: s.shipped_date,
      delivered_date: s.delivered_date,
      destination: s.destination ?? "—",
    }));
    return {
      id: "wh-dispatch-history",
      module: "warehouse",
      title: "Dispatch History",
      sub: "Outbound customer shipments from the warehouse.",
      columns: [
        { key: "shipment_number", label: "Shipment #" },
        { key: "customer", label: "Customer" },
        { key: "carrier", label: "Carrier" },
        { key: "tracking_number", label: "Tracking" },
        { key: "status", label: "Status" },
        { key: "shipped_date", label: "Shipped" },
        { key: "delivered_date", label: "Delivered" },
        { key: "destination", label: "Destination" },
      ],
      rows,
      fileName: "warehouse-dispatch-history",
      summary: [{ label: "Shipments", value: num(shipments.length), tone: "primary" }],
    };
  },
];

/* ------------------------------------------------------------------ */
/* Procurement Manager — procurement reports                           */
/* ------------------------------------------------------------------ */

const procurementBuilders: Builder[] = [
  async (ctx) => {
    const pos = await fetchAll("purchase_orders");
    const reqs = await fetchAll("purchase_requisitions");
    const rows = pos.map((p) => ({
      po_number: p.po_number,
      supplier: ctx.lookups.suppliers.get(p.supplier_id)?.name ?? "—",
      status: p.status,
      total_amount: p.total_amount,
      expected_date: p.expected_date,
      created_at: p.created_at,
    }));
    return {
      id: "pr-reqs-vs-pos",
      module: "procurement",
      title: "Requisitions vs Purchase Orders",
      sub: "Purchase requisitions raised versus purchase orders issued.",
      columns: [
        { key: "po_number", label: "PO #" },
        { key: "supplier", label: "Supplier" },
        { key: "status", label: "Status" },
        { key: "total_amount", label: "Amount", align: "right" },
        { key: "expected_date", label: "Expected" },
        { key: "created_at", label: "Created" },
      ],
      rows,
      fileName: "procurement-requisitions-vs-pos",
      summary: [
        {
          label: "Open Requisitions",
          value: num(
            reqs.filter((r) => r.status !== "approved" && r.status !== "completed").length,
          ),
          tone: "warning",
        },
        { label: "Purchase Orders", value: num(pos.length), tone: "primary" },
        {
          label: "Received",
          value: num(pos.filter((p) => p.status === "received").length),
          tone: "success",
        },
      ],
    };
  },
  async (ctx) => {
    const suppliers = await fetchAll("suppliers");
    const deliveries = await fetchAll("supplier_deliveries");
    const rows = suppliers.map((s) => {
      const dels = deliveries.filter((d) => d.supplier_id === s.id);
      return {
        supplier: s.name,
        rating: s.rating ?? "—",
        deliveries: dels.length,
        dispatched: dels.filter((d) => d.status === "dispatched").length,
        received: dels.filter((d) => d.status === "received").length,
      };
    });
    return {
      id: "pr-supplier-performance",
      module: "procurement",
      title: "Supplier Performance",
      sub: "On-time delivery and acceptance across suppliers.",
      columns: [
        { key: "supplier", label: "Supplier" },
        { key: "rating", label: "Rating", align: "right" },
        { key: "deliveries", label: "Deliveries", align: "right" },
        { key: "dispatched", label: "Dispatched", align: "right" },
        { key: "received", label: "Received", align: "right" },
      ],
      rows,
      fileName: "procurement-supplier-performance",
      summary: [
        { label: "Suppliers", value: num(suppliers.length), tone: "primary" },
        {
          label: "Avg Rating",
          value: avgBy(suppliers, "rating") ? avgBy(suppliers, "rating").toFixed(1) : "—",
          tone: "info",
        },
      ],
    };
  },
  async (ctx) => {
    const pos = await fetchAll("purchase_orders");
    const rows = pos.map((p) => ({
      supplier: ctx.lookups.suppliers.get(p.supplier_id)?.name ?? "—",
      po_number: p.po_number,
      total_amount: p.total_amount,
    }));
    const bySupplier = new Map<string, number>();
    for (const r of rows)
      bySupplier.set(r.supplier, (bySupplier.get(r.supplier) ?? 0) + Number(r.total_amount || 0));
    const summaryRows = [...bySupplier.entries()].map(([supplier, spend]) => ({
      supplier,
      spend,
    }));
    return {
      id: "pr-spend",
      module: "procurement",
      title: "Spend by Supplier",
      sub: "Purchase order spend per supplier.",
      columns: [
        { key: "supplier", label: "Supplier" },
        { key: "spend", label: "Spend", align: "right" },
      ],
      rows: summaryRows,
      fileName: "procurement-spend-by-supplier",
      summary: [
        { label: "Total PO Spend", value: money(sumBy(pos, "total_amount")), tone: "primary" },
      ],
    };
  },
  async (ctx) => {
    const pos = await fetchAll("purchase_orders");
    const rows = pos
      .filter((p) => p.status !== "received")
      .map((p) => ({
        po_number: p.po_number,
        supplier: ctx.lookups.suppliers.get(p.supplier_id)?.name ?? "—",
        status: p.status,
        total_amount: p.total_amount,
        expected_date: p.expected_date,
      }));
    return {
      id: "pr-open-pos",
      module: "procurement",
      title: "Open POs Awaiting Response",
      sub: "Purchase orders not yet received — awaiting supplier action or dispatch.",
      columns: [
        { key: "po_number", label: "PO #" },
        { key: "supplier", label: "Supplier" },
        { key: "status", label: "Status" },
        { key: "total_amount", label: "Amount", align: "right" },
        { key: "expected_date", label: "Expected" },
      ],
      rows,
      fileName: "procurement-open-pos",
      summary: [
        { label: "Open POs", value: num(rows.length), tone: rows.length ? "warning" : "success" },
      ],
      note: "All purchase orders have been received — no open POs.",
    };
  },
];

/* ------------------------------------------------------------------ */
/* Quality Inspector — quality reports                                 */
/* ------------------------------------------------------------------ */

const qualityBuilders: Builder[] = [
  async (ctx) => {
    const inspections = await fetchAll("quality_inspections");
    const passed = inspections.filter((i) => i.result === "pass").length;
    const failed = inspections.filter((i) => i.result === "fail").length;
    const rows = inspections.map((i) => ({
      inspection_number: i.inspection_number,
      inspection_type: i.inspection_type ?? "—",
      product: ctx.lookups.products.get(i.product_id)?.name ?? "—",
      result: i.result,
      defects_found: i.defects_found ?? "—",
      quantity_checked: i.quantity_checked,
      created_at: i.created_at,
    }));
    return {
      id: "qi-pass-fail",
      module: "quality",
      title: "Inspection Pass / Fail Rate",
      sub: "Every quality inspection with its outcome.",
      columns: [
        { key: "inspection_number", label: "Inspection #" },
        { key: "inspection_type", label: "Type" },
        { key: "product", label: "Product" },
        { key: "result", label: "Result" },
        { key: "defects_found", label: "Defects" },
        { key: "quantity_checked", label: "Qty Checked", align: "right" },
        { key: "created_at", label: "Date" },
      ],
      rows,
      fileName: "quality-pass-fail-rate",
      summary: [
        { label: "Inspections", value: num(inspections.length), tone: "primary" },
        { label: "Pass Rate", value: pct(passed, inspections.length || 1), tone: "success" },
        { label: "Failures", value: num(failed), tone: "destructive" },
      ],
      note: "No inspections recorded yet — pass/fail metrics will appear once inspections run.",
    };
  },
  async () => {
    const inspections = await fetchAll("quality_inspections");
    const map = new Map<string, number>();
    for (const i of inspections) {
      const raw = String(i.defects_found ?? "");
      const parts = raw
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (!parts.length) continue;
      for (const p of parts) map.set(p, (map.get(p) ?? 0) + 1);
    }
    const rows = [...map.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
    return {
      id: "qi-defect-categories",
      module: "quality",
      title: "Defect Category Breakdown",
      sub: "Defect types found across inspections (surface scratch, uneven polish, wobbly joints, etc.).",
      columns: [
        { key: "category", label: "Defect Category" },
        { key: "count", label: "Occurrences", align: "right" },
      ],
      rows,
      fileName: "quality-defect-categories",
      summary: [{ label: "Distinct Defect Types", value: num(rows.length), tone: "primary" }],
      note: "No defects recorded yet.",
    };
  },
  async (ctx) => {
    const inspections = await fetchAll("quality_inspections");
    const rows = inspections
      .filter((i) => i.result === "fail")
      .map((i) => ({
        inspection_number: i.inspection_number,
        product: ctx.lookups.products.get(i.product_id)?.name ?? "—",
        defects_found: i.defects_found ?? "—",
        created_at: i.created_at,
      }));
    return {
      id: "qi-rework",
      module: "quality",
      title: "Rework Turnaround",
      sub: "Failed batches — candidates for rework, with the defects that caused the failure.",
      columns: [
        { key: "inspection_number", label: "Inspection #" },
        { key: "product", label: "Product" },
        { key: "defects_found", label: "Defects" },
        { key: "created_at", label: "Failed" },
      ],
      rows,
      fileName: "quality-rework-turnaround",
      summary: [
        {
          label: "Failed Batches",
          value: num(rows.length),
          tone: rows.length ? "destructive" : "success",
        },
      ],
      note: "No failed batches — nothing in rework.",
    };
  },
  async (ctx) => {
    const certs = await fetchAll("quality_certificates");
    const rows = certs.map((c) => ({
      certificate_number: c.certificate_number,
      order: c.customer_order_id?.slice(0, 8) ?? "—",
      inspection: c.inspection_id?.slice(0, 8) ?? "—",
      issued_by: ctx.lookups.profiles.get(c.issued_by)?.full_name ?? "—",
      created_at: c.created_at,
    }));
    return {
      id: "qi-certificates",
      module: "quality",
      title: "Quality Certificates Issued",
      sub: "Quality certificates generated on inspection pass — downloadable as a formatted document.",
      columns: [
        { key: "certificate_number", label: "Certificate #" },
        { key: "order", label: "Order" },
        { key: "inspection", label: "Inspection" },
        { key: "issued_by", label: "Issued By" },
        { key: "created_at", label: "Issued" },
      ],
      rows,
      fileName: "quality-certificates",
      pdf: {
        title: "Quality Certificates — Issued",
        sub: "FactoryOS AI Quality Assurance",
        meta: [
          ["Certificates Issued", String(rows.length)],
          ["Generated", new Date().toLocaleString()],
        ],
        footer: "FactoryOS AI — Quality Certificates",
      },
      summary: [{ label: "Certificates Issued", value: num(certs.length), tone: "success" }],
    };
  },
];

/* ------------------------------------------------------------------ */
/* Maintenance Engineer — maintenance reports                          */
/* ------------------------------------------------------------------ */

const maintenanceBuilders: Builder[] = [
  async (ctx) => {
    const machines = await fetchAll("machines");
    const rows = machines.map((m) => ({
      machine: m.name,
      code: m.code ?? "—",
      status: m.status,
      utilization: m.utilization ?? 0,
      last_maintenance: m.last_maintenance,
    }));
    return {
      id: "mt-machine-health",
      module: "maintenance",
      title: "Machine Health Summary",
      sub: "Current fleet status and utilization.",
      columns: [
        { key: "machine", label: "Machine" },
        { key: "code", label: "Code" },
        { key: "status", label: "Status" },
        { key: "utilization", label: "Utilization", align: "right" },
        { key: "last_maintenance", label: "Last Maintenance" },
      ],
      rows,
      fileName: "maintenance-machine-health",
      summary: [
        { label: "Machines", value: num(machines.length), tone: "primary" },
        {
          label: "Operational",
          value: num(machines.filter((m) => m.status === "operational").length),
          tone: "success",
        },
      ],
    };
  },
  async (ctx) => {
    const tickets = await fetchAll("maintenance_tickets");
    const breakdowns = await fetchAll("machine_breakdowns");
    const rows = [
      ...tickets.map((t) => ({
        date: t.created_at,
        type: "Ticket",
        machine:
          ctx.lookups.products.get(t.machine_id)?.name ??
          ctx.lookups.materials.get(t.machine_id)?.name ??
          "—",
        subject: t.ticket_number ?? t.issue_description ?? "—",
        status: t.status,
      })),
      ...breakdowns.map((b) => ({
        date: b.downtime_start,
        type: "Breakdown",
        machine: "—",
        subject: b.cause ?? "—",
        status: b.downtime_end ? "resolved" : "down",
      })),
    ].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return {
      id: "mt-breakdown-history",
      module: "maintenance",
      title: "Breakdown Ticket History",
      sub: "Maintenance tickets and machine breakdowns.",
      columns: [
        { key: "date", label: "Date" },
        { key: "type", label: "Type" },
        { key: "machine", label: "Machine" },
        { key: "subject", label: "Issue" },
        { key: "status", label: "Status" },
      ],
      rows,
      fileName: "maintenance-breakdown-history",
      summary: [
        { label: "Tickets", value: num(tickets.length), tone: "primary" },
        {
          label: "Breakdowns",
          value: num(breakdowns.length),
          tone: breakdowns.length ? "destructive" : "success",
        },
      ],
      note: "No breakdowns or tickets recorded yet.",
    };
  },
  async () => {
    const breakdowns = await fetchAll("machine_breakdowns");
    const map = new Map<string, { count: number; ms: number }>();
    for (const b of breakdowns) {
      const key = b.machine_id ?? "—";
      const entry = map.get(key) ?? { count: 0, ms: 0 };
      entry.count += 1;
      const start = new Date(b.downtime_start).getTime();
      const end = b.downtime_end ? new Date(b.downtime_end).getTime() : Date.now();
      if (!isNaN(start) && !isNaN(end)) entry.ms += Math.max(0, end - start);
      map.set(key, entry);
    }
    const rows = [...map.entries()].map(([machine, v]) => ({
      machine: machine.slice(0, 8),
      breakdowns: v.count,
      mttr_hours: (v.ms / 3_600_000 / v.count).toFixed(1),
    }));
    return {
      id: "mt-mttr",
      module: "maintenance",
      title: "Mean Time To Repair",
      sub: "Average downtime per breakdown, by machine.",
      columns: [
        { key: "machine", label: "Machine" },
        { key: "breakdowns", label: "Breakdowns", align: "right" },
        { key: "mttr_hours", label: "MTTR (hrs)", align: "right" },
      ],
      rows,
      fileName: "maintenance-mttr",
      summary: [{ label: "Machines with Breakdowns", value: num(rows.length), tone: "primary" }],
      note: "No breakdown data recorded yet.",
    };
  },
  async (ctx) => {
    const schedules = await fetchAll("maintenance_schedules");
    const now = Date.now();
    const rows = schedules.map((s) => ({
      machine:
        ctx.lookups.products.get(s.machine_id)?.name ??
        ctx.lookups.materials.get(s.machine_id)?.name ??
        "—",
      recurrence: s.recurrence ?? "—",
      status: s.status,
      next_due: s.next_due,
      last_done: s.last_done,
      overdue: s.next_due ? new Date(s.next_due).getTime() < now : false,
    }));
    return {
      id: "mt-pm-schedule",
      module: "maintenance",
      title: "Preventive Maintenance Schedule Adherence",
      sub: "PM schedules with next due dates and overdue flags.",
      columns: [
        { key: "machine", label: "Machine" },
        { key: "recurrence", label: "Recurrence" },
        { key: "status", label: "Status" },
        { key: "next_due", label: "Next Due" },
        { key: "last_done", label: "Last Done" },
        { key: "overdue", label: "Overdue" },
      ],
      rows,
      fileName: "maintenance-pm-schedule",
      summary: [{ label: "Schedules", value: num(schedules.length), tone: "primary" }],
      note: "No preventive maintenance schedules configured yet.",
    };
  },
];

/* ------------------------------------------------------------------ */
/* Finance Manager — finance reports                                   */
/* ------------------------------------------------------------------ */

const financeBuilders: Builder[] = [
  async (ctx) => {
    const invoices = await fetchAll("invoices");
    const rows = invoices.map((i) => ({
      invoice_number: i.invoice_number,
      customer: ctx.lookups.customers.get(i.customer_id)?.name ?? "—",
      total_amount: i.total_amount,
      tax_amount: i.tax_amount ?? 0,
      status: i.status,
      issue_date: i.issue_date,
      due_date: i.due_date,
      paid_date: i.paid_date,
    }));
    const issued = sumBy(invoices, "total_amount");
    const paid = sumBy(
      invoices.filter((i) => i.status === "paid"),
      "total_amount",
    );
    return {
      id: "fn-invoices",
      module: "finance",
      title: "Invoices Issued vs Paid",
      sub: "All customer invoices with collection status.",
      columns: [
        { key: "invoice_number", label: "Invoice #" },
        { key: "customer", label: "Customer" },
        { key: "total_amount", label: "Amount", align: "right" },
        { key: "tax_amount", label: "GST", align: "right" },
        { key: "status", label: "Status" },
        { key: "issue_date", label: "Issued" },
        { key: "due_date", label: "Due" },
        { key: "paid_date", label: "Paid" },
      ],
      rows,
      fileName: "finance-invoices",
      summary: [
        { label: "Issued", value: money(issued), tone: "primary" },
        { label: "Paid", value: money(paid), tone: "success" },
        { label: "Outstanding", value: money(issued - paid), tone: "warning" },
      ],
    };
  },
  async (ctx) => {
    const invoices = await fetchAll("invoices");
    const rows = invoices
      .filter((i) => i.status !== "paid")
      .map((i) => ({
        invoice_number: i.invoice_number,
        customer: ctx.lookups.customers.get(i.customer_id)?.name ?? "—",
        total_amount: i.total_amount,
        due_date: i.due_date,
        days_overdue: i.due_date
          ? Math.max(0, Math.floor((Date.now() - new Date(i.due_date).getTime()) / 86_400_000))
          : 0,
      }));
    return {
      id: "fn-receivables",
      module: "finance",
      title: "Outstanding Receivables",
      sub: "Customer invoices not yet collected.",
      columns: [
        { key: "invoice_number", label: "Invoice #" },
        { key: "customer", label: "Customer" },
        { key: "total_amount", label: "Amount", align: "right" },
        { key: "due_date", label: "Due" },
        { key: "days_overdue", label: "Days Overdue", align: "right" },
      ],
      rows,
      fileName: "finance-outstanding-receivables",
      summary: [
        { label: "Outstanding", value: money(sumBy(rows, "total_amount")), tone: "warning" },
      ],
      note: "All customer invoices are collected — no outstanding receivables.",
    };
  },
  async (ctx) => {
    const invs = await fetchAll("supplier_invoices");
    const rows = invs.map((i) => ({
      invoice_number: i.invoice_number,
      supplier: ctx.lookups.suppliers.get(i.supplier_id)?.name ?? "—",
      total_amount: i.total_amount,
      gst_amount: i.gst_amount ?? 0,
      status: i.status,
      created_at: i.created_at,
    }));
    const outstanding = invs.filter((i) => i.status !== "paid");
    return {
      id: "fn-payables",
      module: "finance",
      title: "Outstanding Payables",
      sub: "Supplier invoices not yet paid.",
      columns: [
        { key: "invoice_number", label: "Invoice #" },
        { key: "supplier", label: "Supplier" },
        { key: "total_amount", label: "Amount", align: "right" },
        { key: "gst_amount", label: "GST", align: "right" },
        { key: "status", label: "Status" },
        { key: "created_at", label: "Date" },
      ],
      rows,
      fileName: "finance-outstanding-payables",
      summary: [
        { label: "Outstanding", value: money(sumBy(outstanding, "total_amount")), tone: "warning" },
      ],
      note: "All supplier invoices are paid — no outstanding payables.",
    };
  },
  async (ctx) => {
    const invoices = await fetchAll("invoices");
    const taxes = await fetchAll("taxes");
    const byMonth = new Map<string, { base: number; gst: number }>();
    for (const i of invoices) {
      const key = i.issue_date ? String(i.issue_date).slice(0, 7) : "—";
      const e = byMonth.get(key) ?? { base: 0, gst: 0 };
      e.base += Number(i.total_amount || 0) - Number(i.tax_amount || 0);
      e.gst += Number(i.tax_amount || 0);
      byMonth.set(key, e);
    }
    const filingRows = taxes.map((t) => ({
      period: t.period,
      tax_type: t.tax_type ?? "GST",
      amount: t.amount,
      status: t.filing_status ?? "—",
      filed_at: t.filed_at,
    }));
    const invoiceRows = [...byMonth.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([period, v]) => ({
        period,
        base: v.base,
        gst: v.gst,
        total: v.base + v.gst,
      }));
    const allRows = [
      ...invoiceRows,
      ...filingRows.map((f) => ({ period: String(f.period), base: "", gst: f.amount, total: "" })),
    ];
    const rows = invoiceRows.length
      ? invoiceRows
      : filingRows.map((f) => ({
          period: String(f.period),
          base: 0,
          gst: f.amount,
          total: f.amount,
        }));
    return {
      id: "fn-gst-summary",
      module: "finance",
      title: "GST Summary",
      sub: "GST collected on invoices, by month — downloadable as a formatted PDF statement.",
      columns: [
        { key: "period", label: "Period" },
        { key: "base", label: "Taxable Base", align: "right" },
        { key: "gst", label: "GST", align: "right" },
        { key: "total", label: "Total", align: "right" },
      ],
      rows,
      fileName: "finance-gst-summary",
      pdf: {
        title: "GST Summary Statement",
        sub: "FactoryOS AI Finance",
        meta: [
          ["Periods Covered", rows.map((r) => r.period).join(", ") || "—"],
          ["Total GST", money(sumBy(rows, "gst"))],
          ["Generated", new Date().toLocaleString()],
        ],
        footer: "FactoryOS AI — GST Summary",
      },
      summary: [
        { label: "Total GST", value: money(sumBy(rows, "gst")), tone: "primary" },
        { label: "Periods", value: num(rows.length), tone: "info" },
      ],
      note: "No invoice or filing data yet — GST summary will populate once invoices are issued.",
    };
  },
  async (ctx) => {
    const items = await fetchAll("sales_order_items");
    const rows = items.map((it) => ({
      product: ctx.lookups.products.get(it.product_id)?.name ?? "—",
      quantity: it.quantity,
      unit_price: it.unit_price,
      line_total: it.line_total ?? it.quantity * it.unit_price,
    }));
    return {
      id: "fn-revenue-by-product",
      module: "finance",
      title: "Revenue by Product",
      sub: "Revenue from customer order line items, grouped by product.",
      columns: [
        { key: "product", label: "Product" },
        { key: "quantity", label: "Qty", align: "right" },
        { key: "unit_price", label: "Unit Price", align: "right" },
        { key: "line_total", label: "Revenue", align: "right" },
      ],
      rows,
      fileName: "finance-revenue-by-product",
      summary: [
        { label: "Total Revenue", value: money(sumBy(rows, "line_total")), tone: "primary" },
      ],
    };
  },
  async (ctx) => {
    const payments = await fetchAll("payments");
    const rows = payments.map((p) => {
      const inv = p.invoice_id ? ctx.lookups.invoices.get(p.invoice_id) : null;
      const due = inv?.due_date ? new Date(inv.due_date).getTime() : null;
      const paid = p.paid_at ? new Date(p.paid_at).getTime() : null;
      const late =
        due != null && paid != null ? Math.max(0, Math.floor((paid - due) / 86_400_000)) : null;
      return {
        payment_number: p.payment_number,
        invoice: inv?.invoice_number ?? "—",
        amount: p.amount,
        method: p.method ?? "—",
        status: p.status,
        paid_at: p.paid_at,
        days_late: late,
      };
    });
    return {
      id: "fn-payment-timeliness",
      module: "finance",
      title: "Payment Timeliness",
      sub: "Payments received against invoice due dates — days late (0 = on time).",
      columns: [
        { key: "payment_number", label: "Payment #" },
        { key: "invoice", label: "Invoice" },
        { key: "amount", label: "Amount", align: "right" },
        { key: "method", label: "Method" },
        { key: "status", label: "Status" },
        { key: "paid_at", label: "Paid" },
        { key: "days_late", label: "Days Late", align: "right" },
      ],
      rows,
      fileName: "finance-payment-timeliness",
      summary: [{ label: "Payments", value: num(payments.length), tone: "primary" }],
    };
  },
];

/* ------------------------------------------------------------------ */
/* HR Manager — HR reports                                             */
/* ------------------------------------------------------------------ */

const hrBuilders: Builder[] = [
  async (ctx) => {
    const employees = await fetchAll("employees");
    const counts = countBy(employees, "department");
    const rows = counts.map((c) => ({ department: c.value, headcount: c.count }));
    return {
      id: "hr-headcount",
      module: "hr",
      title: "Headcount by Department",
      sub: "Employee directory grouped by department.",
      columns: [
        { key: "department", label: "Department" },
        { key: "headcount", label: "Headcount", align: "right" },
      ],
      rows,
      fileName: "hr-headcount-by-department",
      summary: [{ label: "Total Headcount", value: num(employees.length), tone: "primary" }],
    };
  },
  async (ctx) => {
    const attendance = await fetchAll("attendance");
    const employees = await fetchAll("employees");
    const rows = employees.map((e) => {
      const recs = attendance.filter((a) => a.employee_id === e.id);
      return {
        employee: e.full_name,
        department: e.department ?? "—",
        records: recs.length,
        present_days: recs.filter((r) => r.status === "present").length,
        hours_worked: sumBy(recs, "hours_worked"),
        avg_hours: recs.length ? avgBy(recs, "hours_worked").toFixed(1) : "—",
      };
    });
    return {
      id: "hr-attendance",
      module: "hr",
      title: "Attendance Summary",
      sub: "Attendance records, present days and hours per employee.",
      columns: [
        { key: "employee", label: "Employee" },
        { key: "department", label: "Department" },
        { key: "records", label: "Records", align: "right" },
        { key: "present_days", label: "Present Days", align: "right" },
        { key: "hours_worked", label: "Hours", align: "right" },
        { key: "avg_hours", label: "Avg / Day", align: "right" },
      ],
      rows,
      fileName: "hr-attendance-summary",
      summary: [
        { label: "Employees", value: num(employees.length), tone: "primary" },
        { label: "Attendance Records", value: num(attendance.length), tone: "info" },
      ],
    };
  },
  async () => {
    const payroll = await fetchAll("payroll");
    const rows = [...new Set(payroll.map((p) => p.period))].sort().map((period) => {
      const recs = payroll.filter((p) => p.period === period);
      return {
        period,
        employees: recs.length,
        gross: sumBy(recs, "gross_amount"),
        deductions: sumBy(recs, "deductions"),
        net: sumBy(recs, "net_amount"),
      };
    });
    return {
      id: "hr-payroll",
      module: "hr",
      title: "Payroll Summary",
      sub: "Gross, deductions and net pay by payroll period.",
      columns: [
        { key: "period", label: "Period" },
        { key: "employees", label: "Employees", align: "right" },
        { key: "gross", label: "Gross", align: "right" },
        { key: "deductions", label: "Deductions", align: "right" },
        { key: "net", label: "Net", align: "right" },
      ],
      rows,
      fileName: "hr-payroll-summary",
      summary: [
        { label: "Net Paid", value: money(sumBy(rows, "net")), tone: "primary" },
        { label: "Periods", value: num(rows.length), tone: "info" },
      ],
    };
  },
  async (ctx) => {
    const leaves = await fetchAll("leaves");
    const rows = leaves.map((l) => ({
      employee: ctx.lookups.employees.get(l.employee_id)?.full_name ?? "—",
      leave_type: l.leave_type ?? "—",
      status: l.status,
      start_date: l.start_date,
      end_date: l.end_date,
      reason: l.reason ?? "—",
    }));
    return {
      id: "hr-leaves",
      module: "hr",
      title: "Leave Balance Overview",
      sub: "Leave requests and their current status.",
      columns: [
        { key: "employee", label: "Employee" },
        { key: "leave_type", label: "Type" },
        { key: "status", label: "Status" },
        { key: "start_date", label: "Start" },
        { key: "end_date", label: "End" },
        { key: "reason", label: "Reason" },
      ],
      rows,
      fileName: "hr-leaves-overview",
      summary: [{ label: "Leave Requests", value: num(leaves.length), tone: "primary" }],
      note: "No leave requests recorded yet.",
    };
  },
];

/* ------------------------------------------------------------------ */
/* Production Operator — personal reports                              */
/* ------------------------------------------------------------------ */

const operatorBuilders: Builder[] = [
  async (ctx) => {
    const wos = await fetchAll("work_orders");
    const mine = wos.filter((w) => w.operator_id === ctx.userId && w.status === "completed");
    const rows = mine.map((w) => ({
      wo_number: w.wo_number,
      operation: w.operation ?? "—",
      status: w.status,
      quantity: w.quantity,
      progress_percent: w.progress_percent ?? 0,
      start_time: w.start_time,
      end_time: w.end_time,
    }));
    return {
      id: "op-my-work-orders",
      module: "production",
      title: "My Completed Work Orders",
      sub: "Work orders assigned to you, with your progress on each.",
      columns: [
        { key: "wo_number", label: "Work Order" },
        { key: "operation", label: "Operation" },
        { key: "status", label: "Status" },
        { key: "quantity", label: "Qty", align: "right" },
        { key: "progress_percent", label: "Progress", align: "right" },
        { key: "start_time", label: "Started" },
        { key: "end_time", label: "Ended" },
      ],
      rows,
      fileName: "operator-my-work-orders",
      summary: [{ label: "Completed", value: num(mine.length), tone: "success" }],
      note: "No work orders assigned to you yet.",
    };
  },
  async (ctx) => {
    const attendance = await fetchAll("attendance");
    const mine = attendance.filter((a) => a.employee_id === ctx.userId);
    const rows = mine.map((a) => ({
      date: a.date,
      status: a.status,
      check_in: a.check_in,
      check_out: a.check_out,
      hours_worked: a.hours_worked,
    }));
    return {
      id: "op-my-attendance",
      module: "hr",
      title: "My Attendance",
      sub: "Your attendance records — individual scope only.",
      columns: [
        { key: "date", label: "Date" },
        { key: "status", label: "Status" },
        { key: "check_in", label: "Check In" },
        { key: "check_out", label: "Check Out" },
        { key: "hours_worked", label: "Hours", align: "right" },
      ],
      rows,
      fileName: "operator-my-attendance",
      summary: [
        { label: "Records", value: num(mine.length), tone: "primary" },
        { label: "Hours Logged", value: num(sumBy(mine, "hours_worked")), tone: "info" },
      ],
      note: "No attendance records found for your account.",
    };
  },
  async (ctx) => {
    const tasks = await fetchAll("work_orders");
    const mine = tasks.filter((t) => t.operator_id === ctx.userId && t.status === "completed");
    const rows = mine.map((t) => ({
      title: t.title,
      status: t.status,
      priority: t.priority ?? "—",
      due_date: t.due_date,
      created_at: t.created_at,
    }));
    return {
      id: "op-task-turnaround",
      module: "production",
      title: "My Task Turnaround Time",
      sub: "Completed work orders assigned to you; timing is derived from their recorded start and end times.",
      columns: [
        { key: "title", label: "Task" },
        { key: "status", label: "Status" },
        { key: "priority", label: "Priority" },
        { key: "due_date", label: "Due" },
        { key: "created_at", label: "Created" },
      ],
      rows,
      fileName: "operator-task-turnaround",
      summary: [
        { label: "My Tasks", value: num(mine.length), tone: "primary" },
        {
          label: "Completed",
          value: num(mine.filter((t) => ["completed", "done"].includes(t.status)).length),
          tone: "success",
        },
      ],
      note: "No tasks assigned to you yet.",
    };
  },
];

/* ------------------------------------------------------------------ */
/* Customer Portal — personal order reports                            */
/* ------------------------------------------------------------------ */

const customerBuilders: Builder[] = [
  async (ctx) => {
    const orders = await fetchAll("sales_orders");
    const items = await fetchAll("sales_order_items");
    const products = orderProducts(orders, items, ctx.lookups);
    const rows = orders.map((o) => ({
      so_number: o.so_number,
      product: products.get(o.id),
      status: o.status,
      total_amount: o.total_amount,
      order_date: o.order_date,
      due_date: o.due_date,
      progress: o.progress ?? 0,
    }));
    return {
      id: "customer-my-orders",
      module: "customer",
      title: "My Orders",
      sub: "Every order you have placed with this company, with its current status.",
      columns: [
        { key: "so_number", label: "Order #" },
        { key: "product", label: "Product" },
        { key: "status", label: "Status" },
        { key: "total_amount", label: "Order Value", align: "right" },
        { key: "order_date", label: "Placed" },
        { key: "due_date", label: "Expected" },
        { key: "progress", label: "Progress", align: "right" },
      ],
      rows,
      fileName: "customer-my-orders",
      summary: [
        { label: "Total Orders", value: num(orders.length), tone: "primary" },
        {
          label: "Active",
          value: num(
            orders.filter((o) => !["delivered", "completed", "rejected"].includes(o.status)).length,
          ),
          tone: "info",
        },
        {
          label: "Delivered",
          value: num(orders.filter((o) => o.status === "delivered").length),
          tone: "success",
        },
      ],
    };
  },
  async () => {
    const orders = await fetchAll("sales_orders");
    const payments = await fetchAll("payments");
    const paid = sumBy(payments, "amount");
    const total = sumBy(orders, "total_amount");
    const rows = orders.map((o) => ({
      so_number: o.so_number,
      order_total: o.total_amount,
      status: o.status,
    }));
    return {
      id: "customer-spending",
      module: "customer",
      title: "My Spending Summary",
      sub: "Lifetime spend with this company versus what you have paid.",
      columns: [
        { key: "so_number", label: "Order #" },
        { key: "order_total", label: "Order Value", align: "right" },
        { key: "status", label: "Status" },
      ],
      rows,
      fileName: "customer-spending-summary",
      summary: [
        { label: "Total Ordered", value: money(total), tone: "primary" },
        { label: "Paid", value: money(paid), tone: "success" },
        { label: "Balance Due", value: money(Math.max(0, total - paid)), tone: "warning" },
      ],
    };
  },
  async (ctx) => {
    const payments = await fetchAll("payments");
    const rows = payments.map((p) => ({
      payment_number: p.payment_number,
      invoice: p.invoice_id ? (ctx.lookups.invoices.get(p.invoice_id)?.invoice_number ?? "—") : "—",
      amount: p.amount,
      method: p.method ?? "—",
      status: p.status,
      paid_at: p.paid_at,
      reference: p.reference ?? "—",
    }));
    return {
      id: "customer-payments",
      module: "customer",
      title: "My Payment History",
      sub: "Every payment you have made, with transaction details.",
      columns: [
        { key: "payment_number", label: "Payment #" },
        { key: "invoice", label: "Invoice" },
        { key: "amount", label: "Amount", align: "right" },
        { key: "method", label: "Method" },
        { key: "status", label: "Status" },
        { key: "paid_at", label: "Paid" },
        { key: "reference", label: "Reference" },
      ],
      rows,
      fileName: "customer-payment-history",
      summary: [{ label: "Payments", value: num(payments.length), tone: "primary" }],
    };
  },
  async (ctx) => {
    const shipments = await fetchAll("shipments");
    const rows = shipments.map((s) => ({
      shipment_number: s.shipment_number,
      carrier: s.carrier ?? "—",
      tracking_number: s.tracking_number ?? "—",
      status: s.status,
      shipped_date: s.shipped_date,
      delivered_date: s.delivered_date,
      destination: s.destination ?? "—",
    }));
    return {
      id: "customer-deliveries",
      module: "customer",
      title: "My Delivery Timeliness",
      sub: "Your shipments and how quickly they were delivered.",
      columns: [
        { key: "shipment_number", label: "Shipment #" },
        { key: "carrier", label: "Carrier" },
        { key: "tracking_number", label: "Tracking" },
        { key: "status", label: "Status" },
        { key: "shipped_date", label: "Shipped" },
        { key: "delivered_date", label: "Delivered" },
        { key: "destination", label: "Destination" },
      ],
      rows,
      fileName: "customer-delivery-timeliness",
      summary: [
        { label: "Shipments", value: num(shipments.length), tone: "primary" },
        {
          label: "Delivered",
          value: num(shipments.filter((s) => s.status === "delivered").length),
          tone: "success",
        },
      ],
    };
  },
];

/* ------------------------------------------------------------------ */
/* Supplier Portal — personal business reports                         */
/* ------------------------------------------------------------------ */

const supplierBuilders: Builder[] = [
  async (ctx) => {
    const pos = await fetchAll("purchase_orders");
    const counts = countBy(pos, "status");
    const rows = counts.map((c) => ({
      status: c.value,
      count: c.count,
      value: sumBy(
        pos.filter((p) => p.status === c.value),
        "total_amount",
      ),
    }));
    return {
      id: "supplier-my-pos",
      module: "supplier",
      title: "POs Received / Accepted / Rejected",
      sub: "Purchase orders sent to you by this company, by status.",
      columns: [
        { key: "status", label: "Status" },
        { key: "count", label: "POs", align: "right" },
        { key: "value", label: "Value", align: "right" },
      ],
      rows,
      fileName: "supplier-pos",
      summary: [
        { label: "Total POs", value: num(pos.length), tone: "primary" },
        {
          label: "Accepted",
          value: num(pos.filter((p) => p.status === "accepted").length),
          tone: "success",
        },
        {
          label: "Awaiting Dispatch",
          value: num(pos.filter((p) => p.status === "dispatched").length),
          tone: "info",
        },
      ],
    };
  },
  async (ctx) => {
    const deliveries = await fetchAll("supplier_deliveries");
    const rows = deliveries.map((d) => ({
      po_number: d.po_id ? (ctx.lookups.purchaseOrders.get(d.po_id)?.po_number ?? "—") : "—",
      dispatch_date: d.dispatch_date,
      carrier: d.carrier ?? "—",
      vehicle_number: d.vehicle_number ?? "—",
      expected_arrival: d.expected_arrival,
      tracking_number: d.tracking_number ?? "—",
      status: d.status,
    }));
    return {
      id: "supplier-deliveries",
      module: "supplier",
      title: "My Delivery Timeliness",
      sub: "Deliveries you have dispatched, with expected arrival.",
      columns: [
        { key: "po_number", label: "PO" },
        { key: "dispatch_date", label: "Dispatched" },
        { key: "carrier", label: "Carrier" },
        { key: "vehicle_number", label: "Vehicle" },
        { key: "expected_arrival", label: "Expected" },
        { key: "tracking_number", label: "Tracking" },
        { key: "status", label: "Status" },
      ],
      rows,
      fileName: "supplier-delivery-timeliness",
      summary: [
        { label: "Deliveries", value: num(deliveries.length), tone: "primary" },
        {
          label: "Received",
          value: num(deliveries.filter((d) => d.status === "received").length),
          tone: "success",
        },
      ],
    };
  },
  async (ctx) => {
    const invs = await fetchAll("supplier_invoices");
    const pays = await fetchAll("supplier_payments");
    const rows = invs.map((i) => ({
      invoice_number: i.invoice_number,
      total_amount: i.total_amount,
      gst_amount: i.gst_amount ?? 0,
      status: i.status,
      paid: pays.filter((p) => p.invoice_id === i.id).length
        ? pays.filter((p) => p.invoice_id === i.id)[0].amount
        : 0,
      created_at: i.created_at,
    }));
    return {
      id: "supplier-invoices-payments",
      module: "supplier",
      title: "My Invoices & Payments",
      sub: "Invoices you have raised and payments received from this company.",
      columns: [
        { key: "invoice_number", label: "Invoice #" },
        { key: "total_amount", label: "Amount", align: "right" },
        { key: "gst_amount", label: "GST", align: "right" },
        { key: "paid", label: "Paid", align: "right" },
        { key: "status", label: "Status" },
        { key: "created_at", label: "Date" },
      ],
      rows,
      fileName: "supplier-invoices-payments",
      summary: [
        { label: "Invoices", value: num(invs.length), tone: "primary" },
        { label: "Payments Received", value: money(sumBy(pays, "amount")), tone: "success" },
      ],
    };
  },
];

/* ------------------------------------------------------------------ */
/* Role registry                                                       */
/* ------------------------------------------------------------------ */

const REPORT_BUILDERS: Partial<Record<AppRole, Builder[]>> = {
  root_super_admin: rootBuilders,
  company_admin: companyAdminBuilders,
  plant_admin: plantBuilders,
  plant_manager: plantBuilders,
  production_manager: productionManagerBuilders,
  warehouse_manager: warehouseBuilders,
  procurement_manager: procurementBuilders,
  quality_inspector: qualityBuilders,
  maintenance_engineer: maintenanceBuilders,
  finance_manager: financeBuilders,
  hr_manager: hrBuilders,
  production_operator: operatorBuilders,
  customer_portal: customerBuilders,
  supplier_portal: supplierBuilders,
};

const MODULE_TITLES: Record<string, string> = {
  production: "Production Reports",
  quality: "Quality Reports",
  maintenance: "Maintenance Reports",
  finance: "Finance Reports",
  hr: "HR Reports",
  warehouse: "Warehouse Reports",
  procurement: "Procurement Reports",
  plant: "Plant Reports",
  customer: "My Reports",
  supplier: "My Reports",
  platform: "Platform Reports",
};

const MODULE_SCOPE: Record<string, string> = {
  production: "Production activity for your company.",
  quality: "Quality inspections, defects and certificates.",
  maintenance: "Machine health and maintenance activity.",
  finance: "Invoices, payments, receivables, payables and GST.",
  hr: "Headcount, attendance, payroll and leave.",
  warehouse: "Stock levels, movements, GRNs and dispatch.",
  procurement: "Requisitions, purchase orders and supplier performance.",
  plant: "Plant-level output, attendance, machines and stock.",
};

/* ------------------------------------------------------------------ */
/* Presentation                                                        */
/* ------------------------------------------------------------------ */

function cellValue(
  r: Row,
  c: Column,
): { text: string; kind: "status" | "date" | "money" | "num" | "pct" | "text" } {
  const v = r[c.key];
  const key = c.key;
  if (key === "overdue") {
    return { text: v ? "Yes" : "No", kind: "text" };
  }
  if (key === "status" || key.endsWith("_status") || key === "result") {
    return { text: String(v ?? "—"), kind: "status" };
  }
  if (key.includes("date") || key.endsWith("_at") || key.includes("time")) {
    return { text: fmtDate(v), kind: "date" };
  }
  if (typeof v === "number") {
    if (
      key === "progress" ||
      key === "progress_percent" ||
      key === "utilization" ||
      key === "rating" ||
      key === "avg_hours" ||
      key === "mttr_hours"
    ) {
      return {
        text: `${Number(v).toLocaleString("en-IN")}${key.includes("percent") || key === "utilization" || key === "progress" ? "%" : ""}`,
        kind: "num",
      };
    }
    if (
      key.includes("amount") ||
      key.includes("total") ||
      key.includes("value") ||
      key.includes("price") ||
      key.includes("cost") ||
      key === "spend" ||
      key === "base" ||
      key === "gst" ||
      key === "net" ||
      key === "gross" ||
      key === "deductions" ||
      key === "line_total"
    ) {
      return { text: money(v), kind: "money" };
    }
    return { text: Number(v).toLocaleString("en-IN"), kind: "num" };
  }
  return { text: String(v ?? "—"), kind: "text" };
}

function SectionTable({ section }: { section: ReportSection }) {
  const { columns, rows } = section;
  const visible = rows.slice(0, 250);
  if (!rows.length) {
    return (
      <div className="py-8 text-center">
        <div className="mx-auto h-8 w-8 rounded-lg bg-muted grid place-items-center mb-2">
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="text-sm text-muted-foreground">
          {section.note ?? "No data recorded yet — this report will populate from live activity."}
        </div>
      </div>
    );
  }
  return (
    <>
      <div className="overflow-x-auto -mx-2 px-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/60">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`px-2 py-2 font-medium ${c.align === "right" ? "text-right" : ""}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => (
              <tr key={i} className="border-b border-border/40 hover:bg-muted/30">
                {columns.map((c) => {
                  const cell = cellValue(r, c);
                  return (
                    <td
                      key={c.key}
                      className={`px-2 py-2 text-xs whitespace-nowrap ${c.align === "right" ? "text-right tabular-nums" : ""}`}
                    >
                      {cell.kind === "status" ? (
                        <StatusBadge status={cell.text} />
                      ) : (
                        <span
                          className={
                            cell.kind === "money" || cell.kind === "num"
                              ? "tabular-nums"
                              : undefined
                          }
                        >
                          {cell.text}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 250 && (
        <div className="text-[11px] text-muted-foreground text-center py-3">
          Showing first 250 of {rows.length} rows — the full dataset is included in the download.
        </div>
      )}
    </>
  );
}

function downloadSection(section: ReportSection) {
  if (section.pdf) {
    downloadPdf(section.fileName, {
      title: section.pdf.title,
      sub: section.pdf.sub,
      meta: section.pdf.meta,
      footer: section.pdf.footer,
      columns: section.columns.map((c) => c.label),
      rows: section.rows.map((r) =>
        section.columns.map((c) => {
          const cell = cellValue(r, c);
          return cell.text;
        }),
      ),
    });
    toast.success(`Downloaded ${section.fileName}-${new Date().toISOString().slice(0, 10)}.pdf`);
  } else {
    downloadCsv(section.fileName, section.columns, section.rows);
    toast.success(
      `Downloaded ${section.fileName}-${new Date().toISOString().slice(0, 10)}.csv (${section.rows.length} rows)`,
    );
  }
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function RoleReports({ module }: { module?: string }) {
  const { user, roles } = useAuth();
  const role = useMemo(() => primaryRole(roles) ?? "company_admin", [roles]);
  const roleLabel = ROLE_MAP[role]?.label ?? "Company";
  const builders = REPORT_BUILDERS[role] ?? [];

  const {
    data: sections,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["role-reports", role, module ?? "all", user?.id],
    queryFn: async () => {
      const lookups =
        role === "production_operator"
          ? {
              products: new Map(),
              materials: new Map(),
              warehouses: new Map(),
              customers: new Map(),
              suppliers: new Map(),
              employees: new Map(),
              departments: new Map(),
              profiles: new Map(),
              invoices: new Map(),
              purchaseOrders: new Map(),
            }
          : await fetchLookups();
      const ctx: ReportCtx = { userId: user?.id ?? "", lookups };
      const all = await Promise.all(builders.map((b) => b(ctx)));
      return module ? all.filter((s) => s.module === module) : all;
    },
  });

  const title = module ? (MODULE_TITLES[module] ?? "Reports") : `${roleLabel} Reports`;
  const sub = module
    ? (MODULE_SCOPE[module] ?? "Live reports for this module.")
    : `Live reports scoped to your ${roleLabel.toLowerCase()} access — every number is computed from the real database through row-level security.`;

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName={module ?? "reports"} />
      <PageHeader
        eyebrow="Reporting"
        title={title}
        sub={sub}
        actions={<ModuleCopilot moduleName={module ?? "reports"} />}
      />

      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass rounded-2xl p-5 min-h-[180px] animate-pulse">
              <div className="h-4 w-40 bg-muted rounded" />
              <div className="mt-4 h-3 w-full bg-muted/60 rounded" />
              <div className="mt-2 h-3 w-3/4 bg-muted/60 rounded" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <EmptyState
          title="Could not load reports"
          sub="The report query was rejected — check your access, or refresh to retry."
        />
      )}

      {sections && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sections.map((s) => (
            <Panel
              key={s.id}
              title={s.title}
              right={
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => downloadSection(s)}
                >
                  {s.pdf ? (
                    <FileText className="h-3.5 w-3.5 mr-1.5" />
                  ) : (
                    <Table2 className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Download {s.pdf ? "PDF" : "CSV"}
                </Button>
              }
            >
              {s.summary && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  {s.summary.map((k) => (
                    <div
                      key={k.label}
                      className="rounded-xl border border-border/50 bg-card/50 p-3"
                    >
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {k.label}
                      </div>
                      <div className="mt-1 text-lg font-semibold tabular-nums">{k.value}</div>
                    </div>
                  ))}
                </div>
              )}
              {s.sub && <p className="text-xs text-muted-foreground mb-3 -mt-1">{s.sub}</p>}
              <SectionTable section={s} />
            </Panel>
          ))}
        </div>
      )}

      {sections && !sections.length && !isLoading && (
        <EmptyState
          title="No reports configured for this view"
          sub="Your role doesn't have report sections for this page yet."
        />
      )}

      {sections && (
        <div className="mt-6 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ScrollText className="h-3.5 w-3.5" />
            Every figure is computed live from the database through RLS — exports match exactly what
            is shown on screen.
          </span>
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-7 text-xs">
            Refresh
          </Button>
        </div>
      )}
    </div>
  );
}
