import { type ReactNode, useEffect, useState, useMemo } from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Search,
  Settings,
  LogOut,
  Command,
  ChevronDown,
  Sun,
  Moon,
  Factory,
  BrainCircuit,
  Palette,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useTheme, type ThemeMode } from "@/hooks/use-theme";
import { useClickSound } from "@/hooks/use-click-sound";
import { toast } from "sonner";
import { recordAccessLog } from "@/lib/access-log";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications, setNavigateHandler } from "@/hooks/use-notifications";
import { ROLE_MAP } from "@/lib/roles";
import { navForRole } from "@/components/nav-config";
import { primaryRole, homeForRole } from "@/lib/route-access";
import { useI18n } from "@/lib/i18n";
import { LoadingScreen } from "@/components/loading-screen";
import { ROLE_DOMAIN_MAP } from "@/lib/role-scope";

/* ────────────────────────────────────────────────────────── */
/*  ROLE-SPECIFIC COPILOT COMMANDS                            */
/* ────────────────────────────────────────────────────────── */

type CopilotCmd = { label: string; value: string; to?: string; action?: () => void };

/** Maps each role to its relevant Copilot quick-commands */
const copilotCommands: Record<string, CopilotCmd[]> = {
  root_super_admin: [
    { label: "View all companies", value: "companies list tenants", to: "/platform" },
    { label: "Check pending registrations", value: "registrations pending approval", to: "/platform/pending" },
    { label: "Platform audit logs", value: "audit platform actions", to: "/platform/audit" },
    { label: "Whitelist management", value: "whitelist manage admins", to: "/platform/whitelist" },
    { label: "Platform security", value: "security settings access", to: "/platform/security" },
  ],
  company_admin: [
    { label: "Show today's production orders", value: "show production today orders manufacturing", to: "/production" },
    { label: "Which machines need maintenance?", value: "which machines need maintenance downtime repair", to: "/maintenance" },
    { label: "Show low inventory items", value: "show low inventory stock reorder shortage", to: "/inventory" },
    { label: "Create a purchase order", value: "create purchase order buy procurement supplier", to: "/procurement" },
    { label: "Run quality inspection", value: "check quality inspection defect yield pass fail", to: "/quality" },
    { label: "Dispatch customer shipment", value: "dispatch shipment delivery customer shipping", to: "/dispatch" },
    { label: "View invoices and payments", value: "finance invoice payment revenue accounting", to: "/finance" },
    { label: "View customer orders", value: "customer order sales tracking", to: "/customers" },
    { label: "Manage employees", value: "employee hr people payroll attendance", to: "/employees" },
    { label: "Approve pending orders", value: "approve pending customer orders", to: "/approved-orders" },
    { label: "Whitelist staff", value: "whitelist staff invite", to: "/whitelist" },
    { label: "View analytics & KPIs", value: "analytics kpi reports intelligence data", to: "/analytics" },
    { label: "Open AI Center", value: "ai center copilot insights predictions", to: "/ai-center" },
    { label: "Generate reports", value: "reports production quality finance maintenance", to: "/reports" },
  ],
  plant_manager: [
    { label: "Show today's production schedule", value: "show production schedule today", to: "/production" },
    { label: "Check machine status", value: "check machine status operational down", to: "/machines" },
    { label: "Staff attendance today", value: "staff attendance present absent today", to: "/attendance" },
    { label: "View work orders at my plant", value: "work orders plant status progress", to: "/work-orders" },
    { label: "Submit daily report", value: "daily report units completed issues", to: "/daily-reports" },
    { label: "Quality status at my plant", value: "quality inspection pass fail defects", to: "/quality" },
    { label: "Inventory levels at my plant", value: "inventory stock levels", to: "/inventory" },
    { label: "Report machine issue", value: "report machine issue maintenance", to: "/maintenance" },
  ],
  plant_admin: [
    { label: "Plant overview", value: "plant overview status departments", to: "/plant-overview" },
    { label: "Department management", value: "departments list manage", to: "/departments" },
    { label: "Machine status", value: "machine status maintenance", to: "/machines" },
    { label: "Production at my plant", value: "production orders plant", to: "/production" },
    { label: "Inventory at my plant", value: "inventory stock plant", to: "/inventory" },
    { label: "Quality at my plant", value: "quality inspection plant", to: "/quality" },
  ],
  production_manager: [
    { label: "Show production orders", value: "show production orders status", to: "/production" },
    { label: "Manage work orders", value: "work orders create assign schedule", to: "/work-orders" },
    { label: "Check approved customer orders", value: "approved customer orders ready production", to: "/approved-orders" },
    { label: "View Bill of Materials", value: "bom bill of materials components", to: "/bom" },
    { label: "Machine availability", value: "machines available operational", to: "/machines" },
    { label: "Material stock levels", value: "material stock inventory levels", to: "/inventory" },
    { label: "Quality feedback", value: "quality defects inspection results", to: "/quality" },
    { label: "Production planning", value: "production planning schedule", to: "/production-planning" },
  ],
  production_operator: [
    { label: "My assigned work orders", value: "my work orders assigned progress", to: "/work-orders" },
    { label: "Update work order progress", value: "update progress percent complete", to: "/work-orders" },
    { label: "Report machine issue", value: "report machine issue breakdown", to: "/maintenance" },
    { label: "Check my machine status", value: "check machine operational status", to: "/machines" },
  ],
  warehouse_manager: [
    { label: "Show inventory levels", value: "show inventory stock levels", to: "/inventory" },
    { label: "Low stock items", value: "low stock reorder items", to: "/inventory" },
    { label: "Pending shipments", value: "pending shipments dispatch", to: "/dispatch" },
    { label: "Finished goods", value: "finished goods ready ship", to: "/finished-goods" },
    { label: "Raw material stock", value: "raw material stock teak plywood", to: "/inventory" },
    { label: "Stock movement log", value: "stock movement transfer history", to: "/stock-movement" },
  ],
  procurement_manager: [
    { label: "Purchase orders", value: "purchase orders status", to: "/procurement" },
    { label: "Supplier list", value: "suppliers list vendors", to: "/suppliers" },
    { label: "Material requirements", value: "material requirements plan", to: "/materials" },
    { label: "RFQ management", value: "rfq request for quotation", to: "/rfq" },
    { label: "Goods receipt", value: "goods receipt received deliveries", to: "/goods-receipt" },
    { label: "Inventory levels", value: "inventory stock material levels", to: "/inventory" },
  ],
  quality_inspector: [
    { label: "Run quality inspection", value: "quality inspection check defects", to: "/quality" },
    { label: "Defect tracking", value: "defects ncr tracking", to: "/defects" },
    { label: "CAPA actions", value: "capa corrective preventive action", to: "/capa" },
    { label: "Incoming inspection", value: "incoming inspection material", to: "/incoming-inspection" },
    { label: "Final inspection", value: "final inspection batch pass fail", to: "/final-inspection" },
    { label: "Quality certificates", value: "quality certificates issued", to: "/quality-certificates" },
  ],
  maintenance_engineer: [
    { label: "Machine status overview", value: "machines status operational down maintenance", to: "/machines" },
    { label: "Maintenance tickets", value: "maintenance tickets open assigned", to: "/maintenance" },
    { label: "Breakdown reports", value: "breakdown reports recent", to: "/breakdowns" },
    { label: "Spare parts inventory", value: "spare parts stock inventory", to: "/spare-parts" },
    { label: "Report machine issue", value: "report machine issue breakdown", to: "/maintenance" },
  ],
  finance_manager: [
    { label: "View invoices", value: "invoices outstanding payments", to: "/invoices" },
    { label: "Payment records", value: "payments received history", to: "/payments" },
    { label: "Expense tracking", value: "expenses budget tracking", to: "/expenses" },
    { label: "Tax management", value: "taxes gst input output", to: "/taxes" },
    { label: "Supplier invoices", value: "supplier invoices pending", to: "/supplier-invoices" },
    { label: "Profit & Loss overview", value: "profit loss revenue expenses", to: "/finance" },
  ],
  hr_manager: [
    { label: "Employee list", value: "employees list staff", to: "/employees" },
    { label: "Attendance today", value: "attendance present absent today", to: "/attendance" },
    { label: "Leave requests", value: "leave requests pending approval", to: "/leaves" },
    { label: "Payroll overview", value: "payroll salary deductions", to: "/payroll" },
    { label: "Training records", value: "training courses certifications", to: "/training" },
    { label: "Performance reviews", value: "performance reviews ratings", to: "/performance" },
  ],
  customer_portal: [
    { label: "My orders", value: "my orders status tracking", to: "/orders" },
    { label: "Order tracking", value: "track order delivery status", to: "/orders" },
    { label: "My invoices", value: "my invoices payments due", to: "/customer-invoices" },
    { label: "My shipments", value: "my shipments delivery tracking", to: "/shipments" },
    { label: "Support tickets", value: "support tickets my issues", to: "/support" },
  ],
  supplier_portal: [
    { label: "My purchase orders", value: "my purchase orders received", to: "/supplier-pos" },
    { label: "Supplier invoices", value: "my invoices payments", to: "/supplier-invoices" },
    { label: "My deliveries", value: "my deliveries shipments tracking", to: "/deliveries" },
    { label: "Payment history", value: "payment history received", to: "/supplier-payments" },
  ],
  auditor: [
    { label: "Audit logs", value: "audit logs activity trail", to: "/audit" },
    { label: "Compliance status", value: "compliance status regulations", to: "/compliance" },
    { label: "Production overview", value: "production overview orders status", to: "/production" },
    { label: "Finance overview", value: "finance invoices payments", to: "/finance" },
    { label: "Generate audit report", value: "audit report generate export", to: "/reports" },
  ],
};

