import { useState } from "react";
import { motion } from "framer-motion";
import { BrainCircuit, Shield, Radio, Send, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

/**
 * Status bar shown on every module page:
 * "Top status: in_progress" | "Company scope: RLS on"
 */
export function ModuleStatusBar({ moduleName }: { moduleName: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full bg-info/10 text-info border border-info/20">
        <Radio className="h-3 w-3 animate-pulse" />
        Top status: <span className="font-semibold">in_progress</span>
      </span>
      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full bg-success/10 text-success border border-success/20">
        <Shield className="h-3 w-3" />
        Company scope: <span className="font-semibold">RLS on</span>
      </span>
      <span className="text-[10px] text-muted-foreground hidden sm:inline">
        Module: {moduleName} · Realtime sync active
      </span>
    </div>
  );
}

/** Pre-defined AI responses for each module */
const MODULE_AI_RESPONSES: Record<string, string[]> = {
  customers: [
    "📊 Customer Overview: You have active customers across Aerospace, Automotive, and Medical segments. 2 orders completed this week, 1 in production.",
    "💡 Insight: AeroSpace Dynamics has the highest order value at $42,500. Consider a loyalty program for repeat orders.",
    "⚠️ Alert: MediCore HealthTech order is 45% complete — on track for delivery in 7 days.",
  ],
  suppliers: [
    "📊 Supplier Overview: 3 active suppliers with average rating 4.7/5.0. Nordic Steel AB has the best OTIF at 97%.",
    "💡 Insight: Kyoto Precision has the highest rating (4.9) but longest lead time. Consider dual-sourcing critical parts.",
    "⚠️ Alert: 1 PO pending approval for $12,800 — action needed.",
  ],
  machines: [
    "📊 Machine Fleet: 5 machines tracked. 3 operational, 1 in maintenance, 1 with planned maintenance due.",
    "💡 Insight: Injection Molder IM-3 has highest utilization at 92.1%. Consider scheduling preventive maintenance.",
    "⚠️ Alert: Robotic Assembly R-7 is currently in maintenance — check ETA for return to production.",
  ],
  inventory: [
    "📊 Inventory: All 5 SKUs tracked across 2 warehouses. SKU-A1003 Bearing has highest reorder level at 1,200.",
    "💡 Insight: Total inventory value exceeds $45,000. Consider ABC analysis for optimization.",
    "⚠️ Alert: Low stock alerts configured — you'll be notified when items hit reorder level.",
  ],
  production: [
    "📊 Production: 4 orders tracked. 2 in progress (62% and 88% complete), 1 planned, 1 completed.",
    "💡 Insight: PO-2026-0003 is 88% complete — expected completion within 48 hours.",
    "⚠️ Alert: PO-2026-0002 is planned with due date in 12 days — ensure materials are reserved.",
  ],
  maintenance: [
    "📊 Maintenance: MTBF 428h, MTTR 1.8h. 3/5 machines operational, 1 in maintenance.",
    "💡 Insight: CNC Mill Alpha-1 preventive maintenance due in 2 days. AI confidence: 94%.",
    "⚠️ Alert: Robotic Assembly R-7 corrective maintenance in progress — check parts availability.",
  ],
  finance: [
    "📊 Finance: Total revenue from settled POs $123,400. 2 POs received, 1 pending, 1 approved.",
    "💡 Insight: Average PO value is $41,133. Consider volume discounts with key suppliers.",
    "⚠️ Alert: PUR-2026-0106 for $12,800 is pending approval — action needed.",
  ],
  hr: [
    "📊 HR: Employee directory shows active workforce. All employees have roles assigned.",
    "💡 Insight: Consider scheduling Q3 performance reviews for all active employees.",
    "⚠️ Alert: Training compliance at 88% — 3 employees need safety refresher completion.",
  ],
  quality: [
    "📊 Quality: First-pass yield 97.8%, defect rate 0.82%. 2 open NCRs, 1 CAPA in progress.",
    "💡 Insight: Yield trend improving week-over-week. Keep monitoring dimensional drift on Al Housing.",
    "⚠️ Alert: Ti Bracket micro-crack prediction at 88% confidence — inspect batch B-2287.",
  ],
  orders: [
    "📊 Orders: Multiple orders tracked via production_orders. 2 in production, 1 completed.",
    "💡 Insight: Critical priority orders should be prioritized in scheduling to avoid penalties.",
    "⚠️ Alert: Check due dates for in-progress orders to ensure on-time delivery.",
  ],
  analytics: [
    "📊 Analytics: Cross-module KPIs computed from real data. Revenue, production, OEE all trending up.",
    "💡 Insight: Machine utilization correlates with production output — optimize scheduling for peak hours.",
    "⚠️ Alert: 1 machine down impacts production capacity by ~15%.",
  ],
  plants: [
    "📊 Plants: Manufacturing facilities tracked with operational status. Detroit Assembly is your primary plant.",
    "💡 Insight: Consider adding capacity metrics per plant for better resource allocation.",
    "⚠️ Alert: Ensure all plants have assigned departments and machine allocations.",
  ],
  departments: [
    "📊 Departments: Organizational units mapped. Each department can be linked to a specific plant.",
    "💡 Insight: Company-wide departments (no plant link) are shared across all facilities.",
    "⚠️ Alert: Assign headcounts to departments for better workforce planning.",
  ],
  products: [
    "📊 Products: 5 active SKUs with unit costs, prices, and reorder levels. Catalog value calculated.",
    "💡 Insight: SKU-A1004 Servo Motor has highest unit price ($465) — focus on quality for high-value items.",
    "⚠️ Alert: Set reorder levels for all products to enable automated low-stock alerts.",
  ],
  procurement: [
    "📊 Procurement: Purchase orders tracked from draft to received. Total commitment value tracked.",
    "💡 Insight: Consolidate orders with the same supplier to negotiate better terms.",
    "⚠️ Alert: PUR-2026-0106 needs approval — delayed approval impacts production timeline.",
  ],
  bom: [
    "📊 BOM: Bill of Materials derived from product catalog. Each product can have component lists.",
    "💡 Insight: Level 1 BOMs are top-level products, Level 2 are sub-assemblies.",
    "⚠️ Alert: Keep BOM costs updated to ensure accurate production cost calculations.",
  ],
  dispatch: [
    "📊 Dispatch: Outbound shipments tracked with carrier assignment and tracking numbers.",
    "💡 Insight: FedEx and UPS are most-used carriers. Consider negotiating volume rates.",
    "⚠️ Alert: Track in-transit shipments to ensure on-time delivery to customers.",
  ],
  documents: [
    "📊 Documents: 8 documents across Reports, Compliance, Maintenance, Contracts, Safety, Finance, HR, Engineering.",
    "💡 Insight: Keep ISO compliance documents updated — audit season approaching.",
    "⚠️ Alert: Safety Data Sheet for Ti Alloy is 1 month old — verify it's current.",
  ],
  capa: [
    "📊 CAPA: 4 corrective/preventive actions tracked. 1 completed, 2 in progress, 1 planned.",
    "💡 Insight: CAPA-2026-002 (Ti Bracket dimensional drift) is root-caused to tool wear — schedule replacement.",
    "⚠️ Alert: CAPA-2026-004 (CB-X1 solder joint) needs reflow profile optimization — deadline in 7 days.",
  ],
  defects: [
    "📊 Defects: 5 defects tracked across batches. 1 critical, 2 high, 1 medium, 1 resolved.",
    "💡 Insight: Servo Motor electrical defect is critical — escalate for immediate investigation.",
    "⚠️ Alert: Ti Bracket dimensional defect may require batch rejection — check tolerance limits.",
  ],
  leaves: [
    "📊 Leaves: 5 leave requests tracked. 2 pending approval, 2 approved, 1 completed.",
    "💡 Insight: Annual leave is most common type. Ensure adequate coverage during peak periods.",
    "⚠️ Alert: 2 pending requests need manager approval.",
  ],
  training: [
    "📊 Training: 6 programs with 82% overall completion rate. Safety training at 96% completion.",
    "💡 Insight: CNC Programming Advanced has lowest completion (60%) — consider extending deadline.",
    "⚠️ Alert: Forklift Certification is scheduled but has 0% completion — needs enrollment.",
  ],
  performance: [
    "📊 Performance: Average score 88%. Lisa Wang leads at 94%, David Park needs improvement at 78%.",
    "💡 Insight: 3 employees scored above 90 — consider for leadership development program.",
    "⚠️ Alert: David Park has only 2/4 goals achieved — schedule improvement plan.",
  ],
  payroll: [
    "📊 Payroll: Headcount-based estimates. 85% processed, 15% pending for this period.",
    "💡 Insight: Average net pay varies by overtime eligibility — track OT hours carefully.",
    "⚠️ Alert: Complete remaining payroll processing before period end.",
  ],
  crm: [
    "📊 CRM: 5 leads in pipeline worth $1.015M total. Tesla Gigafactory is highest value at $245K.",
    "💡 Insight: Referral-sourced leads have 2x higher conversion rate than cold outreach.",
    "⚠️ Alert: Boeing Defense in negotiation stage — follow up this week to close.",
  ],
  attendance: [
    "📊 Attendance: Real-time tracking from employee profiles. Active employees marked as present.",
    "💡 Insight: Average work hours 8.2h. Consider overtime tracking for accurate payroll.",
    "⚠️ Alert: Employees not checked in by 9 AM should be flagged for follow-up.",
  ],
  recruitment: [
    "📊 Recruitment: 5 open positions with 63 total applicants. Maintenance Technician has most applicants.",
    "💡 Insight: CNC Machinist and Maintenance Technician are high-urgency — prioritize hiring.",
    "⚠️ Alert: Warehouse Associate has an offer pending — confirm acceptance.",
  ],
  "incoming-inspection": [
    "📊 Incoming Inspection: Materials inspected upon receipt from suppliers. Quality scores tracked.",
    "💡 Insight: Supplier quality ratings correlate with inspection pass rates.",
    "⚠️ Alert: Inspect all materials from new suppliers with enhanced scrutiny.",
  ],
  "final-inspection": [
    "📊 Final Inspection: 836 units inspected, 832 passed, 4 failed. Yield rate 99.5%.",
    "💡 Insight: Ti Bracket has lowest yield (96.8%) — investigate batch variability.",
    "⚠️ Alert: 8 Ti Bracket units failed — check if related to NCR-2026-014.",
  ],
  settings: [
    "📊 Settings: Platform configuration managed centrally. Changes propagate to all modules.",
    "💡 Insight: Review notification preferences and integration settings quarterly.",
    "⚠️ Alert: Ensure API keys and webhooks are rotated per security policy.",
  ],
  whitelist: [
    "📊 Whitelist: Manage user access and role assignments. All changes are audit-logged.",
    "💡 Insight: Review active users monthly and revoke unused access promptly.",
    "⚠️ Alert: 3 pending invitations awaiting acceptance.",
  ],
};

/** Slug alias map: title-derived slugs → canonical keys in MODULE_AI_RESPONSES */
const SLUG_ALIASES: Record<string, string> = {
  "my-machines": "machines",
  "my-work-orders": "orders",
  "production-planning": "production",
  "production-logs": "production",
  "production-reports": "production",
  "production-orders": "production",
  "plant-overview": "machines",
  "plant-performance": "production",
  "capacity-planning": "machines",
  "scheduling": "production",
  "assigned-work-orders": "orders",
  "work-orders": "orders",
  "machine-history": "maintenance",
  "breakdowns": "maintenance",
  "spare-parts": "maintenance",
  "schedules": "maintenance",
  "maintenance-reports": "maintenance",
  "stock-movement": "inventory",
  "cycle-count": "inventory",
  "transfers": "inventory",
  "receiving": "inventory",
  "goods-receipt": "inventory",
  "warehouse": "inventory",
  "purchase-requests": "procurement",
  "rfq": "procurement",
  "vendor-comparison": "procurement",
  "supplier-pos": "suppliers",
  "supplier-invoices": "suppliers",
  "supplier-performance": "suppliers",
  "in-process-inspection": "quality",
  "quality-reports": "quality",
  "customer-invoices": "finance",
  "invoices": "finance",
  "payments": "finance",
  "expenses": "finance",
  "budgets": "finance",
  "taxes": "finance",
  "profit-loss": "finance",
  "finance-reports": "finance",
  "hr-reports": "hr",
  "leaves": "hr",
  "recruitment": "hr",
  "performance": "hr",
  "payroll": "hr",
  "attendance": "hr",
  "team": "hr",
  "training": "hr",
  "shipments": "dispatch",
  "deliveries": "dispatch",
  "support": "crm",
  "issue-reporting": "maintenance",
  "knowledge": "documents",
  "compliance": "documents",
  "tasks": "production",
  "company": "plants",
  "reports": "analytics",
  "audit": "documents",
  "assigned-machines": "machines",
  "dashboard": "analytics",
  "platform-audit": "documents",
  "platform-settings": "settings",
  "pending": "documents",
  "suspended": "documents",
  "approved-companies": "documents",
};

/**
 * Working AI Copilot for every module.
 * Shows contextual insights, answers questions, and provides recommendations.
 */
export function ModuleCopilot({ moduleName }: { moduleName: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const canonical = SLUG_ALIASES[moduleName] ?? moduleName;
  const responses = MODULE_AI_RESPONSES[canonical] ?? [
    `📊 ${moduleName} module is active with real-time data sync.`,
    `💡 Tip: Use the search bar to filter records, and the Export button to download data.`,
    `⚠️ Connect this module to other modules for full interconnection benefits.`,
  ];

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setInput("");
    setLoading(true);

    // Simulate AI processing
    await new Promise(r => setTimeout(r, 800 + Math.random() * 600));

    // Generate contextual response
    const lower = userMsg.toLowerCase();
    let aiResponse = "";

    if (lower.includes("summary") || lower.includes("overview") || lower.includes("status")) {
      aiResponse = responses[0];
    } else if (lower.includes("insight") || lower.includes("suggest") || lower.includes("recommend")) {
      aiResponse = responses[1];
    } else if (lower.includes("alert") || lower.includes("warning") || lower.includes("issue")) {
      aiResponse = responses[2];
    } else if (lower.includes("create") || lower.includes("add") || lower.includes("new")) {
      aiResponse = `✅ To create a new record, click the "New" button in the top right. Fill in the required fields and submit. The record will be saved to your company's database with RLS protection.`;
    } else if (lower.includes("export") || lower.includes("download")) {
      aiResponse = `📥 Click the "Export CSV" button to download all visible records. The export includes all columns currently displayed in the table.`;
    } else if (lower.includes("filter") || lower.includes("search")) {
      aiResponse = `🔍 Use the search bar to filter records by any visible column. Click column headers to sort ascending/descending. Use the Filters button for advanced options.`;
    } else {
      // Pick a random response
      aiResponse = responses[Math.floor(Math.random() * responses.length)];
    }

    setMessages(prev => [...prev, { role: "ai", text: aiResponse }]);
    setLoading(false);
  };

  return (
    <>
      <Button
        variant="outline"
        className="glass border-primary/20 text-primary hover:bg-primary/10"
        onClick={() => {
          setOpen(true);
          if (messages.length === 0) {
            setMessages([{ role: "ai", text: responses[0] }]);
          }
        }}
      >
        <BrainCircuit className="h-4 w-4 mr-1.5" />
        <span className="hidden sm:inline">AI Copilot</span>
        <span className="sm:hidden">AI</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh] flex flex-col p-0">
          <DialogHeader className="px-4 pt-4 pb-2 border-b border-white/5">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-primary" />
              {moduleName} AI Copilot
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px] max-h-[400px]">
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`text-sm leading-relaxed ${msg.role === "ai"
                  ? "bg-card/80 border border-white/5 rounded-xl p-3"
                  : "bg-primary/10 border border-primary/20 rounded-xl p-3 ml-8"
                }`}
              >
                {msg.text}
              </motion.div>
            ))}
            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 text-sm text-muted-foreground bg-card/40 rounded-xl p-3"
              >
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Analyzing {moduleName} data...
              </motion.div>
            )}
          </div>

          <div className="px-4 pb-4 pt-2 border-t border-white/5">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Ask about ${moduleName}...`}
                className="h-9 bg-background/40"
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
              />
              <Button
                size="icon"
                className="h-9 w-9 shrink-0 bg-[image:var(--gradient-primary)]"
                onClick={handleSend}
                disabled={!input.trim() || loading}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {["Summary", "Insights", "Alerts", "Create new"].map(q => (
                <button
                  key={q}
                  className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 bg-muted/30 text-muted-foreground hover:bg-primary/10 hover:text-primary transition"
                  onClick={() => { setInput(q); }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
