import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence, useScroll, useVelocity } from "framer-motion";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Activity, Factory, Warehouse, Package, ShieldCheck, Wrench, Landmark, Users,
  ShoppingCart, Sparkles, Boxes, Truck, PackageCheck,
  ArrowRight, Search, Sun, Moon, Menu, X, Lock, FileCheck2,
  ScrollText, Network, ChevronRight, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle2, Radio, Database, Zap, Cog,
  BarChart3, Clock, Globe, HardDrive,
  UserCheck, Building2, Server, KeyRound,
} from "lucide-react";
import {
  LineChart as RechartLine, Line, ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip,
} from "recharts";
import { ROLES } from "@/lib/roles";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FactoryOS AI — Intelligent Manufacturing Platform" },
      { name: "description", content: "AI-powered Smart Manufacturing ERP. Production, inventory, quality, maintenance, finance, HR and AI in one platform." },
      { property: "og:title", content: "FactoryOS AI — Intelligent Manufacturing Platform" },
      { property: "og:description", content: "AI-powered Smart Manufacturing ERP built for modern enterprise operations." },
    ],
  }),
  component: LandingPage,
});

/* ────────────────────────────────────────────────────────── */
/*  SECTION 1 — INTERACTIVE NETWORK CANVAS                    */
/* ────────────────────────────────────────────────────────── */
const NETWORK_NODES = [
  { id: "inventory", label: "Inventory", icon: Boxes, x: 10, y: 30 },
  { id: "warehouse", label: "Warehouse", icon: Warehouse, x: 30, y: 15 },
  { id: "production", label: "Production", icon: Cog, x: 50, y: 30 },
  { id: "quality", label: "Quality", icon: ShieldCheck, x: 70, y: 15 },
  { id: "finance", label: "Finance", icon: Landmark, x: 90, y: 30 },
  { id: "hr", label: "HR", icon: Users, x: 10, y: 65 },
  { id: "crm", label: "CRM", icon: Network, x: 30, y: 80 },
  { id: "ai", label: "AI", icon: Sparkles, x: 50, y: 65 },
  { id: "analytics", label: "Analytics", icon: Activity, x: 70, y: 80 },
  { id: "procurement", label: "Procurement", icon: ShoppingCart, x: 90, y: 65 },
] as const;

const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [5, 6], [6, 7], [7, 8], [8, 9],
  [0, 5], [2, 7], [4, 9], [1, 6],
  [2, 7], [3, 8],
];

function NetworkCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const [activePulse, setActivePulse] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActivePulse(p => (p + 1) % CONNECTIONS.length), 1800);
    return () => clearInterval(t);
  }, []);

  const onMove = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) { mouseX.set((e.clientX - rect.left) / rect.width); mouseY.set((e.clientY - rect.top) / rect.height); }
  }, [mouseX, mouseY]);

  return (
    <section ref={containerRef} onMouseMove={onMove} className="relative w-full h-[420px] sm:h-[520px] overflow-hidden select-none">
      {/* Blueprint grid */}
      <div className="absolute inset-0 opacity-[0.07]">
        <svg className="w-full h-full">
          <defs>
            <pattern id="net-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M32 0H0V32" fill="none" stroke="currentColor" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#net-grid)" />
        </svg>
      </div>

      {/* SVG Connections */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {CONNECTIONS.map(([from, to], i) => {
          const a = NETWORK_NODES[from], b = NETWORK_NODES[to];
          const cx = `${(a.x + b.x) / 2}%`, cy = `${(a.y + b.y) / 2}%`;
          const isPulsing = activePulse === i;
          return (
            <g key={i}>
              <line
                x1={`${a.x}%`} y1={`${a.y}%`} x2={`${b.x}%`} y2={`${b.y}%`}
                className="stroke-white/[0.08]" strokeWidth="1"
              />
              {/* Animated pulse dot */}
              {isPulsing && (
                <motion.circle
                  r="2.5" fill="oklch(0.58 0.22 259)"
                  initial={{ cx: `${a.x}%`, cy: `${a.y}%`, opacity: 0 }}
                  animate={{
                    cx: [`${a.x}%`, `${b.x}%`], cy: [`${a.y}%`, `${b.y}%`],
                    opacity: [0, 1, 0],
                  }}
                  transition={{ duration: 1.2, ease: "easeInOut" }}
                />
              )}
              {/* Mouse-reactive glow on connection */}
              <ClosestLine cx={cx} cy={cy} mouseX={mouseX} mouseY={mouseY} />
            </g>
          );
        })}
      </svg>

      {/* Nodes */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-[90%] h-[90%] max-w-5xl">
          {NETWORK_NODES.map((node, i) => (
            <NodeItem
              key={node.id}
              node={node}
              index={i}
              hovered={hovered}
              onHover={setHovered}
              mouseX={mouseX}
              mouseY={mouseY}
              containerRef={containerRef}
            />
          ))}
        </div>
      </div>

      {/* Scroll hint */}
      <motion.div
        animate={{ y: [0, 4, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[11px] text-white/20 flex flex-col items-center gap-1"
      >
        <span>Explore the platform</span>
        <div className="w-4 h-[1px] bg-white/20" />
      </motion.div>
    </section>
  );
}

function ClosestLine({ cx, cy, mouseX, mouseY }: { cx: string; cy: string; mouseX: any; mouseY: any }) {
  const dist = useTransform(
    useVelocity(useTransform(mouseX, (v: number) => Math.abs(parseFloat(cx) / 100 - v))),
    [0, 0.3], [1, 0]
  );
  return (
    <motion.circle
      cx={cx} cy={cy} r="0"
      className="fill-primary/20"
      style={{ opacity: dist }}
    />
  );
}

function NodeItem({ node, index, hovered, onHover, mouseX, mouseY, containerRef }: {
  node: typeof NETWORK_NODES[number];
  index: number;
  hovered: number | null;
  onHover: (i: number | null) => void;
  mouseX: any; mouseY: any; containerRef: any;
}) {
  const springX = useSpring(useMotionValue(0), { stiffness: 120, damping: 12 });
  const springY = useSpring(useMotionValue(0), { stiffness: 120, damping: 12 });

  useEffect(() => {
    const unsubX = mouseX.on("change", (v: number) => {
      const dx = (v - node.x / 100) * 20;
      springX.set(hovered === index ? dx * 0.5 : dx * 0.15);
    });
    const unsubY = mouseY.on("change", (v: number) => {
      const dy = (v - node.y / 100) * 20;
      springY.set(hovered === index ? dy * 0.5 : dy * 0.15);
    });
    return () => { unsubX(); unsubY(); };
  }, [mouseX, mouseY, node.x, node.y, hovered, index, springX, springY]);

  const isHovered = hovered === index;
  const Icon = node.icon;

  return (
    <motion.button
      style={{ x: springX, y: springY, left: `${node.x}%`, top: `${node.y}%` }}
      onMouseEnter={() => onHover(index)}
      onMouseLeave={() => onHover(null)}
      onClick={() => {
        const id = node.id === "ai" ? "ai" : node.id === "analytics" ? "analytics" : node.id === "crm" ? "modules" : "modules";
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      }}
      className="absolute -translate-x-1/2 -translate-y-1/2"
    >
      <motion.div
        animate={{
          scale: isHovered ? 1.15 : 1,
          borderColor: isHovered ? "oklch(0.58 0.22 259 / 0.5)" : "oklch(1 0 0 / 0.08)",
        }}
        transition={{ duration: 0.2 }}
        className="flex items-center gap-2.5 px-3 py-2 rounded-lg border bg-card/80 backdrop-blur-sm cursor-pointer whitespace-nowrap"
      >
        <div className={`h-6 w-6 rounded grid place-items-center transition-colors ${isHovered ? "bg-primary" : "bg-white/5"}`}>
          <Icon className={`h-3 w-3 ${isHovered ? "text-white" : "text-white/60"}`} />
        </div>
        <span className={`text-xs font-medium transition-colors ${isHovered ? "text-white" : "text-white/50"}`}>
          {node.label}
        </span>
      </motion.div>
    </motion.button>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  SECTION 2 — HERO                                           */
/* ────────────────────────────────────────────────────────── */
function Hero() {
  const btnRef = useRef<HTMLAnchorElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `translate(${x * 8}px, ${y * 6}px)`;
  };

  const handleMouseLeave = () => {
    if (btnRef.current) btnRef.current.style.transform = "translate(0, 0)";
  };

  return (
    <section className="pb-16 sm:pb-24 max-w-7xl mx-auto px-4 sm:px-6">
      <div className="max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border border-white/[0.06] bg-white/[0.03] text-white/40">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            v4.2.1 · Production ready
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-6 text-[32px] sm:text-[44px] lg:text-[52px] font-semibold tracking-tight leading-[1.08] text-white"
        >
          Every Operation.<br />
          <span className="text-white/40">One Intelligent Platform.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-4 text-[15px] text-white/50 max-w-xl leading-relaxed"
        >
          AI-powered Smart Manufacturing ERP built for modern enterprise operations.
          Production, inventory, quality, maintenance, finance, HR and AI — unified.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="mt-8 flex items-center gap-3 flex-wrap"
        >
          <Link
            ref={btnRef}
            to="/auth"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="relative inline-flex items-center gap-1.5 h-10 px-5 rounded-lg text-[13px] font-medium text-white bg-primary hover:bg-primary/90 transition-all duration-150 active:scale-[0.97]"
          >
            Explore Platform <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg text-[13px] font-medium border border-white/[0.08] text-white/60 hover:text-white hover:border-white/[0.15] transition-all duration-150 active:scale-[0.97]"
          >
            Sign in
          </Link>
          <button className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg text-[13px] text-white/40 hover:text-white/60 transition-all duration-150">
            <span className="h-5 w-5 rounded border border-white/[0.1] grid place-items-center">
              <PlayIcon className="h-3 w-3" />
            </span>
            Watch workflow
          </button>
        </motion.div>

        {/* Metrics row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="mt-10 flex items-center gap-6 sm:gap-10 text-[12px]"
        >
          {[
            { label: "Plants", value: "128" },
            { label: "Machines", value: "9.4k" },
            { label: "Users", value: "2.1k" },
            { label: "Uptime", value: "99.9%" },
          ].map(m => (
            <div key={m.label}>
              <div className="text-white/30">{m.label}</div>
              <div className="text-white font-semibold text-sm mt-0.5">{m.value}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M8 5v14l11-7L8 5z" fill="currentColor" />
    </svg>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  SECTION 3 — MANUFACTURING WORKFLOW                         */
/* ────────────────────────────────────────────────────────── */
const WORKFLOW_STAGES = [
  { id: "order", label: "Customer Order", icon: ShoppingCart, desc: "Order received and verified" },
  { id: "inventory", label: "Inventory", icon: Boxes, desc: "Stock levels confirmed" },
  { id: "warehouse", label: "Warehouse", icon: Warehouse, desc: "Materials allocated" },
  { id: "production", label: "Production", icon: Cog, desc: "Batch in progress" },
  { id: "quality", label: "Quality", icon: ShieldCheck, desc: "QC inspection passed" },
  { id: "dispatch", label: "Dispatch", icon: Truck, desc: "Shipping scheduled" },
  { id: "finance", label: "Finance", icon: Landmark, desc: "Invoice generated" },
  { id: "analytics", label: "Analytics", icon: Activity, desc: "Performance logged" },
  { id: "ai", label: "AI", icon: Sparkles, desc: "Optimization complete" },
];

function Workflow() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => setActiveIdx(i => (i + 1) % WORKFLOW_STAGES.length), 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <section id="flow" className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 border-t border-white/[0.04]">
      <SectionHeader
        eyebrow="Manufacturing Workflow"
        title="From order to delivery"
        desc="Every stage of your manufacturing pipeline, live and connected."
      />
      <div className="mt-10 relative">
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2.5">
          {WORKFLOW_STAGES.map((stage, i) => {
            const isActive = i === activeIdx;
            const isPast = i < activeIdx;
            const Icon = stage.icon;
            return (
              <motion.button
                key={stage.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04 }}
                onMouseEnter={() => setExpanded(i)}
                onMouseLeave={() => setExpanded(null)}
                onClick={() => setExpanded(expanded === i ? null : i)}
                className="relative text-left"
              >
                <motion.div
                  animate={{
                    borderColor: isActive ? "oklch(0.58 0.22 259 / 0.4)" : isPast ? "oklch(0.72 0.19 145 / 0.25)" : "oklch(1 0 0 / 0.06)",
                    backgroundColor: isActive ? "oklch(0.58 0.22 259 / 0.08)" : "rgba(255,255,255,0.02)",
                  }}
                  transition={{ duration: 0.3 }}
                  className="rounded-xl border p-3"
                >
                  <div className={`h-7 w-7 rounded-lg grid place-items-center ${
                    isActive ? "bg-primary" : isPast ? "bg-success/20" : "bg-white/5"
                  }`}>
                    <Icon className={`h-3.5 w-3.5 ${
                      isActive ? "text-white" : isPast ? "text-success" : "text-white/40"
                    }`} />
                  </div>
                  <div className="mt-2 text-[11px] font-medium text-white/80 truncate">{stage.label}</div>
                  <div className="h-0.5 mt-2 rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      className="h-full bg-primary"
                      initial={{ width: "0%" }}
                      animate={{ width: isActive ? "100%" : isPast ? "100%" : "0%" }}
                      transition={{ duration: 0.6 }}
                    />
                  </div>
                </motion.div>

                {/* Expanded detail */}
                <AnimatePresence>
                  {expanded === i && (
                    <motion.div
                      initial={{ opacity: 0, y: 4, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 mt-2 z-20 w-48 rounded-lg border border-white/[0.08] bg-card p-3 shadow-xl backdrop-blur-xl"
                    >
                      <div className="text-xs font-medium text-white">{stage.label}</div>
                      <div className="text-[11px] text-white/40 mt-0.5">{stage.desc}</div>
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-white/30">
                        <Clock className="h-3 w-3" /> {(i + 1) * 12}m avg.
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </div>

        {/* Live status bar */}
        <div className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 flex items-center gap-3 text-xs">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span className="text-white/40">Current:</span>
          <span className="text-white font-medium">{WORKFLOW_STAGES[activeIdx].label}</span>
          <span className="text-white/20 mx-1">·</span>
          <span className="text-white/40">{WORKFLOW_STAGES[activeIdx].desc}</span>
          <span className="ml-auto text-white/20 tabular-nums">Order #ORD-{4821 + activeIdx}</span>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  SECTION 4 — ENTERPRISE MODULES                             */
/* ────────────────────────────────────────────────────────── */
const ENTERPRISE_MODULES = [
  { label: "Inventory", icon: Boxes, hint: "42k SKUs tracked", color: "from-blue-500/20 to-blue-600/10" },
  { label: "Production", icon: Cog, hint: "12 lines · 87% OEE", color: "from-teal-500/20 to-teal-600/10" },
  { label: "Warehouse", icon: Warehouse, hint: "18 zones · 94% util", color: "from-emerald-500/20 to-emerald-600/10" },
  { label: "Maintenance", icon: Wrench, hint: "94% uptime", color: "from-amber-500/20 to-amber-600/10" },
  { label: "Quality", icon: ShieldCheck, hint: "NCR 0.4% · Cpk 1.6", color: "from-violet-500/20 to-violet-600/10" },
  { label: "Finance", icon: Landmark, hint: "GL · AP · AR", color: "from-green-500/20 to-green-600/10" },
  { label: "HR", icon: Users, hint: "412 employees", color: "from-pink-500/20 to-pink-600/10" },
  { label: "CRM", icon: Network, hint: "312 accounts", color: "from-indigo-500/20 to-indigo-600/10" },
  { label: "AI Center", icon: Sparkles, hint: "Copilot · Predictions", color: "from-primary/30 to-primary/10" },
  { label: "Analytics", icon: BarChart3, hint: "Real-time dashboards", color: "from-cyan-500/20 to-cyan-600/10" },
  { label: "Procurement", icon: ShoppingCart, hint: "128 POs active", color: "from-orange-500/20 to-orange-600/10" },
  { label: "Documents", icon: FileCheck2, hint: "ISO compliant", color: "from-slate-500/20 to-slate-600/10" },
];

function EnterpriseModules() {
  const [clicked, setClicked] = useState<string | null>(null);

  return (
    <section id="modules" className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 border-t border-white/[0.04]">
      <SectionHeader
        eyebrow="Platform"
        title="Every function, one platform"
        desc="Consistent primitives across every module — with role-scoped access."
      />
      <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {ENTERPRISE_MODULES.map((m, i) => (
          <ModuleTile
            key={m.label}
            module={m}
            index={i}
            isClicked={clicked === m.label}
            onClick={() => setClicked(clicked === m.label ? null : m.label)}
          />
        ))}
      </div>
    </section>
  );
}

function ModuleTile({ module: m, index, isClicked, onClick }: {
  module: typeof ENTERPRISE_MODULES[number];
  index: number;
  isClicked: boolean;
  onClick: () => void;
}) {
  const Icon = m.icon;
  const [count, setCount] = useState(0);
  const countRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = parseInt(m.hint.replace(/[^0-9]/g, "").slice(0, 3)) || 100;
    const duration = 1500;
    const start = performance.now();
    const raf = () => {
      const elapsed = performance.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(raf);
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { requestAnimationFrame(raf); observer.disconnect(); }
    }, { threshold: 0.3 });
    if (countRef.current) observer.observe(countRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.03 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="group relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-left hover:border-white/[0.12] transition-all duration-200 overflow-hidden"
    >
      {/* Background gradient on hover */}
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-br ${m.color} transition-opacity duration-300`} />

      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <div className="h-9 w-9 rounded-lg bg-white/[0.04] group-hover:bg-primary/20 grid place-items-center transition-colors duration-200">
            <Icon className="h-4 w-4 text-white/60 group-hover:text-primary transition-colors duration-200" />
          </div>
          <ChevronRight className={`h-3.5 w-3.5 text-white/20 transition-all duration-200 ${
            isClicked ? "rotate-90 text-primary" : "group-hover:translate-x-0.5"
          }`} />
        </div>
        <div className="mt-3 text-sm font-medium text-white/90">{m.label}</div>
        <div ref={countRef} className="text-[11px] text-white/40 mt-0.5">{m.hint}</div>

        {/* Animated number */}
        <AnimatePresence>
          {isClicked && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-3 pt-3 border-t border-white/[0.06] overflow-hidden"
            >
              <div className="text-[10px] text-white/30 uppercase tracking-wider">Live metrics</div>
              <div className="mt-1.5 flex items-baseline gap-1">
                <span className="text-lg font-semibold text-white tabular-nums">{count}</span>
                <span className="text-[10px] text-success">▲ {Math.floor(count * 0.04)}%</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.button>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  SECTION 5 — AI INTELLIGENCE                                */
/* ────────────────────────────────────────────────────────── */
const AI_MESSAGES = [
  { text: "Inventory: Raw Material A projected to run out in 3 days.", type: "warn" as const },
  { text: "Supplier ACME Corp selected — estimated savings $12,400.", type: "success" as const },
  { text: "Production delay detected on Line B-04. Adjusting schedule.", type: "info" as const },
  { text: "Machine M-07: Predictive maintenance due in 48 hours.", type: "warn" as const },
  { text: "Quality trend: Defect rate improving 0.3% week-over-week.", type: "success" as const },
  { text: "Executive summary generated for Q3 board review.", type: "info" as const },
];

function AIIntelligence() {
  const [visible, setVisible] = useState<typeof AI_MESSAGES>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (idx >= AI_MESSAGES.length) return;
    const t = setTimeout(() => {
      setVisible(prev => [...prev, AI_MESSAGES[idx]]);
      setIdx(i => i + 1);
    }, 800);
    return () => clearTimeout(t);
  }, [idx]);

  const typeColors = {
    warn: "border-amber-500/20 bg-amber-500/5",
    success: "border-emerald-500/20 bg-emerald-500/5",
    info: "border-blue-500/20 bg-blue-500/5",
  };

  const typeDot = {
    warn: "bg-amber-500",
    success: "bg-emerald-500",
    info: "bg-blue-500",
  };

  return (
    <section id="ai" className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 border-t border-white/[0.04]">
      <SectionHeader
        eyebrow="AI Intelligence"
        title="AI Copilot, live"
        desc="Real-time decisions from production, inventory, quality and maintenance streams."
      />
      <div className="mt-10 max-w-2xl mx-auto">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 min-h-[320px] relative overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 pb-4 border-b border-white/[0.06]">
            <div className="h-6 w-6 rounded-md bg-primary/20 grid place-items-center">
              <Sparkles className="h-3 w-3 text-primary" />
            </div>
            <div className="text-sm font-medium text-white">AI Copilot</div>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] text-white/30">Live</span>
            </div>
          </div>

          {/* Messages */}
          <div className="mt-4 space-y-2 min-h-[220px]">
            <AnimatePresence>
              {visible.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8, x: -4 }}
                  animate={{ opacity: 1, y: 0, x: 0 }}
                  transition={{ duration: 0.25 }}
                  className={`flex items-start gap-2.5 rounded-lg border p-2.5 ${typeColors[msg.type]}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 ${typeDot[msg.type]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-white/80 leading-relaxed">{msg.text}</div>
                    <div className="text-[10px] text-white/20 mt-1">Just now</div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Typing indicator */}
            {idx < AI_MESSAGES.length && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 px-2.5 py-2"
              >
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="text-[11px] text-white/30">AI is analyzing streams...</span>
              </motion.div>
            )}

            {/* Empty state */}
            {visible.length === 0 && (
              <div className="flex items-center justify-center h-[200px] text-sm text-white/20">
                AI insights will appear here
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  SECTION 6 — ROLE HIERARCHY                                 */
/* ────────────────────────────────────────────────────────── */
function RoleHierarchy() {
  const [expandedRole, setExpandedRole] = useState<string | null>(null);

  const tiers = [
    { label: "Root Super Admin", roles: ["root_super_admin"], color: "text-amber-400", line: "bg-amber-400/30" },
    { label: "Company Admin", roles: ["company_admin"], color: "text-blue-400", line: "bg-blue-400/30" },
    { label: "Plant Admin", roles: ["plant_admin"], color: "text-cyan-400", line: "bg-cyan-400/30" },
    { label: "Managers", roles: ["plant_manager", "production_manager", "warehouse_manager", "procurement_manager", "quality_inspector", "maintenance_engineer", "finance_manager", "hr_manager"], color: "text-teal-400", line: "bg-teal-400/30" },
    { label: "Operators", roles: ["production_operator"], color: "text-slate-400", line: "bg-slate-400/30" },
    { label: "External", roles: ["customer_portal", "supplier_portal", "auditor"], color: "text-violet-400", line: "bg-violet-400/30" },
  ];

  const rolePerms: Record<string, string[]> = {
    root_super_admin: ["Platform access", "All companies", "System config", "Audit logs"],
    company_admin: ["Company settings", "Plant management", "User roles", "Whitelist"],
    plant_admin: ["Plant config", "Departments", "Employee mgmt", "Operations"],
    plant_manager: ["Plant dashboard", "Production view", "Quality view", "Reports"],
    production_manager: ["Work orders", "Scheduling", "BOM", "Capacity"],
    warehouse_manager: ["Inventory", "Stock movement", "Transfers", "Dispatch"],
    procurement_manager: ["POs", "Suppliers", "RFQs", "Goods receipt"],
    quality_inspector: ["Inspections", "Defects", "CAPA", "Reports"],
    maintenance_engineer: ["Machines", "Schedules", "Breakdowns", "Parts"],
    finance_manager: ["Invoices", "Expenses", "Budgets", "P&L"],
    hr_manager: ["Employees", "Attendance", "Payroll", "Training"],
    production_operator: ["Work orders", "Machines", "Logs", "Issues"],
    customer_portal: ["Orders", "Invoices", "Shipments", "Support"],
    supplier_portal: ["POs", "Deliveries", "Invoices", "Performance"],
    auditor: ["Audit logs", "Reports", "Compliance", "Documents"],
  };

  return (
    <section className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 border-t border-white/[0.04]">
      <SectionHeader
        eyebrow="Access Model"
        title="Role hierarchy"
        desc="Every user is scoped by role, plant and company — enforced in the database."
      />
      <div className="mt-10 grid lg:grid-cols-[1fr_300px] gap-8 items-start">
        <div className="space-y-0">
          {tiers.map((tier, ti) => (
            <div key={tier.label}>
              {/* Tier header */}
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: ti * 0.05 }}
                className="flex items-center gap-3 py-3"
              >
                <div className={`h-2 w-2 rounded-full ${tier.line.replace("bg-", "bg-")} bg-opacity-100`} />
                <div className={`text-xs font-medium uppercase tracking-wider ${tier.color}`}>{tier.label}</div>
                <div className="flex-1 h-px bg-white/[0.04]" />
              </motion.div>

              {/* Role pills */}
              <div className="flex flex-wrap gap-1.5 ml-5 mb-1">
                {tier.roles.map(roleId => {
                  const meta = ROLES.find(r => r.id === roleId);
                  if (!meta) return null;
                  const isExpanded = expandedRole === roleId;
                  return (
                    <motion.button
                      key={roleId}
                      initial={{ opacity: 0, scale: 0.95 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => setExpandedRole(isExpanded ? null : roleId)}
                      className={`relative rounded-lg border px-2.5 py-1.5 text-xs transition-all duration-150 ${
                        isExpanded
                          ? "border-primary/40 bg-primary/10 text-white"
                          : "border-white/[0.06] bg-white/[0.02] text-white/60 hover:border-white/[0.12] hover:text-white/80"
                      }`}
                    >
                      {meta.label}
                    </motion.button>
                  );
                })}
              </div>

              {/* Permissions panel */}
              <AnimatePresence>
                {tier.roles.map(roleId => {
                  if (expandedRole !== roleId) return null;
                  const perms = rolePerms[roleId] || [];
                  return (
                    <motion.div
                      key={roleId}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden ml-5 mb-2"
                    >
                      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                        <div className="text-[10px] uppercase tracking-wider text-white/30 mb-2">Permissions</div>
                        <div className="grid grid-cols-2 gap-1">
                          {perms.map(p => (
                            <div key={p} className="flex items-center gap-1.5 text-[11px] text-white/50">
                              <CheckCircle2 className="h-3 w-3 text-primary/60" />
                              {p}
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ))}
        </div>

        {/* Sidebar info */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="text-[10px] uppercase tracking-wider text-white/30">Security model</div>
          <div className="mt-4 space-y-3">
            {[
              { icon: KeyRound, label: "JWT Authentication" },
              { icon: Lock, label: "Row-Level Security" },
              { icon: ScrollText, label: "Audit Logging" },
              { icon: Globe, label: "Multi-tenant Isolation" },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-2.5">
                <div className="h-6 w-6 rounded bg-white/[0.04] grid place-items-center">
                  <s.icon className="h-3 w-3 text-primary/60" />
                </div>
                <span className="text-xs text-white/60">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  SECTION 7 — SECURITY ARCHITECTURE                          */
/* ────────────────────────────────────────────────────────── */
function SecurityArchitecture() {
  const layers = [
    { icon: UserCheck, label: "Authentication", desc: "Supabase Auth + JWT" },
    { icon: FileCheck2, label: "Whitelist", desc: "Email domain verification" },
    { icon: ShieldCheck, label: "Role Permissions", desc: "15 predefined roles" },
    { icon: Lock, label: "Row-Level Security", desc: "PostgreSQL RLS policies" },
    { icon: HardDrive, label: "Encryption at Rest", desc: "AES-256" },
    { icon: ScrollText, label: "Audit Logs", desc: "All writes recorded" },
    { icon: Building2, label: "Multi-company", desc: "Tenant isolation" },
  ];

  return (
    <section id="security" className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 border-t border-white/[0.04]">
      <SectionHeader
        eyebrow="Enterprise Security"
        title="Built for regulated plants"
        desc="Security is enforced in the database, not the UI."
      />
      <div className="mt-10 grid md:grid-cols-[240px_1fr] gap-6 items-center">
        {/* Shield illustration */}
        <div className="relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 grid place-items-center">
          <motion.div
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="h-24 w-24 rounded-full grid place-items-center bg-primary/10"
          >
            <ShieldCheck className="h-10 w-10 text-primary/60" />
          </motion.div>
        </div>

        {/* Security layers */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {layers.map((layer, i) => (
            <motion.div
              key={layer.label}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 hover:border-white/[0.1] transition-colors duration-200"
            >
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-white/[0.04] grid place-items-center">
                  <layer.icon className="h-3.5 w-3.5 text-primary/60" />
                </div>
                <span className="text-xs font-medium text-white/80">{layer.label}</span>
              </div>
              <div className="mt-1.5 text-[10px] text-white/30 ml-9">{layer.desc}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  SECTION 8 — ANALYTICS SHOWCASE                             */
/* ────────────────────────────────────────────────────────── */
const KPI_METRICS = [
  { label: "Revenue", value: "$2.41M", delta: "+12.4%", chart: "area", color: "oklch(0.58 0.22 259)" },
  { label: "Production", value: "1,248/hr", delta: "+8.2%", chart: "line", color: "oklch(0.72 0.14 210)" },
  { label: "OEE", value: "87.4%", delta: "+3.2%", chart: "area", color: "oklch(0.62 0.19 300)" },
  { label: "Efficiency", value: "94.1%", delta: "+1.8%", chart: "line", color: "oklch(0.72 0.19 145)" },
];

function AnalyticsShowcase() {
  const chartData = useMemo(() =>
    Array.from({ length: 14 }, (_, i) => ({
      d: `D${i + 1}`,
      v1: 60 + Math.sin(i / 2) * 15 + Math.random() * 8,
      v2: 40 + Math.cos(i / 2.5) * 10 + Math.random() * 6,
      v3: 70 + Math.sin(i / 1.8) * 12 + Math.random() * 7,
      v4: 80 + Math.cos(i / 2) * 8 + Math.random() * 5,
    })), []);

  return (
    <section id="analytics" className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 border-t border-white/[0.04]">
      <SectionHeader
        eyebrow="Analytics"
        title="Live operations dashboard"
        desc="Real-time KPIs that update as your factory runs."
      />
      <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {KPI_METRICS.map((metric, i) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06 }}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
          >
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-wider text-white/30">{metric.label}</div>
              <span className="text-[10px] text-success flex items-center gap-0.5">
                <TrendingUp className="h-3 w-3" /> {metric.delta}
              </span>
            </div>
            <div className="mt-1.5 text-xl font-semibold text-white tabular-nums">{metric.value}</div>
            <div className="mt-3 h-12">
              <ResponsiveContainer>
                {metric.chart === "area" ? (
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id={`ag-${i}`} x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor={metric.color} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={metric.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey={`v${i + 1}`} stroke={metric.color} strokeWidth={1.5} fill={`url(#ag-${i})`} isAnimationActive />
                  </AreaChart>
                ) : (
                  <RechartLine data={chartData}>
                    <Line type="monotone" dataKey={`v${i + 1}`} stroke={metric.color} strokeWidth={1.5} dot={false} isAnimationActive />
                  </RechartLine>
                )}
              </ResponsiveContainer>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Extended metrics row */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Inventory Turns", value: "8.2", delta: "+0.6" },
          { label: "Machine Health", value: "94%", delta: "+2%" },
          { label: "Quality Rate", value: "99.6%", delta: "+0.1%" },
          { label: "Customer Sat.", value: "4.8/5", delta: "+0.2" },
        ].map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 + i * 0.04 }}
            className="rounded-lg border border-white/[0.04] bg-white/[0.01] p-3"
          >
            <div className="text-[10px] text-white/30">{m.label}</div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-sm font-medium text-white tabular-nums">{m.value}</span>
              <span className="text-[10px] text-success">▲ {m.delta}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  SECTION 9 — TRUSTED PLATFORM                               */
/* ────────────────────────────────────────────────────────── */
function TrustedPlatform() {
  const capabilities = [
    { icon: Activity, label: "99.9% Uptime", desc: "Enterprise SLA with 24/7 monitoring" },
    { icon: Radio, label: "Real-time Sync", desc: "Sub-second data propagation across modules" },
    { icon: ShieldCheck, label: "Enterprise Security", desc: "RLS, JWT, encryption, audit" },
    { icon: Sparkles, label: "AI-first Automation", desc: "Predictive models power every decision" },
    { icon: Globe, label: "Multi-tenant SaaS", desc: "Isolated tenants, shared infrastructure" },
    { icon: Server, label: "Cloud-native", desc: "Deployed on Supabase + Vercel edge" },
  ];

  return (
    <section className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 border-t border-white/[0.04]">
      <SectionHeader
        eyebrow="Platform"
        title="Built for production"
        desc="Enterprise-grade infrastructure that scales with your operations."
      />
      <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {capabilities.map((cap, i) => (
          <motion.div
            key={cap.label}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.04 }}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-start gap-3"
          >
            <div className="h-8 w-8 rounded-lg bg-white/[0.04] grid place-items-center shrink-0">
              <cap.icon className="h-4 w-4 text-primary/60" />
            </div>
            <div>
              <div className="text-sm font-medium text-white/90">{cap.label}</div>
              <div className="text-xs text-white/40 mt-0.5">{cap.desc}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  SECTION 10 — FOOTER                                        */
/* ────────────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="border-t border-white/[0.04]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-8 text-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-primary grid place-items-center">
              <Factory className="h-3 w-3 text-white" />
            </div>
            <span className="text-sm font-semibold text-white">FactoryOS AI</span>
          </div>
          <p className="mt-3 text-xs text-white/40 max-w-xs leading-relaxed">
            The intelligent manufacturing operating system for modern enterprises.
          </p>
          <div className="mt-4 text-[11px] text-white/20">v4.2.1 · © {new Date().getFullYear()}</div>
        </div>

        {[
          { h: "Product", l: ["Modules", "AI Platform", "Security", "Roadmap"] },
          { h: "Resources", l: ["Documentation", "API Reference", "Status", "Support"] },
          { h: "Company", l: ["About", "Careers", "Privacy", "Terms"] },
        ].map(group => (
          <div key={group.h}>
            <div className="text-xs font-medium text-white/60 mb-3">{group.h}</div>
            <ul className="space-y-2">
              {group.l.map(x => (
                <li key={x}>
                  <a href="#" className="text-xs text-white/30 hover:text-white/60 transition-colors duration-150">{x}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/20">
          <span>© {new Date().getFullYear()} FactoryOS AI. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <a href="https://github.com" className="hover:text-white/40 transition-colors">GitHub</a>
            <a href="#" className="hover:text-white/40 transition-colors">Privacy</a>
            <a href="#" className="hover:text-white/40 transition-colors">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  SHARED COMPONENTS                                          */
/* ────────────────────────────────────────────────────────── */
function SectionHeader({ eyebrow, title, desc }: { eyebrow: string; title: string; desc?: string }) {
  return (
    <div className="max-w-2xl">
      <div className="text-[10px] uppercase tracking-[0.2em] text-white/30">{eyebrow}</div>
      <h2 className="mt-3 text-[22px] sm:text-[28px] font-semibold tracking-tight text-white">{title}</h2>
      {desc && <p className="mt-2 text-sm text-white/40 leading-relaxed">{desc}</p>}
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  TOP NAV                                                     */
/* ────────────────────────────────────────────────────────── */
const NAV_LINKS = [
  { label: "Workflow", href: "#flow" },
  { label: "Modules", href: "#modules" },
  { label: "AI", href: "#ai" },
  { label: "Security", href: "#security" },
  { label: "Analytics", href: "#analytics" },
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
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-[oklch(0.14_0.02_260)]/80 backdrop-blur-xl border-b border-white/[0.04]" : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="h-7 w-7 rounded-md bg-primary grid place-items-center">
            <Factory className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-[13px] font-semibold tracking-tight text-white">FactoryOS <span className="text-white/40">AI</span></span>
        </Link>

        <nav className="hidden lg:flex items-center gap-0.5 ml-2">
          {NAV_LINKS.map(l => (
            <a key={l.href} href={l.href}
              className="text-[12px] text-white/40 hover:text-white/80 transition-colors px-2.5 py-1.5 rounded-md hover:bg-white/[0.04]"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setDark(d => !d)} className="grid place-items-center h-8 w-8 rounded-md hover:bg-white/[0.04] text-white/40" aria-label="Theme">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Link to="/auth" className="hidden sm:inline-flex items-center h-8 px-3 rounded-md text-[12px] text-white/60 hover:text-white/80 hover:bg-white/[0.04] transition-all">
            Sign in
          </Link>
          <Link to="/auth" className="inline-flex items-center gap-1 h-8 px-3 rounded-md text-[12px] font-medium text-white bg-primary hover:bg-primary/90 transition-all active:scale-[0.97]">
            Get started <ArrowRight className="h-3 w-3" />
          </Link>
          <button onClick={() => setMobile(true)} className="lg:hidden grid place-items-center h-8 w-8 rounded-md hover:bg-white/[0.04] text-white/40" aria-label="Menu">
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-50 bg-[oklch(0.14_0.02_260)]/98 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between h-14 px-4 border-b border-white/[0.04]">
              <span className="text-sm font-medium text-white">Menu</span>
              <button onClick={() => setMobile(false)} className="grid place-items-center h-8 w-8 text-white/40"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-4 flex flex-col gap-0.5">
              {NAV_LINKS.map(l => (
                <a key={l.href} href={l.href} onClick={() => setMobile(false)}
                  className="px-3 py-3 rounded-lg hover:bg-white/[0.04] text-sm text-white/60 hover:text-white">{l.label}</a>
              ))}
              <hr className="my-3 border-white/[0.04]" />
              <Link to="/auth" onClick={() => setMobile(false)}
                className="px-3 py-3 rounded-lg text-sm font-medium text-white bg-primary/20 text-center">Get started</Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  PAGE                                                      */
/* ────────────────────────────────────────────────────────── */
function LandingPage() {
  return (
    <div className="min-h-screen bg-[oklch(0.14_0.02_260)] text-white selection:bg-primary/30">
      {/* Subtle background */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-[oklch(0.12_0.015_260)]" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-primary/[0.02] blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-blue-500/[0.02] blur-[100px]" />
      </div>

      <TopNav />
      <div className="pt-20">
        <NetworkCanvas />
        <Hero />
        <Workflow />
        <EnterpriseModules />
        <AIIntelligence />
        <RoleHierarchy />
        <SecurityArchitecture />
        <AnalyticsShowcase />
        <TrustedPlatform />
        <Footer />
      </div>
    </div>
  );
}
