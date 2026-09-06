import { useCallback, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnConnect,
  type NodeTypes,
  type EdgeTypes,
  BackgroundVariant,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ROLE_MAP, type AppRole } from "@/lib/roles";

export interface WorkflowUser {
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

export interface WorkflowLink {
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

interface Props {
  users: WorkflowUser[];
  links: WorkflowLink[];
  positions: CanvasPosition[];
  selectedUserId: string | null;
  onSelectUser: (id: string | null) => void;
  onRefresh: () => void;
  canEdit: boolean;
  isPlantAdmin: boolean;
  companyId: string | null;
  plantId: string | null;
  onNodeDragStop?: (userId: string, x: number, y: number) => void;
}

const NODE_W = 200;
const NODE_H = 80;

// Custom node component
function EmployeeNode({ data }: { data: any }) {
  const user: WorkflowUser = data.user;
  const isSelected: boolean = data.isSelected;
  const roleColor = getRoleColor(user.role);

  return (
    <div
      className={cn(
        "rounded-xl border bg-card shadow-sm transition-all duration-150 cursor-grab active:cursor-grabbing",
        "hover:shadow-md hover:border-primary/30",
        isSelected && "ring-2 ring-primary border-primary shadow-md",
        !isSelected && "border-border/60"
      )}
      style={{ width: NODE_W, height: NODE_H }}
    >
      <div className="flex items-center gap-2 p-2.5 h-full">
        <div className="relative shrink-0">
          <UserAvatar
            name={user.full_name ?? user.email}
            url={user.avatar_url}
            className="h-9 w-9"
          />
          <div
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card",
              user.status === "active" ? "bg-emerald-500" : "bg-muted"
            )}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate leading-tight">
            {user.full_name ?? user.email.split("@")[0]}
          </p>
          <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
            {user.email}
          </p>
          <div className="flex items-center gap-1 mt-1">
            <Badge
              variant="secondary"
              className={cn(
                "text-[9px] px-1.5 py-0 h-4 leading-none font-medium",
                roleColor
              )}
            >
              {ROLE_MAP[user.role as AppRole]?.label ?? user.role}
            </Badge>
          </div>
        </div>
      </div>
      <div
        className={cn(
          "absolute top-0 left-0 w-1 h-full rounded-l-xl",
          roleColor.replace("text-", "bg-")
        )}
      />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  employee: EmployeeNode,
};

// Group label component for plant regions
function PlantGroupLabel({ label, x, y, width }: { label: string; x: number; y: number; width: number }) {
  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: x, top: y - 28 }}
    >
      <span className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider bg-background/80 px-2 py-0.5 rounded">
        {label}
      </span>
    </div>
  );
}

