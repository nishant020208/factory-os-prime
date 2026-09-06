import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { WorkflowGraph } from "@/components/workflow/workflow-graph";
import { EmployeeListPanel } from "@/components/workflow/employee-list-panel";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  RefreshCw,
  Workflow,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/workflow")({
  ssr: false,
  component: WorkflowPage,
});

interface WorkflowUser {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  role: string;
  plant_id: string | null;
  plant_name: string | null;
  status: string;
}

interface WorkflowLink {
  id: string;
  from_user_id: string;
  to_user_id: string;
  from_role: string;
  to_role: string;
}

function WorkflowPage() {
  const { companyId, plantId, roles } = useAuth();
  const isPlantAdmin = roles.includes("plant_admin");
  const isCompanyAdmin = roles.includes("company_admin");
  const canEdit = isCompanyAdmin || isPlantAdmin;

  const [zoom, setZoom] = useState(1);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Query whitelist as the source of truth for all invited employees.
  // LEFT JOIN profiles to get avatar/full_name for users who have signed up.
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["workflow-users", companyId, plantId, refreshKey],
    queryFn: async () => {
      if (!companyId) return [];

      // 1) Fetch all whitelist rows for this company
      let wlQuery = supabase
        .from("whitelist")
        .select("id, email, role, company_id, plant_id, status")
        .eq("company_id", companyId)
        .not("role", "in", "(root_super_admin,customer_portal,supplier_portal)");

      if (isPlantAdmin && plantId) {
        wlQuery = wlQuery.or(`plant_id.eq.${plantId},plant_id.is.null`);
      }

      const { data: whitelistRows, error: wlError } = await wlQuery;
      if (wlError) throw wlError;
      if (!whitelistRows?.length) return [];

      // 2) Fetch profiles for users who have signed up (matched by email)
      const emails = whitelistRows.map((w: any) => w.email?.toLowerCase()).filter(Boolean);
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url, status")
        .eq("company_id", companyId)
        .in("email", emails.length > 0 ? emails : ["__none__"]);

      const profileByEmail = new Map(
        (profileRows ?? []).map((p: any) => [p.email?.toLowerCase(), p])
      );

      // 3) Fetch user_roles to get the authoritative role + plant_id per user
      const profileIds = (profileRows ?? []).map((p: any) => p.id).filter(Boolean);
      const { data: roleRows } = profileIds.length > 0
        ? await supabase
            .from("user_roles")
            .select("user_id, role, company_id, plant_id")
            .eq("company_id", companyId)
            .in("user_id", profileIds)
        : { data: [] };

      const rolesByUserId = new Map<string, any>();
      (roleRows ?? []).forEach((r: any) => {
        if (!rolesByUserId.has(r.user_id)) rolesByUserId.set(r.user_id, r);
      });

      // 4) Fetch plant names
      const plantIds = [
        ...new Set(
          whitelistRows
            .map((w: any) => w.plant_id)
            .filter(Boolean)
        ),
      ];
      let plantMap: Record<string, string> = {};
      if (plantIds.length > 0) {
        const { data: plants } = await supabase
          .from("plants")
          .select("id, name")
          .in("id", plantIds);
        (plants ?? []).forEach((pl: any) => {
          plantMap[pl.id] = pl.name;
        });
      }

      // 5) Build the unified user list: every whitelist row = one employee
      return whitelistRows.map((w: any) => {
        const profile = profileByEmail.get(w.email?.toLowerCase());
        const userRole = profile ? rolesByUserId.get(profile.id) : null;
        const resolvedPlantId = userRole?.plant_id ?? w.plant_id ?? null;
        return {
          id: profile?.id ?? `wl-${w.id}`,
          full_name: profile?.full_name ?? w.email?.split("@")[0] ?? "Unknown",
          email: w.email,
          avatar_url: profile?.avatar_url ?? null,
          role: userRole?.role ?? w.role ?? "unknown",
          plant_id: resolvedPlantId,
          plant_name: resolvedPlantId
            ? plantMap[resolvedPlantId] ?? "Unknown Plant"
            : "Company-wide",
          status: profile?.status ?? (w.status === "accepted" ? "active" : w.status ?? "pending"),
        } as WorkflowUser;
      });
    },
    enabled: !!companyId,
  });

  // Derive links from whitelist hierarchy (role + plant_id) AND workflow_links table.
  // The default hierarchy is computed client-side so it works even when
  // workflow_links rows don't exist yet or reference different IDs.
  const links: WorkflowLink[] = (() => {
    if (!users.length) return [];

    const derived: WorkflowLink[] = [];
    let linkId = 0;
    const makeLink = (
      fromUser: WorkflowUser,
      toUser: WorkflowUser,
    ): WorkflowLink => ({
      id: `derived-${linkId++}`,
      from_user_id: fromUser.id,
      to_user_id: toUser.id,
      from_role: fromUser.role,
      to_role: toUser.role,
    });

    const companyAdmin = users.find((u) => u.role === "company_admin");
    if (!companyAdmin) return [];

    // Group users by plant
    const byPlant = new Map<string, WorkflowUser[]>();
    const companyLevel: WorkflowUser[] = [];
    for (const u of users) {
      if (u.id === companyAdmin.id) continue;
      if (u.plant_id) {
        if (!byPlant.has(u.plant_id)) byPlant.set(u.plant_id, []);
        byPlant.get(u.plant_id)!.push(u);
      } else {
        companyLevel.push(u);
      }
    }

    const PLANT_ROLES = new Set([
      "plant_admin",
      "plant_manager",
      "production_manager",
      "warehouse_manager",
      "procurement_manager",
      "quality_inspector",
      "maintenance_engineer",
      "production_operator",
    ]);

    // For each plant: company_admin → plant_admin, plant_admin → everyone else in plant
    for (const [, plantUsers] of byPlant) {
      const plantAdmin = plantUsers.find((u) => u.role === "plant_admin");
      if (plantAdmin) {
        // company_admin → plant_admin
        derived.push(makeLink(companyAdmin, plantAdmin));

        // plant_admin → all other plant-level roles
        for (const u of plantUsers) {
          if (u.id !== plantAdmin.id && PLANT_ROLES.has(u.role)) {
            derived.push(makeLink(plantAdmin, u));
          }
        }
      } else {
        // No plant_admin — link plant users directly to company_admin
        for (const u of plantUsers) {
          if (PLANT_ROLES.has(u.role)) {
            derived.push(makeLink(companyAdmin, u));
          }
        }
      }
    }

    // Company-level roles: company_admin → finance_manager, hr_manager, auditor, etc.
    const COMPANY_LEVEL_ROLES = new Set([
      "finance_manager",
      "hr_manager",
      "auditor",
      "procurement_manager",
    ]);
    for (const u of companyLevel) {
      if (COMPANY_LEVEL_ROLES.has(u.role)) {
        derived.push(makeLink(companyAdmin, u));
      }
    }

    // Portals: link to company_admin
    for (const u of users) {
      if (
        (u.role === "customer_portal" || u.role === "supplier_portal") &&
        u.id !== companyAdmin.id
      ) {
        derived.push(makeLink(companyAdmin, u));
      }
    }

    return derived;
  })();

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(z + 0.15, 2));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(z - 0.15, 0.3));
  }, []);

  const handleFitView = useCallback(() => {
    setZoom(1);
  }, []);

  const isLoading = usersLoading;

  return (
    <TooltipProvider>
      <div className="h-[calc(100vh-4rem)] flex flex-col bg-background">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10">
              <Workflow className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Org Workflow</h1>
              <p className="text-[11px] text-muted-foreground">
                {isPlantAdmin && !isCompanyAdmin
                  ? "Plant scope — drag employees to link reports"
                  : "Company scope — drag employees to link reports"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleRefresh}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleZoomOut}
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom Out</TooltipContent>
            </Tooltip>
            <span className="text-[11px] text-muted-foreground w-10 text-center tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleZoomIn}
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom In</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleFitView}
                >
                  <Maximize className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Fit View</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel — Employee List */}
          <EmployeeListPanel
            users={users}
            links={links}
            canEdit={canEdit}
            selectedUserId={selectedNode}
            onSelectUser={setSelectedNode}
            onRefresh={handleRefresh}
          />

          {/* Canvas */}
          <div className="flex-1 relative overflow-hidden">
            <WorkflowGraph
              users={users}
              links={links}
              zoom={zoom}
              selectedUserId={selectedNode}
              onSelectUser={setSelectedNode}
              onRefresh={handleRefresh}
              canEdit={canEdit}
            />

            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm z-10">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Loading workflow...
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
