import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import {
  ArrowRight, Sparkles, Factory, Cpu, ShieldCheck, LineChart, Zap, Boxes,
  Cog, Wrench, Truck, Building2, Users, BrainCircuit, Radar, ScanLine, GaugeCircle,
  CheckCircle2, ArrowUpRight, Layers, Lock, Globe, Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FactoryOS AI — The Smart Manufacturing Operating System" },
      { name: "description", content: "AI-first, cloud-native ERP for modern manufacturers. Production, inventory, quality, maintenance and finance — orchestrated by AI." },
      { property: "og:title", content: "FactoryOS AI — Smart Manufacturing OS" },
      { property: "og:description", content: "Run your entire factory on one AI-native platform: real-time production, predictive maintenance, executive intelligence." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-clip">
      <Nav />
      <Hero />
      <TrustBar />
      <Features />
      <WorkflowSection />
      <ModulesGrid />
      <AISection />
      <SecuritySection />
      <RolesSection />
      <Faq />
      <CtaSection />
      <Footer />
    </div>
  );
}

/* ─────────── NAV ─────────── */
function Nav() {
  const { scrollY } = useScroll();
  const bg = useTransform(scrollY, [0, 60], ["oklch(0.16 0.02 260 / 0)", "oklch(0.14 0.02 260 / 0.85)"]);
  const border = useTransform(scrollY, [0, 60], ["oklch(1 0 0 / 0)", "oklch(1 0 0 / 0.08)"]);
  const shadow = useTransform(scrollY, [0, 60], ["0 0 0 rgba(0,0,0,0)", "0 10px 30px -20px rgba(0,0,0,0.6)"]);
  return (
    <motion.header
      style={{ backgroundColor: bg, borderColor: border, boxShadow: shadow, backdropFilter: "blur(16px) saturate(160%)" }}
      className="fixed top-0 inset-x-0 z-50 border-b"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-[image:var(--gradient-primary)] shadow-glow grid place-items-center">
            <Factory className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold tracking-tight">FactoryOS <span className="text-muted-foreground">AI</span></span>
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition">Features</a>
          <a href="#modules" className="hover:text-foreground transition">Solutions</a>
          <a href="#ai" className="hover:text-foreground transition">AI</a>
          <a href="#security" className="hover:text-foreground transition">Security</a>
          <a href="#faq" className="hover:text-foreground transition">Docs</a>
          <span className="text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground">Pricing · Soon</span>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/auth"><Button variant="ghost" size="sm">Log in</Button></Link>
          <Link to="/auth"><Button size="sm" className="bg-[image:var(--gradient-primary)] shadow-glow">Start free demo</Button></Link>
        </div>
      </div>
    </motion.header>
  );
}

