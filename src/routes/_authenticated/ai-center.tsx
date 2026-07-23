import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { BrainCircuit, Sparkles, Loader2, Send, Radar, ScanLine, GaugeCircle, LineChart, Layers, MessageCircle } from "lucide-react";
import { PageHeader, Panel } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  const [q, setQ] = useState("What's the biggest risk to on-time delivery this week?");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<{ role: "user" | "ai"; text: string; conf?: number }[]>([
    { role: "ai", text: "Hi, I'm your FactoryOS Copilot. Ask me anything about production, inventory, quality, machines or suppliers.", conf: 100 },
  ]);

  function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    const question = q.trim();
    setMsgs(m => [...m, { role: "user", text: question }]);
    setQ("");
    setBusy(true);
    setTimeout(() => {
      const answer =
        "Based on the last 7 days: **PO-2026-0003** is the top risk. It's 88% complete but blocked by a spare-part shortage on **CNC Mill Alpha-1**. Recommended actions: (1) expedite spare from Kyoto Precision (ETA 36h), (2) reroute op 40 to CNC Lathe Beta-2 (available window Wed 22:00). Estimated recovery: on-time.";
      setMsgs(m => [...m, { role: "ai", text: answer, conf: 92 }]);
      setBusy(false);
    }, 900);
    toast.success("Copilot is thinking…");
  }

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader eyebrow="AI-native" title="AI Center" sub="Every AI capability across FactoryOS in one control plane." />

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
