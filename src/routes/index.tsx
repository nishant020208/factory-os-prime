import { createFileRoute, Link } from "@tanstack/react-router";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  AnimatePresence,
  useScroll,
  useVelocity,
} from "framer-motion";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Activity,
  Factory,
  Warehouse,
  Package,
  ShieldCheck,
  Wrench,
  Landmark,
  Users,
  ShoppingCart,
  Sparkles,
  Boxes,
  Truck,
  PackageCheck,
  ArrowRight,
  Search,
  Sun,
  Moon,
  Menu,
  X,
  Lock,
  FileCheck2,
  ScrollText,
  Network,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Radio,
  Database,
  Zap,
  Cog,
  Palette,
  BarChart3,
  Clock,
  Globe,
  HardDrive,
  UserCheck,
  Building2,
  Server,
  KeyRound,
} from "lucide-react";
import {
  LineChart as RechartLine,
  Line,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { ROLES } from "@/lib/roles";
import { useTheme, type ThemeMode } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";
import { FactoryHalftoneBackdrop } from "@/components/factory-halftone-backdrop";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FactoryOS AI — Intelligent Manufacturing Platform" },
      {
        name: "description",
        content:
          "AI-powered Smart Manufacturing ERP. Production, inventory, quality, maintenance, finance, HR and AI in one platform.",
      },
      { property: "og:title", content: "FactoryOS AI — Intelligent Manufacturing Platform" },
      {
        property: "og:description",
        content: "AI-powered Smart Manufacturing ERP built for modern enterprise operations.",
      },
    ],
  }),
  component: LandingPage,
});

/* ────────────────────────────────────────────────────────── */
/*  SECTION 1 — INTERACTIVE NETWORK CANVAS                    */
/* ────────────────────────────────────────────────────────── */
const NODE_COLORS: Record<string, string> = {
  warehouse: "oklch(0.72 0.19 145)",
  quality: "oklch(0.67 0.18 145)",
  inventory: "oklch(0.79 0.17 75)",
  production: "oklch(0.58 0.22 259)",
  finance: "oklch(0.65 0.20 160)",
  hr: "oklch(0.62 0.19 300)",
  ai: "oklch(0.65 0.22 280)",
  procurement: "oklch(0.62 0.23 340)",
  crm: "oklch(0.55 0.20 270)",
  analytics: "oklch(0.72 0.14 210)",
};

const NETWORK_NODES = [
  { id: "inventory", label: "Inventory", icon: Boxes, x: 10, y: 30, color: NODE_COLORS.inventory },
  {
    id: "warehouse",
    label: "Warehouse",
    icon: Warehouse,
    x: 30,
    y: 15,
    color: NODE_COLORS.warehouse,
  },
  { id: "production", label: "Production", icon: Cog, x: 50, y: 30, color: NODE_COLORS.production },
  { id: "quality", label: "Quality", icon: ShieldCheck, x: 70, y: 15, color: NODE_COLORS.quality },
  { id: "finance", label: "Finance", icon: Landmark, x: 90, y: 30, color: NODE_COLORS.finance },
  { id: "hr", label: "HR", icon: Users, x: 10, y: 65, color: NODE_COLORS.hr },
  { id: "crm", label: "CRM", icon: Network, x: 30, y: 80, color: NODE_COLORS.crm },
  { id: "ai", label: "AI", icon: Sparkles, x: 50, y: 65, color: NODE_COLORS.ai },
  {
    id: "analytics",
    label: "Analytics",
    icon: Activity,
    x: 70,
    y: 80,
    color: NODE_COLORS.analytics,
  },
  {
    id: "procurement",
    label: "Procurement",
    icon: ShoppingCart,
    x: 90,
    y: 65,
    color: NODE_COLORS.procurement,
  },
] as const;

const CONNECTIONS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [5, 6],
  [6, 7],
  [7, 8],
  [8, 9],
  [0, 5],
  [2, 7],
  [4, 9],
  [1, 6],
  [2, 7],
  [3, 8],
];

function NetworkCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const [activePulse, setActivePulse] = useState(0);
  const [badgePositions, setBadgePositions] = useState<Record<string, { x: number; y: number }>>(
    {},
  );
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  // Track badge pixel positions via getBoundingClientRect relative to inner container
  const updateBadgePositions = useCallback(() => {
    const section = containerRef.current;
    if (!section) return;
    const inner = section.querySelector("[data-badges-container]") as HTMLElement | null;
    if (!inner) return;
    const innerRect = inner.getBoundingClientRect();
    if (innerRect.width === 0 || innerRect.height === 0) return;

    const pos: Record<string, { x: number; y: number }> = {};
    const els = section.querySelectorAll("[data-node-id]");
    els.forEach((el) => {
      const id = el.getAttribute("data-node-id");
      if (!id) return;
      const rect = el.getBoundingClientRect();
      // Position is center of badge element relative to inner container
      pos[id] = {
        x: rect.left + rect.width / 2 - innerRect.left,
        y: rect.top + rect.height / 2 - innerRect.top,
      };
    });
    setBadgePositions(pos);
    setContainerSize({ w: innerRect.width, h: innerRect.height });
  }, []);

  // ResizeObserver on container + inner to recalculate badge positions dynamically
  useEffect(() => {
    const section = containerRef.current;
    if (!section) return;
    const ro = new ResizeObserver(() => updateBadgePositions());
    ro.observe(section);
    const inner = section.querySelector("[data-badges-container]");
    if (inner) ro.observe(inner);
    // Initial measurement
    requestAnimationFrame(updateBadgePositions);
    return () => ro.disconnect();
  }, [updateBadgePositions]);

  useEffect(() => {
    const t = setInterval(() => setActivePulse((p) => (p + 1) % CONNECTIONS.length), 1800);
    return () => clearInterval(t);
  }, []);

  const onMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        mouseX.set((e.clientX - rect.left) / rect.width);
        mouseY.set((e.clientY - rect.top) / rect.height);
      }
    },
    [mouseX, mouseY],
  );

  return (
    <section
      ref={containerRef}
      onMouseMove={onMove}
      className="relative w-full h-[420px] sm:h-[520px] overflow-hidden select-none"
    >
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

      {/* Nodes wrapper — centered 90% container for badges + connections */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div data-badges-container className="relative w-[90%] h-[90%] max-w-5xl">
          {/* SVG Connections with bezier curves — NO viewBox, using pixel coordinates
              from getBoundingClientRect so paths match badge DOM positions on any screen size.
              ResizeObserver triggers full recalculation on resize. */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none z-10"
            style={{ overflow: "visible" }}
          >
            {CONNECTIONS.map(([from, to], i) => {
              const a = NETWORK_NODES[from],
                b = NETWORK_NODES[to];
              const pa = badgePositions[a.id];
              const pb = badgePositions[b.id];
              // Fallback: use percentage-based viewBox estimate if pixel positions not yet available
              if (!pa || !pb) {
                const { w, h } = containerSize;
                const scaleX = w / 100,
                  scaleY = h / 100;
                const ax = a.x * scaleX,
                  ay = a.y * scaleY;
                const bx = b.x * scaleX,
                  by = b.y * scaleY;
                const cpx1 = ax + (bx - ax) * 0.3,
                  cpy1 = ay + (by - ay) * 0.1 - 3;
                const cpx2 = ax + (bx - ax) * 0.7,
                  cpy2 = by + (ay - by) * 0.1 + 3;
                const d = `M${ax} ${ay} C${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${bx} ${by}`;
                const cxMid = (ax + bx) / 2,
                  cyMid = (ay + by) / 2;
                return (
                  <g key={i}>
                    <path
                      d={d}
                      className="stroke-foreground/[0.06]"
                      fill="none"
                      strokeWidth="0.5"
                    />
                    {activePulse === i && (
                      <path
                        d={d}
                        className="stroke-primary/15"
                        fill="none"
                        strokeWidth="1"
                        strokeDasharray="2 4"
                      />
                    )}
                    {Array.from({ length: 3 }).map((_, di) => (
                      <motion.circle
                        key={`dot-${di}`}
                        r="0.6"
                        className="fill-primary/50"
                        initial={{ offsetDistance: "0%" }}
                        animate={{ offsetDistance: ["0%", "100%"], opacity: [0, 0.8, 0] }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          delay: -di * 1.0,
                          ease: "linear",
                        }}
                        style={{ offsetPath: `path("${d}")` }}
                      />
                    ))}
                    <ClosestLine
                      cx={cxMid}
                      cy={cyMid}
                      cw={w}
                      ch={h}
                      mouseX={mouseX}
                      mouseY={mouseY}
                    />
                  </g>
                );
              }
              const { x: ax, y: ay } = pa;
              const { x: bx, y: by } = pb;
              const cpx1 = ax + (bx - ax) * 0.3,
                cpy1 = ay + (by - ay) * 0.1 - 3;
              const cpx2 = ax + (bx - ax) * 0.7,
                cpy2 = by + (ay - by) * 0.1 + 3;
              const isPulsing = activePulse === i;
              const d = `M${ax} ${ay} C${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${bx} ${by}`;
              const cxMid = (ax + bx) / 2,
                cyMid = (ay + by) / 2;
              return (
                <g key={i}>
                  {/* Bezier curve — pixel coordinates from getBoundingClientRect */}
                  <path d={d} className="stroke-foreground/[0.06]" fill="none" strokeWidth="0.5" />
                  {isPulsing && (
                    <path
                      d={d}
                      className="stroke-primary/15"
                      fill="none"
                      strokeWidth="1"
                      strokeDasharray="2 4"
                    />
                  )}
                  {/* Flowing data dots along bezier — same pixel path for CSS offset-path */}
                  {Array.from({ length: 3 }).map((_, di) => (
                    <motion.circle
                      key={`dot-${di}`}
                      r="0.6"
                      className="fill-primary/50"
                      initial={{ offsetDistance: "0%" }}
                      animate={{
                        offsetDistance: ["0%", "100%"],
                        opacity: [0, 0.8, 0],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        delay: -di * 1.0,
                        ease: "linear",
                      }}
                      style={{
                        offsetPath: `path("${d}")`,
                      }}
                    />
                  ))}
                  {/* Mouse-reactive glow on connection */}
                  <ClosestLine
                    cx={cxMid}
                    cy={cyMid}
                    cw={containerSize.w}
                    ch={containerSize.h}
                    mouseX={mouseX}
                    mouseY={mouseY}
                  />
                </g>
              );
            })}
          </svg>

          {/* Orbital trail ellipses — drawn behind badges */}
          {/* viewBox="0 0 100 100" matches the coordinate system used by badges */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none z-0"
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid meet"
          >
            {NETWORK_NODES.map((node, i) => {
              const dx = node.x - 50;
              const dy = node.y - 50;
              const distPct = Math.sqrt(dx * dx + dy * dy);
              const rx = +(distPct * 0.15);
              const ry = +(rx * 0.7);
              const startAngle = Math.atan2(dy, dx);
              const orbitDur = 25 + (i % 5) * 3;
              const omega = (2 * Math.PI) / orbitDur;
              // Time for badge to reach bottom of ellipse (nearest point, angle = PI/2 in screen coords)
              const tBottom = ((Math.PI / 2 - startAngle + 2 * Math.PI) % (2 * Math.PI)) / omega;
              // Delay: animation starts so the 10% keyframe peak aligns with badge at bottom
              // We need (tBottom + |delay|) mod orbitDur = 0.1 * orbitDur
              const peakTime = 0.1 * orbitDur;
              const rawOffset = (peakTime - tBottom) % orbitDur;
              const normalizedOffset = rawOffset < 0 ? rawOffset + orbitDur : rawOffset;
              const pulseDelay = -normalizedOffset;
              return (
                <ellipse
                  key={node.id}
                  cx={50}
                  cy={50}
                  rx={rx}
                  ry={ry}
                  fill="none"
                  stroke={node.color}
                  strokeWidth="0.3"
                  strokeOpacity="0.08"
                  strokeDasharray="1 3"
                  style={{
                    animation: `orbit-rotate 60s linear infinite, trail-pulse ${orbitDur}s ease-in-out infinite`,
                    animationDelay: `${-(i * 4)}s, ${pulseDelay}s`,
                    transformOrigin: "center",
                  }}
                />
              );
            })}
          </svg>
          {/* Badges */}
          {NETWORK_NODES.map((node, i) => (
            <NodeItem
              key={node.id}
              node={node}
              index={i}
              hovered={hovered}
              onHover={setHovered}
              mouseX={mouseX}
              mouseY={mouseY}
            />
          ))}
        </div>
      </div>

      {/* Scroll hint */}
      <motion.div
        animate={{ y: [0, 4, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[11px] text-foreground/30 flex flex-col items-center gap-1"
      >
        <span>Explore the platform</span>
        <div className="w-4 h-[1px] bg-foreground/20" />
      </motion.div>
    </section>
  );
}

function ClosestLine({
  cx,
  cy,
  cw,
  ch,
  mouseX,
  mouseY,
}: {
  cx: number;
  cy: number;
  cw: number;
  ch: number;
  mouseX: any;
  mouseY: any;
}) {
  // Normalize pixel coordinates to 0-1 for distance comparison with mouseX/mouseY (0-1 range)
  const normX = cw > 0 ? cx / cw : 0.5;
  const normY = ch > 0 ? cy / ch : 0.5;
  const distX = useTransform(mouseX, (v: number) => Math.abs(normX - v));
  const distY = useTransform(mouseY, (v: number) => Math.abs(normY - v));
  const dist = useTransform(useVelocity(distX), [0, 0.25], [1, 0]);
  const scale = useTransform(dist, [0, 1], [5, 1]);
  return (
    <>
      <motion.circle
        cx={cx}
        cy={cy}
        r="0"
        className="fill-primary/30"
        style={{ opacity: dist, scale }}
      />
      <motion.circle
        cx={cx}
        cy={cy}
        r="0"
        className="fill-primary/10"
        style={{
          opacity: useTransform(dist, [0, 1], [0, 0.5]),
          scale: useTransform(scale, [1, 5], [3, 10]),
        }}
      />
    </>
  );
}

function NodeItem({
  node,
  index,
  hovered,
  onHover,
  mouseX,
  mouseY,
}: {
  node: (typeof NETWORK_NODES)[number];
  index: number;
  hovered: number | null;
  onHover: (i: number | null) => void;
  mouseX: any;
  mouseY: any;
}) {
  const mouseSpringX = useSpring(useMotionValue(0), { stiffness: 120, damping: 12 });
  const mouseSpringY = useSpring(useMotionValue(0), { stiffness: 120, damping: 12 });
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const unsubX = mouseX.on("change", (v: number) => {
      const dx = (v - node.x / 100) * 20;
      mouseSpringX.set(hovered === index ? dx * 0.5 : dx * 0.15);
    });
    const unsubY = mouseY.on("change", (v: number) => {
      const dy = (v - node.y / 100) * 20;
      mouseSpringY.set(hovered === index ? dy * 0.5 : dy * 0.15);
    });
    return () => {
      unsubX();
      unsubY();
    };
  }, [mouseX, mouseY, node.x, node.y, hovered, index, mouseSpringX, mouseSpringY]);

  // ── Orbital motion ──
  // Center of badge cluster: (50%, 50%)
  const cx = 50,
    cy = 50;
  const dx = node.x - cx,
    dy = node.y - cy;
  const distPct = Math.sqrt(dx * dx + dy * dy);
  const startAngle = Math.atan2(dy, dx);
  // Orbit radius scales with distance from center (badges further out orbit wider)
  const orbitRadius = distPct * 0.15;
  // Duration varies: 25-37s per badge (within spec's 25-40s range)
  const orbitDur = 25 + (index % 5) * 3;
  const omega = (2 * Math.PI) / orbitDur;
  // Elliptical squish: vertical axis 70% of horizontal
  const ellipseFactor = 0.7;

  const orbitAngleMV = useMotionValue(0);
  useEffect(() => {
    if (reducedMotion) {
      orbitAngleMV.set(0);
      return;
    }
    const delayMs = index * 350;
    const startDelay = setTimeout(() => {
      let lastTime: number | null = null;
      function raf(t: number) {
        if (!lastTime) lastTime = t;
        const dt = (t - lastTime) / 1000;
        lastTime = t;
        const current = orbitAngleMV.get();
        orbitAngleMV.set(current + omega * dt);
        rafId = requestAnimationFrame(raf);
      }
      let rafId = requestAnimationFrame(raf);
      cleanup = () => cancelAnimationFrame(rafId);
    }, delayMs);
    let cleanup: (() => void) | null = null;
    return () => {
      clearTimeout(startDelay);
      if (cleanup) cleanup();
    };
  }, [index, reducedMotion]);

  // Derive X/Y offsets from orbit angle (subtract startAngle so offset is 0 at t=0)
  const orbitOffsetX = useTransform(orbitAngleMV, (a: number) => {
    const angle = startAngle + a;
    return orbitRadius * (Math.cos(angle) - Math.cos(startAngle));
  });
  const orbitOffsetY = useTransform(orbitAngleMV, (a: number) => {
    const angle = startAngle + a;
    return ellipseFactor * orbitRadius * (Math.sin(angle) - Math.sin(startAngle));
  });

  // Compose orbit + mouse spring → final position
  const composedX = useTransform(
    [orbitOffsetX, mouseSpringX],
    (vals: number[]) => vals[0] + vals[1],
  );
  const composedY = useTransform(
    [orbitOffsetY, mouseSpringY],
    (vals: number[]) => vals[0] + vals[1],
  );

  const isHovered = hovered === index;
  const Icon = node.icon;
  const accent = node.color;
  const glowBg = accent.replace(")", " / 0.15)");
  const borderGlow = accent.replace(")", " / 0.4)");

  return (
    <motion.button
      data-node-id={node.id}
      style={{ x: composedX, y: composedY, left: `${node.x}%`, top: `${node.y}%` }}
      onMouseEnter={() => onHover(index)}
      onMouseLeave={() => onHover(null)}
      onClick={() => {
        const id: string =
          node.id === "ai" ? "ai" : node.id === "analytics" ? "analytics" : "modules";
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      }}
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{
        opacity: 1,
        scale: reducedMotion ? 1 : isHovered ? 1.12 : 1,
      }}
      transition={{
        opacity: { type: "spring", stiffness: 180, damping: 18, delay: index * 0.07 },
        scale: { type: "spring", stiffness: 250, damping: 18 },
      }}
      className="absolute -translate-x-1/2 -translate-y-1/2"
    >
      {/* Colored glow behind the badge (orbits with badge) */}
      <motion.div
        className="absolute inset-0 -m-2 rounded-xl pointer-events-none"
        animate={{
          opacity: isHovered ? 1 : 0.6,
          scale: isHovered ? 1.3 : 1,
        }}
        transition={{ duration: 0.3 }}
        style={{
          background: `radial-gradient(circle at 50% 50%, ${glowBg}, transparent 70%)`,
          filter: "blur(4px)",
        }}
      />

      <motion.div
        animate={{
          borderColor: isHovered
            ? borderGlow
            : "color-mix(in oklab, var(--color-border) 80%, transparent)",
          boxShadow: isHovered ? `0 0 20px ${glowBg}` : "0 0 0px transparent",
          y: isHovered ? -4 : 0,
        }}
        transition={{ type: "spring", stiffness: 200, damping: 16 }}
        className="flex items-center gap-2.5 px-3 py-2 rounded-lg border bg-card/70 backdrop-blur-sm cursor-pointer whitespace-nowrap"
      >
        <div
          className="h-6 w-6 rounded grid place-items-center"
          style={{
            backgroundColor: isHovered
              ? accent
              : "color-mix(in oklab, var(--color-foreground) 10%, transparent)",
          }}
        >
          <Icon
            className="h-3 w-3"
            style={{
              color: isHovered
                ? "white"
                : "color-mix(in oklab, var(--color-foreground) 50%, transparent)",
            }}
          />
        </div>
        <span
          className="text-xs font-medium"
          style={{
            color: isHovered ? accent : "var(--color-muted-foreground)",
          }}
        >
          {node.label}
        </span>
      </motion.div>
    </motion.button>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  FLOATING PARTICLES (canvas, ~80, cursor-reactive)         */
/* ────────────────────────────────────────────────────────── */
function FloatingParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -999, y: -999 });
  const raf = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isMobile || prefersReduced) {
      canvas.style.display = "none";
      return;
    }

    let w = 0,
      h = 0;
    const count = 70;
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      alpha: number;
      phase: number;
      baseX: number;
      baseY: number;
    }> = [];

    function resize() {
      w = window.innerWidth;
      h = Math.min(window.innerHeight * 1.1, 700);
      canvas!.width = w * devicePixelRatio;
      canvas!.height = h * devicePixelRatio;
      canvas!.style.width = w + "px";
      canvas!.style.height = h + "px";
      ctx!.scale(devicePixelRatio, devicePixelRatio);
    }

    function init() {
      particles.length = 0;
      for (let i = 0; i < count; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.15 + Math.random() * 0.25;
        particles.push({
          x,
          y,
          baseX: x,
          baseY: y,
          vx: Math.cos(angle) * speed,
          vy: -(0.1 + Math.random() * 0.2),
          size: 1.5 + Math.random() * 2.5,
          alpha: 0.15 + Math.random() * 0.35,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }

    resize();
    init();
    window.addEventListener("resize", () => {
      resize();
      init();
    });

    const onMouse = (e: MouseEvent) => {
      const rect = canvas!.getBoundingClientRect();
      mouse.current.x = e.clientX - rect.left;
      mouse.current.y = e.clientY - rect.top;
    };
    window.addEventListener("mousemove", onMouse, { passive: true });

    function draw() {
      ctx!.clearRect(0, 0, w, h);

      const mx = mouse.current.x;
      const my = mouse.current.y;
      const repelRadius = 120;
      const repelStrength = 1.2;

      for (const p of particles) {
        // Drift: slow upward float with gentle sine oscillation
        p.x += p.vx + Math.sin(Date.now() * 0.001 + p.phase) * 0.08;
        p.y += p.vy;

        // Wrap around vertically
        if (p.y < -10) {
          p.y = h + 10;
          p.baseY = p.y;
          p.baseX = Math.random() * w;
          p.x = p.baseX;
        }
        if (p.y > h + 10) {
          p.y = -10;
          p.baseY = p.y;
        }
        if (p.x < -10 || p.x > w + 10) {
          p.baseX = Math.random() * w;
          p.x = p.baseX;
        }

        // Cursor repulsion
        const dx = p.x - mx;
        const dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < repelRadius && dist > 0) {
          const force = ((repelRadius - dist) / repelRadius) * repelStrength;
          const nx = dx / dist;
          const ny = dy / dist;
          p.x += nx * force * 3;
          p.y += ny * force * 3;
        }

        // Gentle return to base position
        p.x += (p.baseX - p.x) * 0.001;
        p.y += (p.baseY - p.y) * 0.001;

        const isAesthetic = document.documentElement.getAttribute("data-theme") === "aesthetic";
        const color = isAesthetic
          ? `oklch(0.79 0.17 75 / ${p.alpha})`
          : `oklch(0.58 0.22 259 / ${p.alpha})`;

        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx!.fillStyle = color;
        ctx!.fill();

        // Subtle glow ring
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
        ctx!.fillStyle = isAesthetic
          ? `oklch(0.79 0.17 75 / ${p.alpha * 0.15})`
          : `oklch(0.58 0.22 259 / ${p.alpha * 0.15})`;
        ctx!.fill();
      }

      raf.current = requestAnimationFrame(draw);
    }
    raf.current = requestAnimationFrame(draw);

    function onVisibility() {
      if (document.hidden) cancelAnimationFrame(raf.current);
      else raf.current = requestAnimationFrame(draw);
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouse);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-0"
      style={{ maskImage: "linear-gradient(to bottom, black 0%, black 70%, transparent 100%)" }}
    />
  );
}

