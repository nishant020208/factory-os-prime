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
  type NodeTypes,
  BackgroundVariant,
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

const NODE_W = 220;
const NODE_H = 72;

// ─── Dark-theme employee node ────────────────────────────────────
function EmployeeNode({ data }: { data: any }) {
  const user: WorkflowUser = data.user;
  const isSelected: boolean = data.isSelected;
  const colors = ROLE_COLORS[user.role] ?? ROLE_COLORS.default;

  return (
    <div
      className={cn(
        "drag-handle rounded-xl transition-all duration-150 cursor-grab active:cursor-grabbing",
        "border shadow-lg",
        isSelected
          ? "ring-2 ring-offset-1 ring-offset-background"
          : "hover:shadow-xl hover:scale-[1.02]"
      )}
      style={{
        width: NODE_W,
        height: NODE_H,
        background: "hsl(220, 15%, 12%)",
        borderColor: isSelected ? colors.solid : "hsl(220, 10%, 22%)",
      }}
    >
      <div className="flex items-center gap-2.5 px-3 h-full">
        {/* Avatar with colored ring */}
        <div className="relative shrink-0">
          <div
            className="rounded-full p-[2px]"
            style={{ background: colors.gradient }}
          >
            <div className="rounded-full bg-[hsl(220,15%,12%)] p-[1px]">
              <UserAvatar
                name={user.full_name ?? user.email}
                url={user.avatar_url}
                className="h-8 w-8"
              />
            </div>
          </div>
          <div
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[hsl(220,15%,12%)]",
              user.status === "active" ? "bg-emerald-400" : "bg-zinc-500"
            )}
          />
        </div>

        {/* Text content */}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-zinc-100 truncate leading-tight">
            {user.full_name ?? user.email.split("@")[0]}
          </p>
          <p className="text-[9px] text-zinc-400 truncate leading-tight mt-0.5">
            {user.email}
          </p>
          <Badge
            className="mt-1.5 text-[8px] px-1.5 py-0 h-3.5 leading-none font-semibold border"
            style={{
              background: colors.bg,
              color: colors.text,
              borderColor: colors.border,
            }}
          >
            {ROLE_MAP[user.role as AppRole]?.label ?? user.role}
          </Badge>
        </div>
      </div>

      {/* Left accent strip */}
      <div
        className="absolute top-1 bottom-1 left-0 w-[3px] rounded-r-full"
        style={{ background: colors.gradient }}
      />
    </div>
  );
}

const nodeTypes: NodeTypes = { employee: EmployeeNode };

// ─── Role color definitions (dark-theme optimized) ──────────────
const ROLE_COLORS: Record<string, { solid: string; gradient: string; bg: string; text: string; border: string }> = {
  company_admin:       { solid: "#818cf8", gradient: "linear-gradient(135deg, #6366f1, #818cf8)", bg: "rgba(99,102,241,0.15)", text: "#a5b4fc", border: "rgba(99,102,241,0.3)" },
  plant_admin:         { solid: "#a78bfa", gradient: "linear-gradient(135deg, #8b5cf6, #a78bfa)", bg: "rgba(139,92,246,0.15)", text: "#c4b5fd", border: "rgba(139,92,246,0.3)" },
  plant_manager:       { solid: "#60a5fa", gradient: "linear-gradient(135deg, #3b82f6, #60a5fa)", bg: "rgba(59,130,246,0.15)", text: "#93c5fd", border: "rgba(59,130,246,0.3)" },
  production_manager:  { solid: "#38bdf8", gradient: "linear-gradient(135deg, #0ea5e9, #38bdf8)", bg: "rgba(14,165,233,0.15)", text: "#7dd3fc", border: "rgba(14,165,233,0.3)" },
  warehouse_manager:   { solid: "#fbbf24", gradient: "linear-gradient(135deg, #f59e0b, #fbbf24)", bg: "rgba(245,158,11,0.15)", text: "#fcd34d", border: "rgba(245,158,11,0.3)" },
  procurement_manager: { solid: "#fb923c", gradient: "linear-gradient(135deg, #f97316, #fb923c)", bg: "rgba(249,115,22,0.15)", text: "#fdba74", border: "rgba(249,115,22,0.3)" },
  quality_inspector:   { solid: "#34d399", gradient: "linear-gradient(135deg, #10b981, #34d399)", bg: "rgba(16,185,129,0.15)", text: "#6ee7b7", border: "rgba(16,185,129,0.3)" },
  maintenance_engineer:{ solid: "#fb7185", gradient: "linear-gradient(135deg, #f43f5e, #fb7185)", bg: "rgba(244,63,94,0.15)", text: "#fda4af", border: "rgba(244,63,94,0.3)" },
  finance_manager:     { solid: "#4ade80", gradient: "linear-gradient(135deg, #22c55e, #4ade80)", bg: "rgba(34,197,94,0.15)", text: "#86efac", border: "rgba(34,197,94,0.3)" },
  hr_manager:          { solid: "#f472b6", gradient: "linear-gradient(135deg, #ec4899, #f472b6)", bg: "rgba(236,72,153,0.15)", text: "#f9a8d4", border: "rgba(236,72,153,0.3)" },
  production_operator: { solid: "#2dd4bf", gradient: "linear-gradient(135deg, #14b8a6, #2dd4bf)", bg: "rgba(20,184,166,0.15)", text: "#5eead4", border: "rgba(20,184,166,0.3)" },
  customer_portal:     { solid: "#22d3ee", gradient: "linear-gradient(135deg, #06b6d4, #22d3ee)", bg: "rgba(6,182,212,0.15)", text: "#67e8f9", border: "rgba(6,182,212,0.3)" },
  supplier_portal:     { solid: "#a3e635", gradient: "linear-gradient(135deg, #84cc16, #a3e635)", bg: "rgba(132,204,22,0.15)", text: "#bef264", border: "rgba(132,204,22,0.3)" },
  auditor:             { solid: "#94a3b8", gradient: "linear-gradient(135deg, #64748b, #94a3b8)", bg: "rgba(100,116,139,0.15)", text: "#cbd5e1", border: "rgba(100,116,139,0.3)" },
  default:             { solid: "#71717a", gradient: "linear-gradient(135deg, #52525b, #71717a)", bg: "rgba(113,113,122,0.15)", text: "#a1a1aa", border: "rgba(113,113,122,0.3)" },
};