/* ─────────── HERO ─────────── */
function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <section ref={ref} className="relative pt-32 pb-20 aurora-bg">
      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center relative">
        {/* LEFT */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <Badge variant="outline" className="glass border-white/10 px-3 py-1 mb-6">
            <Sparkles className="h-3.5 w-3.5 mr-1.5 text-primary" />
            <span className="text-xs">AI-native · Multi-tenant · Enterprise-grade</span>
          </Badge>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05]">
            The Smart Manufacturing<br />
            <span className="gradient-text">Operating System.</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed">
            FactoryOS AI unifies production, inventory, quality, maintenance and finance into a single
            AI-native ERP — built for the world's most demanding factories.
          </p>
          <ul className="mt-6 space-y-2.5 text-sm">
            {[
              "Real-time production, OEE and machine intelligence",
              "Predictive maintenance and AI defect detection",
              "Executive Copilot for natural-language operations",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2 text-foreground/90">
                <CheckCircle2 className="h-4 w-4 text-success" /> {t}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/auth"><Button size="lg" className="bg-[image:var(--gradient-primary)] shadow-glow">
              Start free demo <ArrowRight className="h-4 w-4 ml-1" />
            </Button></Link>
            <Link to="/auth"><Button size="lg" variant="outline" className="glass border-white/10">Login</Button></Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Password for every demo account: <code className="text-foreground">Factory@2026</code>
          </p>
        </motion.div>

        {/* RIGHT — App preview */}
        <motion.div
          initial={{ opacity: 0, y: 30, rotateX: 10 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="relative"
          style={{ perspective: 1400 }}
        >
          <AppPreview />
        </motion.div>
      </div>
    </section>
  );
}

function AppPreview() {
  const kpis = [
    { label: "OEE",           value: "87.4%", delta: "+3.2%", tone: "text-success" },
    { label: "On-Time",       value: "96.1%", delta: "+1.4%", tone: "text-info" },
    { label: "Scrap Rate",    value: "0.82%", delta: "-0.3%", tone: "text-success" },
    { label: "Open WOs",      value: "142",   delta: "24 due", tone: "text-warning" },
  ];
  const machines = [
    { name: "CNC Mill Alpha-1", u: 87, s: "Running" },
    { name: "CNC Lathe Beta-2",  u: 76, s: "Running" },
    { name: "Robotic Assembly R-7", u: 0, s: "Maintenance" },
    { name: "Injection Molder IM-3", u: 92, s: "Running" },
  ];
  return (
    <div className="glass-strong rounded-2xl p-4 sm:p-5 shadow-elegant relative">
      {/* window chrome */}
      <div className="flex items-center gap-2 pb-3 border-b border-white/5">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
        <div className="mx-auto text-xs text-muted-foreground">factoryos.ai · Operations · Detroit Plant</div>
      </div>

      <div className="grid grid-cols-4 gap-2 mt-4">
        {kpis.map(k => (
          <div key={k.label} className="rounded-xl bg-card/60 border border-white/5 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.label}</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{k.value}</div>
            <div className={`text-[10px] ${k.tone}`}>{k.delta}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-3 mt-3">
        {/* Sparkline card */}
        <div className="col-span-3 rounded-xl bg-card/60 border border-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">Production Output · Last 24h</div>
            <div className="text-[10px] text-success flex items-center gap-1">▲ 12.4%</div>
          </div>
          <svg viewBox="0 0 400 120" className="mt-3 w-full h-28">
            <defs>
              <linearGradient id="lg" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="oklch(0.58 0.22 259)" stopOpacity="0.5" />
                <stop offset="1" stopColor="oklch(0.58 0.22 259)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0,90 C40,70 60,80 90,60 C120,40 150,55 180,45 C210,35 240,60 270,40 C300,25 330,50 360,30 L400,20 L400,120 L0,120 Z" fill="url(#lg)" />
            <path d="M0,90 C40,70 60,80 90,60 C120,40 150,55 180,45 C210,35 240,60 270,40 C300,25 330,50 360,30 L400,20"
                  stroke="oklch(0.58 0.22 259)" strokeWidth="2" fill="none" />
          </svg>
        </div>
        {/* AI insight */}
        <div className="col-span-2 rounded-xl bg-[image:var(--gradient-primary)]/10 border border-primary/30 p-4">
          <div className="flex items-center gap-1.5 text-xs text-primary">
            <BrainCircuit className="h-3.5 w-3.5" /> AI Insight · 94% conf.
          </div>
          <div className="mt-2 text-sm leading-snug">
            Predicted <span className="text-warning">bearing wear</span> on <span className="font-medium">CNC Mill Alpha-1</span> within 72h. Schedule PM window Fri 22:00.
          </div>
          <button className="mt-3 text-[11px] text-primary hover:underline flex items-center gap-1">
            Open recommendation <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-card/60 border border-white/5 p-3">
        <div className="text-xs text-muted-foreground mb-2 flex items-center justify-between">
          <span>Machine Status · Detroit Assembly</span>
          <span className="text-[10px]">Live</span>
        </div>
        <div className="space-y-1.5">
          {machines.map(m => (
            <div key={m.name} className="grid grid-cols-[1fr_auto_100px] items-center gap-3 text-xs">
              <div className="truncate">{m.name}</div>
              <div className={m.s === "Running" ? "text-success" : "text-warning"}>{m.s}</div>
              <div className="relative h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-[image:var(--gradient-primary)]" style={{ width: `${m.u}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating notification */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="absolute -bottom-4 -right-3 hidden sm:flex items-center gap-2 glass rounded-xl px-3 py-2 shadow-elegant"
      >
        <div className="h-6 w-6 rounded-md bg-success/20 grid place-items-center">
          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
        </div>
        <div className="text-[11px]">PO-2026-0003 released to shop floor</div>
      </motion.div>
    </div>
  );
}

/* ─────────── TRUST BAR ─────────── */
function TrustBar() {
  const items = ["Aerospace", "Automotive", "Medical Devices", "Semiconductors", "Heavy Industry", "Consumer Goods", "Energy", "Defense"];
  return (
    <div className="border-y border-white/5 py-6 bg-card/30">
      <div className="mx-auto max-w-7xl px-4 text-xs uppercase tracking-widest text-muted-foreground text-center">
        Built for the industries that build everything
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-foreground/70">
        {items.map(i => <span key={i}>{i}</span>)}
      </div>
    </div>
  );
}

/* ─────────── FEATURES ─────────── */
function Features() {
  const features = [
    { icon: Factory,      title: "Production Control",     text: "Orders, work orders, routings and shop-floor execution in real time." },
    { icon: Boxes,        title: "Inventory & WMS",        text: "Multi-warehouse, bin-level, batch/lot/serial with barcode & QR." },
    { icon: ShieldCheck,  title: "Quality Management",     text: "Incoming, in-process and final inspection with NCR and CAPA." },
    { icon: Wrench,       title: "Maintenance",            text: "Preventive, corrective and predictive maintenance with spare parts." },
    { icon: Truck,        title: "Procurement",            text: "RFQs, POs, supplier scorecards and AI vendor recommendations." },
    { icon: LineChart,    title: "Finance",                text: "GL, AP/AR, budgets, cost centers and executive financial analytics." },
  ];
  return (
    <section id="features" className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHead
          eyebrow="Core platform"
          title="One platform. Every operation."
          sub="Everything a modern factory needs — designed like a product, not a portal."
        />
        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="group glass rounded-2xl p-6 hover:border-primary/30 transition"
            >
              <div className="h-10 w-10 rounded-xl bg-[image:var(--gradient-primary)]/15 border border-primary/20 grid place-items-center">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{f.text}</p>
              <div className="mt-4 text-xs text-primary opacity-0 group-hover:opacity-100 transition flex items-center gap-1">
                Explore module <ArrowUpRight className="h-3 w-3" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────── WORKFLOW ─────────── */
function WorkflowSection() {
  const steps = [
    { icon: ShoppingCartIcon, title: "Demand & Sales",       text: "Sales orders and forecasts feed the plan." },
    { icon: Cpu,              title: "Planning & MRP",       text: "AI generates production and material plans." },
    { icon: Cog,              title: "Execution",            text: "Work orders release to shop floor and machines." },
    { icon: ShieldCheck,      title: "Quality",              text: "In-process and final inspection with NCR." },
    { icon: Truck,            title: "Dispatch",             text: "Pick, pack and ship with barcode & tracking." },
  ];
  return (
    <section className="py-24 bg-card/30 border-y border-white/5">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHead eyebrow="Workflow" title="From demand to dispatch" sub="An end-to-end orchestrated manufacturing pipeline." />
        <div className="mt-14 grid grid-cols-1 md:grid-cols-5 gap-4">
          {steps.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="relative glass rounded-2xl p-5"
            >
              <div className="text-xs text-muted-foreground">Step {i + 1}</div>
              <s.icon className="h-6 w-6 text-primary mt-2" />
              <h4 className="mt-3 font-medium">{s.title}</h4>
              <p className="mt-1 text-xs text-muted-foreground">{s.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
function ShoppingCartIcon(props: React.SVGProps<SVGSVGElement>) {
  return <Boxes {...props} />;
}

/* ─────────── MODULES ─────────── */
function ModulesGrid() {
  const mods = [
    "Dashboard","Inventory","Warehouse","Products","Categories","Bill of Materials","Routings",
    "Production Planning","Production Orders","Work Orders","Scheduling","Capacity Planning",
    "Machines","Production Lines","Work Centers","Machine Monitoring","Preventive Maintenance",
    "Predictive Maintenance","Spare Parts","Quality Control","NCR","CAPA","Suppliers","Purchase Requests",
    "Purchase Orders","RFQ","GRN","Customers","Sales Orders","Dispatch","Shipments","Fleet",
    "Finance","GL","AP","AR","Expenses","Budgets","Payroll","HR","Attendance","Leave",
    "Recruitment","Performance","Training","Assets","Documents","Calendar","Notifications",
    "Reports","Analytics","AI Center","Audit Logs","Companies","Plants","Departments","Knowledge Center",
  ];
  return (
    <section id="modules" className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHead eyebrow="Enterprise modules" title="66+ modules. Zero silos." sub="Every function of a Fortune-500 factory, unified under one design system." />
        <div className="mt-12 flex flex-wrap gap-2">
          {mods.map((m, i) => (
            <motion.span
              key={m}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.01 }}
              className="text-xs px-3 py-1.5 rounded-lg glass border-white/5 hover:border-primary/30 hover:text-primary transition"
            >{m}</motion.span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────── AI ─────────── */
function AISection() {
  const items = [
    { icon: BrainCircuit, t: "AI Copilot",           d: "Ask about any KPI, order, machine or supplier in natural language." },
    { icon: Radar,        t: "Predictive Maintenance", d: "Detect anomalies before they cause downtime." },
    { icon: ScanLine,     t: "AI Defect Detection",  d: "Vision-ready quality inspection with confidence scores." },
    { icon: GaugeCircle,  t: "Factory Health Score", d: "One number that captures the state of your entire operation." },
    { icon: LineChart,    t: "Demand Forecasting",   d: "Statistical + ML forecasts driving MRP and procurement." },
    { icon: Layers,       t: "Scenario Simulator",   d: "What-if analysis on capacity, cost, delivery and margin." },
  ];
  return (
    <section id="ai" className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 [background:var(--gradient-mesh)] opacity-20 blur-3xl pointer-events-none" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
        <SectionHead eyebrow="AI-native" title="An AI layer across every module" sub="Explainable AI with confidence scores, reasoning, and human approval flows." />
        <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((it, i) => (
            <motion.div
              key={it.t}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="glass-strong rounded-2xl p-6 border-white/10"
            >
              <div className="h-10 w-10 rounded-xl bg-primary/15 border border-primary/30 grid place-items-center">
                <it.icon className="h-5 w-5 text-primary" />
              </div>
              <h4 className="mt-4 font-semibold">{it.t}</h4>
              <p className="mt-1.5 text-sm text-muted-foreground">{it.d}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────── SECURITY ─────────── */
function SecuritySection() {
  const points = [
    { icon: Lock,   t: "Row-Level Security", d: "Every row scoped to its company. Zero cross-tenant leakage." },
    { icon: ShieldCheck, t: "Role Hierarchy",  d: "15 enterprise roles from Root Super Admin to Operator and portals." },
    { icon: Globe,  t: "Multi-tenant SaaS",  d: "Unlimited companies, plants, warehouses and departments." },
    { icon: Rocket, t: "Realtime & Offline", d: "Live updates via Realtime; offline detection for shop-floor devices." },
  ];
  return (
    <section id="security" className="py-24 bg-card/30 border-y border-white/5">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHead eyebrow="Enterprise security" title="Trust by design" sub="Multi-tenant isolation, granular roles, and full audit trail on every action." />
        <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {points.map((p) => (
            <div key={p.t} className="glass rounded-2xl p-6">
              <p.icon className="h-6 w-6 text-primary" />
              <h4 className="mt-4 font-medium">{p.t}</h4>
              <p className="mt-1.5 text-sm text-muted-foreground">{p.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────── ROLES ─────────── */
import { ROLES } from "@/lib/roles";
function RolesSection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHead eyebrow="Role hierarchy" title="Built for every seat in the factory" sub="From boardroom to shop floor. From supplier to auditor." />
        <div className="mt-14 grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {ROLES.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.03 }}
              className="glass rounded-xl p-4 hover:border-primary/30 transition"
            >
              <div className={`h-9 w-9 rounded-lg bg-gradient-to-br ${r.accent} grid place-items-center shadow-glow`}>
                <r.icon className="h-4 w-4 text-white" />
              </div>
              <div className="mt-3 text-sm font-medium">{r.label}</div>
              <div className="text-[11px] text-muted-foreground">{r.tagline}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────── FAQ ─────────── */
function Faq() {
  const q = [
    { q: "Is FactoryOS multi-tenant?", a: "Yes. One deployment serves unlimited companies, each with plants, warehouses and role isolation via row-level security." },
    { q: "How does AI show up in the product?", a: "Every module surfaces AI Insights with confidence and reasoning. The Copilot answers natural-language questions across the entire dataset." },
    { q: "Can I import my existing data?", a: "Yes. Every module supports import, export and integrations for barcode/RFID/IoT and standard connectors." },
    { q: "Is there a customer or supplier portal?", a: "Yes. External roles get scoped portals for orders, invoices, shipments and documents." },
  ];
  return (
    <section id="faq" className="py-24 bg-card/30 border-y border-white/5">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <SectionHead eyebrow="FAQ" title="Frequently asked questions" sub="Everything you'd ask a Fortune-500 ERP vendor — with straight answers." />
        <div className="mt-10 space-y-3">
          {q.map((it) => (
            <details key={it.q} className="glass rounded-2xl p-5 group">
              <summary className="cursor-pointer list-none flex items-center justify-between font-medium">
                {it.q}
                <span className="text-muted-foreground group-open:rotate-180 transition">▾</span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{it.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────── CTA ─────────── */
function CtaSection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl glass-strong p-10 sm:p-14 text-center">
          <div className="absolute inset-0 [background:var(--gradient-mesh)] opacity-25 blur-2xl pointer-events-none" />
          <div className="relative">
            <Zap className="h-8 w-8 text-primary mx-auto" />
            <h3 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight">
              Ship your factory of the future.
            </h3>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              Launch FactoryOS AI in your plant this quarter. Free demo, full modules, no credit card.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/auth"><Button size="lg" className="bg-[image:var(--gradient-primary)] shadow-glow">
                Start free demo <ArrowRight className="h-4 w-4 ml-1" />
              </Button></Link>
              <Link to="/auth"><Button size="lg" variant="outline" className="glass border-white/10">Talk to sales</Button></Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────── FOOTER ─────────── */
function Footer() {
  return (
    <footer className="border-t border-white/5 py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-8 text-sm text-muted-foreground">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-[image:var(--gradient-primary)] grid place-items-center">
              <Factory className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-foreground">FactoryOS AI</span>
          </div>
          <p className="mt-3 text-xs">The Smart Manufacturing Operating System. Built for the world's most demanding factories.</p>
        </div>
        <div>
          <div className="text-foreground font-medium">Product</div>
          <ul className="mt-3 space-y-1.5 text-xs">
            <li><a href="#features">Features</a></li>
            <li><a href="#modules">Modules</a></li>
            <li><a href="#ai">AI</a></li>
            <li><a href="#security">Security</a></li>
          </ul>
        </div>
        <div>
          <div className="text-foreground font-medium">Company</div>
          <ul className="mt-3 space-y-1.5 text-xs">
            <li>About</li><li>Careers</li><li>Contact sales</li><li>Documentation</li>
          </ul>
        </div>
        <div>
          <div className="text-foreground font-medium">Legal</div>
          <ul className="mt-3 space-y-1.5 text-xs">
            <li>Privacy</li><li>Terms</li><li>Security</li><li>DPA</li>
          </ul>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 mt-8 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
        <div>© {new Date().getFullYear()} FactoryOS AI. All rights reserved.</div>
        <div>Made for factories that shape the world.</div>
      </div>
    </footer>
  );
}

/* ─────────── SECTION HEAD ─────────── */
function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  return (
    <div className="max-w-3xl">
      <div className="text-xs uppercase tracking-widest text-primary/90">{eyebrow}</div>
      <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-3 text-muted-foreground">{sub}</p>
    </div>
  );
}