/** Role-specific search bar placeholders */
const copilotPlaceholder: Record<string, string> = {
  root_super_admin: 'Ask about companies, registrations, platform health…',
  company_admin: 'Ask Copilot — "show production", "approve orders", "staff count"…',
  plant_manager: 'Ask Copilot — "production schedule", "machine status", "daily report"…',
  plant_admin: 'Ask Copilot — "plant overview", "departments", "machines"…',
  production_manager: 'Ask Copilot — "production orders", "work orders", "BOM"…',
  production_operator: 'Ask Copilot — "my work orders", "machine status"…',
  warehouse_manager: 'Ask Copilot — "stock levels", "shipments", "low inventory"…',
  procurement_manager: 'Ask Copilot — "purchase orders", "suppliers", "RFQ"…',
  quality_inspector: 'Ask Copilot — "inspections", "defects", "CAPA"…',
  maintenance_engineer: 'Ask Copilot — "machine status", "maintenance tickets", "breakdowns"…',
  finance_manager: 'Ask Copilot — "invoices", "payments", "expenses"…',
  hr_manager: 'Ask Copilot — "employees", "attendance", "payroll"…',
  customer_portal: 'Ask Copilot — "my orders", "shipment status", "invoices"…',
  supplier_portal: 'Ask Copilot — "my POs", "deliveries", "payments"…',
  auditor: 'Ask Copilot — "audit logs", "compliance", "cross-module summary"…',
};