function getNodeColor(role: string): string {
  return ROLE_COLORS[role]?.solid ?? ROLE_COLORS.default.solid;
}

// ─── Main graph component ────────────────────────────────────────
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
  const [draggedOver, setDraggedOver] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // Position map from saved positions
  const positionMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    positions.forEach((p) => map.set(p.whitelist_id, { x: p.position_x, y: p.position_y }));
    return map;
  }, [positions]);

  // Hierarchical default layout: group by plant, tree structure
  const getDefaultPosition = useCallback(
    (user: WorkflowUser, allUsers: WorkflowUser[]) => {
      const saved = positionMap.get(user.whitelist_id);
      if (saved) return saved;

      const companyAdmin = allUsers.find((u) => u.role === "company_admin");
      if (!companyAdmin) return { x: 400, y: 300 };

      // Group users by plant
      const byPlant = new Map<string, WorkflowUser[]>();
      const companyLevel: WorkflowUser[] = [];
      for (const u of allUsers) {
        if (u.id === companyAdmin.id) continue;
        if (u.plant_id) {
          if (!byPlant.has(u.plant_id)) byPlant.set(u.plant_id, []);
          byPlant.get(u.plant_id)!.push(u);
        } else {
          companyLevel.push(u);
        }
      }

      const PLANT_ROLES = ["plant_admin", "plant_manager", "production_manager", "warehouse_manager",
        "procurement_manager", "quality_inspector", "maintenance_engineer", "production_operator", "hr_manager"];
      const COMPANY_ROLES = ["finance_manager", "auditor"];

      const COLS = 3;
      const GAP_X = NODE_W + 50;
      const GAP_Y = NODE_H + 35;
      const PLANT_GAP = 80;
      const PLANT_HEADER = 30;

      // Company admin at top center
      if (user.id === companyAdmin.id) return { x: 500, y: 40 };

      // Company-level roles: right side
      const compIdx = COMPANY_ROLES.indexOf(user.role);
      if (compIdx >= 0 && !user.plant_id) {
        return { x: 900, y: 160 + compIdx * GAP_Y };
      }

      // Plant-grouped users
      const plantEntries = Array.from(byPlant.entries());
      for (let pi = 0; pi < plantEntries.length; pi++) {
        const [plantIdKey, plantUsers] = plantEntries[pi];
        const plantX = 100 + pi * (COLS * GAP_X + PLANT_GAP);

        const roleInPlant = plantUsers.filter((u) => PLANT_ROLES.includes(u.role));
        const portalsInPlant = plantUsers.filter((u) =>
          u.role === "customer_portal" || u.role === "supplier_portal"
        );

        const allInPlant = [...roleInPlant, ...portalsInPlant];
        const idx = allInPlant.findIndex((u) => u.id === user.id);
        if (idx >= 0) {
          return {
            x: plantX + (idx % COLS) * GAP_X,
            y: 140 + PLANT_HEADER + Math.floor(idx / COLS) * GAP_Y,
          };
        }
      }

      // Fallback: bottom
      return { x: 400, y: 600 };
    },
    [positionMap]
  );

  // Build React Flow nodes
  const initialNodes: Node[] = useMemo(() => {
    return users.map((user) => {
      const pos = getDefaultPosition(user, users);
      return {
        id: user.id,
        type: "employee",
        position: pos,
        data: { user, isSelected: selectedUserId === user.id },
      };
    });
  }, [users, selectedUserId, getDefaultPosition]);

  // Build React Flow edges
  const initialEdges: Edge[] = useMemo(() => {
    return links
      .map((link) => {
        const parent = users.find((u) => u.whitelist_id === link.parent_id);
        const child = users.find((u) => u.whitelist_id === link.child_id);
        if (!parent || !child) return null;
        const isHighlighted = selectedUserId === parent.id || selectedUserId === child.id;
        return {
          id: link.id,
          source: parent.id,
          target: child.id,
          type: "smoothstep",
          animated: false,
          style: {
            stroke: isHighlighted ? "#818cf8" : "rgba(148,163,184,0.4)",
            strokeWidth: isHighlighted ? 2.5 : 1.5,
          },
        };
      })
      .filter(Boolean) as Edge[];
  }, [links, users, selectedUserId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync when data changes
  useMemo(() => { setNodes(initialNodes); }, [initialNodes]);
  useMemo(() => { setEdges(initialEdges); }, [initialEdges]);

  // Node drag stop → persist
  const handleNodeDragStop: any = useCallback(
    (_: any, node: Node) => {
      if (!canEdit || !onNodeDragStop) return;
      const user = users.find((u) => u.id === node.id);
      if (user) onNodeDragStop(user.whitelist_id, node.position.x, node.position.y);
    },
    [canEdit, onNodeDragStop, users]
  );

  // Drop from panel
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "link";
    setDraggedOver(true);
  }, []);

  const onDragLeave = useCallback(() => setDraggedOver(false), []);

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDraggedOver(false);
      const data = e.dataTransfer.getData("application/workflow-drag");
      if (!data || !companyId) return;

      const { userId: fromUserId } = JSON.parse(data);
      const fromUser = users.find((u) => u.id === fromUserId);
      if (!fromUser) return;

      const wrapper = reactFlowWrapper.current;
      if (!wrapper) return;
      const bounds = wrapper.getBoundingClientRect();
      const flowX = e.clientX - bounds.left;
      const flowY = e.clientY - bounds.top;

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

      const { error } = await supabase.from("workflow_links" as any).upsert(
        {
          company_id: companyId,
          parent_id: fromUser.whitelist_id,
          child_id: toUser.whitelist_id,
          from_role: fromUser.role,
          to_role: toUser.role,
          plant_id: toUser.plant_id ?? fromUser.plant_id ?? null,
          status: "active",
        },
        { onConflict: "company_id,parent_id,child_id" }
      );

      if (!error) onRefresh();
    },
    [companyId, users, nodes, onRefresh]
  );

  return (
    <div
      ref={reactFlowWrapper}
      className={cn(
        "w-full h-full rounded-lg",
        draggedOver && "ring-2 ring-primary/40 ring-inset"
      )}
      style={{ background: "hsl(220, 15%, 8%)" }}
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
        onNodeClick={(_, node) => onSelectUser(selectedUserId === node.id ? null : node.id)}
        onPaneClick={() => onSelectUser(null)}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.15}
        maxZoom={2}
        defaultEdgeOptions={{
          type: "smoothstep",
          style: { stroke: "rgba(148,163,184,0.4)", strokeWidth: 1.5 },
        }}
        proOptions={{ hideAttribution: true }}
        className="!bg-transparent"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="rgba(148,163,184,0.06)"
        />
        <Controls
          showInteractive={false}
          className="!bg-[hsl(220,15%,14%)] !border-[hsl(220,10%,22%)] !shadow-lg !rounded-lg [&>button]:!bg-[hsl(220,15%,18%)] [&>button]:!border-[hsl(220,10%,26%)] [&>button]:!text-zinc-300 [&>button:hover]:!bg-[hsl(220,15%,22%)]"
        />
        <MiniMap
          nodeColor={(node) => getNodeColor((node.data as any)?.user?.role)}
          maskColor="hsl(220, 15%, 8%, 0.85)"
          className="!bg-[hsl(220,15%,12%)] !border-[hsl(220,10%,22%)] !rounded-lg"
          nodeStrokeWidth={0}
        />
      </ReactFlow>
    </div>
  );
}