/* ────────────────────────────────────────────────────────── */
/*  DRIFTING GRADIENT ORBS                                    */
/* ────────────────────────────────────────────────────────── */
function GradientOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {[
        { size: 420, x: "12%", y: "15%", color: "oklch(0.72 0.19 145 / 0.08)", dur: 22, delay: 0 },
        { size: 380, x: "55%", y: "8%", color: "oklch(0.62 0.19 300 / 0.06)", dur: 26, delay: 3 },
        { size: 340, x: "30%", y: "55%", color: "oklch(0.79 0.17 75 / 0.05)", dur: 24, delay: 6 },
        { size: 300, x: "75%", y: "70%", color: "oklch(0.62 0.23 340 / 0.05)", dur: 28, delay: 9 },
        { size: 260, x: "85%", y: "25%", color: "oklch(0.72 0.14 210 / 0.06)", dur: 20, delay: 12 },
      ].map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: orb.size,
            height: orb.size,
            background: `radial-gradient(circle at 40% 40%, ${orb.color} 0%, transparent 70%)`,
          }}
          animate={{
            x: [0, 25, -15, 10, 0],
            y: [0, -20, 12, -8, 0],
            scale: [1, 1.05, 0.97, 1.03, 1],
          }}
          transition={{
            duration: orb.dur,
            delay: orb.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  SECTION 2 — HERO (3D DEPTH PARALLAX)                      */
/* ────────────────────────────────────────────────────────── */
function Hero() {
  const heroRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const springX = useSpring(mouseX, { stiffness: 120, damping: 18 });
  const springY = useSpring(mouseY, { stiffness: 120, damping: 18 });

  // Scroll-based parallax out
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.6], [1, 0.92]);
  const heroY = useTransform(scrollYProgress, [0, 1], [0, -80]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = heroRef.current?.getBoundingClientRect();
    if (rect) {
      mouseX.set((e.clientX - rect.left) / rect.width);
      mouseY.set((e.clientY - rect.top) / rect.height);
    }
  };

  const handleMouseLeave = () => {
    mouseX.set(0.5);
    mouseY.set(0.5);
  };

  // Layer transforms: each layer moves at different depth
  const layer1X = useTransform(springX, [0, 1], [18, -18]);
  const layer1Y = useTransform(springY, [0, 1], [18, -18]);
  const layer2X = useTransform(springX, [0, 1], [10, -10]);
  const layer2Y = useTransform(springY, [0, 1], [10, -10]);
  const layer3X = useTransform(springX, [0, 1], [6, -6]);
  const layer3Y = useTransform(springY, [0, 1], [6, -6]);
  const layer4X = useTransform(springX, [0, 1], [3, -3]);
  const layer4Y = useTransform(springY, [0, 1], [3, -3]);

  const btnRef = useRef<HTMLAnchorElement>(null);

  return (
    <motion.section
      ref={heroRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        opacity: heroOpacity,
        scale: heroScale,
        y: heroY,
        perspective: 800,
      }}
      className="relative pb-16 sm:pb-24 max-w-7xl mx-auto px-4 sm:px-6"
    >
      {/* Furniture factory halftone backdrop (WebGL loupe on desktop) */}
      <div className="absolute -inset-x-4 sm:-inset-x-6 -top-24 bottom-0 -z-0">
        <FactoryHalftoneBackdrop />
      </div>

      {/* Drifting gradient orbs */}
      <GradientOrbs />

      {/* Floating particles */}
      <FloatingParticles />


      <div className="relative z-10" style={{ transformStyle: "preserve-3d" }}>
        {/* Layer 1 — Version badge (moves 18px, deepest) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          style={{ x: layer1X, y: layer1Y }}
        >
          <div className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border border-border bg-muted/40 text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            v4.2.1 · Production ready
          </div>
        </motion.div>

        {/* Layer 2 — Main title (moves 10px, mid-depth) */}
        <motion.div style={{ x: layer2X, y: layer2Y }}>
          <motion.h1 className="mt-6 text-[32px] sm:text-[44px] lg:text-[52px] font-semibold tracking-tight leading-[1.08] text-foreground">
            <span className="inline-flex flex-wrap gap-x-[0.3em]">
              {["Every", "Operation.", "One", "Intelligent", "Platform."].map((word, i) => (
                <motion.span
                  key={word}
                  className="inline-block"
                  initial={{ opacity: 0, rotateX: 85, y: 30, filter: "blur(4px)" }}
                  animate={{ opacity: 1, rotateX: 0, y: 0, filter: "blur(0px)" }}
                  transition={{
                    type: "spring",
                    stiffness: 180,
                    damping: 16,
                    delay: 0.15 + i * 0.09,
                  }}
                  style={{ perspective: 400 }}
                >
                  {i >= 2 ? <span className="text-muted-foreground">{word}</span> : word}
                </motion.span>
              ))}
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16, filter: "blur(3px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ type: "spring", stiffness: 150, damping: 18, delay: 0.55 }}
            className="mt-4 text-[15px] text-muted-foreground max-w-xl leading-relaxed"
          >
            AI-powered Smart Manufacturing ERP built for modern enterprise operations. Production,
            inventory, quality, maintenance, finance, HR and AI — unified.
          </motion.p>
        </motion.div>

        {/* Layer 3 — Buttons & CTA (moves 6px, closer) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          style={{ x: layer3X, y: layer3Y }}
          className="mt-8 flex items-center gap-3 flex-wrap"
        >
          <Link
            ref={btnRef}
            to="/auth"
            onMouseMove={(e) => {
              const el = btnRef.current;
              if (!el) return;
              const r = el.getBoundingClientRect();
              const x = (e.clientX - r.left) / r.width - 0.5;
              const y = (e.clientY - r.top) / r.height - 0.5;
              el.style.transform = `translate(${x * 8}px, ${y * 6}px)`;
            }}
            onMouseLeave={() => {
              if (btnRef.current) btnRef.current.style.transform = "translate(0, 0)";
            }}
            className="relative inline-flex items-center gap-1.5 h-10 px-5 rounded-lg text-[13px] font-medium text-white bg-primary hover:bg-primary/90 transition-all duration-150 active:scale-[0.97]"
          >
            Explore Platform <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg text-[13px] font-medium border border-border text-muted-foreground hover:text-foreground hover:border-border transition-all duration-150 active:scale-[0.97]"
          >
            Sign in
          </Link>
          <button
            onClick={() => {
              const el = document.getElementById("flow");
              if (el) {
                el.scrollIntoView({ behavior: "smooth" });
                setTimeout(() => {
                  const playEvent = new CustomEvent("workflow:play");
                  window.dispatchEvent(playEvent);
                }, 800);
              }
            }}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg text-[13px] text-muted-foreground hover:text-muted-foreground transition-all duration-150 group"
          >
            <span className="h-5 w-5 rounded border border-border grid place-items-center group-hover:border-primary/40 group-hover:bg-primary/10 transition-all duration-200">
              <PlayIcon className="h-3 w-3 group-hover:text-primary transition-colors duration-200" />
            </span>
            Watch workflow
          </button>
        </motion.div>

        {/* Layer 4 — Metrics row with live DB counts (moves 3px, closest) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          style={{ x: layer4X, y: layer4Y }}
          className="mt-10 flex items-center gap-6 sm:gap-10 text-[12px]"
        >
          <LiveMetrics />
        </motion.div>
      </div>
    </motion.section>
  );
}

/* — spring count-up metric counter — */
function MetricCounter({
  label,
  target,
  suffix,
  live = true,
}: {
  label: string;
  target: number;
  suffix: string;
  live?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => {
    if (suffix === "%") return v.toFixed(1);
    return Math.round(v).toString();
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    count.set(0);
    let started = false;
    const run = () => {
      if (started) return;
      started = true;
      const duration = 1500;
      const start = performance.now();
      function raf(now: number) {
        const pct = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - pct, 3);
        count.set(eased * target);
        if (pct < 1) requestAnimationFrame(raf);
      }
      requestAnimationFrame(raf);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          run();
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    // Fallback so the number always renders even if the observer never
    // fires (hidden tab, headless, or reduced-motion contexts).
    const fallback = setTimeout(() => {
      run();
      observer.disconnect();
    }, 2000);
    return () => {
      observer.disconnect();
      clearTimeout(fallback);
    };
  }, [target]);

  return (
    <div ref={ref}>
      <div className="text-muted-foreground">{label}</div>
      {!live ? (
        <div className="text-foreground/40 font-semibold text-sm mt-0.5 tabular-nums">…</div>
      ) : (
        <motion.div className="text-foreground font-semibold text-sm mt-0.5 tabular-nums">
          <motion.span>{rounded}</motion.span>
          {suffix}
        </motion.div>
      )}
    </div>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M8 5v14l11-7L8 5z" fill="currentColor" />
    </svg>
  );
}

/* — live platform metrics pulled from the database (no fake numbers) — */
function LiveMetrics() {
  const [stats, setStats] = useState<{
    companies: number;
    machines: number;
    users: number;
    uptime: number;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.rpc("get_platform_stats");
        if (mounted && data) {
          const s = typeof data === "string" ? JSON.parse(data) : data;
          setStats({
            companies: Number(s.companies ?? 0),
            machines: Number(s.machines ?? 0),
            users: Number(s.users ?? 0),
            uptime: Number(s.uptime ?? 0),
          });
        }
      } catch {
        // Leave stats null → fall back to honest placeholders
      }
      if (mounted) {
        setStats((prev) => prev); // keep whatever we got
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const metrics = [
    { label: "Plants", target: stats?.companies ?? 0, suffix: "", live: !!stats },
    {
      label: "Machines",
      target: stats ? (stats.machines >= 1000 ? stats.machines / 1000 : stats.machines) : 0,
      suffix: stats && stats.machines >= 1000 ? "k" : "",
      live: !!stats,
    },
    {
      label: "Users",
      target: stats ? (stats.users >= 1000 ? stats.users / 1000 : stats.users) : 0,
      suffix: stats && stats.users >= 1000 ? "k" : "",
      live: !!stats,
    },
    { label: "Uptime", target: stats?.uptime ?? 0, suffix: "%", live: !!stats },
  ];

  return (
    <>
      {metrics.map((m) => (
        <MetricCounter
          key={m.label}
          label={m.label}
          target={m.target}
          suffix={m.suffix}
          live={m.live}
        />
      ))}
    </>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  SECTION 3 — MANUFACTURING WORKFLOW                         */
/* ────────────────────────────────────────────────────────── */
const WORKFLOW_STAGES = [
  {
    id: "order",
    label: "Customer Order",
    icon: ShoppingCart,
    desc: "Order received and verified",
    color: "oklch(0.58 0.22 259)",
    bg: "oklch(0.58 0.22 259 / 0.1)",
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: Boxes,
    desc: "Stock levels confirmed",
    color: "oklch(0.72 0.19 145)",
    bg: "oklch(0.72 0.19 145 / 0.1)",
  },
  {
    id: "warehouse",
    label: "Warehouse",
    icon: Warehouse,
    desc: "Materials allocated",
    color: "oklch(0.62 0.19 300)",
    bg: "oklch(0.62 0.19 300 / 0.1)",
  },
  {
    id: "production",
    label: "Production",
    icon: Cog,
    desc: "Batch in progress",
    color: "oklch(0.58 0.22 259)",
    bg: "oklch(0.58 0.22 259 / 0.1)",
  },
  {
    id: "quality",
    label: "Quality",
    icon: ShieldCheck,
    desc: "QC inspection passed",
    color: "oklch(0.67 0.18 220)",
    bg: "oklch(0.67 0.18 220 / 0.1)",
  },
  {
    id: "dispatch",
    label: "Dispatch",
    icon: Truck,
    desc: "Shipping scheduled",
    color: "oklch(0.79 0.17 75)",
    bg: "oklch(0.79 0.17 75 / 0.1)",
  },
  {
    id: "finance",
    label: "Finance",
    icon: Landmark,
    desc: "Invoice generated",
    color: "oklch(0.72 0.19 145)",
    bg: "oklch(0.72 0.19 145 / 0.1)",
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: Activity,
    desc: "Performance logged",
    color: "oklch(0.62 0.23 340)",
    bg: "oklch(0.62 0.23 340 / 0.1)",
  },
  {
    id: "ai",
    label: "AI",
    icon: Sparkles,
    desc: "Optimization complete",
    color: "oklch(0.72 0.14 210)",
    bg: "oklch(0.72 0.14 210 / 0.1)",
  },
];

function Workflow() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const playTimerRef = useRef<number | null>(null);
  const lastScrollIdx = useRef(-1);

  // Pause ambient timer while section is in view (scroll-driven takes over)
  const [sectionInView, setSectionInView] = useState(false);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setSectionInView(entry.isIntersecting), {
      threshold: 0.05,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Watch workflow auto-play
  useEffect(() => {
    const onPlay = () => {
      if (playing) return;
      setPlaying(true);
      setScrollProgress(0);
      setActiveIdx(0);
      setExpanded(0);

      let step = 0;
      playTimerRef.current = window.setInterval(() => {
        step++;
        if (step >= WORKFLOW_STAGES.length) {
          setPlaying(false);
          setExpanded(null);
          if (playTimerRef.current) {
            clearInterval(playTimerRef.current);
            playTimerRef.current = null;
          }
          return;
        }
        setActiveIdx(step);
        setScrollProgress((step + 1) / WORKFLOW_STAGES.length);
        setExpanded(step);
      }, 1200);
    };

    window.addEventListener("workflow:play", onPlay);
    return () => {
      window.removeEventListener("workflow:play", onPlay);
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, [playing]);

  // Scroll-driven animation: IntersectionObserver + ResizeObserver + scroll progress
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    let winH = window.innerHeight;

    const onResize = () => {
      winH = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    const onScroll = () => {
      if (playing) return;
      const rect = el.getBoundingClientRect();
      // Progress: 0 when section bottom enters viewport, 1 when section top leaves
      const totalVisible = rect.height + winH;
      const scrolledPast = winH - rect.top;
      const pct = Math.max(0, Math.min(1, scrolledPast / totalVisible));
      setScrollProgress(pct);
      const idx = Math.min(Math.floor(pct * WORKFLOW_STAGES.length), WORKFLOW_STAGES.length - 1);
      if (idx !== lastScrollIdx.current) {
        lastScrollIdx.current = idx;
        setActiveIdx(idx);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    // Initial measurement (synchronous to avoid initial 0-width flash)
    onScroll();

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
    };
  }, [playing]);

  // Ambient auto-advance timer: only runs when section is NOT mid-scroll (so it doesn't fight scroll)
  useEffect(() => {
    if (playing) return;
    if (sectionInView && scrollProgress > 0.02 && scrollProgress < 0.98) {
      return; // scroll position is driving the stage — pause timer
    }
    const t = setInterval(() => {
      setActiveIdx((i) => (i + 1) % WORKFLOW_STAGES.length);
    }, 2200);
    return () => clearInterval(t);
  }, [playing, sectionInView, scrollProgress]);

  return (
    <section
      ref={sectionRef}
      id="flow"
      className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 border-t border-border"
    >
      <SectionHeader
        eyebrow="Manufacturing Workflow"
        title="From order to delivery"
        desc="Every stage of your manufacturing pipeline, live and connected."
      />
      <div className="mt-10 relative">
        {/* Pipeline connection line — flowing gradient between stages */}
        <div className="hidden lg:block absolute top-[34px] left-[4%] right-[4%] h-px z-0 overflow-hidden">
          <div className="w-full h-full bg-foreground/[0.06]" />
          <motion.div
            className="absolute inset-y-0 left-0 h-full"
            style={{
              width: `${scrollProgress * 100}%`,
              background: `linear-gradient(90deg, ${WORKFLOW_STAGES[activeIdx].color}, ${WORKFLOW_STAGES[activeIdx].color} 60%, transparent)`,
            }}
          />
          {/* Flowing dots along the pipeline */}
          <motion.div
            className="absolute inset-y-0 h-1 w-1 rounded-full"
            style={{ backgroundColor: WORKFLOW_STAGES[activeIdx].color }}
            animate={{
              left: ["0%", "100%"],
              opacity: [0, 1, 1, 0],
            }}
            transition={{
              duration: 2.2,
              repeat: Infinity,
              ease: "linear",
            }}
          />
          <motion.div
            className="absolute inset-y-0 h-0.5 w-0.5 rounded-full opacity-60"
            style={{ backgroundColor: WORKFLOW_STAGES[activeIdx].color }}
            animate={{
              left: ["-20%", "105%"],
              opacity: [0, 0.6, 0.6, 0],
            }}
            transition={{
              duration: 2.8,
              repeat: Infinity,
              ease: "linear",
              delay: 0.8,
            }}
          />
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-1.5 sm:gap-2.5 relative z-10">
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
                    borderColor: isActive
                      ? `${stage.color.replace(")", " / 0.5)")}`
                      : isPast
                        ? `${stage.color.replace(")", " / 0.3)")}`
                        : "color-mix(in oklab, var(--color-foreground) 8%, transparent)",
                    backgroundColor: isActive
                      ? stage.bg
                      : isPast
                        ? `${stage.color.replace(")", " / 0.06)")}`
                        : "color-mix(in oklab, var(--color-foreground) 3%, transparent)",
                    boxShadow: isActive
                      ? `0 0 24px ${stage.color.replace(")", " / 0.2)")}`
                      : "0 0 0px transparent",
                  }}
                  transition={{ type: "spring", stiffness: 200, damping: 18 }}
                  className="relative rounded-lg sm:rounded-xl border p-1.5 sm:p-3 overflow-hidden"
                >
                  {/* Ripple pulse on becoming active — using stage color */}
                  <AnimatePresence>
                    {isActive && (
                      <motion.div
                        key="ripple"
                        className="absolute inset-0 rounded-xl pointer-events-none"
                        initial={{ opacity: 0.4, scale: 0.92 }}
                        animate={{ opacity: 0, scale: 1.12 }}
                        exit={{ opacity: 0, scale: 1.12 }}
                        transition={{ duration: 0.7, ease: "easeOut" }}
                        style={{
                          background: `${stage.color.replace(")", " / 0.2)")}`,
                          borderRadius: "inherit",
                        }}
                      />
                    )}
                  </AnimatePresence>

                  {/* Colored gradient background glow for active stage */}
                  {isActive && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute -top-12 -right-12 w-24 h-24 rounded-full pointer-events-none"
                      style={{
                        background: `radial-gradient(circle, ${stage.color.replace(")", " / 0.15)")}, transparent 70%)`,
                        filter: "blur(8px)",
                      }}
                    />
                  )}

                  <div className="relative z-10">
                    {/* Icon with stage color */}
                    <motion.div
                      animate={{
                        scale: isActive ? [1, 1.1, 1] : 1,
                      }}
                      transition={{
                        duration: 0.6,
                        ease: "easeOut",
                      }}
                      className={`h-7 w-7 rounded-lg grid place-items-center ${
                        isActive ? "" : isPast ? "" : "bg-foreground/10"
                      }`}
                      style={{
                        backgroundColor: isActive
                          ? stage.color
                          : isPast
                            ? `${stage.color.replace(")", " / 0.2)")}`
                            : undefined,
                      }}
                    >
                      <Icon
                        className={`h-3.5 w-3.5 ${
                          isActive
                            ? "text-white"
                            : isPast
                              ? "text-foreground/80"
                              : "text-muted-foreground"
                        }`}
                      />
                    </motion.div>

                    {/* Label with stage color for active */}
                    <div
                      className="mt-2 text-[11px] font-medium truncate transition-colors duration-300"
                      style={{
                        color: isActive
                          ? stage.color
                          : isPast
                            ? "var(--color-foreground)"
                            : "var(--color-foreground)",
                      }}
                    >
                      {stage.label}
                    </div>

                    {/* Colored progress bar */}
                    <div className="h-0.5 mt-2 rounded-full bg-foreground/10 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: stage.color }}
                        initial={{ width: "0%" }}
                        animate={{
                          width: isActive ? "100%" : isPast ? "100%" : "0%",
                          opacity: isPast ? 0.6 : 1,
                        }}
                        transition={{ duration: 0.6 }}
                      />
                    </div>

                    {/* Time estimate badge */}
                    {(isActive || expanded === i) && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-1.5 text-[9px] text-muted-foreground/60 tabular-nums"
                      >
                        ~{(i + 1) * 12}m
                      </motion.div>
                    )}
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
                      className="absolute top-full left-0 mt-2 z-20 w-48 rounded-lg border border-border bg-card p-3 shadow-xl backdrop-blur-xl"
                      style={{ borderColor: `${stage.color.replace(")", " / 0.3)")}` }}
                    >
                      <div
                        className="text-xs font-medium text-foreground"
                        style={{ color: stage.color }}
                      >
                        {stage.label}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{stage.desc}</div>
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" /> Avg. {(i + 1) * 12}m
                      </div>
                      <div
                        className="mt-2 h-px w-full"
                        style={{
                          background: `linear-gradient(90deg, ${stage.color.replace(")", " / 0.3)")}, transparent)`,
                        }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </div>

        {/* Live status bar with stage color */}
        <div
          className="mt-6 rounded-xl border px-4 py-3 flex items-center gap-3 text-xs transition-all duration-500"
          style={{
            borderColor: `${WORKFLOW_STAGES[activeIdx].color.replace(")", " / 0.25)")}`,
            backgroundColor: `${WORKFLOW_STAGES[activeIdx].color.replace(")", " / 0.04)")}`,
          }}
        >
          <motion.span
            key={activeIdx}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: WORKFLOW_STAGES[activeIdx].color }}
          />
          <motion.span
            key={`label-${activeIdx}`}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="text-muted-foreground"
          >
            Current:
          </motion.span>
          <motion.span
            key={`name-${activeIdx}`}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 16 }}
            className="font-medium"
            style={{ color: WORKFLOW_STAGES[activeIdx].color }}
          >
            {WORKFLOW_STAGES[activeIdx].label}
          </motion.span>
          <span className="text-foreground/30 mx-1">·</span>
          <motion.span
            key={`desc-${activeIdx}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-muted-foreground"
          >
            {WORKFLOW_STAGES[activeIdx].desc}
          </motion.span>

          {/* Progress indicator */}
          <div className="ml-auto flex items-center gap-2">
            <motion.div
              key={`progress-${activeIdx}`}
              initial={{ width: 0 }}
              animate={{ width: 32 }}
              className="h-1 rounded-full"
              style={{
                background: `linear-gradient(90deg, ${WORKFLOW_STAGES[activeIdx].color}, ${WORKFLOW_STAGES[activeIdx].color}80)`,
              }}
            />
            <span className="text-foreground/40 tabular-nums text-[10px]">
              {activeIdx + 1}/{WORKFLOW_STAGES.length}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  SECTION 4 — ENTERPRISE MODULES — BENTO GRID                */
/* ────────────────────────────────────────────────────────── */

/* — bento data — */
type BentoSize = "1x1" | "2x1";
interface BentoModule {
  id: string;
  label: string;
  icon: any;
  hint: string;
  sub: string;
  color: string; // tailwind gradient class for bg overlay
  colorHex: string; // oklch string for charts/icons
  size: BentoSize;
  chart?: "sparkline" | "radial";
}

const COLOR_MAP: Record<string, string> = {
  teal: "oklch(0.72 0.19 145)",
  blue: "oklch(0.58 0.22 259)",
  emerald: "oklch(0.72 0.19 145)",
  violet: "oklch(0.62 0.19 300)",
  amber: "oklch(0.79 0.17 75)",
  green: "oklch(0.72 0.19 145)",
  pink: "oklch(0.62 0.23 340)",
  indigo: "oklch(0.62 0.19 300)",
  orange: "oklch(0.79 0.17 75)",
  cyan: "oklch(0.72 0.14 210)",
};
function hexFromColor(c: string): string {
  return COLOR_MAP[Object.keys(COLOR_MAP).find((k) => c.includes(k)) ?? "blue"];
}

const BENTO_MODULES: BentoModule[] = [
  {
    id: "production",
    label: "Production",
    icon: Cog,
    hint: "87.4%",
    sub: "OEE · 12 lines active",
    color: "from-teal-500/20 to-teal-600/10",
    colorHex: hexFromColor("teal"),
    size: "2x1",
    chart: "sparkline",
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: Boxes,
    hint: "42,380",
    sub: "SKUs tracked",
    color: "from-blue-500/20 to-blue-600/10",
    colorHex: hexFromColor("blue"),
    size: "1x1",
  },
  {
    id: "warehouse",
    label: "Warehouse",
    icon: Warehouse,
    hint: "94%",
    sub: "Utilization · 18 zones",
    color: "from-emerald-500/20 to-emerald-600/10",
    colorHex: hexFromColor("emerald"),
    size: "1x1",
  },
  {
    id: "quality",
    label: "Quality",
    icon: ShieldCheck,
    hint: "99.6%",
    sub: "Pass rate · Cpk 1.6",
    color: "from-violet-500/20 to-violet-600/10",
    colorHex: hexFromColor("violet"),
    size: "1x1",
    chart: "sparkline",
  },
  {
    id: "maintenance",
    label: "Maintenance",
    icon: Wrench,
    hint: "96.2%",
    sub: "Uptime · 3 open tickets",
    color: "from-amber-500/20 to-amber-600/10",
    colorHex: hexFromColor("amber"),
    size: "1x1",
    chart: "radial",
  },
  {
    id: "finance",
    label: "Finance",
    icon: Landmark,
    hint: "$2.41M",
    sub: "Revenue · GL · AP · AR",
    color: "from-green-500/20 to-green-600/10",
    colorHex: hexFromColor("green"),
    size: "1x1",
  },
  {
    id: "hr",
    label: "HR",
    icon: Users,
    hint: "412",
    sub: "Employees · 12 departments",
    color: "from-pink-500/20 to-pink-600/10",
    colorHex: hexFromColor("pink"),
    size: "1x1",
  },
  {
    id: "crm-ai",
    label: "CRM + AI Center",
    icon: Sparkles,
    hint: "312 accounts",
    sub: "AI Copilot · Predictions · Insights",
    color: "from-indigo-500/20 to-indigo-600/10",
    colorHex: hexFromColor("indigo"),
    size: "2x1",
  },
  {
    id: "procurement",
    label: "Procurement",
    icon: ShoppingCart,
    hint: "128",
    sub: "Active POs · 36 suppliers",
    color: "from-orange-500/20 to-orange-600/10",
    colorHex: hexFromColor("orange"),
    size: "1x1",
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    hint: "14",
    sub: "Live dashboards · 48 reports",
    color: "from-cyan-500/20 to-cyan-600/10",
    colorHex: hexFromColor("cyan"),
    size: "1x1",
  },
];

/* — utility: bento placement map (lg: grid-cols-4) — */
const BENTO_LAYOUT: Record<string, string> = {
  production: "sm:col-span-2 lg:col-span-2",
  inventory: "sm:col-span-1 lg:col-span-1",
  warehouse: "sm:col-span-1 lg:col-span-1",
  quality: "sm:col-span-1 lg:col-span-1",
  maintenance: "sm:col-span-1 lg:col-span-1",
  finance: "sm:col-span-1 lg:col-span-1",
  hr: "sm:col-span-1 lg:col-span-1",
  "crm-ai": "sm:col-span-2 lg:col-span-2",
  procurement: "sm:col-span-1 lg:col-span-1",
  analytics: "sm:col-span-1 lg:col-span-1",
};

/* — mini sparkline chart — */
let sparkIdCounter = 0;
function MiniSparkline({ color, moduleId }: { color: string; moduleId: string }) {
  const [id] = useState(() => `spark-${moduleId}-${++sparkIdCounter}`);
  const data = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        v: 60 + Math.sin(i * 0.6) * 15 + Math.sin(i * 1.3) * 6 + Math.random() * 5,
      })),
    [],
  );
  return (
    <div className="h-10 w-full mt-2">
      <ResponsiveContainer>
        <AreaChart data={data}>
          <defs>
            <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${id})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* — mini radial gauge — */
function MiniRadial({ value, color }: { value: number; color: string }) {
  const r = 24;
  const circ = 2 * Math.PI * r;
  const [animated, setAnimated] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        let start: number | null = null;
        const duration = 1200;
        function raf(t: number) {
          if (!start) start = t;
          const pct = Math.min((t - start) / duration, 1);
          const eased = 1 - Math.pow(1 - pct, 3);
          setAnimated(eased * value);
          if (pct < 1) requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);
        observer.disconnect();
      },
      { threshold: 0.3 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value]);

  return (
    <div ref={ref} className="relative flex items-center justify-center mt-1">
      <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="color-mix(in oklab, var(--color-foreground) 8%, transparent)"
          strokeWidth="4"
        />
        <motion.circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - animated / 100)}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.3s ease-out" }}
        />
      </svg>
      <div className="absolute text-xs font-semibold text-foreground tabular-nums">
        {Math.round(animated)}%
      </div>
    </div>
  );
}

/* — bento tile (with 3D tilt + spring entry + holographic glow) — */
function BentoModuleTile({
  m,
  index,
  onHover,
}: {
  m: BentoModule;
  index: number;
  onHover?: (id: string | null) => void;
}) {
  const Icon = m.icon;
  const [expanded, setExpanded] = useState(false);
  const [count, setCount] = useState(0);
  const countRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Reduced motion check
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Spring-driven 3D tilt (disabled for reduced motion)
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const springTiltX = useSpring(tiltX, { stiffness: 200, damping: 18 });
  const springTiltY = useSpring(tiltY, { stiffness: 200, damping: 18 });

  // count-up
  useEffect(() => {
    const target = parseInt(m.hint.replace(/[^0-9.]/g, "")) || 100;
    const isPct = m.hint.includes("%");
    const duration = 1500;
    let started = false;
    const rafCb = () => {
      if (started) return;
      started = true;
      const startPerf = performance.now();
      const step = () => {
        const elapsed = performance.now() - startPerf;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const val = isPct ? Math.round(eased * target * 10) / 10 : Math.round(eased * target);
        setCount(val);
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          rafCb();
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    if (countRef.current) observer.observe(countRef.current);
    // Fallback so the value always renders even if the observer never fires
    // (hidden tab, headless, reduced-motion). Snap to the final value instead
    // of animating so the scroll-triggered count-up reveal is preserved for
    // real users on below-the-fold cards.
    const fallback = setTimeout(() => {
      if (!started) {
        setCount(target);
        observer.disconnect();
      }
    }, 2000);
    return () => {
      observer.disconnect();
      clearTimeout(fallback);
    };
  }, [m.hint]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (reducedMotion) return;
    const el = buttonRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    tiltX.set(x * 8);
    tiltY.set(y * 8);
  };

  const handleMouseEnter = () => {
    onHover?.(m.id);
  };

  const handleMouseLeave = () => {
    tiltX.set(0);
    tiltY.set(0);
    onHover?.(null);
  };

  const isTwoCol = m.size === "2x1";

  // Glow background position — tracks cursor tilt for holographic sweep, both axes
  const tiltBgPosX = useTransform(springTiltX, [-4, 4], ["100%", "0%"]);
  const tiltBgPosY = useTransform(springTiltY, [-4, 4], ["100%", "0%"]);
  const tiltBgPos = useTransform(
    [tiltBgPosX, tiltBgPosY],
    (vals: string[]) => `${vals[0]} ${vals[1]}`,
  );
  const glowColor = m.colorHex.replace(")", " / 0.13)");

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true }}
      transition={{ type: "spring", stiffness: 260, damping: 20, delay: index * 0.04 }}
      className={`${BENTO_LAYOUT[m.id]} group`}
    >
      <motion.button
        ref={buttonRef}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        whileTap={{ scale: 0.98 }}
        onClick={() => setExpanded((e) => !e)}
        className={`relative w-full text-left rounded-xl border border-border hover:border-border transition-shadow duration-200 overflow-hidden ${
          isTwoCol ? "p-5" : "p-4"
        } h-full bg-muted/30 group`}
        style={{
          rotateX: reducedMotion ? 0 : springTiltY,
          rotateY: reducedMotion ? 0 : springTiltX,
          perspective: reducedMotion ? "none" : 600,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Holographic glow overlay that sweeps with tilt direction */}
        <motion.div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${glowColor}, transparent 60%)`,
            backgroundPosition: tiltBgPos,
            backgroundSize: "150% 150%",
          }}
        />

        {/* Background gradient on hover (behind content layer) */}
        <div
          className={`absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-br ${m.color} transition-opacity duration-300 z-[1]`}
        />

        <div className="relative z-10 h-full flex flex-col">
          {/* Header row */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`${isTwoCol ? "h-11 w-11" : "h-9 w-9"} rounded-lg bg-muted/50 group-hover:bg-primary/20 grid place-items-center transition-colors duration-200`}
              >
                <Icon
                  className={`${isTwoCol ? "h-5 w-5" : "h-4 w-4"} text-muted-foreground group-hover:text-primary transition-colors duration-200`}
                />
              </div>
              <div>
                <div
                  className={`${isTwoCol ? "text-base" : "text-sm"} font-medium text-foreground`}
                >
                  {m.label}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{m.sub}</div>
              </div>
            </div>
            <ChevronRight
              className={`h-4 w-4 text-foreground/30 transition-all duration-200 ${
                expanded ? "rotate-90 text-primary" : "group-hover:translate-x-0.5"
              }`}
            />
          </div>

          {/* Sparkline chart for Production and Quality */}
          {m.chart === "sparkline" && (
            <div className="mt-auto pt-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-semibold text-foreground tabular-nums" ref={countRef}>
                  {count}
                  {m.hint.includes("%") ? "%" : ""}
                </span>
                <span className="text-[10px] text-success">▲ {isTwoCol ? "3.2" : "0.8"}%</span>
              </div>
              <MiniSparkline color={m.colorHex} moduleId={m.id} />
            </div>
          )}

          {/* Radial gauge for Maintenance */}
          {m.chart === "radial" && (
            <div className="mt-auto pt-1 flex items-center gap-3">
              <div className="relative flex items-center justify-center">
                <MiniRadial value={96.2} color={m.colorHex} />
              </div>
              <div>
                <div className="text-lg font-semibold text-foreground tabular-nums" ref={countRef}>
                  {count}%
                </div>
                <div className="text-[10px] text-muted-foreground">3 open tickets</div>
              </div>
            </div>
          )}

          {/* Plain counter for 1x1 tiles without chart */}
          {!m.chart && (
            <div className="mt-auto pt-3">
              <div className="flex items-baseline gap-1.5">
                <span className={`${isTwoCol ? "text-sm" : "text-[11px]"} text-muted-foreground`}>
                  {m.hint.includes("%") ? "" : ""}
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span
                  className={`${isTwoCol ? "text-2xl" : "text-xl"} font-semibold text-foreground tabular-nums`}
                  ref={countRef}
                >
                  {count}
                  {m.hint.includes("%") ? "%" : m.hint.startsWith("$") ? "" : ""}
                </span>
                {!m.hint.includes("%") && !m.hint.startsWith("$") && (
                  <span className="text-[10px] text-success">▲ 4.2%</span>
                )}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{m.sub}</div>
            </div>
          )}

          {/* Expanded detail */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-3 pt-3 border-t border-border overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                      {m.id === "production"
                        ? "Output"
                        : m.id === "inventory"
                          ? "Low stock"
                          : m.id === "warehouse"
                            ? "Zones"
                            : m.id === "quality"
                              ? "Inspected"
                              : m.id === "maintenance"
                                ? "Scheduled"
                                : m.id === "finance"
                                  ? "Expenses"
                                  : m.id === "hr"
                                    ? "New hires"
                                    : m.id === "crm-ai"
                                      ? "AI insights"
                                      : m.id === "procurement"
                                        ? "Pending"
                                        : "Reports"}
                    </div>
                    <div className="text-sm font-semibold text-foreground tabular-nums mt-0.5">
                      {Math.round(count * (0.3 + Math.random() * 0.5))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                      {m.id === "production"
                        ? "Efficiency"
                        : m.id === "inventory"
                          ? "Value"
                          : m.id === "warehouse"
                            ? "Capacity"
                            : m.id === "quality"
                              ? "Passed"
                              : m.id === "maintenance"
                                ? "Overdue"
                                : m.id === "finance"
                                  ? "Profit"
                                  : m.id === "hr"
                                    ? "Requests"
                                    : m.id === "crm-ai"
                                      ? "Predictions"
                                      : m.id === "procurement"
                                        ? "Suppliers"
                                        : "Charts"}
                    </div>
                    <div className="text-sm font-semibold text-foreground tabular-nums mt-0.5">
                      {Math.round(count * (0.1 + Math.random() * 0.4))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.button>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  3D PRODUCT CUBE (replaces TrustBanner)                    */
/* ────────────────────────────────────────────────────────── */
const CUBE_FACES = [
  { id: "production", label: "Production", color: "oklch(0.72 0.19 145)", icon: Cog },
  { id: "inventory", label: "Inventory", color: "oklch(0.58 0.22 259)", icon: Boxes },
  { id: "warehouse", label: "Warehouse", color: "oklch(0.62 0.19 300)", icon: Warehouse },
  { id: "quality", label: "Quality", color: "oklch(0.67 0.18 220)", icon: ShieldCheck },
  { id: "maintenance", label: "Maintenance", color: "oklch(0.79 0.17 75)", icon: Wrench },
  { id: "procurement", label: "Procurement", color: "oklch(0.55 0.18 25)", icon: ShoppingCart },
  { id: "finance", label: "Finance", color: "oklch(0.72 0.19 145)", icon: Landmark },
  { id: "hr", label: "HR", color: "oklch(0.62 0.23 340)", icon: Users },
  { id: "analytics", label: "Analytics", color: "oklch(0.72 0.14 210)", icon: BarChart3 },
];

function ProductCube({ hoveredModule }: { hoveredModule: string | null }) {
  const cubeRef = useRef<HTMLDivElement>(null);
  const rotateX = useMotionValue(-15);
  const rotateY = useMotionValue(0);
  const springRotateX = useSpring(rotateX, { stiffness: 60, damping: 16 });
  const springRotateY = useSpring(rotateY, { stiffness: 60, damping: 16 });
  const autoSpin = useRef(0);
  const faceAngle = useRef(0);

  // Dynamic shadow derived from rotation
  const shadowX = useTransform(springRotateY, (angle) => Math.sin((angle * Math.PI) / 180) * 14);
  const shadowScaleX = useTransform(
    springRotateY,
    (angle) => 0.6 + 0.5 * (0.5 + 0.5 * Math.cos((angle * Math.PI) / 90)),
  );
  const shadowScaleY = useTransform(springRotateX, (tilt) => 0.7 + ((tilt + 23) / 38) * 0.8);
  const shadowOpacity = useTransform(springRotateX, (tilt) => 0.2 + ((23 + tilt) / 38) * 0.55);
  const shadowBlur = useTransform(springRotateX, (tilt) => 8 + ((tilt + 23) / 38) * 14);

  // Derived glow layer transforms (extracted for hook rules compliance)
  const glowX = useTransform(shadowX, (x) => x * 1.6);
  const glowScaleX = useTransform(shadowScaleX, (s) => s * 1.3);
  const glowScaleY = useTransform(shadowScaleY, (s) => s * 0.6);
  const glowOpacity = useTransform(shadowOpacity, (o) => o * 0.4);
  const highlightX = useTransform(shadowX, (x) => x * 0.5);
  const highlightScaleX = useTransform(shadowScaleX, (s) => s * 0.8);
  const highlightOpacity = useTransform(shadowOpacity, (o) => o * 0.6);
  const shadowFilter = useTransform(shadowBlur, (b: number) => `blur(${b}px)`);

  // Glow trail: active face color that follows rotation
  const [trailColor, setTrailColor] = useState(CUBE_FACES[0].color);
  const lastFaceRef = useRef(-1);

  // Update trail color when active face changes
  useEffect(() => {
    if (hoveredModule) {
      const face = CUBE_FACES.find((f) => f.id === hoveredModule);
      if (face) {
        setTrailColor(face.color);
        lastFaceRef.current = CUBE_FACES.indexOf(face);
      }
      return;
    }
    const unsub = springRotateY.on("change", (angle) => {
      const norm = ((angle % 360) + 360) % 360;
      const idx = Math.round(norm / 40) % 9;
      if (idx !== lastFaceRef.current) {
        lastFaceRef.current = idx;
        setTrailColor(CUBE_FACES[idx].color);
      }
    });
    return unsub;
  }, [hoveredModule, springRotateY]);

  // Trace glow MotionValue: updates on rotation OR trailColor change
  const traceGlowMV = useMotionValue("");

  const updateTrailGradient = useCallback(() => {
    const angle = springRotateY.get();
    // Front-facing position in the gradient: the active face is at ~90° in CSS conic-gradient
    // (0° = top 12 o'clock, face front = right 3 o'clock = 90°)
    const baseAngle = 90;
    const startBright = baseAngle - 8;
    const endBright = baseAngle + 18;
    const endFade = (((baseAngle + 55) % 360) + 360) % 360;
    traceGlowMV.set(`conic-gradient(from 0deg at 50% 50%, 
      transparent 0deg, 
      ${trailColor} ${startBright}deg ${endBright}deg, 
      transparent ${endFade}deg
    )`);
  }, [trailColor, springRotateY, traceGlowMV]);

  useEffect(() => {
    updateTrailGradient();
    const unsub = springRotateY.on("change", updateTrailGradient);
    return unsub;
  }, [updateTrailGradient, springRotateY]);

  // Hovered face color for holographic tint — proper oklch with alpha
  const hoverColor = useMemo(() => {
    if (!hoveredModule) return "oklch(0.58 0.22 259 / 0.08)";
    const face = CUBE_FACES.find((f) => f.id === hoveredModule);
    if (!face) return "oklch(0.58 0.22 259 / 0.08)";
    return face.color.replace(")", " / 0.12)");
  }, [hoveredModule]);

  // Auto-rotation and hover-snap
  useEffect(() => {
    let running = true;
    function tick() {
      if (!running) return;
      if (!hoveredModule) {
        // Auto-rotate slowly
        faceAngle.current += 0.15;
        rotateY.set(faceAngle.current);
      }
      autoSpin.current = requestAnimationFrame(tick);
    }
    autoSpin.current = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(autoSpin.current);
    };
  }, [hoveredModule, rotateY]);

  // Snap to face on hover
  useEffect(() => {
    if (!hoveredModule) return;
    const idx = CUBE_FACES.findIndex((f) => f.id === hoveredModule);
    if (idx < 0) return;
    const targetAngle = idx * 40; // 40° per face (360/9)
    faceAngle.current = targetAngle;
    rotateY.set(targetAngle);
  }, [hoveredModule, rotateY]);

  // Cursor proximity tracking
  useEffect(() => {
    const el = cubeRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = (e.clientX - cx) / r.width;
      const dy = (e.clientY - cy) / r.height;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1.5) {
        const influence = (1 - dist / 1.5) * 8;
        rotateX.set(-15 + dy * influence);
        if (!hoveredModule) rotateY.set(faceAngle.current + dx * influence);
      }
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [hoveredModule, rotateX, rotateY]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ type: "spring", stiffness: 200, damping: 22, delay: 0.35 }}
      className="lg:col-span-4"
    >
      <div className="relative rounded-xl border border-border bg-transparent p-5 sm:p-8 overflow-hidden group">
        <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
          {/* Cube */}
          <div className="relative shrink-0" style={{ perspective: 900 }}>
            {/* Glow trail arc — sweeps with rotation, colored by active face */}
            <motion.div
              className="absolute -inset-6 sm:-inset-8 rounded-full pointer-events-none opacity-25 blur-sm"
              style={{
                rotate: springRotateY,
                background: traceGlowMV,
                mask: "radial-gradient(circle at center, transparent 71%, black 72%, black 86%, transparent 87%)",
                WebkitMask:
                  "radial-gradient(circle at center, transparent 71%, black 72%, black 86%, transparent 87%)",
              }}
            />

            {/* Dynamic 3D Shadow — responds to cube rotation & tilt */}
            {/* Layer 1: Holographic glow ring */}
            <motion.div
              className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-36 h-6 rounded-full blur-2xl pointer-events-none"
              style={{
                x: glowX,
                scaleX: glowScaleX,
                scaleY: glowScaleY,
                opacity: glowOpacity,
                background: `radial-gradient(ellipse at center, ${hoverColor}, transparent 70%)`,
              }}
            />

            {/* Layer 2: Core shadow */}
            <motion.div
              className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-28 h-4 rounded-full pointer-events-none"
              style={{
                x: shadowX,
                scaleX: shadowScaleX,
                scaleY: shadowScaleY,
                opacity: shadowOpacity,
                backgroundColor: "color-mix(in oklab, var(--color-foreground) 10%, transparent)",
                filter: shadowFilter,
              }}
            />

            {/* Layer 3: Hover-colored highlight ring (closest to shadow edge) */}
            <motion.div
              className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-20 h-2 rounded-full pointer-events-none"
              style={{
                x: highlightX,
                scaleX: highlightScaleX,
                opacity: highlightOpacity,
                background: `radial-gradient(ellipse at center, color-mix(in oklab, ${hoverColor} 60%, transparent), transparent 70%)`,
                filter: "blur(4px)",
              }}
            />

            <motion.div
              ref={cubeRef}
              style={{
                rotateX: springRotateX,
                rotateY: springRotateY,
                transformStyle: "preserve-3d",
              }}
              className="w-36 h-36 sm:w-44 sm:h-44"
            >
              {CUBE_FACES.map((face, i) => {
                const angle = i * 40;
                const Icon = face.icon;
                const isVisible = hoveredModule === face.id;
                return (
                  <div
                    key={face.id}
                    style={{
                      transform: `rotateY(${angle}deg) translateZ(110px)`,
                      backgroundColor: face.color + "1A",
                      borderColor: face.color + "33",
                    }}
                    className={`absolute inset-0 rounded-xl border-2 flex flex-col items-center justify-center gap-2 sm:gap-3 p-4 transition-shadow duration-300 ${
                      isVisible ? "shadow-glow" : ""
                    }`}
                  >
                    <Icon className="h-6 w-6 sm:h-8 sm:w-8" style={{ color: face.color }} />
                    <span className="text-xs sm:text-sm font-semibold text-foreground">
                      {face.label}
                    </span>
                    <div className="flex gap-1">
                      {[0, 1, 2].map((j) => (
                        <div
                          key={j}
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: face.color + "66" }}
                        />
                      ))}
                    </div>
                    {/* Mini chart bars */}
                    <div className="flex items-end gap-[2px] h-6 sm:h-8">
                      {[35, 60, 45, 80, 55, 70, 90, 50].map((h, j) => (
                        <div
                          key={j}
                          className="w-1.5 sm:w-2 rounded-t"
                          style={{
                            height: `${h * 0.3}px`,
                            backgroundColor: face.color + (isVisible ? "99" : "44"),
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </div>

          {/* Label + face indicator */}
          <div className="flex-1 text-center lg:text-left">
            <div className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-border bg-muted/30 text-muted-foreground mb-3">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Interactive demo
            </div>
            <h3 className="text-xl sm:text-2xl font-semibold text-foreground">
              {hoveredModule
                ? CUBE_FACES.find((f) => f.id === hoveredModule)?.label
                : "Explore every module"}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto lg:mx-0">
              {hoveredModule === "production" &&
                "Monitor OEE, track production lines, and optimize throughput in real time."}
              {hoveredModule === "inventory" &&
                "Track 42k+ SKUs with real-time stock levels, low-stock alerts, and automated reorder."}
              {hoveredModule === "warehouse" &&
                "Manage 18 warehouse zones with real-time stock visibility, putaway, and picking workflows."}
              {hoveredModule === "quality" &&
                "Maintain 99.6% pass rate with real-time inspection tracking and Cpk monitoring."}
              {hoveredModule === "maintenance" &&
                "Schedule preventive maintenance, track repair tickets, and monitor machine uptime across the plant."}
              {hoveredModule === "procurement" &&
                "Manage 128 active POs across 36 suppliers with automated RFQs and performance tracking."}
              {hoveredModule === "finance" &&
                "Manage $2.41M in revenue with automated invoicing, payment tracking, and financial reporting."}
              {hoveredModule === "hr" &&
                "Oversee 412 employees across 12 departments with onboarding, payroll, and performance tools."}
              {hoveredModule === "analytics" &&
                "14 live dashboards with 48+ reports covering production, quality, maintenance, and finance."}
              {!hoveredModule &&
                "Hover any module card above to see it come alive on the cube. The cube auto-rotates — move your cursor near it to control the view."}
            </p>
            <div className="mt-4 flex items-center justify-center lg:justify-start gap-2">
              {CUBE_FACES.map((f, i) => (
                <button
                  key={f.id}
                  onClick={() => {
                    const el = document.getElementById("modules");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    hoveredModule === f.id ? "w-6" : "w-2 hover:w-3 bg-foreground/20"
                  }`}
                  style={{
                    backgroundColor: hoveredModule === f.id ? f.color : undefined,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* — page-level component — */
function EnterpriseModules() {
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);

  return (
    <section
      id="modules"
      className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 border-t border-border"
    >
      <SectionHeader
        eyebrow="Platform"
        title="Every function, one platform"
        desc="Consistent primitives across every module — with role-scoped access."
      />
      <p className="mt-2 text-[11px] text-muted-foreground/60">
        Sample module metrics shown for illustration — every dashboard in the app displays live,
        role-scoped data.
      </p>
      <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {BENTO_MODULES.map((m, i) => (
          <BentoModuleTile key={m.id} m={m} index={i} onHover={setHoveredModule} />
        ))}
        <ProductCube hoveredModule={hoveredModule} />
      </div>
    </section>
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
      setVisible((prev) => [...prev, AI_MESSAGES[idx]]);
      setIdx((i) => i + 1);
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
    <section
      id="ai"
      className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 border-t border-border"
    >
      <SectionHeader
        eyebrow="AI Intelligence"
        title="AI Copilot, live"
        desc="Real-time decisions from production, inventory, quality and maintenance streams."
      />
      <div className="mt-10 max-w-2xl mx-auto">
        <div className="rounded-xl border border-border bg-muted/30 p-5 min-h-[320px] relative overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 pb-4 border-b border-border">
            <div className="h-6 w-6 rounded-md bg-primary/20 grid place-items-center">
              <Sparkles className="h-3 w-3 text-primary" />
            </div>
            <div className="text-sm font-medium text-foreground">AI Copilot</div>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] text-muted-foreground">Live</span>
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
                  <span
                    className={`h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 ${typeDot[msg.type]}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-foreground leading-relaxed">{msg.text}</div>
                    <div className="text-[10px] text-foreground/30 mt-1">Just now</div>
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
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
                <span className="text-[11px] text-muted-foreground">
                  AI is analyzing streams...
                </span>
              </motion.div>
            )}

            {/* Empty state */}
            {visible.length === 0 && (
              <div className="flex items-center justify-center h-[200px] text-sm text-foreground/30">
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
    {
      label: "Root Super Admin",
      roles: ["root_super_admin"],
      color: "text-amber-400",
      line: "bg-amber-400/30",
    },
    {
      label: "Company Admin",
      roles: ["company_admin"],
      color: "text-blue-400",
      line: "bg-blue-400/30",
    },
    {
      label: "Plant Admin",
      roles: ["plant_admin"],
      color: "text-cyan-400",
      line: "bg-cyan-400/30",
    },
    {
      label: "Managers",
      roles: [
        "plant_manager",
        "production_manager",
        "warehouse_manager",
        "procurement_manager",
        "quality_inspector",
        "maintenance_engineer",
        "finance_manager",
        "hr_manager",
      ],
      color: "text-teal-400",
      line: "bg-teal-400/30",
    },
    {
      label: "Operators",
      roles: ["production_operator"],
      color: "text-slate-400",
      line: "bg-slate-400/30",
    },
    {
      label: "External",
      roles: ["customer_portal", "supplier_portal", "auditor"],
      color: "text-violet-400",
      line: "bg-violet-400/30",
    },
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
    <section className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 border-t border-border">
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
                <div
                  className={`h-2 w-2 rounded-full ${tier.line.replace("bg-", "bg-")} bg-opacity-100`}
                />
                <div className={`text-xs font-medium uppercase tracking-wider ${tier.color}`}>
                  {tier.label}
                </div>
                <div className="flex-1 h-px bg-muted/50" />
              </motion.div>

              {/* Role pills */}
              <div className="flex flex-wrap gap-1.5 ml-5 mb-1">
                {tier.roles.map((roleId) => {
                  const meta = ROLES.find((r) => r.id === roleId);
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
                          : "border-border bg-muted/30 text-muted-foreground hover:border-border hover:text-foreground"
                      }`}
                    >
                      {meta.label}
                    </motion.button>
                  );
                })}
              </div>

              {/* Permissions panel */}
              <AnimatePresence>
                {tier.roles.map((roleId) => {
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
                      <div className="rounded-lg border border-border bg-muted/30 p-3">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                          Permissions
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          {perms.map((p) => (
                            <div
                              key={p}
                              className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                            >
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
        <div className="rounded-xl border border-border bg-muted/30 p-5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Security model
          </div>
          <div className="mt-4 space-y-3">
            {[
              { icon: KeyRound, label: "JWT Authentication" },
              { icon: Lock, label: "Row-Level Security" },
              { icon: ScrollText, label: "Audit Logging" },
              { icon: Globe, label: "Multi-tenant Isolation" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2.5">
                <div className="h-6 w-6 rounded bg-muted/50 grid place-items-center">
                  <s.icon className="h-3 w-3 text-primary/60" />
                </div>
                <span className="text-xs text-muted-foreground">{s.label}</span>
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
    <section
      id="security"
      className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 border-t border-border"
    >
      <SectionHeader
        eyebrow="Enterprise Security"
        title="Built for regulated plants"
        desc="Security is enforced in the database, not the UI."
      />
      <div className="mt-10 grid md:grid-cols-[240px_1fr] gap-6 items-center">
        {/* Shield illustration */}
        <div className="relative rounded-xl border border-border bg-muted/30 p-8 grid place-items-center">
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
              className="rounded-xl border border-border bg-muted/30 p-3.5 hover:border-border transition-colors duration-200"
            >
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-muted/50 grid place-items-center">
                  <layer.icon className="h-3.5 w-3.5 text-primary/60" />
                </div>
                <span className="text-xs font-medium text-foreground">{layer.label}</span>
              </div>
              <div className="mt-1.5 text-[10px] text-muted-foreground ml-9">{layer.desc}</div>
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
  {
    label: "Revenue",
    value: "$2.41M",
    delta: "+12.4%",
    chart: "area",
    color: "oklch(0.58 0.22 259)",
  },
  {
    label: "Production",
    value: "1,248/hr",
    delta: "+8.2%",
    chart: "line",
    color: "oklch(0.72 0.14 210)",
  },
  { label: "OEE", value: "87.4%", delta: "+3.2%", chart: "area", color: "oklch(0.62 0.19 300)" },
  {
    label: "Efficiency",
    value: "94.1%",
    delta: "+1.8%",
    chart: "line",
    color: "oklch(0.72 0.19 145)",
  },
];

function AnalyticsShowcase() {
  const chartData = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        d: `D${i + 1}`,
        v1: 60 + Math.sin(i / 2) * 15 + Math.random() * 8,
        v2: 40 + Math.cos(i / 2.5) * 10 + Math.random() * 6,
        v3: 70 + Math.sin(i / 1.8) * 12 + Math.random() * 7,
        v4: 80 + Math.cos(i / 2) * 8 + Math.random() * 5,
      })),
    [],
  );

  return (
    <section
      id="analytics"
      className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 border-t border-border"
    >
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
            className="rounded-xl border border-border bg-muted/30 p-4"
          >
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {metric.label}
              </div>
              <span className="text-[10px] text-success flex items-center gap-0.5">
                <TrendingUp className="h-3 w-3" /> {metric.delta}
              </span>
            </div>
            <div className="mt-1.5 text-xl font-semibold text-foreground tabular-nums">
              {metric.value}
            </div>
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
                    <Area
                      type="monotone"
                      dataKey={`v${i + 1}`}
                      stroke={metric.color}
                      strokeWidth={1.5}
                      fill={`url(#ag-${i})`}
                      isAnimationActive
                    />
                  </AreaChart>
                ) : (
                  <RechartLine data={chartData}>
                    <Line
                      type="monotone"
                      dataKey={`v${i + 1}`}
                      stroke={metric.color}
                      strokeWidth={1.5}
                      dot={false}
                      isAnimationActive
                    />
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
            className="rounded-lg border border-border bg-muted/20 p-3"
          >
            <div className="text-[10px] text-muted-foreground">{m.label}</div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-sm font-medium text-foreground tabular-nums">{m.value}</span>
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
    {
      icon: Sparkles,
      label: "AI-first Automation",
      desc: "Predictive models power every decision",
    },
    { icon: Globe, label: "Multi-tenant SaaS", desc: "Isolated tenants, shared infrastructure" },
    { icon: Server, label: "Cloud-native", desc: "Deployed on Supabase + Vercel edge" },
  ];

  return (
    <section className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 border-t border-border">
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
            className="rounded-xl border border-border bg-muted/30 p-4 flex items-start gap-3"
          >
            <div className="h-8 w-8 rounded-lg bg-muted/50 grid place-items-center shrink-0">
              <cap.icon className="h-4 w-4 text-primary/60" />
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">{cap.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{cap.desc}</div>
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
    <footer className="border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-8 text-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-primary grid place-items-center">
              <Factory className="h-3 w-3 text-white" />
            </div>
            <span className="text-sm font-semibold text-foreground">FactoryOS AI</span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground max-w-xs leading-relaxed">
            The intelligent manufacturing operating system for modern enterprises.
          </p>
          <div className="mt-4 text-[11px] text-foreground/30">
            v4.2.1 · © {new Date().getFullYear()}
          </div>
        </div>

        {[
          {
            h: "Product",
            l: [
              { label: "Modules", href: "#modules" },
              { label: "AI Platform", href: "#ai" },
              { label: "Security", href: "#security" },
              { label: "Workflow", href: "#flow" },
            ],
          },
          {
            h: "Resources",
            l: [
              { label: "Sign in", href: "/auth" },
              { label: "Register a company", href: "/auth" },
              { label: "Customer access", href: "/auth" },
            ],
          },
          {
            h: "Company",
            l: [
              { label: "Get started", href: "/auth" },
              { label: "Analytics", href: "#analytics" },
            ],
          },
        ].map((group) => (
          <div key={group.h}>
            <div className="text-xs font-medium text-muted-foreground mb-3">{group.h}</div>
            <ul className="space-y-2">
              {group.l.map((x) => (
                <li key={x.label}>
                  <a
                    href={x.href}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-150"
                  >
                    {x.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-foreground/30">
          <span>© {new Date().getFullYear()} FactoryOS AI. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/nishant020208/factory-os-prime"
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </a>
            <a href="/auth" className="hover:text-foreground transition-colors">
              Sign in
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  SHARED COMPONENTS                                          */
/* ────────────────────────────────────────────────────────── */
/* ────────────────────────────────────────────────────────── */
/*  ANIMATED SECTION DIVIDER                                  */
/* ────────────────────────────────────────────────────────── */
function SectionDivider() {
  return (
    <motion.div
      className="w-full h-px"
      initial={{ opacity: 0, scaleX: 0 }}
      whileInView={{ opacity: 1, scaleX: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ type: "spring", stiffness: 200, damping: 22, delay: 0.1 }}
      style={{
        transformOrigin: "left",
        background:
          "linear-gradient(90deg, var(--color-border), var(--color-primary) 30%, var(--color-primary) 70%, var(--color-border))",
        backgroundSize: "200% 100%",
        animation: "shimmer 3s linear infinite",
      }}
    />
  );
}

function SectionHeader({
  eyebrow,
  title,
  desc,
}: {
  eyebrow: string;
  title: string;
  desc?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className="max-w-2xl"
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.05 }}
        className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
      >
        <span className="inline-flex items-center gap-2">
          <motion.span
            className="inline-block w-4 h-[1px] bg-primary/60"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
            style={{ transformOrigin: "left" }}
          />
          {eyebrow}
        </span>
      </motion.div>
      <motion.h2
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.12 }}
        className="mt-3 text-[22px] sm:text-[28px] font-semibold tracking-tight text-foreground"
      >
        {title}
      </motion.h2>
      {desc && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 180, damping: 20, delay: 0.18 }}
          className="mt-2 text-sm text-muted-foreground leading-relaxed"
        >
          {desc}
        </motion.p>
      )}
      {/* Animated gradient underline */}
      <motion.div
        className="mt-4 h-[2px] w-16 rounded-full"
        initial={{ scaleX: 0, opacity: 0 }}
        whileInView={{ scaleX: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ type: "spring", stiffness: 250, damping: 18, delay: 0.22 }}
        style={{
          transformOrigin: "left",
          background:
            "linear-gradient(90deg, var(--color-primary), var(--color-primary) 40%, transparent)",
        }}
      />
    </motion.div>
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
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-background border-b border-border shadow-sm" : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="h-7 w-7 rounded-md bg-primary grid place-items-center">
            <Factory className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="text-[13px] font-semibold tracking-tight text-foreground">
            FactoryOS <span className="text-muted-foreground">AI</span>
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-0.5 ml-2">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[12px] text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-md hover:bg-muted/50"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          {/* 3-way theme switcher - visible on desktop */}
          <div className="hidden sm:flex items-center bg-card/70 border border-border rounded-lg p-0.5 gap-0 shadow-sm">
            {[
              { id: "dark" as ThemeMode, icon: Moon, label: "Dark" },
              { id: "light" as ThemeMode, icon: Sun, label: "Light" },
              { id: "aesthetic" as ThemeMode, icon: Palette, label: "Aesthetic" },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setTheme(id)}
                className={`relative flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md transition-all duration-200 ${
                  theme === id
                    ? "text-foreground bg-card shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {theme === id && (
                  <motion.div
                    layoutId="landingThemePill"
                    className="absolute inset-0 rounded-md bg-card shadow-sm border border-border"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1">
                  <Icon className="h-3 w-3" />
                  <span className="hidden lg:inline">{label}</span>
                </span>
              </button>
            ))}
          </div>

          {/* Mobile theme icon */}
          <div className="sm:hidden relative">
            <button
              onClick={() => setThemeMenuOpen((o) => !o)}
              className="grid place-items-center h-8 w-8 rounded-md hover:bg-muted/60 text-muted-foreground"
              aria-label="Theme"
            >
              {theme === "dark" ? (
                <Moon className="h-4 w-4" />
              ) : theme === "light" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Palette className="h-4 w-4" />
              )}
            </button>
            <AnimatePresence>
              {themeMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.96 }}
                  className="absolute right-0 top-full mt-1 z-50 w-36 rounded-lg border border-border bg-card shadow-elevated p-1"
                >
                  {[
                    { id: "dark" as ThemeMode, icon: Moon, label: "Dark" },
                    { id: "light" as ThemeMode, icon: Sun, label: "Light" },
                    { id: "aesthetic" as ThemeMode, icon: Palette, label: "Aesthetic" },
                  ].map(({ id, icon: Icon, label }) => (
                    <button
                      key={id}
                      onClick={() => {
                        setTheme(id);
                        setThemeMenuOpen(false);
                      }}
                      className={`flex items-center gap-2 w-full px-3 py-2 text-xs rounded-md transition-colors ${
                        theme === id
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Link
            to="/auth"
            className="hidden sm:inline-flex items-center h-8 px-3 rounded-md text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
          >
            Sign in
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center gap-1 h-8 px-3 rounded-md text-[12px] font-medium text-primary-foreground bg-primary hover:bg-primary/90 transition-all active:scale-[0.97]"
          >
            Get started <ArrowRight className="h-3 w-3" />
          </Link>
          <button
            onClick={() => setMobile(true)}
            className="lg:hidden grid place-items-center h-8 w-8 rounded-md hover:bg-muted/60 text-muted-foreground"
            aria-label="Menu"
          >
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
            className="lg:hidden fixed inset-0 z-50 bg-background"
          >
            <div className="flex items-center justify-between h-14 px-4 border-b border-border">
              <span className="text-sm font-medium text-foreground">Menu</span>
              <button
                onClick={() => setMobile(false)}
                className="grid place-items-center h-8 w-8 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-0.5">
              {NAV_LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobile(false)}
                  className="px-3 py-3 rounded-lg hover:bg-muted/50 text-sm text-muted-foreground hover:text-foreground"
                >
                  {l.label}
                </a>
              ))}
              <hr className="my-3 border-border" />
              <Link
                to="/auth"
                onClick={() => setMobile(false)}
                className="px-3 py-3 rounded-lg text-sm font-medium text-primary-foreground bg-primary/20 text-center"
              >
                Get started
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  LIQUID MOTION BACKGROUND (canvas shader)                  */
/* ────────────────────────────────────────────────────────── */
/* ────────────────────────────────────────────────────────── */
/*  CURSOR GLOW — visible spotlight following the mouse       */
/* ────────────────────────────────────────────────────────── */
function CursorGlow() {
  const glowRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const springX = useSpring(mouseX, { stiffness: 80, damping: 25 });
  const springY = useSpring(mouseY, { stiffness: 80, damping: 25 });
  const xPct = useTransform(springX, [0, 1], [0, 100]);
  const yPct = useTransform(springY, [0, 1], [0, 100]);

  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      mouseX.set(e.clientX / window.innerWidth);
      mouseY.set(e.clientY / window.innerHeight);
    };
    window.addEventListener("mousemove", onMouse, { passive: true });
    return () => window.removeEventListener("mousemove", onMouse);
  }, [mouseX, mouseY]);

  return (
    <motion.div
      ref={glowRef}
      className="fixed pointer-events-none z-[5]"
      style={{
        left: xPct,
        top: yPct,
        width: "60vw",
        height: "60vw",
        maxWidth: "800px",
        maxHeight: "800px",
        transform: "translate(-50%, -50%)",
      }}
    >
      <div
        className="w-full h-full rounded-full"
        style={{
          background: "radial-gradient(circle, var(--accent-glow) 0%, transparent 70%)",
          opacity: 0.35,
        }}
      />
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  LIQUID MOTION BACKGROUND (canvas shader v2 — dramatic)   */
/* ────────────────────────────────────────────────────────── */
function LiquidBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: 0.5, y: 0.5 });
  const smoothMouse = useRef({ x: 0.5, y: 0.5 });
  const time = useRef(0);
  const raf = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isMobile || prefersReduced) {
      canvas.style.display = "none";
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;

    function resize() {
      width = window.innerWidth;
      height = Math.min(window.innerHeight * 1.2, 800);
      canvas!.width = width * devicePixelRatio;
      canvas!.height = height * devicePixelRatio;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.scale(devicePixelRatio, devicePixelRatio);
    }
    resize();
    window.addEventListener("resize", resize);

    const onMouse = (e: MouseEvent) => {
      mouse.current.x = e.clientX / width;
      mouse.current.y = e.clientY / height;
    };
    window.addEventListener("mousemove", onMouse, { passive: true });

    function draw(t: number) {
      time.current = t * 0.00025;

      // Smooth mouse follow with spring-like lerp
      smoothMouse.current.x += (mouse.current.x - smoothMouse.current.x) * 0.04;
      smoothMouse.current.y += (mouse.current.y - smoothMouse.current.y) * 0.04;

      ctx!.clearRect(0, 0, width, height);

      const isAesthetic = document.documentElement.getAttribute("data-theme") === "aesthetic";

      // Colors — more blobs, richer opacity
      const blobs = isAesthetic
        ? [
            { r: 0.79, g: 0.45, b: 0.14, a: 0.18, phase: 0.0 }, // amber
            { r: 0.31, g: 0.82, b: 0.77, a: 0.15, phase: 1.8 }, // teal
            { r: 0.65, g: 0.35, b: 0.8, a: 0.12, phase: 3.2 }, // violet
            { r: 0.9, g: 0.6, b: 0.3, a: 0.1, phase: 4.5 }, // gold
            { r: 0.2, g: 0.7, b: 0.85, a: 0.1, phase: 5.8 }, // sky
          ]
        : [
            { r: 0.33, g: 0.39, b: 0.96, a: 0.16, phase: 0.0 }, // blue
            { r: 0.62, g: 0.28, b: 0.96, a: 0.14, phase: 1.5 }, // violet
            { r: 0.05, g: 0.71, b: 0.83, a: 0.12, phase: 2.9 }, // cyan
            { r: 0.2, g: 0.6, b: 0.9, a: 0.09, phase: 4.2 }, // light blue
            { r: 0.8, g: 0.3, b: 0.7, a: 0.08, phase: 5.6 }, // pink
          ];

      const mx = smoothMouse.current.x;
      const my = smoothMouse.current.y;

      for (let i = 0; i < blobs.length; i++) {
        const c = blobs[i];

        // Strong cursor pull — blobs cluster near the cursor
        const cursorPullX =
          (mx - 0.5) * width * 0.35 * (1 + Math.sin(time.current * 0.3 + c.phase) * 0.3);
        const cursorPullY =
          (my - 0.5) * height * 0.35 * (1 + Math.cos(time.current * 0.25 + c.phase) * 0.3);

        // Natural drift
        const driftX = Math.sin(time.current * 0.35 + c.phase * 1.2) * width * 0.12;
        const driftY = Math.cos(time.current * 0.3 + c.phase * 1.1) * height * 0.12;

        const cx = width * (0.5 + Math.sin(c.phase) * 0.3) + driftX + cursorPullX;
        const cy = height * (0.5 + Math.cos(c.phase * 0.8) * 0.25) + driftY + cursorPullY;

        // Pulsing radii based on cursor proximity
        const distToCursor = Math.sqrt(
          Math.pow(cx / width - mx, 2) + Math.pow(cy / height - my, 2),
        );
        const pulseFactor = 1 + Math.max(0, 1 - distToCursor * 3) * 0.5;

        const rx = width * (0.18 + Math.sin(time.current * 0.2 + c.phase) * 0.06) * pulseFactor;
        const ry = height * (0.14 + Math.cos(time.current * 0.22 + c.phase) * 0.05) * pulseFactor;

        // Blobs expand when cursor is near
        const alphaBoost = Math.max(0, 1 - distToCursor * 2.5) * 0.5;
        const finalAlpha = Math.min(c.a + alphaBoost, 0.35);

        ctx!.beginPath();
        ctx!.ellipse(cx, cy, rx, ry, time.current * 0.08 + c.phase, 0, Math.PI * 2);
        const gradient = ctx!.createRadialGradient(
          cx - rx * 0.2,
          cy - ry * 0.2,
          0,
          cx,
          cy,
          Math.max(rx, ry) * 1.2,
        );
        gradient.addColorStop(0, `oklch(${c.r} ${c.g} ${c.b} / ${finalAlpha * 1.8})`);
        gradient.addColorStop(0.4, `oklch(${c.r} ${c.g} ${c.b} / ${finalAlpha})`);
        gradient.addColorStop(1, `oklch(${c.r} ${c.g} ${c.b} / 0)`);
        ctx!.fillStyle = gradient;
        ctx!.fill();
      }

      // Extra bright highlight right at cursor position
      const glowSize = width * 0.08;
      const cursorGrad = ctx!.createRadialGradient(
        mx * width,
        my * height,
        0,
        mx * width,
        my * height,
        glowSize,
      );
      cursorGrad.addColorStop(
        0,
        isAesthetic ? "oklch(0.79 0.17 75 / 0.20)" : "oklch(0.58 0.22 259 / 0.18)",
      );
      cursorGrad.addColorStop(1, "oklch(0 0 0 / 0)");
      ctx!.fillStyle = cursorGrad;
      ctx!.fillRect(0, 0, width, height);

      raf.current = requestAnimationFrame(draw);
    }
    raf.current = requestAnimationFrame(draw);

    function onVisibility() {
      if (document.hidden) cancelAnimationFrame(raf.current);
      else raf.current = requestAnimationFrame(draw);
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouse);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{
        maskImage: "linear-gradient(to bottom, black 0%, black 65%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 65%, transparent 100%)",
      }}
    />
  );
}

/* ────────────────────────────────────────────────────────── */
/*  PAGE                                                      */
/* ────────────────────────────────────────────────────────── */
function LandingPage() {
  const SectionWrap = ({ children }: { children: React.ReactNode; alt?: boolean }) => (
    <div className="bg-transparent">{children}</div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      {/* Cursor-following spotlight glow */}
      <CursorGlow />

      {/* Liquid motion background (above the fold only) */}
      <LiquidBackground />

      {/* Fallback gradient-mesh when canvas is hidden (mobile) */}
      <div className="fixed inset-0 -z-10 pointer-events-none mesh-bg sm:opacity-0 transition-opacity duration-500" />

      <TopNav />
      <div className="pt-20 relative z-10">
        <SectionWrap alt={false}>
          <NetworkCanvas />
        </SectionWrap>
        <SectionDivider />
        <SectionWrap alt={true}>
          <Hero />
        </SectionWrap>
        <SectionDivider />
        <SectionWrap alt={false}>
          <Workflow />
        </SectionWrap>
        <SectionDivider />
        <SectionWrap alt={true}>
          <EnterpriseModules />
        </SectionWrap>
        <SectionDivider />
        <SectionWrap alt={false}>
          <AIIntelligence />
        </SectionWrap>
        <SectionDivider />
        <SectionWrap alt={true}>
          <RoleHierarchy />
        </SectionWrap>
        <SectionDivider />
        <SectionWrap alt={false}>
          <SecurityArchitecture />
        </SectionWrap>
        <SectionDivider />
        <SectionWrap alt={true}>
          <AnalyticsShowcase />
        </SectionWrap>
        <SectionDivider />
        <SectionWrap alt={false}>
          <TrustedPlatform />
        </SectionWrap>
        <SectionDivider />
        <SectionWrap alt={true}>
          <Footer />
        </SectionWrap>
      </div>
    </div>
  );
}
