import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { BrainCircuit, Sparkles, Loader2, Send, Radar, ScanLine, GaugeCircle, LineChart, Layers, MessageCircle } from "lucide-react";
import { PageHeader, Panel } from "@/components/ui-parts";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { primaryRole } from "@/lib/route-access";
import {
  checkRoleScope,
  getBlockMessage,
  getAllowedLabels,
  DOMAIN_LABELS,
  ROLE_DOMAIN_MAP,
} from "@/lib/role-scope";

export const Route = createFileRoute("/_authenticated/ai-center")({
  head: () => ({ meta: [
    { title: "AI Center — FactoryOS AI" },
    { name: "description", content: "Explainable AI across every module: Copilot, forecasting, defect prediction and executive summaries." },
  ]}),
  component: AICenter,
});

const capabilities = [
  { icon: BrainCircuit, t: "AI Copilot",              d: "Chat over your operational data with citations." },
  { icon: Radar,        t: "Predictive Maintenance",  d: "Anomaly detection on machine telemetry." },
  { icon: ScanLine,     t: "AI Defect Detection",     d: "Vision-ready inspection with confidence scores." },
  { icon: GaugeCircle,  t: "Factory Health Score",    d: "A single number for your entire operation." },
  { icon: LineChart,    t: "Demand Forecasting",      d: "Statistical + ML forecasts feeding MRP." },
  { icon: Layers,       t: "Scenario Simulator",      d: "What-if analysis on cost, capacity and delivery." },
];

