import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  whitelist_id: string;
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
  parent_id: string;
  child_id: string;
  from_role: string;
  to_role: string;
  plant_id: string | null;
}

interface CanvasPosition {
  whitelist_id: string;
  position_x: number;
  position_y: number;
}

function WorkflowPage() {
  const queryClient = useQueryClient();
  const { companyId, plantId, roles } = useAuth();
  const isPlantAdmin = roles.includes("plant_admin");
  const isCompanyAdmin = roles.includes("company_admin");
  const canEdit = isCompanyAdmin || isPlantAdmin;

  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // 1) Fetch ALL whitelisted employees — no role exclusions
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["workflow-users", companyId, plantId, refreshKey],
    queryFn: async () => {
      if (!companyId) return [];

      let wlQuery = supabase
        .from("whitelist")
        .select("id, email, role, company_id, plant_id, status, created_at")
        .eq("company_id", companyId)
        .not("role", "eq", "root_super_admin");

      // Plant Admin: ONLY their plant's employees — no company-level roles
      if (isPlantAdmin && plantId) {
        wlQuery = wlQuery.eq("plant_id", plantId);
      }

      const { data: whitelistRows, error: wlError } = await wlQuery;
      if (wlError) throw wlError;
      if (!whitelistRows?.length) return [];

      // 2) Fetch profiles for users who have signed up
      const emails = whitelistRows.map((w: any) => w.email?.toLowerCase()).filter(Boolean);
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url, status")
        .eq("company_id", companyId)
        .in("email", emails.length > 0 ? emails : ["__none__"]);

      const profileByEmail = new Map(
        (profileRows ?? []).map((p: any) => [p.email?.toLowerCase(), p])
      );

      // 3) Fetch user_roles for authoritative role/plant_id
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
        ...new Set(whitelistRows.map((w: any) => w.plant_id).filter(Boolean)),
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

      // 5) Build unified list — every whitelist row = one employee
      return whitelistRows.map((w: any) => {
        const profile = profileByEmail.get(w.email?.toLowerCase());
        const userRole = profile ? rolesByUserId.get(profile.id) : null;
        const resolvedPlantId = userRole?.plant_id ?? w.plant_id ?? null;
        return {
          id: profile?.id ?? `wl-${w.id}`,
          whitelist_id: w.id,
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

  // 2) Fetch workflow_links from database
  const { data: dbLinks = [], isLoading: linksLoading } = useQuery({
    queryKey: ["workflow-links", companyId, plantId, refreshKey],
    queryFn: async () => {
      if (!companyId) return [];
      try {
        let query = supabase
          .from("workflow_links" as any)
          .select("id, parent_id, child_id, from_role, to_role, plant_id, status")
          .eq("company_id", companyId)
          .eq("status", "active");

        const { data, error } = await query;
        if (error) {
          console.warn("workflow_links table may not exist yet:", error.message);
          return [];
        }
        return (data ?? []) as unknown as WorkflowLink[];
      } catch (e) {
        console.warn("workflow_links query failed (table may not exist):", e);
        return [];
      }
    },
    enabled: !!companyId,
  });

  // 3) Fetch saved canvas positions
  const { data: savedPositions = [] } = useQuery({
    queryKey: ["canvas-positions", companyId, plantId, refreshKey],
    queryFn: async () => {
      if (!companyId) return [];
      try {
        let query = supabase
          .from("canvas_positions" as any)
          .select("whitelist_id, position_x, position_y")
          .eq("company_id", companyId);

        if (isPlantAdmin && plantId) {
          query = query.eq("plant_id", plantId);
        }

        const { data, error } = await query;
        if (error) {
          console.warn("canvas_positions table may not exist yet:", error.message);
          return [];
        }
        return (data ?? []) as unknown as CanvasPosition[];
      } catch (e) {
        console.warn("canvas_positions query failed (table may not exist):", e);
        return [];
      }
    },
    enabled: !!companyId,
  });

  // 4) Merge DB links with derived hierarchy links
  const links: WorkflowLink[] = (() => {
    const merged = new Map<string, WorkflowLink>();

    // Start with DB links — only include those whose parent/child are in our user list
    const userIds = new Set(users.map((u) => u.whitelist_id));
    for (const link of dbLinks) {
      if (userIds.has(link.parent_id) && userIds.has(link.child_id)) {
        merged.set(`${link.parent_id}->${link.child_id}`, link);
      }
    }

    const linkedChildren = new Set(dbLinks.filter((l) => userIds.has(l.parent_id) && userIds.has(l.child_id)).map((l) => l.child_id));

    const PLANT_ROLES = new Set([
      "plant_admin", "plant_manager", "production_manager", "warehouse_manager",
      "procurement_manager", "quality_inspector", "maintenance_engineer",
      "production_operator", "hr_manager",
    ]);

    let linkId = dbLinks.length;
    const makeDerived = (
      parentId: string,
      childId: string,
      fromRole: string,
      toRole: string,
      plantIdVal: string | null
    ): WorkflowLink => ({
      id: `derived-${linkId++}`,
      parent_id: parentId,
      child_id: childId,
      from_role: fromRole,
      to_role: toRole,
      plant_id: plantIdVal,
    });

    // Find root: company_admin (Company view) or plant_admin (Plant view)
    const companyAdmin = users.find((u) => u.role === "company_admin");
    const plantAdmin = users.find((u) => u.role === "plant_admin");
    const root = companyAdmin ?? plantAdmin;
    if (!root) return Array.from(merged.values());

    // Group users by plant
    const byPlant = new Map<string, WorkflowUser[]>();
    const companyLevel: WorkflowUser[] = [];
    for (const u of users) {
      if (u.id === root.id) continue;
      if (u.plant_id) {
        if (!byPlant.has(u.plant_id)) byPlant.set(u.plant_id, []);
        byPlant.get(u.plant_id)!.push(u);
      } else {
        companyLevel.push(u);
      }
    }

    // Plant Admin view: link root → all plant users
    if (isPlantAdmin) {
      for (const u of users) {
        if (u.id !== root.id && PLANT_ROLES.has(u.role) && !linkedChildren.has(u.whitelist_id)) {
          const key = `${root.whitelist_id}->${u.whitelist_id}`;
          if (!merged.has(key)) {
            merged.set(key, makeDerived(root.whitelist_id, u.whitelist_id, root.role, u.role, u.plant_id));
          }
        }
      }
    } else {
      // Company Admin view: hierarchical by plant
      for (const [, plantUsers] of byPlant) {
        const pa = plantUsers.find((u) => u.role === "plant_admin");
        if (pa && !linkedChildren.has(pa.whitelist_id)) {
          const key = `${root.whitelist_id}->${pa.whitelist_id}`;
          if (!merged.has(key)) {
            merged.set(key, makeDerived(root.whitelist_id, pa.whitelist_id, "company_admin", "plant_admin", pa.plant_id));
          }
        }
        if (pa) {
          for (const u of plantUsers) {
            if (u.id !== pa.id && PLANT_ROLES.has(u.role) && !linkedChildren.has(u.whitelist_id)) {
              const key = `${pa.whitelist_id}->${u.whitelist_id}`;
              if (!merged.has(key)) {
                merged.set(key, makeDerived(pa.whitelist_id, u.whitelist_id, "plant_admin", u.role, u.plant_id));
              }
            }
          }
        }
      }

      const COMPANY_LEVEL_ROLES = new Set(["finance_manager", "auditor", "procurement_manager"]);
      for (const u of companyLevel) {
        if (COMPANY_LEVEL_ROLES.has(u.role) && !linkedChildren.has(u.whitelist_id)) {
          const key = `${root.whitelist_id}->${u.whitelist_id}`;
          if (!merged.has(key)) {
            merged.set(key, makeDerived(root.whitelist_id, u.whitelist_id, "company_admin", u.role, null));
          }
        }
      }
    }

    // Portals
    for (const u of users) {
      if ((u.role === "customer_portal" || u.role === "supplier_portal") &&
          u.id !== root.id && !linkedChildren.has(u.whitelist_id)) {
        const key = `${root.whitelist_id}->${u.whitelist_id}`;
        if (!merged.has(key)) {
          merged.set(key, makeDerived(root.whitelist_id, u.whitelist_id, root.role, u.role, u.plant_id));
        }
      }
    }

    return Array.from(merged.values());
  })();

  // 5) Position persistence mutation
  const positionMutation = useMutation({
    mutationFn: async ({ whitelistId, x, y }: { whitelistId: string; x: number; y: number }) => {
      if (!companyId) return;
      const user = users.find((u) => u.whitelist_id === whitelistId);
      const { error } = await supabase.from("canvas_positions" as any).upsert(
        {
          company_id: companyId,
          whitelist_id: whitelistId,
          plant_id: user?.plant_id ?? null,
          position_x: x,
          position_y: y,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "company_id,whitelist_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canvas-positions"] });
    },
  });

  // 6) Create link mutation
  const createLinkMutation = useMutation({
    mutationFn: async ({ parent, child }: { parent: WorkflowUser; child: WorkflowUser }) => {
      if (!companyId) return;
      const { error } = await supabase.from("workflow_links" as any).upsert(
        {
          company_id: companyId,
          parent_id: parent.whitelist_id,
          child_id: child.whitelist_id,
          from_role: parent.role,
          to_role: child.role,
          plant_id: child.plant_id ?? parent.plant_id ?? null,
          status: "active",
        },
        { onConflict: "company_id,parent_id,child_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => handleRefresh(),
  });

  // 7) Delete link mutation
  const deleteLinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      if (!companyId) return;
      if (linkId.startsWith("derived-")) return;
      const { error } = await supabase
        .from("workflow_links" as any)
        .delete()
        .eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: () => handleRefresh(),
  });

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleNodeDragStop = useCallback(
    (whitelistId: string, x: number, y: number) => {
      positionMutation.mutate({ whitelistId, x, y });
    },
    [positionMutation]
  );

  const isLoading = usersLoading || linksLoading;

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
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={handleRefresh}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Refresh
            </Button>
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
              positions={savedPositions}
              selectedUserId={selectedNode}
              onSelectUser={setSelectedNode}
              onRefresh={handleRefresh}
              canEdit={canEdit}
              isPlantAdmin={isPlantAdmin}
              companyId={companyId}
              plantId={plantId}
              onNodeDragStop={handleNodeDragStop}
              onNodeConnect={(parent, child) => createLinkMutation.mutate({ parent, child })}
              onEdgeDisconnect={(edgeId) => deleteLinkMutation.mutate(edgeId)}
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
