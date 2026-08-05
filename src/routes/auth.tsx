import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { ArrowLeft, Factory, Loader2, Lock, Mail, ShieldCheck, Sparkles, Zap, Building2, Globe, UserPlus, CheckCircle2, Eye, EyeOff, Store } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ROLES, ROLE_MAP, type AppRole } from "@/lib/roles";
import {
  notifyCompanyRegistrationRequest,
  notifyCustomerAccessRequest,
} from "@/lib/notifications";

const searchSchema = z.object({ role: z.string().optional(), redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Sign in — FactoryOS AI" },
      { name: "description", content: "Access FactoryOS AI — the Smart Manufacturing Operating System. Select your role to continue." },
      { property: "og:title", content: "Sign in to FactoryOS AI" },
      { property: "og:description", content: "Role-based access to the enterprise manufacturing OS." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

/* ───────────────────────────────────────────────────── */
/*  FLOATING PARTICLES (canvas, ~60, cursor-reactive)    */
/* ───────────────────────────────────────────────────── */
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
    if (isMobile || prefersReduced) { canvas.style.display = "none"; return; }

    let w = 0, h = 0;
    const count = 60;
    const particles: Array<{
      x: number; y: number; vx: number; vy: number;
      size: number; alpha: number; phase: number;
      baseX: number; baseY: number;
    }> = [];

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
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
        const speed = 0.1 + Math.random() * 0.2;
        particles.push({
          x, y,
          baseX: x, baseY: y,
          vx: Math.cos(angle) * speed,
          vy: -(0.08 + Math.random() * 0.15),
          size: 1.2 + Math.random() * 2,
          alpha: 0.1 + Math.random() * 0.25,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }

    resize();
    init();
    window.addEventListener("resize", () => { resize(); init(); });

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
      const repelRadius = 100;
      const repelStrength = 1.0;

      for (const p of particles) {
        p.x += p.vx + Math.sin(Date.now() * 0.001 + p.phase) * 0.06;
        p.y += p.vy;
        if (p.y < -10) { p.y = h + 10; p.baseY = p.y; p.baseX = Math.random() * w; p.x = p.baseX; }
        if (p.y > h + 10) { p.y = -10; p.baseY = p.y; }
        if (p.x < -10 || p.x > w + 10) { p.baseX = Math.random() * w; p.x = p.baseX; }

        const dx = p.x - mx, dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < repelRadius && dist > 0) {
          const force = (repelRadius - dist) / repelRadius * repelStrength;
          p.x += (dx / dist) * force * 2.5;
          p.y += (dy / dist) * force * 2.5;
        }
        p.x += (p.baseX - p.x) * 0.001;
        p.y += (p.baseY - p.y) * 0.001;

        const isAesthetic = document.documentElement.getAttribute("data-theme") === "aesthetic";
        const color = isAesthetic ? `oklch(0.79 0.17 75 / ${p.alpha})` : `oklch(0.58 0.22 259 / ${p.alpha})`;

        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx!.fillStyle = color;
        ctx!.fill();

        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
        ctx!.fillStyle = isAesthetic
          ? `oklch(0.79 0.17 75 / ${p.alpha * 0.12})`
          : `oklch(0.58 0.22 259 / ${p.alpha * 0.12})`;
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
      className="fixed inset-0 pointer-events-none z-0"
    />
  );
}

/* ───────────────────────────────────────────────────── */
/*  DRIFTING GRADIENT ORBS                               */
/* ───────────────────────────────────────────────────── */
function GradientOrbs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {[
        { size: 600, x: "10%", y: "15%", color: "oklch(0.58 0.22 259 / 0.08)", dur: 10, delay: 0 },
        { size: 450, x: "70%", y: "20%", color: "oklch(0.62 0.19 300 / 0.06)", dur: 12, delay: 3 },
        { size: 350, x: "40%", y: "70%", color: "oklch(0.72 0.14 210 / 0.05)", dur: 14, delay: 5 },
      ].map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: orb.size,
            height: orb.size,
            background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
          }}
          animate={{
            x: [0, 40, -25, 0],
            y: [0, -30, 20, 0],
            scale: [1, 1.1, 0.93, 1],
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

/* ───────────────────────────────────────────────────── */
/*  AUTH PAGE — MAIN                                    */
/* ───────────────────────────────────────────────────── */
function AuthPage() {
  const { role, redirect } = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const selected = role && role in ROLE_MAP ? ROLE_MAP[role as AppRole] : null;
  const [showRegisterCompany, setShowRegisterCompany] = useState(false);
  const [showRegisterCustomer, setShowRegisterCustomer] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Background effects */}
      <GradientOrbs />
      <FloatingParticles />

      {/* Subtle grid overlay */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none">
        <svg className="w-full h-full">
          <defs>
            <pattern id="auth-grid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M48 0H0V48" fill="none" stroke="currentColor" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#auth-grid)" />
        </svg>
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between p-4 sm:p-6 max-w-7xl mx-auto">
        <Link to="/" className="flex items-center gap-2 group">
          <motion.div
            whileHover={{ scale: 1.05, rotate: -5 }}
            className="h-8 w-8 rounded-lg bg-primary shadow-glow grid place-items-center"
          >
            <Factory className="h-4 w-4 text-primary-foreground" />
          </motion.div>
          <span className="font-semibold">FactoryOS <span className="text-muted-foreground">AI</span></span>
        </Link>
        {selected && (
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/auth" })}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Change role
          </Button>
        )}
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        <AnimatePresence mode="wait">
          {showRegisterCompany ? (
            <RegisterCompany key="register" onBack={() => setShowRegisterCompany(false)} />
          ) : showRegisterCustomer ? (
            <RegisterCustomer key="register-customer" onBack={() => setShowRegisterCustomer(false)} />
          ) : !selected ? (
            <RoleGrid
              key="grid"
              onPick={(r) => navigate({ to: "/auth", search: { role: r, redirect } })}
              onRegisterCompany={() => setShowRegisterCompany(true)}
              onRegisterCustomer={() => setShowRegisterCustomer(true)}
            />
          ) : (
            <LoginPanel key={selected.id} role={selected.id} redirect={redirect} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────── */
/*  REGISTER COMPANY — Premium                          */
/* ───────────────────────────────────────────────────── */
function RegisterCompany({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    company_name: "",
    email: "",
    full_name: "",
    phone: "",
    country: "US",
    industry: "",
  });
  const [busy, setBusy] = useState(false);
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const springX = useSpring(mouseX, { stiffness: 60, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 60, damping: 20 });
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouse = (e: React.MouseEvent) => {
    const r = cardRef.current?.getBoundingClientRect();
    if (r) { mouseX.set((e.clientX - r.left) / r.width); mouseY.set((e.clientY - r.top) / r.height); }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      // No .select() here on purpose: anonymous visitors may submit a
      // registration but must never be able to read this table back.
      const { error } = await supabase
        .from("company_registrations")
        .insert({
          company_name: form.company_name,
          email: form.email,
          phone: form.phone || null,
          country: form.country,
          industry: form.industry || null,
          registration_data: { full_name: form.full_name },
          status: "pending",
        });
      if (error) throw error;
      // Notify Root Super Admin that a new company registration is pending review
      await notifyCompanyRegistrationRequest(null, form.company_name);
      toast.success("Registration submitted! A Root Admin will review and activate your company.");
      setBusy(false);
      onBack();
    } catch (err: any) {
      toast.error(err.message || "Registration failed. Please try again.");
      setBusy(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mt-6 max-w-md mx-auto">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to roles
      </Button>
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouse}
        onMouseLeave={() => { mouseX.set(0.5); mouseY.set(0.5); }}
        style={{
          rotateX: useTransform(springY, [0, 1], [2, -2]),
          rotateY: useTransform(springX, [0, 1], [-2, 2]),
          transformStyle: "preserve-3d",
        }}
        className="glass-strong rounded-3xl p-8 shadow-elegant relative overflow-hidden"
      >
        {/* Animated gradient border */}
        <div className="absolute inset-0 rounded-3xl p-[1px] pointer-events-none">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/20 via-accent/10 to-primary/5 opacity-50" />
        </div>

        <div className="relative z-10" style={{ transformStyle: "preserve-3d" }}>
          <motion.div
            style={{ z: useTransform(springY, [0, 1], [10, -10]) }}
            className="flex items-center gap-3 mb-4"
          >
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 grid place-items-center shadow-glow">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="font-semibold">Register Your Company</div>
              <div className="text-xs text-muted-foreground">Get started with FactoryOS AI</div>
            </div>
          </motion.div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <FloatingLabelField icon={Building2} label="Company Name *" value={form.company_name} onChange={(v) => setForm(f => ({ ...f, company_name: v }))} />
            <FloatingLabelField icon={Mail} label="Your Email *" value={form.email} onChange={(v) => setForm(f => ({ ...f, email: v }))} type="email" />
            <FloatingLabelField icon={UserPlus} label="Your Full Name *" value={form.full_name} onChange={(v) => setForm(f => ({ ...f, full_name: v }))} />
            <PhoneField value={form.phone} onChange={(v) => setForm(f => ({ ...f, phone: v }))} />
            <FloatingSelectField
              icon={Globe}
              label="Country"
              value={form.country}
              onChange={(v) => setForm(f => ({ ...f, country: v }))}
              options={[
                { value: "US", label: "🇺🇸 United States" },
                { value: "CA", label: "🇨🇦 Canada" },
                { value: "GB", label: "🇬🇧 United Kingdom" },
                { value: "DE", label: "🇩🇪 Germany" },
                { value: "FR", label: "🇫🇷 France" },
                { value: "IN", label: "🇮🇳 India" },
                { value: "JP", label: "🇯🇵 Japan" },
                { value: "CN", label: "🇨🇳 China" },
                { value: "BR", label: "🇧🇷 Brazil" },
                { value: "AU", label: "🇦🇺 Australia" },
                { value: "SG", label: "🇸🇬 Singapore" },
              ]}
            />
            <FloatingLabelField icon={Factory} label="Industry" value={form.industry} onChange={(v) => setForm(f => ({ ...f, industry: v }))} />

            <RippleButton
              type="submit"
              disabled={busy || !form.company_name || !form.email || !form.full_name}
              className="w-full h-11 rounded-lg bg-gradient-to-r from-primary via-primary/90 to-accent text-white font-medium shadow-glow disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Registration"}
            </RippleButton>
            <p className="text-xs text-muted-foreground mt-2">
              A Root Super Admin will review your registration. You'll receive an email when your company is approved.
            </p>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ───────────────────────────────────────────────────── */
/*  REGISTER AS A CUSTOMER — company-specific          */
/* ───────────────────────────────────────────────────── */
function RegisterCustomer({ onBack }: { onBack: () => void }) {
  const [companies, setCompanies] = useState<Array<{ id: string; name: string; industry: string | null }>>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [form, setForm] = useState({
    company_id: "",
    business_name: "",
    contact_person: "",
    email: "",
    phone: "",
    gst_number: "",
    address: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Prefer the RPC; fall back to direct table read for existing auth users
        const { data: rpc, error: rpcError } = await supabase.rpc("get_active_companies");
        if (!rpcError && Array.isArray(rpc)) {
          if (mounted) { setCompanies(rpc as Array<{ id: string; name: string; industry: string | null }>); setLoadingCompanies(false); }
          return;
        }
        const { data, error } = await supabase.from("companies").select("id,name,industry").eq("status", "active").order("name");
        if (!error && data) { if (mounted) setCompanies(data); }
      } catch {
        // ignore — dropdown stays empty if RLS blocks
      }
      if (mounted) setLoadingCompanies(false);
    })();
    return () => { mounted = false; };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company_id) { toast.error("Please select the company you want to order from"); return; }
    setBusy(true);
    try {
      // No .select() here on purpose: anonymous visitors may submit a request
      // but must never be able to read customer_requests back.
      const { error } = await supabase
        .from("customer_requests")
        .insert({
          company_id: form.company_id,
          business_name: form.business_name,
          contact_person: form.contact_person,
          email: form.email,
          phone: form.phone || null,
          gst_number: form.gst_number || null,
          address: form.address || null,
          status: "pending",
        });
      if (error) throw error;
      await notifyCustomerAccessRequest(form.company_id, form.business_name);
      toast.success("Request submitted! The company's admin will approve your access.");
      setBusy(false);
      onBack();
    } catch (err: any) {
      toast.error(err.message || "Submission failed. Please try again.");
      setBusy(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mt-6 max-w-md mx-auto">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to roles
      </Button>
      <div className="glass-strong rounded-3xl p-8 shadow-elegant relative overflow-hidden">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-400 via-cyan-500 to-blue-600 grid place-items-center shadow-glow">
            <Store className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-semibold">Register as a Customer</div>
            <div className="text-xs text-muted-foreground">Order from a specific company on FactoryOS</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Company you want to order from *</label>
            {loadingCompanies ? (
              <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Loading companies…</div>
            ) : companies.length === 0 ? (
              <div className="text-xs text-amber-500">No active companies available yet. Please check back later.</div>
            ) : (
              <select
                value={form.company_id}
                onChange={(e) => setForm(f => ({ ...f, company_id: e.target.value }))}
                className="flex w-full rounded-md border border-input bg-background/40 px-3 py-2 text-sm h-11 appearance-none cursor-pointer focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              >
                <option value="">Select a company…</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.industry ? ` · ${c.industry}` : ""}</option>
                ))}
              </select>
            )}
          </div>
          <FloatingLabelField icon={Building2} label="Business Name *" value={form.business_name} onChange={(v) => setForm(f => ({ ...f, business_name: v }))} />
          <FloatingLabelField icon={UserPlus} label="Contact Person *" value={form.contact_person} onChange={(v) => setForm(f => ({ ...f, contact_person: v }))} />
          <FloatingLabelField icon={Mail} label="Contact Email *" value={form.email} onChange={(v) => setForm(f => ({ ...f, email: v }))} type="email" />
          <PhoneField value={form.phone} onChange={(v) => setForm(f => ({ ...f, phone: v }))} />
          <FloatingLabelField icon={ShieldCheck} label="GST / Business Reg. No." value={form.gst_number} onChange={(v) => setForm(f => ({ ...f, gst_number: v }))} />
          <FloatingLabelField icon={Building2} label="Billing Address" value={form.address} onChange={(v) => setForm(f => ({ ...f, address: v }))} />

          <RippleButton
            type="submit"
            disabled={busy || !form.company_id || !form.business_name || !form.contact_person || !form.email || form.phone.length > 0 && form.phone.length !== 10}
            className="w-full h-11 rounded-lg bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-600 text-white font-medium shadow-glow disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Access Request"}
          </RippleButton>
          <p className="text-xs text-muted-foreground">
            The selected company's admin will review your request before you can place orders.
          </p>
        </form>
      </div>
    </motion.div>
  );
}

