import { type ReactNode, useEffect, useState, useMemo } from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Bell, Search, Settings, LogOut, Command, ChevronDown, Sun, Moon, Factory, BrainCircuit,
} from "lucide-react";
import { toast } from "sonner";
import {
  SidebarProvider, Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger, SidebarFooter, SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_MAP } from "@/lib/roles";
import { navForRole } from "@/components/nav-config";
import { primaryRole, homeForRole } from "@/lib/route-access";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full aurora-bg">
        <FactorySidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
            <motion.div
              key={useRouterState({ select: (s) => s.location.pathname })}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
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
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { roles } = useAuth();
  const role = useMemo(() => primaryRole(roles), [roles]);
  const sections = useMemo(() => navForRole(role), [role]);
  const home = homeForRole(role);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to={home} className="flex items-center gap-2 px-2 py-2">
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
            {!collapsed && <SidebarGroupLabel>{section.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((it) => {
                  const active = pathname === it.to || (it.to !== home && pathname.startsWith(it.to + "/"));
                  return (
                    <SidebarMenuItem key={it.to}>
                      <SidebarMenuButton asChild isActive={active} tooltip={it.label}>
                        <Link to={it.to} className="flex items-center gap-2">
                          <it.icon className="h-4 w-4" />
                          {!collapsed && <span className="truncate">{it.label}</span>}
                          {!collapsed && it.badge && (
                            <Badge variant="secondary" className="ml-auto text-[10px] py-0 h-4">{it.badge}</Badge>
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
  const initials = (profile?.full_name ?? profile?.email ?? "?")
    .split(/[.\s@]/).filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join("");
  const role = primaryRole(roles);
  const roleLabel = role ? ROLE_MAP[role]?.label : "User";
  return (
    <div className="flex items-center gap-2 p-2">
      <Avatar className="h-8 w-8"><AvatarFallback className="text-xs bg-primary/20 text-primary">{initials || "U"}</AvatarFallback></Avatar>
      {!collapsed && (
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium truncate">{profile?.full_name ?? profile?.email ?? "Signed in"}</div>
          <div className="text-[10px] text-muted-foreground truncate">{roleLabel}</div>
        </div>
      )}
    </div>
  );
}

function TopBar() {
  const router = useRouter();
  const { profile, roles, companyId } = useAuth();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [dark, setDark] = useState(true);
  const role = useMemo(() => primaryRole(roles), [roles]);
  const sections = useMemo(() => navForRole(role), [role]);

  useEffect(() => {
    document.documentElement.classList.toggle("light", !dark);
  }, [dark]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); setCmdOpen(o => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    router.navigate({ to: "/auth", replace: true });
  }

  const roleLabel = role ? ROLE_MAP[role]?.label : "";
  const tenantLabel = role === "root_super_admin" ? "Platform" : (companyId ? "Your Company" : "—");

  return (
    <>
    <header className="sticky top-0 z-30 border-b border-white/5 bg-background/70 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-3 sm:px-4 h-14">
        <SidebarTrigger />
        <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
          <span className="px-2 py-0.5 rounded-md bg-card border border-white/5">{tenantLabel}</span>
          {roleLabel && <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">{roleLabel}</span>}
        </div>

        <button
          onClick={() => setCmdOpen(true)}
          className="ml-auto flex items-center gap-2 text-xs text-muted-foreground bg-card/60 border border-white/5 rounded-lg px-3 h-9 hover:border-primary/30 transition min-w-[220px]"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 flex items-center gap-0.5">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </button>

        <Button variant="ghost" size="icon" onClick={() => setDark(d => !d)} className="h-9 w-9" aria-label="Toggle theme">
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9 relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-primary animate-pulse-glow" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 hover:bg-card rounded-lg px-2 h-9">
              <Avatar className="h-7 w-7"><AvatarFallback className="text-xs bg-primary/20 text-primary">
                {(profile?.full_name ?? profile?.email ?? "U").slice(0, 1).toUpperCase()}
              </AvatarFallback></Avatar>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="text-xs">{profile?.full_name ?? "Signed in"}</div>
              <div className="text-[11px] text-muted-foreground font-normal">{profile?.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {role !== "root_super_admin" && (
              <DropdownMenuItem asChild><Link to="/settings"><Settings className="h-3.5 w-3.5 mr-2" />Settings</Link></DropdownMenuItem>
            )}
            {role === "root_super_admin" && (
              <DropdownMenuItem asChild><Link to="/platform/settings"><Settings className="h-3.5 w-3.5 mr-2" />Platform Settings</Link></DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive"><LogOut className="h-3.5 w-3.5 mr-2" />Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>

    <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
      <CommandInput placeholder={'Ask Copilot — "show production", "create supplier", "export inventory"…'} />
      <CommandList>
        <CommandEmpty>No results. Try "show production", "create supplier", or "export inventory".</CommandEmpty>
        <CommandGroup heading="🏭 ERP Workflow Commands">
          <CommandItem value="show production today orders manufacturing" onSelect={() => { setCmdOpen(false); router.navigate({ to: "/production" }); }}>
            <BrainCircuit className="h-4 w-4 mr-2 text-primary" />
            <span>Show today's production orders</span>
          </CommandItem>
          <CommandItem value="which machines need maintenance downtime repair" onSelect={() => { setCmdOpen(false); router.navigate({ to: "/maintenance" }); }}>
            <BrainCircuit className="h-4 w-4 mr-2 text-primary" />
            <span>Which machines need maintenance?</span>
          </CommandItem>
          <CommandItem value="show low inventory stock reorder shortage" onSelect={() => { setCmdOpen(false); router.navigate({ to: "/inventory" }); }}>
            <BrainCircuit className="h-4 w-4 mr-2 text-primary" />
            <span>Show low inventory items</span>
          </CommandItem>
          <CommandItem value="create purchase order buy procurement supplier" onSelect={() => { setCmdOpen(false); router.navigate({ to: "/procurement" }); }}>
            <BrainCircuit className="h-4 w-4 mr-2 text-primary" />
            <span>Create a purchase order</span>
          </CommandItem>
          <CommandItem value="check quality inspection defect yield pass fail" onSelect={() => { setCmdOpen(false); router.navigate({ to: "/quality" }); }}>
            <BrainCircuit className="h-4 w-4 mr-2 text-primary" />
            <span>Run quality inspection</span>
          </CommandItem>
          <CommandItem value="dispatch shipment delivery customer shipping" onSelect={() => { setCmdOpen(false); router.navigate({ to: "/dispatch" }); }}>
            <BrainCircuit className="h-4 w-4 mr-2 text-primary" />
            <span>Dispatch customer shipment</span>
          </CommandItem>
          <CommandItem value="finance invoice payment revenue accounting" onSelect={() => { setCmdOpen(false); router.navigate({ to: "/finance" }); }}>
            <BrainCircuit className="h-4 w-4 mr-2 text-primary" />
            <span>View invoices and payments</span>
          </CommandItem>
          <CommandItem value="customer order sales tracking" onSelect={() => { setCmdOpen(false); router.navigate({ to: "/customers" }); }}>
            <BrainCircuit className="h-4 w-4 mr-2 text-primary" />
            <span>View customer orders</span>
          </CommandItem>
          <CommandItem value="employee hr people payroll attendance" onSelect={() => { setCmdOpen(false); router.navigate({ to: "/employees" }); }}>
            <BrainCircuit className="h-4 w-4 mr-2 text-primary" />
            <span>Manage employees</span>
          </CommandItem>
          <CommandItem value="create new supplier vendor" onSelect={() => { setCmdOpen(false); router.navigate({ to: "/suppliers" }); }}>
            <BrainCircuit className="h-4 w-4 mr-2 text-primary" />
            <span>Add a new supplier</span>
          </CommandItem>
          <CommandItem value="summarize today activities overview status" onSelect={() => { setCmdOpen(false); router.navigate({ to: "/dashboard" }); }}>
            <BrainCircuit className="h-4 w-4 mr-2 text-primary" />
            <span>Summarize today's activities</span>
          </CommandItem>
          <CommandItem value="analytics kpi reports intelligence data" onSelect={() => { setCmdOpen(false); router.navigate({ to: "/analytics" }); }}>
            <BrainCircuit className="h-4 w-4 mr-2 text-primary" />
            <span>View analytics & KPIs</span>
          </CommandItem>
          <CommandItem value="ai center copilot insights predictions" onSelect={() => { setCmdOpen(false); router.navigate({ to: "/ai-center" }); }}>
            <BrainCircuit className="h-4 w-4 mr-2 text-primary" />
            <span>Open AI Center</span>
          </CommandItem>
          <CommandItem value="export inventory data csv download" onSelect={() => { setCmdOpen(false); router.navigate({ to: "/inventory" }); toast.success("Navigate to Inventory → click Export CSV"); }}>
            <BrainCircuit className="h-4 w-4 mr-2 text-primary" />
            <span>Export inventory data</span>
          </CommandItem>
          <CommandItem value="create warehouse new storage" onSelect={() => { setCmdOpen(false); router.navigate({ to: "/warehouse" }); toast.success("Click \"New\" to add a warehouse"); }}>
            <BrainCircuit className="h-4 w-4 mr-2 text-primary" />
            <span>Create a new warehouse</span>
          </CommandItem>
          <CommandItem value="work order production schedule plan" onSelect={() => { setCmdOpen(false); router.navigate({ to: "/work-orders" }); }}>
            <BrainCircuit className="h-4 w-4 mr-2 text-primary" />
            <span>Manage work orders</span>
          </CommandItem>
          <CommandItem value="bom bill of materials product assembly" onSelect={() => { setCmdOpen(false); router.navigate({ to: "/bom" }); }}>
            <BrainCircuit className="h-4 w-4 mr-2 text-primary" />
            <span>View Bill of Materials</span>
          </CommandItem>
          <CommandItem value="products catalog sku manage" onSelect={() => { setCmdOpen(false); router.navigate({ to: "/products" }); }}>
            <BrainCircuit className="h-4 w-4 mr-2 text-primary" />
            <span>Manage product catalog</span>
          </CommandItem>
          <CommandItem value="reports production quality finance maintenance" onSelect={() => { setCmdOpen(false); router.navigate({ to: "/reports" }); }}>
            <BrainCircuit className="h-4 w-4 mr-2 text-primary" />
            <span>Generate reports</span>
          </CommandItem>
        </CommandGroup>
        {sections.map(s => (
          <CommandGroup key={s.label} heading={s.label}>
            {s.items.map(it => (
              <CommandItem key={it.to} value={`${s.label} ${it.label} ${it.to}`} onSelect={() => { setCmdOpen(false); router.navigate({ to: it.to }); }}>
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
