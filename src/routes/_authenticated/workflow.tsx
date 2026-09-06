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

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["workflow-users", companyId, plantId, refreshKey],
    queryFn: async () => {
      if (!companyId) return [];
      let query = supabase
        .from("profiles")
        .select(
          `
          id,
          full_name,
          email,
          avatar_url,
          status,
          user_roles!inner (
            role,
            company_id,
            plant_id
          )
        `
        )
        .eq("user_roles.company_id", companyId)
        .eq("status", "active");

      if (isPlantAdmin && plantId) {
        query = query.eq("user_roles.plant_id", plantId);
      }

      const { data: profiles, error } = await query;
      if (error) throw error;

      const plantIds = [
        ...new Set(
          (profiles ?? [])
            .map((p: any) => p.user_roles?.[0]?.plant_id)
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

      return (profiles ?? []).map((p: any) => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        avatar_url: p.avatar_url,
        role: p.user_roles?.[0]?.role ?? "unknown",
        plant_id: p.user_roles?.[0]?.plant_id ?? null,
        plant_name: p.user_roles?.[0]?.plant_id
          ? plantMap[p.user_roles[0].plant_id] ?? "Unknown Plant"
          : "Company-wide",
        status: p.status,
      })) as WorkflowUser[];
    },
    enabled: !!companyId,
  });

  const { data: links = [], isLoading: linksLoading } = useQuery({
    queryKey: ["workflow-links", companyId, plantId, refreshKey],
    queryFn: async () => {
      if (!companyId) return [];
      let query = supabase
        .from("workflow_links" as any)
        .select("id, from_user_id, to_user_id, from_role, to_role")
        .eq("company_id", companyId);

      if (isPlantAdmin && plantId) {
        const plantUserIds = users.map((u) => u.id);
        query = query.or(
          `from_user_id.in.(${plantUserIds.join(",")}),to_user_id.in.(${plantUserIds.join(",")})`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as WorkflowLink[];
    },
    enabled: !!companyId && users.length > 0,
  });

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