/* ───────────────────────────────────────────────────── */
/*  ROLE GRID — Premium 3D Tilt Cards                   */
/* ───────────────────────────────────────────────────── */
function RoleGrid({ onPick, onRegisterCompany, onRegisterCustomer }: { onPick: (r: AppRole) => void; onRegisterCompany: () => void; onRegisterCustomer: () => void }) {
  const groups: Array<[string, string, typeof ROLES]> = [
    ["Platform", "Root-level control", ROLES.filter(r => r.group === "platform")],
    ["Company", "Tenant administration", ROLES.filter(r => r.group === "company")],
    ["Operations", "Plant & shop-floor", ROLES.filter(r => r.group === "operations")],
    ["External", "Portals & compliance", ROLES.filter(r => r.group === "external")],
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mt-6">
      <div className="text-center max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full glass border border-primary/20"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Role-based access
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight"
        >
          Who's signing in?
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-2 text-muted-foreground text-sm"
        >
          Select your role to open your workspace. Each role gets a tailored experience.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-4 flex flex-wrap items-center justify-center gap-3"
        >
          <Button
            variant="outline"
            onClick={onRegisterCompany}
            className="border-primary/30 text-primary hover:bg-primary/10"
          >
            <Building2 className="h-4 w-4 mr-1.5" />
            Register your company
          </Button>
          <Button
            variant="outline"
            onClick={onRegisterCustomer}
            className="border-teal-500/40 text-teal-500 hover:bg-teal-500/10"
          >
            <Store className="h-4 w-4 mr-1.5" />
            Register as a Customer
          </Button>
        </motion.div>
      </div>

      <div className="mt-10 space-y-10">
        {groups.map(([label, sub, roles]) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3 }}
          >
            <div className="mb-3 flex items-end justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-primary/80">{label}</div>
                <div className="text-sm text-muted-foreground">{sub}</div>
              </div>
              <div className="text-xs text-muted-foreground">{roles.length} roles</div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {roles.map((r, i) => (
                <RoleCard key={r.id} role={r} index={i} onClick={() => onPick(r.id)} />
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function RoleCard({ role, index, onClick }: { role: typeof ROLES[number]; index: number; onClick: () => void }) {
  const tiltRef = useRef<HTMLButtonElement>(null);

  const handleMove = (e: React.MouseEvent) => {
    const el = tiltRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(600px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateY(-6px)`;
  };

  const handleLeave = () => {
    if (tiltRef.current) tiltRef.current.style.transform = "perspective(600px) rotateY(0deg) rotateX(0deg) translateY(0px)";
  };

  return (
    <motion.button
      ref={tiltRef}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, type: "spring", stiffness: 300, damping: 24 }}
      whileTap={{ scale: 0.97 }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      onClick={onClick}
      className="relative text-left glass rounded-2xl p-4 border border-border/40 hover:border-primary/30 transition-all duration-200 overflow-hidden group"
      style={{ transition: "transform 0.15s ease-out" }}
    >
      {/* Gradient glow on hover */}
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-br ${role.accent} opacity-[0.06] transition-opacity duration-300`} />

      <div className="relative z-10">
        <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${role.accent} grid place-items-center shadow-glow`}>
          <role.icon className="h-5 w-5 text-white" />
        </div>
        <div className="mt-3 text-sm font-medium">{role.label}</div>
        <div className="text-[11px] text-muted-foreground">{role.tagline}</div>

        {/* Peek preview on hover */}
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          whileHover={{ opacity: 1, height: "auto" }}
          className="overflow-hidden"
        >
          <div className="mt-2 pt-2 border-t border-border/30 grid grid-cols-2 gap-1 text-[10px] text-muted-foreground">
            <span>Dashboard</span>
            <span>Settings</span>
          </div>
        </motion.div>
      </div>
    </motion.button>
  );
}

/* ───────────────────────────────────────────────────── */
/*  LOGIN PANEL — Premium Tabs + Glassmorphism          */
/* ───────────────────────────────────────────────────── */
function LoginPanel({ role, redirect }: { role: AppRole; redirect?: string }) {
  const meta = ROLE_MAP[role];
  const navigate = useNavigate();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const springX = useSpring(mouseX, { stiffness: 60, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 60, damping: 20 });

  const handleMouse = (e: React.MouseEvent) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    mouseX.set((e.clientX - r.left) / r.width);
    mouseY.set((e.clientY - r.top) / r.height);
  };

  async function doSignIn(withEmail: string, withPassword: string) {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: withEmail, password: withPassword });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Welcome back to FactoryOS`);
    navigate({ to: redirect ?? "/dashboard" });
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    await doSignIn(email, password);
  }




  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName || email.split("@")[0] }, emailRedirectTo: `${window.location.origin}/auth` },
    });
    setBusy(false);
    if (error) {
      const msg = error.message ?? "";
      if (msg.includes("whitelisted")) {
        toast.error("Your email isn't whitelisted for this role. Ask your Company Admin for an invitation.");
      } else if (msg.includes("rate limit") || msg.includes("429") || msg.includes("over_email_send")) {
        toast.error("Too many sign-up attempts in a short window. Please wait a minute and try again.");
      } else {
        toast.error(msg);
      }
      return;
    }
    toast.success("Account created. You're signed in.");
    navigate({ to: redirect ?? "/dashboard" });
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="mt-6 grid lg:grid-cols-2 gap-8 items-center max-w-6xl mx-auto"
    >
      {/* Left illustration — 3D depth */}
      <div className="hidden lg:block relative" onMouseMove={handleMouse} onMouseLeave={() => { mouseX.set(0.5); mouseY.set(0.5); }}>
        <motion.div
          style={{
            rotateX: useTransform(springY, [0, 1], [3, -3]),
            rotateY: useTransform(springX, [0, 1], [-3, 3]),
          }}
        >
          <div className={`absolute -inset-6 rounded-3xl bg-gradient-to-br ${meta.accent} opacity-20 blur-3xl`} />
          <div className="relative glass-strong rounded-3xl p-10 min-h-[420px] flex flex-col justify-between overflow-hidden group">
            {/* Animated border glow */}
            <div className="absolute inset-0 rounded-3xl p-[1px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/30 via-accent/20 to-primary/10" />
            </div>

            <motion.div
              className="relative"
              style={{ z: useTransform(springY, [0, 1], [15, -15]) }}
            >
              <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${meta.accent} grid place-items-center shadow-glow`}>
                <meta.icon className="h-7 w-7 text-white" />
              </div>
            </motion.div>

            <div className="relative">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Signing in as</div>
              <motion.h2
                style={{ z: useTransform(springY, [0, 1], [5, -5]) }}
                className="mt-2 text-3xl font-semibold"
              >
                {meta.label}
              </motion.h2>
              <p className="mt-2 text-muted-foreground max-w-md">{meta.tagline}. Your workspace is scoped to the data your role is authorized to see.</p>
            </div>

            <motion.div
              style={{ z: useTransform(springY, [0, 1], [-5, 5]) }}
              className="grid grid-cols-3 gap-2 text-xs"
            >
              {["RLS enforced", "Audit-logged", "Realtime"].map(x => (
                <div key={x} className="glass rounded-lg px-3 py-2 border border-border/30 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-success" /> {x}
                </div>
              ))}
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Right — Login form */}
      <motion.div
        onMouseMove={handleMouse}
        onMouseLeave={() => { mouseX.set(0.5); mouseY.set(0.5); }}
        style={{
          rotateX: useTransform(springY, [0, 1], [1.5, -1.5]),
          rotateY: useTransform(springX, [0, 1], [-1.5, 1.5]),
        }}
        className="glass-strong rounded-3xl p-8 shadow-elegant relative overflow-hidden"
      >
        {/* Animated gradient border */}
        <div className="absolute inset-0 rounded-3xl p-[1px] pointer-events-none">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/15 via-accent/10 to-primary/5 opacity-50" />
        </div>

        <div className="relative z-10">
          <div className="lg:hidden mb-4 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${meta.accent} grid place-items-center shadow-glow`}>
              <meta.icon className="h-5 w-5 text-white" />
            </div>
            <div><div className="font-semibold">{meta.label}</div><div className="text-xs text-muted-foreground">{meta.tagline}</div></div>
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
            <div className="relative">
              <TabsList className="grid grid-cols-2 w-full bg-muted/30 p-0.5 rounded-lg">
                <TabsTrigger value="signin" className="relative z-10 data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:bg-transparent">Sign in</TabsTrigger>
                <TabsTrigger value="signup" className="relative z-10 data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:bg-transparent">Register</TabsTrigger>
              </TabsList>
              {/* Animated pill indicator */}
              <motion.div
                className="absolute top-0.5 h-[calc(100%-4px)] rounded-md bg-card shadow-sm border border-border z-0"
                animate={{
                  left: tab === "signin" ? "0.25rem" : "50%",
                  right: tab === "signin" ? "50%" : "0.25rem",
                }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            </div>

            <TabsContent value="signin" className="mt-5">
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
              >
                <motion.form
                  onSubmit={signIn}
                  className="space-y-4"
                  variants={formVariants}
                  animate={busy ? "success" : "initial"}
                >
                  <FloatingLabelField icon={Mail} label="Work email" value={email} onChange={setEmail} type="email" />
                  <PasswordStrengthField value={password} onChange={setPassword} />
                  <RippleButton
                    type="submit"
                    disabled={busy}
                    className="w-full h-11 rounded-lg bg-gradient-to-r from-primary via-primary/90 to-accent text-white font-medium shadow-glow disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Sign in as ${meta.label}`}
                  </RippleButton>
                </motion.form>
              </motion.div>
            </TabsContent>

            <TabsContent value="signup" className="mt-5">
              <motion.div
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
              >
                <motion.form
                  onSubmit={signUp}
                  className="space-y-4"
                  variants={formVariants}
                  animate={busy ? "success" : "initial"}
                >
                  <FloatingLabelField icon={Mail} label="Whitelisted email" value={email} onChange={setEmail} type="email" />
                  <FloatingLabelField icon={ShieldCheck} label="Full name" value={fullName} onChange={setFullName} />
                  <PasswordStrengthField value={password} onChange={setPassword} />
                  <RippleButton
                    type="submit"
                    disabled={busy}
                    className="w-full h-11 rounded-lg bg-gradient-to-r from-primary via-primary/90 to-accent text-white font-medium shadow-glow disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
                  </RippleButton>
                  <p className="text-xs text-muted-foreground">
                    Registration succeeds only when your email is whitelisted for this role by a Root or Company Admin.
                  </p>
                </motion.form>
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ───────────────────────────────────────────────────── */
/*  FLOATING LABEL FIELD — Animated Input               */
/* ───────────────────────────────────────────────────── */
function FloatingLabelField({
  icon: Icon, label, value, onChange, type = "text",
}: { icon: any; label: string; value: string; onChange: (v: string) => void; type?: string }) {
  const [focused, setFocused] = useState(false);
  const hasValue = value.length > 0;
  const isUp = focused || hasValue;

  const labelY = useMotionValue(isUp ? -18 : 0);
  const labelS = useMotionValue(isUp ? 0.78 : 1);
  const springY = useSpring(labelY, { stiffness: 280, damping: 28 });
  const springS = useSpring(labelS, { stiffness: 280, damping: 28 });

  useEffect(() => { labelY.set(isUp ? -18 : 0); labelS.set(isUp ? 0.78 : 1); }, [isUp, labelY, labelS]);

  return (
    <div className="space-y-1.5">
      <div className="relative group">
        {/* Animated gradient border glow ring */}
        {focused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-primary/40 via-accent/30 to-primary/40 blur-[2px] z-0"
            style={{
              backgroundSize: "200% 100%",
              animation: "shimmer 3s linear infinite",
            }}
          />
        )}

        <div className="relative z-10">
          <Icon className={`h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-200 z-20 ${
            focused ? "text-primary" : "text-muted-foreground"
          }`} />

          {/* Floating label */}
          <motion.label
            style={{ y: springY, scale: springS, transformOrigin: "left center" }}
            className={`absolute left-9 top-3.5 text-sm pointer-events-none z-20 ${
              focused ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {label}
          </motion.label>

          <Input
            value={value}
            type={type}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className="pl-9 pt-4 pb-1.5 h-11 bg-background/40 border-border/60 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all duration-200 relative z-10"
            required
          />
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────── */
/*  PASSWORD STRENGTH FIELD                             */
/* ───────────────────────────────────────────────────── */
function PasswordStrengthField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);

  const hasValue = value.length > 0;
  const isUp = focused || hasValue;

  const labelY = useMotionValue(isUp ? -18 : 0);
  const labelS = useMotionValue(isUp ? 0.78 : 1);
  const springY = useSpring(labelY, { stiffness: 280, damping: 28 });
  const springS = useSpring(labelS, { stiffness: 280, damping: 28 });

  useEffect(() => { labelY.set(isUp ? -18 : 0); labelS.set(isUp ? 0.78 : 1); }, [isUp, labelY, labelS]);

  // Strength calculation
  const strength = useMemo(() => {
    if (value.length === 0) return { level: 0, label: "", color: "", checks: [false, false, false, false, false] };
    const checks = [
      value.length >= 8,
      value.length >= 12,
      /[A-Z]/.test(value),
      /[0-9]/.test(value),
      /[^A-Za-z0-9]/.test(value),
    ];
    const score = checks.filter(Boolean).length;
    if (score <= 1) return { level: 1, label: "Weak", color: "oklch(0.62 0.23 25)", checks };
    if (score <= 3) return { level: 2, label: "Medium", color: "oklch(0.79 0.17 75)", checks };
    return { level: 3, label: "Strong", color: "oklch(0.72 0.19 145)", checks };
  }, [value]);

  const barWidth = useSpring(0, { stiffness: 200, damping: 20 });
  // Hoisted to top level — never call hooks inside conditional JSX.
  // (This was the cause of the manual-login crash: when the user typed in
  // the password field, this hook mounted for the first time → React #310.)
  const barWidthPct = useTransform(barWidth, [0, 100], ["0%", "100%"]);
  useEffect(() => {
    barWidth.set(strength.level === 0 ? 0 : (strength.level / 3) * 100);
  }, [strength.level, barWidth]);

  const passwordHints = [
    { label: "8+ characters", check: strength.checks[0] },
    { label: "12+ characters", check: strength.checks[1] },
    { label: "Uppercase letter", check: strength.checks[2] },
    { label: "Number", check: strength.checks[3] },
    { label: "Special character", check: strength.checks[4] },
  ];

  return (
    <div className="space-y-1.5">
      <div className="relative group">
        {focused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-primary/40 via-accent/30 to-primary/40 blur-[2px] z-0"
            style={{
              backgroundSize: "200% 100%",
              animation: "shimmer 3s linear infinite",
            }}
          />
        )}

        <div className="relative z-10">
          <Lock className={`h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-200 z-20 ${
            focused ? "text-primary" : "text-muted-foreground"
          }`} />

          <motion.label
            style={{ y: springY, scale: springS, transformOrigin: "left center" }}
            className={`absolute left-9 top-3.5 text-sm pointer-events-none z-20 ${
              focused ? "text-primary" : "text-muted-foreground"
            }`}
          >
            Password
          </motion.label>

          <Input
            value={value}
            type={visible ? "text" : "password"}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className="pl-9 pr-10 pt-4 pb-1.5 h-11 bg-background/40 border-border/60 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all duration-200 relative z-10"
            required
          />

          {/* Toggle visibility */}
          <button
            type="button"
            onClick={() => setVisible(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Strength indicator bar + hints */}
      <AnimatePresence>
        {focused && value.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="space-y-2"
          >
            {/* Strength bar */}
            <div className="h-1 rounded-full bg-foreground/10 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{
                  width: barWidthPct,
                  backgroundColor: strength.color,
                }}
              />
            </div>
            <div className="flex justify-between text-[10px]">
              <span style={{ color: strength.color }} className="font-medium">
                {strength.label}
              </span>
              <span className="text-muted-foreground">
                {value.length} chars
              </span>
            </div>

            {/* Requirement hints with animated checkmarks */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              {passwordHints.map((hint, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{
                    opacity: 1,
                    x: 0,
                    color: hint.check ? strength.color : "var(--color-muted-foreground)",
                  }}
                  transition={{ delay: i * 0.04, duration: 0.2 }}
                  className="flex items-center gap-1.5 text-[10px]"
                >
                  <AnimatePresence mode="wait">
                    {hint.check ? (
                      <motion.span
                        key="check"
                        initial={{ scale: 0, rotate: -90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, rotate: 90 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                        className="shrink-0"
                      >
                        <CheckCircle2 className="h-3 w-3" style={{ color: strength.color }} />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="circle"
                        initial={{ scale: 1 }}
                        animate={{ scale: 1 }}
                        className="shrink-0"
                      >
                        <div className="h-3 w-3 rounded-full border border-muted-foreground/30" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {hint.label}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ───────────────────────────────────────────────────── */
/*  PHONE FIELD — 10-digit validation                  */
/* ───────────────────────────────────────────────────── */
function PhoneField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false);
  const digits = value.replace(/\D/g, "");
  const isValid = digits.length === 0 || digits.length === 10;
  const error = value.length > 0 && !isValid ? "Phone must be exactly 10 digits" : "";

  const labelY = useMotionValue((focused || digits.length > 0) ? -18 : 0);
  const labelS = useMotionValue((focused || digits.length > 0) ? 0.78 : 1);
  const springY = useSpring(labelY, { stiffness: 280, damping: 28 });
  const springS = useSpring(labelS, { stiffness: 280, damping: 28 });

  useEffect(() => {
    const isUp = focused || digits.length > 0;
    labelY.set(isUp ? -18 : 0);
    labelS.set(isUp ? 0.78 : 1);
  }, [focused, digits.length, labelY, labelS]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const cleaned = raw.replace(/\D/g, "").slice(0, 10);
    onChange(cleaned);
  }

  return (
    <div className="space-y-1.5">
      <div className="relative group">
        {focused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-primary/40 via-accent/30 to-primary/40 blur-[2px] z-0"
            style={{ backgroundSize: "200% 100%", animation: "shimmer 3s linear infinite" }}
          />
        )}
        <div className="relative z-10">
          <Globe className={`h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-200 z-20 ${
            focused ? "text-primary" : "text-muted-foreground"
          }`} />
          <motion.label
            style={{ y: springY, scale: springS, transformOrigin: "left center" }}
            className={`absolute left-9 top-3.5 text-sm pointer-events-none z-20 ${
              focused ? "text-primary" : "text-muted-foreground"
            }`}
          >
            Phone (10 digits)
          </motion.label>
          <Input
            value={digits}
            type="tel"
            onChange={handleChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className={`pl-9 pt-4 pb-1.5 h-11 bg-background/40 border-border/60 focus:ring-1 transition-all duration-200 relative z-10 ${
              error ? "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20" : "focus:border-primary/50 focus:ring-primary/20"
            }`}
            placeholder=""
          />
        </div>
      </div>
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[11px] px-1 text-red-400"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
}

/* ───────────────────────────────────────────────────── */
/*  RIPPLE BUTTON                                      */
/* ───────────────────────────────────────────────────── */
function RippleButton({ children, className = "", disabled = false, onClick, type = "button" }: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);
  const idRef = useRef(0);

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = ++idRef.current;
    setRipples(prev => [...prev, { x, y, id }]);
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 600);
    onClick?.();
  }, [disabled, onClick]);

  return (
    <motion.button
      type={type}
      disabled={disabled}
      whileHover={{ scale: disabled ? 1 : 1.01 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onClick={handleClick}
      className={`relative overflow-hidden ${className}`}
    >
      {children}
      <AnimatePresence>
        {ripples.map(r => (
          <motion.span
            key={r.id}
            initial={{ width: 0, height: 0, x: r.x, y: r.y, opacity: 0.4 }}
            animate={{ width: 300, height: 300, x: r.x - 150, y: r.y - 150, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute rounded-full bg-white/20 pointer-events-none"
            style={{ left: 0, top: 0 }}
          />
        ))}
      </AnimatePresence>
    </motion.button>
  );
}

/* ───────────────────────────────────────────────────── */
/*  FLOATING SELECT FIELD — Country etc.               */
/* ───────────────────────────────────────────────────── */
function FloatingSelectField({ icon: Icon, label, value, onChange, options }: {
  icon: any;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  const [focused, setFocused] = useState(false);
  const isUp = focused || value.length > 0;

  const labelY = useMotionValue(isUp ? -18 : 0);
  const labelS = useMotionValue(isUp ? 0.78 : 1);
  const springY = useSpring(labelY, { stiffness: 280, damping: 28 });
  const springS = useSpring(labelS, { stiffness: 280, damping: 28 });

  useEffect(() => { labelY.set(isUp ? -18 : 0); labelS.set(isUp ? 0.78 : 1); }, [isUp, labelY, labelS]);

  return (
    <div className="space-y-1.5">
      <div className="relative group">
        {focused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-primary/40 via-accent/30 to-primary/40 blur-[2px] z-0"
            style={{
              backgroundSize: "200% 100%",
              animation: "shimmer 3s linear infinite",
            }}
          />
        )}

        <div className="relative z-10">
          <Icon className={`h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-200 z-20 ${
            focused ? "text-primary" : "text-muted-foreground"
          }`} />

          <motion.label
            style={{ y: springY, scale: springS, transformOrigin: "left center" }}
            className={`absolute left-9 top-3.5 text-sm pointer-events-none z-20 ${
              focused ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {label}
          </motion.label>

          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className="flex w-full rounded-md border border-input bg-background/40 px-3 py-2 text-sm h-11 pl-9 pt-4 pb-1.5 appearance-none cursor-pointer focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all duration-200 relative z-10"
          >
            {options.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Custom dropdown arrow */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 pointer-events-none text-muted-foreground">
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M1 1l4 4 4-4" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────── */
/*  FORM SUBMIT ANIMATION WRAPPER                      */
/* ───────────────────────────────────────────────────── */
const formVariants = {
  initial: { opacity: 1, y: 0 },
  success: {
    opacity: [1, 0.8, 1],
    scale: [1, 1.02, 1],
    transition: { duration: 0.4 },
  },
};