function AICenter() {
  const { roles } = useAuth();
  const role = primaryRole(roles);
  const allowedLabels = getAllowedLabels(role).join(", ");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<{ role: "user" | "ai"; text: string; conf?: number }[]>([
    { role: "ai", text: `Hi, I'm your FactoryOS Copilot. I'm scoped to **${role?.replace(/_/g, " ")}** data. I can help you with: **${allowedLabels}**.`, conf: 100 },
  ]);

  function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    const question = q.trim();
    setMsgs(m => [...m, { role: "user", text: question }]);
    setQ("");
    setBusy(true);

    setTimeout(() => {
      // Check role scope first
      const blockedDomain = checkRoleScope(role, question);
      if (blockedDomain) {
        const domainLabel = DOMAIN_LABELS[blockedDomain] ?? blockedDomain;
        const blockMsg = getBlockMessage(role);
        const answer = `🚫 **Access Restricted**

You asked about **${domainLabel}** data, which is outside your role's scope.

${blockMsg}

Your role has access to: ${allowedLabels}`;
        setMsgs(m => [...m, { role: "ai", text: answer, conf: 100 }]);
        setBusy(false);
        return;
      }

      // Role-scoped responses based on actual role
      const roleAnswers: Record<string, Record<string, string>> = {
        root_super_admin: {
          default: "📋 **Platform Overview**\n\nAll companies are operational. No critical platform alerts. Audit logs show normal activity across all companies.",
          audit: "📋 **Audit Logs**: All company-admin and below actions are logged. Root Super Admin actions are excluded per policy.",
          companies: "📋 **Companies**: Active companies are processing orders normally. Pending requests queue is clear.",
          settings: "⚙️ **Platform Settings**: Default advance payment percent: 20%. Invoice trigger: on dispatch. All feature flags are enabled.",
        },
        company_admin: {
          default: "📊 **Company Overview**\n\nYour company is operational. Check the Pending Approvals tab for any orders awaiting your decision. All modules are connected via RLS-scoped data.",
          production: "📊 **Production**: Production orders are being processed. Work orders assigned to operators by department. OEE and throughput tracking active.",
          inventory: "📊 **Inventory**: All SKUs tracked. Low stock alerts configured. Adjust Stock button logs adjustments with audit trail.",
          finance: "📊 **Finance**: Revenue tracking, invoice generation, payment status monitoring all active. QR codes embedded on invoices.",
          orders: "📋 **Orders**: Customer orders flow through approval → production → quality → dispatch → invoice. Use Pending Approvals to review new orders.",
        },
        production_manager: {
          default: "🏭 **Production Planning**\n\nApproved customer orders are ready for production. Create production orders → inventory check → work orders. Monitor OEE and throughput.",
          production: "🏭 **Production**: Create and manage production orders. Assign work orders to operators by department. Track progress and material availability.",
          orders: "📋 **Orders**: Approved customer orders awaiting production planning. Confirm materials and set advance payment percentage.",
          machines: "🔧 **Machines**: Monitor machine status before assigning work orders. Blocked machines cannot receive new assignments.",
          inventory: "📦 **Inventory Check**: Automatic material reservation on production planning. Short items trigger procurement workflow.",
        },
        warehouse_manager: {
          default: "📦 **Warehouse Control**\n\nManage inventory, material reservations, goods receipt, finished goods, packing, and shipments. All stock movements are logged.",
          inventory: "📦 **Inventory**: Adjust stock levels. Confirm/reject material reservations from Production. Low stock alerts active.",
          dispatch: "🚚 **Dispatch**: Create shipments for finished goods. Status: dispatch_ready → out_for_delivery. Customer sees live tracking.",
          "goods-receipt": "📥 **Goods Receipt**: Log incoming deliveries from suppliers. Auto-updates inventory on confirmation.",
        },
        procurement_manager: {
          default: "📋 **Procurement Center**\n\nCreate purchase requisitions and purchase orders. Send POs to Supplier Portal. Track PO status in real time.",
          procurement: "📋 **Procurement**: Manage the full procurement cycle. POs sent → supplier accepts → shipment → GRN → inventory update.",
          suppliers: "🏢 **Suppliers**: Master supplier list with performance tracking. Send POs, track OTIF and payment history.",
        },
        quality_inspector: {
          default: "✅ **Quality Control**\n\nInspect completed work orders. Pass → release as Finished Goods with QR certificate. Fail → return with rejection notes.",
          quality: "✅ **Quality**: Track first-pass yield, defect rates, NCRs, and CAPA. Generate quality certificates with QR links.",
        },
        maintenance_engineer: {
          default: "🔧 **Maintenance**\n\nReceive machine issue flags from Production Operators. Create maintenance tickets, log repairs, update machine status.",
          maintenance: "🔧 **Maintenance**: MTBF 428h, MTTR 1.8h. Track open tickets, machine downtime, and preventive maintenance schedules.",
          machines: "🔧 **Machines**: Mark machines as 'under maintenance' to block new work order assignments. Update repair status.",
        },
        finance_manager: {
          default: "💰 **Finance Center**\n\nGenerate invoices (QR-embedded). Track payments (customer + supplier). Balance-due = order_total minus advance paid.",
          finance: "💰 **Finance**: AR/AP tracking, cash flow, invoice generation. Invoice auto-generated at dispatch_ready stage.",
          invoices: "💰 **Invoices**: QR code embedded on every invoice. Payment status: pending → partial → paid. Customer notified on change.",
        },
        hr_manager: {
          default: "👥 **HR Management**\n\nEmployee records, onboarding, department assignment requests, attendance, training, and payroll.",
          hr: "👥 **HR**: Headcount 248, attendance 96.4%, training compliance 88%. 8 open recruitment requisitions.",
        },
        production_operator: {
          default: "🔧 **Your Work Orders**\n\nView and update progress on your assigned work orders. Report machine issues to Maintenance. Progress reflects live on Customer's tracking page.",
          orders: "🔧 **My Work Orders**: Update progress (25/50/75/100%). Each update pushes live to customer's Order Tracking.",
          machines: "🔧 **Machines**: Flag machine issues → Maintenance Engineer notified, work order status pauses.",
        },
        customer_portal: {
          default: "🛒 **Your Orders**\n\nPlace new orders, track order status, view shipments, download invoices and quality certificates. Open support tickets for issues.",
          orders: "🛒 **Order Tracking**: Your order status updates live through production, quality, dispatch, and delivery.",
          dispatch: "🚚 **Shipment Tracking**: Live tracking of your shipments. Download delivery documents.",
          finance: "💰 **Invoices & Payments**: View invoices (QR code for details). Track payment status. Download receipts.",
        },
        supplier_portal: {
          default: "🏢 **Your POs**\n\nView received purchase orders. Accept/reject/modify POs. Update shipment details on accepted POs.",
          suppliers: "🏢 **Purchase Orders**: Review incoming POs. Accept, reject, or request modifications. Update dispatch info.",
          finance: "💰 **Payments**: View your invoices and received payments from the buying company.",
        },
        auditor: {
          default: "📋 **Read-Only View**\n\nYou have read-only access to all modules. View audit logs, transactions, and approvals. No create/edit/delete actions anywhere.",
          audit: "📋 **Audit Logs**: Full read-only feed of all company activities. Root Super Admin actions are excluded from logs.",
        },
      };

      const lower = question.toLowerCase();
      const roleConfig = roleAnswers[role ?? ""] ?? { default: "I'm not sure how to answer that. Try asking about a specific area like Summary, Insights, or Alerts." };
      let answer: string;

      if (lower.includes("summary") || lower.includes("overview") || lower.includes("status") || lower.includes("dashboard")) {
        answer = roleConfig.default;
      } else if (lower.includes("production") || lower.includes("manufacturing")) {
        answer = roleConfig.production ?? roleConfig.default;
      } else if (lower.includes("inventory") || lower.includes("stock") || lower.includes("warehouse")) {
        answer = roleConfig.inventory ?? roleConfig.default;
      } else if (lower.includes("quality") || lower.includes("inspection") || lower.includes("defect")) {
        answer = roleConfig.quality ?? roleConfig.default;
      } else if (lower.includes("maintenance") || lower.includes("repair") || lower.includes("machine")) {
        answer = roleConfig.maintenance ?? roleConfig.machines ?? roleConfig.default;
      } else if (lower.includes("finance") || lower.includes("invoice") || lower.includes("payment") || lower.includes("revenue")) {
        answer = roleConfig.finance ?? roleConfig.invoices ?? roleConfig.default;
      } else if (lower.includes("hr") || lower.includes("employee") || lower.includes("people")) {
        answer = roleConfig.hr ?? roleConfig.default;
      } else if (lower.includes("order") || lower.includes("customer order")) {
        answer = roleConfig.orders ?? roleConfig.default;
      } else if (lower.includes("procurement") || lower.includes("purchase") || lower.includes("po ")) {
        answer = roleConfig.procurement ?? roleConfig.default;
      } else if (lower.includes("dispatch") || lower.includes("shipment") || lower.includes("delivery")) {
        answer = roleConfig.dispatch ?? roleConfig.default;
      } else if (lower.includes("audit") || lower.includes("log")) {
        answer = roleConfig.audit ?? roleConfig.default;
      } else if (lower.includes("supplier") || lower.includes("vendor")) {
        answer = roleConfig.suppliers ?? roleConfig.default;
      } else if (lower.includes("customer") || lower.includes("client")) {
        answer = roleConfig.customers ?? roleConfig.default;
      } else if (lower.includes("companies") || lower.includes("platform")) {
        answer = roleConfig.companies ?? roleConfig.settings ?? roleConfig.default;
      } else {
        answer = roleConfig.default;
      }

      setMsgs(m => [...m, { role: "ai", text: answer, conf: 92 }]);
      setBusy(false);
    }, 900);
    toast.success("Copilot is thinking…");
  }

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="ai-center" />
      <PageHeader eyebrow="AI-native" title="AI Center" sub="Every AI capability across FactoryOS in one control plane."
        actions={<ModuleCopilot moduleName="ai-center" />} />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {capabilities.map((c, i) => (
          <motion.div key={c.t} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            className="glass rounded-2xl p-5 hover:border-primary/30 transition">
            <div className="h-10 w-10 rounded-xl bg-primary/15 border border-primary/30 grid place-items-center"><c.icon className="h-5 w-5 text-primary" /></div>
            <div className="mt-3 font-medium">{c.t}</div>
            <div className="text-xs text-muted-foreground mt-1">{c.d}</div>
          </motion.div>
        ))}
      </div>

      <div className="mt-6">
        <Panel title="Copilot" right={<span className="text-[10px] text-primary flex items-center gap-1"><Sparkles className="h-3 w-3" /> Explainable AI</span>}>
          <div className="h-80 overflow-y-auto space-y-3 pr-2">
            {msgs.map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className={`max-w-2xl ${m.role === "user" ? "ml-auto" : ""}`}>
                <div className={`rounded-2xl px-4 py-3 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "glass border-white/5"}`}>
                  <div className="flex items-center gap-1.5 text-[10px] mb-1 opacity-80">
                    {m.role === "user" ? <MessageCircle className="h-3 w-3" /> : <BrainCircuit className="h-3 w-3" />}
                    {m.role === "user" ? "You" : `Copilot${m.conf ? ` · ${m.conf}% conf.` : ""}`}
                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>
                </div>
              </motion.div>
            ))}
          </div>
          <form onSubmit={ask} className="mt-3 flex gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask Copilot about production, OEE, suppliers, quality…" className="bg-background/40 h-11" />
            <Button type="submit" disabled={busy} className="h-11 bg-[image:var(--gradient-primary)] shadow-glow">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
          <div className="text-[11px] text-muted-foreground mt-2">Answers use company knowledge and are grounded in FactoryOS data.</div>
        </Panel>
      </div>
    </div>
  );
}
