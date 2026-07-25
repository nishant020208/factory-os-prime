import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { z } from "zod";
import { ArrowLeft, Factory, Loader2, Lock, Mail, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ROLES, ROLE_MAP, DEMO_PASSWORD, type AppRole } from "@/lib/roles";

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

function AuthPage() {
  const { role, redirect } = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const selected = role && role in ROLE_MAP ? ROLE_MAP[role as AppRole] : null;

  return (
    <div className="min-h-screen aurora-bg text-foreground relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />

      {/* top bar */}
      <div className="relative flex items-center justify-between p-4 sm:p-6 max-w-7xl mx-auto">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="h-8 w-8 rounded-lg bg-[image:var(--gradient-primary)] shadow-glow grid place-items-center">
            <Factory className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold">FactoryOS <span className="text-muted-foreground">AI</span></span>
        </Link>
        {selected && (
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/auth" })}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Change role
          </Button>
        )}
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        <AnimatePresence mode="wait">
          {!selected ? (
            <RoleGrid key="grid" onPick={(r) => navigate({ to: "/auth", search: { role: r, redirect } })} />
          ) : (
            <LoginPanel key={selected.id} role={selected.id} redirect={redirect} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ───────────────────── ROLE GRID ───────────────────── */
function RoleGrid({ onPick }: { onPick: (r: AppRole) => void }) {
  const groups: Array<[string, string, typeof ROLES]> = [
    ["Platform", "Root-level control", ROLES.filter(r => r.group === "platform")],
    ["Company", "Tenant administration", ROLES.filter(r => r.group === "company")],
    ["Operations", "Plant & shop-floor", ROLES.filter(r => r.group === "operations")],
    ["External", "Portals & compliance", ROLES.filter(r => r.group === "external")],
  ];
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mt-6">
      <div className="text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full glass border border-white/10">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Role-based access
        </div>
        <h1 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight">
          Who's signing in?
        </h1>
        <p className="mt-2 text-muted-foreground text-sm">
          Select your role to open your workspace. Each role gets a tailored experience.
        </p>
      </div>

      <div className="mt-10 space-y-10">
        {groups.map(([label, sub, roles]) => (
          <div key={label}>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-primary/90">{label}</div>
                <div className="text-sm text-muted-foreground">{sub}</div>
              </div>
              <div className="text-xs text-muted-foreground">{roles.length} roles</div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {roles.map((r, i) => (
                <motion.button
                  key={r.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  whileHover={{ y: -3 }}
                  onClick={() => onPick(r.id)}
                  className={`text-left glass rounded-2xl p-4 border-white/5 hover:border-primary/30 transition ring-0 hover:ring-2 ${r.ring}`}
                >
                  <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${r.accent} grid place-items-center shadow-glow`}>
                    <r.icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="mt-3 text-sm font-medium">{r.label}</div>
                  <div className="text-[11px] text-muted-foreground">{r.tagline}</div>
                </motion.button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ───────────────────── LOGIN PANEL ───────────────────── */
function LoginPanel({ role, redirect }: { role: AppRole; redirect?: string }) {
  const meta = ROLE_MAP[role];
  const navigate = useNavigate();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

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

  async function oneClickDemo() {
    await doSignIn(meta.demoEmail, DEMO_PASSWORD);
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
      toast.error(error.message.includes("whitelisted")
        ? "Your email isn't whitelisted for this role. Ask your Company Admin for an invitation."
        : error.message);
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
      {/* left: illustration */}
      <div className="hidden lg:block relative">
        <div className={`absolute -inset-6 rounded-3xl bg-gradient-to-br ${meta.accent} opacity-25 blur-3xl`} />
        <div className="relative glass-strong rounded-3xl p-10 min-h-[420px] flex flex-col justify-between">
          <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${meta.accent} grid place-items-center shadow-glow`}>
            <meta.icon className="h-7 w-7 text-white" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Signing in as</div>
            <h2 className="mt-2 text-3xl font-semibold">{meta.label}</h2>
            <p className="mt-2 text-muted-foreground max-w-md">{meta.tagline}. Your workspace is scoped to the data your role is authorized to see.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {["RLS enforced","Audit-logged","Realtime"].map(x => (
              <div key={x} className="glass rounded-lg px-3 py-2 border-white/5 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-success" /> {x}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* right: form */}
      <div className="glass-strong rounded-3xl p-8 shadow-elegant">
        <div className="lg:hidden mb-4 flex items-center gap-3">
          <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${meta.accent} grid place-items-center shadow-glow`}>
            <meta.icon className="h-5 w-5 text-white" />
          </div>
          <div><div className="font-semibold">{meta.label}</div><div className="text-xs text-muted-foreground">{meta.tagline}</div></div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Register</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <Button
              type="button"
              onClick={oneClickDemo}
              disabled={busy}
              className="mt-5 w-full h-11 bg-gradient-to-r from-primary via-primary/90 to-accent shadow-glow"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Zap className="h-4 w-4 mr-1.5" /> One-click sign in as {meta.label}</>}
            </Button>
            <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
              <div className="h-px flex-1 bg-border/60" /> or use credentials <div className="h-px flex-1 bg-border/60" />
            </div>
            <form onSubmit={signIn} className="space-y-4">
              <Field icon={Mail} label="Work email" value={email} onChange={setEmail} type="email" />
              <Field icon={Lock} label="Password" value={password} onChange={setPassword} type="password" />
              <Button type="submit" disabled={busy} className="w-full bg-[image:var(--gradient-primary)] shadow-glow">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Sign in as ${meta.label}`}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={signUp} className="mt-5 space-y-4">
              <Field icon={Mail} label="Whitelisted email" value={email} onChange={setEmail} type="email" />
              <Field icon={ShieldCheck} label="Full name" value={fullName} onChange={setFullName} />
              <Field icon={Lock} label="Password" value={password} onChange={setPassword} type="password" />
              <Button type="submit" disabled={busy} className="w-full bg-[image:var(--gradient-primary)] shadow-glow">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Registration succeeds only when your email is whitelisted for this role by a Root or Company Admin.
              </p>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </motion.div>
  );
}

function Field({
  icon: Icon, label, value, onChange, type = "text",
}: { icon: any; label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <Icon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={value} type={type} onChange={(e) => onChange(e.target.value)} className="pl-9 h-11 bg-background/40" required />
      </div>
    </div>
  );
}