/** Role-specific empty-state messages */
const copilotEmpty: Record<string, string> = {
  root_super_admin: 'No results. Try "companies", "registrations", or "platform status".',
  company_admin: 'No results. Try "production", "approve orders", or "staff count".',
  plant_manager: 'No results. Try "production schedule", "machine status", or "daily report".',
  production_manager: 'No results. Try "work orders", "production schedule", or "BOM".',
  production_operator: 'No results. Try "my work orders" or "machine status".',
  warehouse_manager: 'No results. Try "stock levels", "shipments", or "low inventory".',
  procurement_manager: 'No results. Try "purchase orders", "suppliers", or "RFQ".',
  quality_inspector: 'No results. Try "inspections", "defects", or "CAPA".',
  maintenance_engineer: 'No results. Try "machine status", "maintenance", or "breakdowns".',
  finance_manager: 'No results. Try "invoices", "payments", or "expenses".',
  hr_manager: 'No results. Try "employees", "attendance", or "payroll".',
  customer_portal: 'No results. Try "my orders", "shipment", or "invoices".',
  supplier_portal: 'No results. Try "my POs", "deliveries", or "payments".',
  auditor: 'No results. Try "audit logs", "compliance", or "reports".',
};

export function AppShell({ children }: { children: ReactNode }) {
  const { loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (loading) return <LoadingScreen />;
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full aurora-bg">
        <FactorySidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />
          <main className="flex-1 p-3 sm:p-6 lg:p-8 overflow-y-auto">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.12 }}
            >
              {children}
            </motion.div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function FactorySidebar() {
  const { state, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { roles } = useAuth();
  const { t } = useI18n();
  const role = useMemo(() => primaryRole(roles), [roles]);
  const sections = useMemo(() => navForRole(role), [role]);
  const home = homeForRole(role);

  function closeMobile() {
    setOpenMobile(false);
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to={home} onClick={closeMobile} className="flex items-center gap-2 px-2 py-2">
          <div className="h-8 w-8 rounded-lg bg-[image:var(--gradient-primary)] shadow-glow grid place-items-center shrink-0">
            <Factory className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">FactoryOS</div>
              <div className="text-[10px] text-muted-foreground truncate">
                {role === "root_super_admin" ? "Platform Console" : "AI Manufacturing OS"}
              </div>
            </div>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent className="scrollbar-thin">
        {sections.map((section) => (
          <SidebarGroup key={section.label}>
            {!collapsed && <SidebarGroupLabel>{t(section.label)}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((it) => {
                  const active =
                    pathname === it.to || (it.to !== home && pathname.startsWith(it.to + "/"));
                  const label = t(it.label);
                  const isBold = it.bold;
                  return (
                    <SidebarMenuItem key={it.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={label}
                        className={isBold ? "relative overflow-visible" : undefined}
                      >
                        <Link to={it.to} onClick={closeMobile} className="flex items-center gap-2">
                          <it.icon className="h-4 w-4" />
                          {!collapsed && (
                            <span
                              className={`truncate ${isBold ? "font-bold text-foreground" : ""}`}
                            >
                              {label}
                            </span>
                          )}

                          {!collapsed && it.badge && (
                            <Badge
                              variant="secondary"
                              className={`ml-auto text-[10px] py-0 h-4 ${isBold ? "bg-primary/20 text-primary border-primary/30" : ""}`}
                            >
                              {it.badge}
                            </Badge>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <UserBadge collapsed={collapsed} />
      </SidebarFooter>
    </Sidebar>
  );
}

function UserBadge({ collapsed }: { collapsed: boolean }) {
  const { profile, roles } = useAuth();
  const role = primaryRole(roles);
  const roleLabel = role ? ROLE_MAP[role]?.label : "User";
  return (
    <div className="flex items-center gap-2 p-2">
      <UserAvatar
        name={profile?.full_name}
        email={profile?.email}
        url={profile?.avatar_url}
        className="h-8 w-8"
        fallbackClassName="text-xs bg-primary/20 text-primary"
      />
      {!collapsed && (
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium truncate">
            {profile?.full_name ?? profile?.email ?? "Signed in"}
          </div>
          <div className="text-[10px] text-muted-foreground truncate">{roleLabel}</div>
        </div>
      )}
    </div>
  );
}

function TopBar() {
  const router = useRouter();
  const { profile, roles, companyId } = useAuth();
  const { theme, setTheme } = useTheme();
  const {
    enabled: soundEnabled,
    setEnabled: setSoundEnabled,
    play: playClick,
  } = useClickSound();
  const { t } = useI18n();
  const { unreadCount } = useNotifications();
  // Register TanStack Router navigate handler for in-app navigation (no full page reloads)
  useEffect(() => {
    setNavigateHandler((to: string) => router.navigate({ to }));
  }, [router]);
  const [cmdOpen, setCmdOpen] = useState(false);
  const role = useMemo(() => primaryRole(roles), [roles]);
  const sections = useMemo(() => navForRole(role), [role]);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function signOut() {
    const email = profile?.email ?? undefined;
    await supabase.auth.signOut();
    sessionStorage.removeItem("factoryos-navigated");
    if (email) void recordAccessLog(email, "logout", "success");
    toast.success("Signed out");
    router.navigate({ to: "/auth", replace: true });
  }

  const roleLabel = role ? ROLE_MAP[role]?.label : "";
  const tenantLabel =
    role === "root_super_admin" ? t("Platform") : companyId ? t("Your Company") : "—";

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-white/5 bg-background/70 backdrop-blur-xl">
        <div className="flex items-center gap-1 sm:gap-3 px-2 sm:px-4 h-14">
          <SidebarTrigger />
          <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
            <span className="px-2 py-0.5 rounded-md bg-card border border-white/5">
              {tenantLabel}
            </span>
            {roleLabel && (
              <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                {roleLabel}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setCmdOpen(true)}
            className="ml-auto flex items-center gap-2 text-xs text-muted-foreground bg-card/60 border border-white/5 rounded-lg px-2 sm:px-3 h-9 hover:border-primary/30 transition min-w-[40px] sm:min-w-[220px]"
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline flex-1 text-left">{t("Search…")}</span>
            <kbd className="hidden sm:flex text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 items-center gap-0.5">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </button>

          {/* 3-way theme switcher - visible as segmented control on wide screens */}
          <div className="hidden lg:flex items-center bg-card/60 border border-white/5 rounded-lg p-0.5 gap-0">
            {[
              { id: "dark" as ThemeMode, icon: Moon, label: "Dark" },
              { id: "light" as ThemeMode, icon: Sun, label: "Light" },
              { id: "aesthetic" as ThemeMode, icon: Palette, label: "Aesthetic" },
            ].map(({ id, icon: Icon, label }) => (
              <button
                type="button"
                key={id}
                onClick={() => setTheme(id)}
                className={`relative flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-all duration-200 ${
                  theme === id
                    ? "text-foreground bg-card shadow-sm border border-white/10"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {theme === id && (
                  <motion.div
                    layoutId="activeTheme"
                    className="absolute inset-0 rounded-md bg-card shadow-sm border border-white/10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <Icon className="h-3 w-3" />
                  <span>{label}</span>
                </span>
              </button>
            ))}
          </div>

          {/* Compact theme dropdown for smaller screens */}
          <div className="lg:hidden relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setThemeMenuOpen((o) => !o)}
              className="h-9 w-9"
              aria-label="Theme"
              aria-expanded={themeMenuOpen}
            >
              {theme === "dark" ? (
                <Moon className="h-4 w-4" />
              ) : theme === "light" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Palette className="h-4 w-4" />
              )}
            </Button>
            <AnimatePresence>
              {themeMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.96 }}
                  className="absolute right-0 top-full mt-1 z-50 w-40 rounded-lg border border-white/10 bg-card shadow-elevated p-1"
                >
                  {[
                    { id: "dark" as ThemeMode, icon: Moon, label: "Dark" },
                    { id: "light" as ThemeMode, icon: Sun, label: "Light" },
                    { id: "aesthetic" as ThemeMode, icon: Palette, label: "Aesthetic" },
                  ].map(({ id, icon: Icon, label }) => (
                    <button
                      type="button"
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
          {/* Click-sound mute toggle (preference persists in localStorage) */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            aria-label={soundEnabled ? "Mute click sounds" : "Enable click sounds"}
            aria-pressed={soundEnabled}
            title={soundEnabled ? "Click sounds on — mute" : "Click sounds off — enable"}
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              // Give instant feedback when switching sound back on (the global
              // layer only ticks while enabled, so this click is otherwise silent)
              if (next) playClick();
            }}
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 relative"
            aria-label="Notifications"
            onClick={() => router.navigate({ to: "/notifications" })}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[1rem] px-1 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center leading-none">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : (
              <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
            )}
          </Button>

          <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 sm:gap-2 hover:bg-card rounded-lg px-1 sm:px-2 h-9"
              >
                <UserAvatar
                  name={profile?.full_name}
                  email={profile?.email}
                  url={profile?.avatar_url}
                  className="h-7 w-7"
                  fallbackClassName="text-xs bg-primary/20 text-primary"
                />
                <ChevronDown className="hidden sm:block h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="text-xs">{profile?.full_name ?? "Signed in"}</div>
                <div className="text-[11px] text-muted-foreground font-normal">
                  {profile?.email}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {role !== "root_super_admin" && (
                <DropdownMenuItem asChild>
                  <Link to="/settings" onClick={() => setDropdownOpen(false)}>
                    <Settings className="h-3.5 w-3.5 mr-2" />
                    {t("Settings")}
                  </Link>
                </DropdownMenuItem>
              )}
              {role === "root_super_admin" && (
                <DropdownMenuItem asChild>
                  <Link to="/platform/settings" onClick={() => setDropdownOpen(false)}>
                    <Settings className="h-3.5 w-3.5 mr-2" />
                    Platform Settings
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { setDropdownOpen(false); signOut(); }} className="text-destructive">
                <LogOut className="h-3.5 w-3.5 mr-2" />
                {t("Sign out")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput
          placeholder={copilotPlaceholder[role ?? ""] ?? copilotPlaceholder.company_admin}
        />
        <CommandList>
          <CommandEmpty>
            {copilotEmpty[role ?? ""] ?? copilotEmpty.company_admin}
          </CommandEmpty>
          <CommandGroup heading="🤖 Copilot Commands">
            {(copilotCommands[role ?? ""] ?? copilotCommands.company_admin).map((cmd) => (
              <CommandItem
                key={cmd.value}
                value={cmd.value}
                onSelect={() => {
                  setCmdOpen(false);
                  if (cmd.action) cmd.action();
                  else router.navigate({ to: cmd.to! });
                }}
              >
                <BrainCircuit className="h-4 w-4 mr-2 text-primary" />
                <span>{cmd.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          {sections.map((s) => (
            <CommandGroup key={s.label} heading={s.label}>
              {s.items.map((it) => (
                <CommandItem
                  key={it.to}
                  value={`${s.label} ${it.label} ${it.to}`}
                  onSelect={() => {
                    setCmdOpen(false);
                    router.navigate({ to: it.to });
                  }}
                >
                  <it.icon className="h-4 w-4 mr-2 text-muted-foreground" />
                  {it.label}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