export function WorkflowGraph({
  users,
  links,
  positions,
  selectedUserId,
  onSelectUser,
  onRefresh,
  canEdit,
  isPlantAdmin,
  companyId,
  plantId,
  onNodeDragStop,
}: Props) {
  const [ draggedOver, setDraggedOver ] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // Build position map from saved positions
  const positionMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    positions.forEach((p) => {
      map.set(p.whitelist_id, { x: p.position_x, y: p.position_y });
    });
    return map;
  }, [positions]);

  // Compute default positions for users without saved positions
  const getDefaultPosition = useCallback(
    (user: WorkflowUser, index: number) => {
      const saved = positionMap.get(user.whitelist_id);
      if (saved) return saved;

      // Group by plant for default layout
      const plantUsers = users.filter(
        (u) => u.plant_id === user.plant_id && u.role !== "company_admin"
      );
      const idx = plantUsers.findIndex((u) => u.id === user.id);
      const plantOffset = user.plant_id
        ? users.findIndex((u) => u.plant_id === user.plant_id && u.role === "plant_admin") * 300
        : 0;

      return {
        x: 400 + plantOffset + (idx % 4) * (NODE_W + 60),
        y: 100 + Math.floor(index / 4) * (NODE_H + 40),
      };
    },
    [positionMap, users]
  );

  // Build React Flow nodes
  const initialNodes: Node[] = useMemo(() => {
    return users.map((user, i) => {
      const pos = getDefaultPosition(user, i);
      return {
        id: user.id,
        type: "employee",
        position: pos,
        data: {
          user,
          isSelected: selectedUserId === user.id,
        },
        dragHandle: ".drag-handle",
      };
    });
  }, [users, selectedUserId, getDefaultPosition]);

  // Build React Flow edges from links
  const initialEdges: Edge[] = useMemo(() => {
    return links
      .map((link) => {
        // Find user IDs matching parent/child whitelist IDs
        const parent = users.find((u) => u.whitelist_id === link.parent_id);
        const child = users.find((u) => u.whitelist_id === link.child_id);
        if (!parent || !child) return null;
        return {
          id: link.id,
          source: parent.id,
          target: child.id,
          type: "smoothstep",
          animated: false,
          style: { stroke: "hsl(var(--muted-foreground) / 0.3)", strokeWidth: 1.5 },
        };
      })
      .filter(Boolean) as Edge[];
  }, [links, users]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync nodes when users change
  useMemo(() => {
    setNodes(initialNodes);
  }, [initialNodes]);

  useMemo(() => {
    setEdges(initialEdges);
  }, [initialEdges]);

  // Handle node drag stop — persist position
  const handleNodeDragStop: any = useCallback(
    (_: any, node: Node) => {
      if (!canEdit || !onNodeDragStop) return;
      const user = users.find((u) => u.id === node.id);
      if (user) {
        onNodeDragStop(user.whitelist_id, node.position.x, node.position.y);
      }
    },
    [canEdit, onNodeDragStop, users]
  );

  // Handle drop from employee list panel
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "link";
    setDraggedOver(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setDraggedOver(false);
  }, []);

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDraggedOver(false);
      const data = e.dataTransfer.getData("application/workflow-drag");
      if (!data || !companyId) return;

      const { userId: fromUserId, fromRole } = JSON.parse(data);
      const fromUser = users.find((u) => u.id === fromUserId);
      if (!fromUser) return;

      // Find the React Flow instance to convert screen coords to flow coords
      const wrapper = reactFlowWrapper.current;
      if (!wrapper) return;
      const bounds = wrapper.getBoundingClientRect();
      const flowX = (e.clientX - bounds.left) / 1; // simplified — React Flow handles zoom
      const flowY = (e.clientY - bounds.top) / 1;

      // Find nearest existing node
      let nearestId: string | null = null;
      let nearestDist = Infinity;
      for (const n of nodes) {
        if (n.id === fromUserId) continue;
        const cx = n.position.x + NODE_W / 2;
        const cy = n.position.y + NODE_H / 2;
        const dist = Math.sqrt((flowX - cx) ** 2 + (flowY - cy) ** 2);
        if (dist < nearestDist && dist < 250) {
          nearestDist = dist;
          nearestId = n.id;
        }
      }

      if (!nearestId) return;
      const toUser = users.find((u) => u.id === nearestId);
      if (!toUser) return;

      // Create the link in the database
      const { error } = await supabase.from("workflow_links" as any).upsert(
        {
          company_id: companyId,
          parent_id: fromUser.whitelist_id,
          child_id: toUser.whitelist_id,
          from_role: fromUser.role,
          to_role: toUser.role,
          plant_id: toUser.plant_id ?? fromUser.plant_id ?? null,
          status: "active",
          linked_by: null,
        },
        { onConflict: "company_id,parent_id,child_id" }
      );

      if (!error) {
        onRefresh();
      }
    },
    [companyId, users, nodes, onRefresh]
  );

  return (
    <div
      ref={reactFlowWrapper}
      className={cn(
        "w-full h-full",
        draggedOver && "ring-2 ring-primary/40 ring-inset rounded-lg"
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange as OnNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={handleNodeDragStop}
        onNodeClick={(_, node) => {
          onSelectUser(selectedUserId === node.id ? null : node.id);
        }}
        onPaneClick={() => onSelectUser(null)}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        defaultEdgeOptions={{
          type: "smoothstep",
          style: { stroke: "hsl(var(--muted-foreground) / 0.3)", strokeWidth: 1.5 },
        }}
        proOptions={{ hideAttribution: true }}
        className="bg-transparent"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="hsl(var(--muted-foreground) / 0.08)"
        />
        <Controls
          showInteractive={false}
          className="!bg-card !border-border !shadow-sm"
        />
        <MiniMap
          nodeColor={(node) => {
            const user = (node.data as any)?.user as WorkflowUser;
            return user ? getNodeColor(user.role) : "#666";
          }}
          maskColor="hsl(var(--background) / 0.8)"
          className="!bg-card !border-border"
        />
      </ReactFlow>
    </div>
  );
}

function getRoleColor(role: string): string {
  const colors: Record<string, string> = {
    company_admin: "bg-indigo-500/10 text-indigo-600 border-indigo-200",
    plant_admin: "bg-violet-500/10 text-violet-600 border-violet-200",
    plant_manager: "bg-blue-500/10 text-blue-600 border-blue-200",
    production_manager: "bg-sky-500/10 text-sky-600 border-sky-200",
    warehouse_manager: "bg-amber-500/10 text-amber-600 border-amber-200",
    procurement_manager: "bg-orange-500/10 text-orange-600 border-orange-200",
    quality_inspector: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
    maintenance_engineer: "bg-rose-500/10 text-rose-600 border-rose-200",
    finance_manager: "bg-green-500/10 text-green-600 border-green-200",
    hr_manager: "bg-pink-500/10 text-pink-600 border-pink-200",
    production_operator: "bg-teal-500/10 text-teal-600 border-teal-200",
    customer_portal: "bg-cyan-500/10 text-cyan-600 border-cyan-200",
    supplier_portal: "bg-lime-500/10 text-lime-600 border-lime-200",
    auditor: "bg-slate-500/10 text-slate-600 border-slate-200",
  };
  return colors[role] ?? "bg-muted text-muted-foreground border-border";
}

function getNodeColor(role: string): string {
  const colors: Record<string, string> = {
    company_admin: "#6366f1",
    plant_admin: "#8b5cf6",
    plant_manager: "#3b82f6",
    production_manager: "#0ea5e9",
    warehouse_manager: "#f59e0b",
    procurement_manager: "#f97316",
    quality_inspector: "#10b981",
    maintenance_engineer: "#f43f5e",
    finance_manager: "#22c55e",
    hr_manager: "#ec4899",
    production_operator: "#14b8a6",
    customer_portal: "#06b6d4",
    supplier_portal: "#84cc16",
    auditor: "#64748b",
  };
  return colors[role] ?? "#666";
}
