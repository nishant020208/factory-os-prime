import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence, useScroll } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, Factory, Warehouse, Package, ShieldCheck, Wrench, Landmark, Users,
  ShoppingCart, Sparkles, Cpu, Boxes, Truck, ClipboardCheck, PackageCheck,
  ArrowRight, Search, Sun, Moon, Menu, X, Lock, KeyRound, FileCheck2,
  ScrollText, Network, ChevronRight, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle2, Radio, Gauge, Layers, Database, Zap, Cog,
} from "lucide-react";
import {
  LineChart, Line, ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip,
} from "recharts";
import { ROLES } from "@/lib/roles";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FactoryOS AI — Factory Command Center" },
      { name: "description", content: "Enterprise Smart Manufacturing Operating System. Production, inventory, warehouses, procurement, quality, maintenance, finance, HR and AI — in one control room." },
      { property: "og:title", content: "FactoryOS AI — Factory Command Center" },
      { property: "og:description", content: "Enterprise Smart Manufacturing Operating System. Production, inventory, warehouses, procurement, quality, maintenance, finance, HR and AI — in one control room." },
    ],
  }),
  component: LandingPage,
});

/* ────────────────────────────────────────────────────────── */
/*  BACKGROUND — animated blueprint / CAD grid                */
/* ────────────────────────────────────────────────────────── */
function BlueprintBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* radial gradients */}
      <div className="absolute inset-0 aurora-bg" />
      {/* grid */}
      <div className="absolute inset-0 grid-bg opacity-60" />
      {/* fine blueprint grid */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.18]">
        <defs>
          <pattern id="fine" width="22" height="22" patternUnits="userSpaceOnUse">
            <path d="M22 0H0V22" fill="none" stroke="oklch(0.72 0.14 210 / 0.35)" strokeWidth="0.4" />
          </pattern>
          <pattern id="cad" width="220" height="220" patternUnits="userSpaceOnUse">
            <path d="M0 110H220M110 0V220" fill="none" stroke="oklch(0.58 0.22 259 / 0.35)" strokeWidth="0.6" />
            <circle cx="110" cy="110" r="2" fill="oklch(0.72 0.14 210 / 0.6)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#fine)" />
        <rect width="100%" height="100%" fill="url(#cad)" />
      </svg>

      {/* moving connection lines */}
      <svg className="absolute inset-0 h-full w-full">
        {Array.from({ length: 6 }).map((_, i) => {
          const y = 80 + i * 130;
          return (
            <g key={i}>
              <line x1="-10%" y1={y} x2="110%" y2={y}
                stroke="oklch(0.58 0.22 259 / 0.18)" strokeWidth="1" strokeDasharray="4 10" />
              <motion.circle
                r="2.4" fill="oklch(0.72 0.14 210 / 0.9)"
                initial={{ cx: "-5%", cy: y }}
                animate={{ cx: "105%" }}
                transition={{ duration: 14 + i * 2, repeat: Infinity, ease: "linear", delay: i * 1.5 }}
              />
            </g>
          );
        })}
      </svg>

      {/* subtle particles */}
      <svg className="absolute inset-0 h-full w-full opacity-70">
        {Array.from({ length: 40 }).map((_, i) => {
          const cx = (i * 97) % 100;
          const cy = (i * 53) % 100;
          return (
            <motion.circle
              key={i} cx={`${cx}%`} cy={`${cy}%`} r="1"
              fill="oklch(0.98 0.005 250 / 0.5)"
              animate={{ opacity: [0.1, 0.7, 0.1] }}
              transition={{ duration: 4 + (i % 5), repeat: Infinity, delay: i * 0.1 }}
            />
          );
        })}
      </svg>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  NAV                                                       */
/* ────────────────────────────────────────────────────────── */
const NAV_LINKS = [
  { label: "Solutions", href: "#modules" },
  { label: "Manufacturing", href: "#flow" },
  { label: "AI Platform", href: "#ai" },
  { label: "Security", href: "#security" },
  { label: "Documentation", href: "#tech" },
  { label: "Contact", href: "#contact" },
];

function TopNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("light", !dark);
  }, [dark]);

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? "backdrop-blur-xl bg-background/70 border-b border-white/5" : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="h-7 w-7 rounded-md bg-[image:var(--gradient-primary)] grid place-items-center shadow-glow">
            <Factory className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="text-[13px] font-semibold tracking-tight">FactoryOS <span className="text-primary">AI</span></div>
        </Link>

        <nav className="hidden lg:flex items-center gap-1 ml-4">
          {NAV_LINKS.map(l => (
            <a key={l.href} href={l.href}
              className="text-[12.5px] text-muted-foreground hover:text-foreground transition px-3 py-1.5 rounded-md hover:bg-white/5">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <button className="hidden sm:grid place-items-center h-8 w-8 rounded-md hover:bg-white/5 text-muted-foreground" aria-label="Search">
            <Search className="h-4 w-4" />
          </button>
          <button onClick={() => setDark(d => !d)} className="grid place-items-center h-8 w-8 rounded-md hover:bg-white/5 text-muted-foreground" aria-label="Theme">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Link to="/auth" className="hidden sm:inline-flex items-center h-8 px-3 rounded-md text-[12.5px] text-foreground/90 hover:bg-white/5">
            Login
          </Link>
          <Link to="/auth" className="inline-flex items-center gap-1 h-8 px-3 rounded-md text-[12.5px] font-medium text-white bg-[image:var(--gradient-primary)] shadow-glow hover:opacity-95">
            Register <ArrowRight className="h-3 w-3" />
          </Link>
          <button onClick={() => setMobile(true)} className="lg:hidden grid place-items-center h-8 w-8 rounded-md hover:bg-white/5" aria-label="Menu">
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobile && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-50 bg-background/95 backdrop-blur-xl">
            <div className="flex items-center justify-between h-14 px-4 border-b border-white/5">
              <span className="text-sm font-semibold">Menu</span>
              <button onClick={() => setMobile(false)} className="grid place-items-center h-8 w-8"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-4 flex flex-col gap-1">
              {NAV_LINKS.map(l => (
                <a key={l.href} href={l.href} onClick={() => setMobile(false)}
                  className="px-3 py-3 rounded-lg hover:bg-white/5 text-sm">{l.label}</a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  ANIMATED COUNTER                                          */
/* ────────────────────────────────────────────────────────── */
function useTicker(base: number, jitter = 0.02, interval = 2400) {
  const [v, setV] = useState(base);
  useEffect(() => {
    const t = setInterval(() => {
      setV(base * (1 + (Math.random() - 0.5) * jitter * 2));
    }, interval);
    return () => clearInterval(t);
  }, [base, jitter, interval]);
  return v;
}

/* ────────────────────────────────────────────────────────── */
/*  DASHBOARD PREVIEW (right column)                          */
/* ────────────────────────────────────────────────────────── */
function seriesFromSeed(seed: number, n = 24, base = 60) {
  const out: { i: number; v: number }[] = [];
  let v = base;
  for (let i = 0; i < n; i++) {
    v += Math.sin(i * 0.6 + seed) * 4 + (Math.random() - 0.5) * 3;
    out.push({ i, v: Math.max(20, Math.round(v)) });
  }
  return out;
}

function TiltCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const rx = useSpring(useMotionValue(0), { stiffness: 200, damping: 20 });
  const ry = useSpring(useMotionValue(0), { stiffness: 200, damping: 20 });
  const tx = useTransform(rx, v => `${v}deg`);
  const ty = useTransform(ry, v => `${v}deg`);

  function onMove(e: React.MouseEvent) {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    ry.set(px * 8); rx.set(-py * 8);
  }
  function onLeave() { rx.set(0); ry.set(0); }

  return (
    <motion.div
      ref={ref} onMouseMove={onMove} onMouseLeave={onLeave}
      style={{ rotateX: tx, rotateY: ty, transformStyle: "preserve-3d" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function DashboardPreview() {
  const oee = useTicker(87.4, 0.01);
  const throughput = useTicker(1248, 0.015);
  const revenue = useTicker(2.41, 0.008);
  const health = useTicker(94, 0.005);

  const line = useMemo(() => seriesFromSeed(1, 30, 70), []);
  const area = useMemo(() => seriesFromSeed(2, 30, 40), []);
  const bars = useMemo(() => seriesFromSeed(3, 12, 55), []);

  const [notif, setNotif] = useState<{ id: number; text: string; kind: "ok" | "warn" | "info" } | null>(null);
  useEffect(() => {
    const msgs: { text: string; kind: "ok" | "warn" | "info" }[] = [
      { text: "Line B-04 reached target OEE 92%", kind: "ok" },
      { text: "Bearing wear detected on Machine 07", kind: "warn" },
      { text: "PO #4821 approved by Finance", kind: "info" },
      { text: "Batch QC passed — Motor Housing", kind: "ok" },
    ];
    let i = 0;
    const t = setInterval(() => {
      setNotif({ id: Date.now(), ...msgs[i % msgs.length] });
      i++;
    }, 3200);
    return () => clearInterval(t);
  }, []);

  return (
    <TiltCard className="relative">
      <div className="absolute -inset-4 rounded-3xl bg-[image:var(--gradient-primary)] opacity-20 blur-3xl" />
      <div className="relative glass-strong rounded-2xl shadow-elegant overflow-hidden border border-white/10">
        {/* Fake window chrome */}
        <div className="flex items-center gap-2 px-3 h-9 border-b border-white/5 bg-white/[0.02]">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          </div>
          <div className="mx-auto text-[10.5px] text-muted-foreground flex items-center gap-1.5">
            <Radio className="h-3 w-3 text-success animate-pulse" />
            factoryos.ai / plants / abc-detroit-01 · live
          </div>
        </div>

        <div className="p-3 sm:p-4 grid grid-cols-6 gap-2.5 text-[11.5px]">
          {/* KPI row */}
          <KPI icon={Gauge} label="OEE" value={`${oee.toFixed(1)}%`} trend="+2.4" />
          <KPI icon={Activity} label="Throughput" value={`${Math.round(throughput)}/hr`} trend="+120" />
          <KPI icon={Landmark} label="Revenue" value={`$${revenue.toFixed(2)}M`} trend="+3.1%" />
          <KPI icon={ShieldCheck} label="Health" value={`${Math.round(health)}`} trend="stable" ok />
          <KPI icon={AlertTriangle} label="Alerts" value="3" trend="-1" warn />
          <KPI icon={Boxes} label="SKUs" value="1,284" trend="+12" />

          {/* Big chart */}
          <div className="col-span-4 rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Production Output — 24h</div>
                <div className="text-sm font-semibold">Line A · Assembly</div>
              </div>
              <div className="text-[10px] text-success flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> +8.2% vs shift avg
              </div>
            </div>
            <div className="h-28">
              <ResponsiveContainer>
                <AreaChart data={line}>
                  <defs>
                    <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.58 0.22 259)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="oklch(0.58 0.22 259)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="v" stroke="oklch(0.58 0.22 259)" strokeWidth={1.6} fill="url(#g1)" isAnimationActive />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Machine health */}
          <div className="col-span-2 rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Machine Health</div>
            <div className="mt-2 space-y-2">
              {[
                { n: "CNC-01", v: 96, c: "success" },
                { n: "PRESS-04", v: 78, c: "warning" },
                { n: "ROBOT-07", v: 42, c: "destructive" },
                { n: "PACK-02", v: 88, c: "success" },
              ].map(m => (
                <div key={m.n}>
                  <div className="flex justify-between text-[10.5px]">
                    <span className="text-muted-foreground">{m.n}</span>
                    <span className="font-medium">{m.v}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${m.v}%` }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                      className={`h-full bg-${m.c}`}
                      style={{
                        background:
                          m.c === "success" ? "oklch(0.72 0.19 145)" :
                          m.c === "warning" ? "oklch(0.79 0.17 75)" :
                          "oklch(0.62 0.23 25)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Inventory */}
          <div className="col-span-3 rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Inventory · 12 weeks</div>
              <div className="text-[10px] text-muted-foreground">Raw · WIP · Finished</div>
            </div>
            <div className="h-24">
              <ResponsiveContainer>
                <BarChart data={bars}>
                  <Bar dataKey="v" radius={[3, 3, 0, 0]}>
                    {bars.map((_, i) => (
                      <motion.rect key={i} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* AI reco */}
          <div className="col-span-3 rounded-xl border border-primary/20 bg-primary/5 p-3 relative overflow-hidden">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/20 blur-2xl" />
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-primary">
              <Sparkles className="h-3 w-3" /> AI Copilot
            </div>
            <div className="mt-1.5 text-[12px] font-medium leading-snug">
              Reorder <span className="text-primary">250 units</span> of Raw Material A within 5 days to prevent Line B stoppage.
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/15 text-success">96% confidence</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground">2.3s ago</span>
            </div>
          </div>

          {/* Alerts */}
          <div className="col-span-3 rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Quality & Maintenance</div>
            <div className="space-y-1.5">
              <AlertRow icon={AlertTriangle} color="warning" text="NCR-2831 · Deviation on Motor Housing (3.1%)" />
              <AlertRow icon={Wrench} color="destructive" text="ROBOT-07 · Bearing wear · ETA 4h" />
              <AlertRow icon={CheckCircle2} color="success" text="QC batch #1284 passed" />
            </div>
          </div>

          <div className="col-span-3 rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Purchase Orders</div>
            <div className="h-20">
              <ResponsiveContainer>
                <LineChart data={area}>
                  <Line dataKey="v" type="monotone" stroke="oklch(0.62 0.19 300)" strokeWidth={1.4} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-between text-[10.5px] mt-1">
              <span className="text-muted-foreground">Open</span><span>42</span>
              <span className="text-muted-foreground">Pending</span><span>7</span>
              <span className="text-muted-foreground">Approved</span><span className="text-success">128</span>
            </div>
          </div>
        </div>

        {/* Floating notif */}
        <div className="absolute bottom-3 right-3 w-64 pointer-events-none">
          <AnimatePresence>
            {notif && (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, x: 20, y: 10 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="glass-strong rounded-lg border border-white/10 px-3 py-2 text-[11px] shadow-elegant flex items-center gap-2"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${
                  notif.kind === "ok" ? "bg-success" : notif.kind === "warn" ? "bg-warning" : "bg-primary"
                } animate-pulse`} />
                {notif.text}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </TiltCard>
  );
}

function KPI({ icon: Icon, label, value, trend, ok, warn }: {
  icon: any; label: string; value: string; trend: string; ok?: boolean; warn?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/5 p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mt-1 text-sm font-semibold tabular-nums">{value}</div>
      <div className={`text-[10px] ${warn ? "text-warning" : ok ? "text-muted-foreground" : "text-success"}`}>{trend}</div>
    </div>
  );
}

function AlertRow({ icon: Icon, color, text }: { icon: any; color: "warning" | "destructive" | "success"; text: string }) {
  const c = color === "warning" ? "text-warning" : color === "destructive" ? "text-destructive" : "text-success";
  return (
    <div className="flex items-start gap-2 text-[11px]">
      <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${c}`} />
      <span className="text-foreground/90 leading-snug">{text}</span>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  COMMAND CENTER (hero replacement)                         */
/* ────────────────────────────────────────────────────────── */
function CommandCenter() {
  return (
    <section className="pt-28 pb-16 max-w-7xl mx-auto px-4 sm:px-6">
      <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-10 items-center">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="inline-flex items-center gap-2 text-[11px] px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.03] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            Live system · v4.2.1
          </div>
          <h1 className="mt-5 text-[28px] sm:text-[34px] leading-[1.15] font-semibold tracking-tight">
            FactoryOS <span className="gradient-text">AI</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-md">
            Enterprise Smart Manufacturing Operating System.
          </p>
          <p className="mt-4 text-[13.5px] leading-relaxed text-foreground/80 max-w-lg">
            Manage production, inventory, warehouses, procurement, quality, maintenance, finance,
            HR and AI from one enterprise platform. Multi-tenant, RLS-enforced, audit-logged.
          </p>

          <div className="mt-6 flex items-center gap-2.5">
            <Link to="/auth" className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-[12.5px] font-medium text-white bg-[image:var(--gradient-primary)] shadow-glow hover:opacity-95">
              Launch Platform <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <a href="#tech" className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-[12.5px] font-medium border border-white/10 hover:bg-white/5">
              Documentation
            </a>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-2 max-w-md">
            {[
              { k: "Plants", v: "128" },
              { k: "Machines", v: "9.4k" },
              { k: "SKUs", v: "42k" },
            ].map(x => (
              <div key={x.k} className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{x.k}</div>
                <div className="text-sm font-semibold">{x.v}</div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
          <DashboardPreview />
        </motion.div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  INTERACTIVE FACTORY MAP                                   */
/* ────────────────────────────────────────────────────────── */
const FACTORY_STAGES = [
  { id: "warehouse", label: "Warehouse", icon: Warehouse, stat: "18 zones · 94% util" },
  { id: "inventory", label: "Inventory", icon: Boxes, stat: "42k SKUs · 3 low" },
  { id: "production", label: "Production", icon: Cog, stat: "12 lines · OEE 87%" },
  { id: "quality", label: "Quality", icon: ShieldCheck, stat: "NCR 0.4% · Cpk 1.6" },
  { id: "packaging", label: "Packaging", icon: Package, stat: "8.2k/hr" },
  { id: "dispatch", label: "Dispatch", icon: Truck, stat: "42 shipments today" },
] as const;

function FactoryMap() {
  const [active, setActive] = useState<string | null>(null);
  const [modal, setModal] = useState<typeof FACTORY_STAGES[number] | null>(null);

  return (
    <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6">
      <SectionHeader eyebrow="Plant Layout" title="Interactive factory map" desc="Hover a station for live stats. Click to inspect." />

      <div className="mt-8 relative rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-8">
        {/* Connection lines (SVG) */}
        <svg className="absolute inset-0 h-full w-full pointer-events-none" preserveAspectRatio="none">
          <defs>
            <linearGradient id="flow" x1="0" x2="1">
              <stop offset="0%" stopColor="oklch(0.58 0.22 259)" stopOpacity="0" />
              <stop offset="50%" stopColor="oklch(0.58 0.22 259)" stopOpacity="0.8" />
              <stop offset="100%" stopColor="oklch(0.62 0.19 300)" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        <div className="relative grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 overflow-x-auto">
          {FACTORY_STAGES.map((s, i) => (
            <motion.button
              key={s.id}
              onMouseEnter={() => setActive(s.id)}
              onMouseLeave={() => setActive(null)}
              onClick={() => setModal(s)}
              initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.05 }}
              className="group relative rounded-xl border border-white/10 bg-card/50 p-4 text-left hover:border-primary/40 hover:bg-primary/5 transition"
            >
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 rounded-lg bg-[image:var(--gradient-primary)] grid place-items-center shadow-glow">
                  <s.icon className="h-4 w-4 text-white" />
                </div>
                <span className="text-[10px] text-muted-foreground">0{i + 1}</span>
              </div>
              <div className="mt-3 text-sm font-medium">{s.label}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">{s.stat}</div>
              <AnimatePresence>
                {active === s.id && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-x-0 -bottom-2 mx-3 h-0.5 bg-[image:var(--gradient-primary)] rounded-full" />
                )}
              </AnimatePresence>
            </motion.button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {modal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setModal(null)}
            className="fixed inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur-md p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="glass-strong rounded-2xl border border-white/10 p-6 max-w-md w-full shadow-elegant"
            >
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-glow">
                  <modal.icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="text-sm font-semibold">{modal.label}</div>
                  <div className="text-xs text-muted-foreground">{modal.stat}</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {["Throughput", "Utilization", "Alerts"].map((k, i) => (
                  <div key={k} className="rounded-lg bg-white/[0.03] p-2">
                    <div className="text-[10px] uppercase text-muted-foreground">{k}</div>
                    <div className="text-sm font-semibold">{["98%", "87%", "2"][i]}</div>
                  </div>
                ))}
              </div>
              <button onClick={() => setModal(null)} className="mt-5 w-full h-9 rounded-md text-[12.5px] bg-white/5 hover:bg-white/10">
                Close preview
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  LIVE PRODUCTION FLOW                                       */
/* ────────────────────────────────────────────────────────── */
const FLOW = [
  { id: "supplier", label: "Supplier", icon: Truck },
  { id: "raw", label: "Raw Material", icon: Layers },
  { id: "warehouse", label: "Warehouse", icon: Warehouse },
  { id: "production", label: "Production", icon: Cog },
  { id: "assembly", label: "Assembly", icon: Wrench },
  { id: "quality", label: "Quality", icon: ShieldCheck },
  { id: "packaging", label: "Packaging", icon: Package },
  { id: "finished", label: "Finished Goods", icon: PackageCheck },
  { id: "customer", label: "Customer", icon: Users },
] as const;

function ProductionFlow() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const activeIdx = useTransform(scrollYProgress, [0.1, 0.9], [0, FLOW.length - 1]);
  const [current, setCurrent] = useState(0);

  useEffect(() => activeIdx.on("change", v => setCurrent(Math.min(FLOW.length - 1, Math.max(0, Math.round(v))))), [activeIdx]);

  return (
    <section ref={ref} className="py-20 max-w-7xl mx-auto px-4 sm:px-6">
      <SectionHeader eyebrow="End-to-end pipeline" title="Live production flow" desc="Material moves as you scroll — every stage updates in real time." />

      <div className="mt-10 relative">
        {/* Horizontal scrollable on mobile, grid on desktop */}
        <div className="grid grid-cols-3 md:grid-cols-9 gap-2 relative">
          {FLOW.map((s, i) => {
            const active = i <= current;
            return (
              <motion.div key={s.id}
                initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                className="relative">
                <div className={`rounded-xl border p-3 text-center transition-all ${
                  active ? "border-primary/50 bg-primary/10 shadow-glow" : "border-white/5 bg-white/[0.02]"
                }`}>
                  <s.icon className={`h-4 w-4 mx-auto ${active ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="mt-1.5 text-[10.5px] font-medium">{s.label}</div>
                  <div className="mt-1 h-1 rounded-full bg-white/5 overflow-hidden">
                    <motion.div className="h-full bg-[image:var(--gradient-primary)]"
                      initial={{ width: 0 }}
                      animate={{ width: active ? "100%" : "0%" }}
                      transition={{ duration: 0.6 }} />
                  </div>
                </div>
                {i < FLOW.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-1 h-px w-2 bg-white/10" />
                )}
              </motion.div>
            );
          })}
        </div>

        <div className="mt-6 rounded-xl border border-white/5 bg-white/[0.02] p-4 flex items-center gap-4 text-[12.5px]">
          <Radio className="h-4 w-4 text-success animate-pulse" />
          <span className="text-muted-foreground">Current stage:</span>
          <span className="font-medium">{FLOW[current].label}</span>
          <span className="ml-auto text-muted-foreground tabular-nums">Batch #{1284 + current} · {(94 - current * 0.6).toFixed(1)}%</span>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  CORE MODULES                                              */
/* ────────────────────────────────────────────────────────── */
const MODULES = [
  { label: "Inventory", icon: Boxes, hint: "42k SKUs" },
  { label: "Warehouse", icon: Warehouse, hint: "18 zones" },
  { label: "Production", icon: Cog, hint: "12 lines" },
  { label: "Quality", icon: ShieldCheck, hint: "NCR 0.4%" },
  { label: "Maintenance", icon: Wrench, hint: "94% uptime" },
  { label: "Finance", icon: Landmark, hint: "GL · AP · AR" },
  { label: "HR", icon: Users, hint: "412 people" },
  { label: "Procurement", icon: ShoppingCart, hint: "128 POs" },
  { label: "CRM", icon: Network, hint: "312 accounts" },
  { label: "Analytics", icon: Activity, hint: "real-time" },
  { label: "AI Center", icon: Sparkles, hint: "copilot" },
  { label: "Documents", icon: FileCheck2, hint: "ISO ready" },
];

function CoreModules() {
  return (
    <section id="modules" className="py-20 max-w-7xl mx-auto px-4 sm:px-6">
      <SectionHeader eyebrow="Modules" title="One platform, every function" desc="Consistent primitives across every module — with role-scoped access." />
      <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {MODULES.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ delay: i * 0.03 }}
            whileHover={{ y: -3 }}
            className="group rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:border-primary/40 hover:shadow-glow transition"
          >
            <div className="flex items-center justify-between">
              <div className="h-9 w-9 rounded-lg bg-white/5 grid place-items-center group-hover:bg-[image:var(--gradient-primary)] transition">
                <m.icon className="h-4 w-4" />
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition" />
            </div>
            <div className="mt-3 text-sm font-medium">{m.label}</div>
            <div className="text-[11px] text-muted-foreground">{m.hint}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  AI CENTER — realistic outputs                             */
/* ────────────────────────────────────────────────────────── */
function AICenter() {
  const p1 = useTicker(82, 0.03);
  const p2 = useTicker(250, 0.02);
  const p3 = useTicker(3.1, 0.05);

  return (
    <section id="ai" className="py-20 max-w-7xl mx-auto px-4 sm:px-6">
      <SectionHeader eyebrow="AI Center" title="Decisions, not demos" desc="Live model outputs from production, maintenance and inventory streams." />
      <div className="mt-10 grid md:grid-cols-3 gap-4">
        <AICard title="Predictive Maintenance" chip="Machine 07">
          <Row k="Failure probability" v={`${p1.toFixed(0)}%`} vColor="text-warning" />
          <Row k="Recommended action" v="Replace bearing" />
          <Row k="Confidence" v="96%" vColor="text-success" />
          <Row k="Est. downtime saved" v="14 hrs" />
        </AICard>
        <AICard title="Inventory Forecast" chip="Raw Material A">
          <Row k="Estimated shortage" v="5 days" vColor="text-destructive" />
          <Row k="Suggested purchase" v={`${Math.round(p2)} units`} />
          <Row k="Confidence" v="93%" vColor="text-success" />
          <Row k="Lead time buffer" v="+2 days" />
        </AICard>
        <AICard title="Quality Alert" chip="Motor Housing">
          <Row k="Expected defect rate" v={`${p3.toFixed(1)}%`} vColor="text-warning" />
          <Row k="Root cause" v="Torque drift on Station 3" />
          <Row k="Confidence" v="88%" vColor="text-success" />
          <Row k="Action" v="Recalibrate spindle" />
        </AICard>
      </div>
    </section>
  );
}

function AICard({ title, chip, children }: { title: string; chip: string; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
      className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 relative overflow-hidden">
      <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-primary/15 blur-3xl" />
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-primary">
        <Sparkles className="h-3 w-3" /> Model output
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <div className="text-sm font-semibold">{title}</div>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground">{chip}</span>
      </div>
      <div className="mt-4 space-y-2">{children}</div>
    </motion.div>
  );
}

function Row({ k, v, vColor = "text-foreground" }: { k: string; v: string; vColor?: string }) {
  return (
    <div className="flex items-center justify-between text-[12.5px] border-t border-white/5 pt-2">
      <span className="text-muted-foreground">{k}</span>
      <span className={`font-medium tabular-nums ${vColor}`}>{v}</span>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  ROLE HIERARCHY                                            */
/* ────────────────────────────────────────────────────────── */
function RoleHierarchy() {
  const [hovered, setHovered] = useState<string | null>(null);
  const meta = hovered ? ROLES.find(r => r.id === hovered) : null;
  return (
    <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6">
      <SectionHeader eyebrow="Access model" title="Role hierarchy" desc="Every user is scoped by role, plant and company — enforced in the database." />
      <div className="mt-10 grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {ROLES.map((r, i) => (
            <motion.button
              key={r.id}
              onMouseEnter={() => setHovered(r.id)}
              initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.02 }}
              className={`group relative rounded-xl border p-3 text-left transition ${
                hovered === r.id ? "border-primary/50 bg-primary/5" : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${r.accent} grid place-items-center`}>
                <r.icon className="h-4 w-4 text-white" />
              </div>
              <div className="mt-2 text-[12px] font-medium truncate">{r.label}</div>
              <div className="text-[10.5px] text-muted-foreground truncate">{r.tagline}</div>
            </motion.button>
          ))}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 min-h-[220px]">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Selected role</div>
          {meta ? (
            <>
              <div className="mt-1 flex items-center gap-2">
                <div className={`h-9 w-9 rounded-lg bg-gradient-to-br ${meta.accent} grid place-items-center`}>
                  <meta.icon className="h-4 w-4 text-white" />
                </div>
                <div>
                  <div className="text-sm font-semibold">{meta.label}</div>
                  <div className="text-[11px] text-muted-foreground">{meta.tagline}</div>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-[12px]">
                <Row k="Scope" v={meta.group === "platform" ? "Global" : meta.group === "company" ? "Company" : meta.group === "operations" ? "Plant" : "External"} />
                <Row k="Access model" v="RLS + JWT" />
                <Row k="Audit" v="All writes logged" />
              </div>
            </>
          ) : (
            <div className="mt-4 text-[12.5px] text-muted-foreground">Hover a role to inspect responsibilities, permissions and modules.</div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  SECURITY                                                  */
/* ────────────────────────────────────────────────────────── */
function Security() {
  const items = [
    { icon: Layers, label: "Multi-tenant" },
    { icon: KeyRound, label: "JWT" },
    { icon: Lock, label: "Row-Level Security" },
    { icon: ScrollText, label: "Audit logs" },
    { icon: Database, label: "Encryption at rest" },
    { icon: Network, label: "Permission matrix" },
  ];
  return (
    <section id="security" className="py-20 max-w-7xl mx-auto px-4 sm:px-6">
      <SectionHeader eyebrow="Enterprise security" title="Built for regulated plants" desc="Security is enforced in the database, not the UI." />
      <div className="mt-10 grid md:grid-cols-[280px_minmax(0,1fr)] gap-6 items-center">
        <div className="relative rounded-2xl border border-white/10 bg-white/[0.02] p-8 grid place-items-center">
          <div className="absolute inset-0 rounded-2xl bg-[image:var(--gradient-primary)] opacity-10 blur-2xl" />
          <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 3, repeat: Infinity }}
            className="relative h-28 w-28 rounded-full grid place-items-center bg-[image:var(--gradient-primary)] shadow-glow">
            <ShieldCheck className="h-12 w-12 text-white" />
          </motion.div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {items.map((it, i) => (
            <motion.div key={it.label}
              initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-white/5 grid place-items-center">
                <it.icon className="h-4 w-4 text-primary" />
              </div>
              <span className="text-[12.5px] font-medium">{it.label}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  TECH STACK                                                */
/* ────────────────────────────────────────────────────────── */
function Tech() {
  const stack = ["React", "TypeScript", "Supabase", "PostgreSQL", "TailwindCSS", "Framer Motion", "React Three Fiber", "Shadcn UI", "Recharts"];
  return (
    <section id="tech" className="py-20 max-w-7xl mx-auto px-4 sm:px-6">
      <SectionHeader eyebrow="Engineering" title="Built on a modern stack" />
      <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        {stack.map((t, i) => (
          <motion.div key={t}
            initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ delay: i * 0.04 }}
            className="rounded-xl border border-white/10 bg-white/[0.02] p-3 flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="text-[12.5px] font-medium">{t}</span>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  SECTION HEADER + FOOTER                                   */
/* ────────────────────────────────────────────────────────── */
function SectionHeader({ eyebrow, title, desc }: { eyebrow: string; title: string; desc?: string }) {
  return (
    <div className="max-w-2xl">
      <div className="text-[10.5px] uppercase tracking-[0.15em] text-primary">{eyebrow}</div>
      <h2 className="mt-2 text-[22px] sm:text-[26px] font-semibold tracking-tight">{title}</h2>
      {desc && <p className="mt-2 text-[13.5px] text-muted-foreground">{desc}</p>}
    </div>
  );
}

function Footer() {
  return (
    <footer id="contact" className="mt-16 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid md:grid-cols-4 gap-6 text-[12.5px]">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-[image:var(--gradient-primary)] grid place-items-center">
              <Factory className="h-3 w-3 text-white" />
            </div>
            <span className="font-semibold">FactoryOS AI</span>
          </div>
          <p className="mt-3 text-muted-foreground max-w-xs">The enterprise operating system for modern factories.</p>
        </div>
        {[
          { h: "Product", l: ["Modules", "AI Platform", "Security", "Roadmap"] },
          { h: "Company", l: ["About", "Careers", "Press", "Legal"] },
          { h: "Resources", l: ["Documentation", "API", "Status", "Contact"] },
        ].map(g => (
          <div key={g.h}>
            <div className="text-foreground font-medium mb-2">{g.h}</div>
            <ul className="space-y-1.5 text-muted-foreground">
              {g.l.map(x => <li key={x}><a href="#" className="hover:text-foreground">{x}</a></li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>© {new Date().getFullYear()} FactoryOS AI. All rights reserved.</span>
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> All systems operational</span>
        </div>
      </div>
    </footer>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  PAGE                                                      */
/* ────────────────────────────────────────────────────────── */
function LandingPage() {
  return (
    <div className="min-h-screen text-foreground">
      <BlueprintBackground />
      <TopNav />
      <CommandCenter />
      <FactoryMap />
      <ProductionFlow />
      <CoreModules />
      <AICenter />
      <RoleHierarchy />
      <Security />
      <Tech />
      <Footer />
    </div>
  );
}
