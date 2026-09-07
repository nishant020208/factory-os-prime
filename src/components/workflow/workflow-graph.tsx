import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Node,
  type Edge,
  type OnNodesChange,
  type NodeTypes,
  type Connection,
  BackgroundVariant,
  MarkerType,
  ConnectionLineType,
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
  onNodeConnect?: (parent: WorkflowUser, child: WorkflowUser) => void;
  onEdgeDisconnect?: (edgeId: string) => void;
}

const NODE_W = 220;
const NODE_H = 72;
const H_GAP = 80;
const V_GAP = 140;

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
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !-left-1.5 !rounded-full !border-2 !border-[hsl(220,15%,25%)] !bg-slate-500 hover:!bg-indigo-400 !transition-colors !cursor-crosshair"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !-right-1.5 !rounded-full !border-2 !border-[hsl(220,15%,25%)] !bg-slate-500 hover:!bg-indigo-400 !transition-colors !cursor-crosshair"
      />
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

// ─── Tree layout engine ─────────────────────────────────────────
function computeTreeLayout(
  users: WorkflowUser[],
  links: WorkflowLink[],
  isPlantAdmin: boolean
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (users.length === 0) return positions;

  // Build adjacency: parentId → childIds (using whitelist_id → user.id mapping)
  const whitelistToUserId = new Map<string, string>();
  for (const u of users) {
    whitelistToUserId.set(u.whitelist_id, u.id);
  }
  const userIdSet = new Set(users.map((u) => u.id));
  const childrenOf = new Map<string, string[]>();
  for (const link of links) {
    const parentId = whitelistToUserId.get(link.parent_id);
    const childId = whitelistToUserId.get(link.child_id);
    if (!parentId || !childId) continue;
    if (!childrenOf.has(parentId)) childrenOf.set(parentId, []);
    childrenOf.get(parentId)!.push(childId);
  }

  // Find root
  const root = users.find((u) => u.role === "company_admin") ?? users.find((u) => u.role === "plant_admin");
  if (!root) return positions;

  // ── Phase 1: compute subtree widths bottom-up ──
  const widthCache = new Map<string, number>();
  function subtreeWidth(nodeId: string): number {
    if (widthCache.has(nodeId)) return widthCache.get(nodeId)!;
    const kids = (childrenOf.get(nodeId) ?? []).filter((id) => userIdSet.has(id));
    if (kids.length === 0) {
      widthCache.set(nodeId, NODE_W);
      return NODE_W;
    }
    const totalKidsWidth =
      kids.reduce((sum, cid) => sum + subtreeWidth(cid), 0) +
      (kids.length - 1) * H_GAP;
    const w = Math.max(NODE_W, totalKidsWidth);
    widthCache.set(nodeId, w);
    return w;
  }
  subtreeWidth(root.id);

  // ── Phase 2: position all nodes top-down ──
  function positionNode(nodeId: string, left: number, top: number) {
    const kids = (childrenOf.get(nodeId) ?? []).filter((id) => userIdSet.has(id));

    if (kids.length === 0) {
      // Leaf node — just place it
      positions.set(nodeId, { x: left + (widthCache.get(nodeId)! - NODE_W) / 2, y: top });
      return;
    }

    // Position children left-to-right
    let childLeft = left;
    for (const cid of kids) {
      const cw = widthCache.get(cid)!;
      positionNode(cid, childLeft, top + V_GAP);
      childLeft += cw + H_GAP;
    }

    // Center parent above its children
    const firstKidPos = positions.get(kids[0]);
    const lastKidPos = positions.get(kids[kids.length - 1]);
    if (firstKidPos && lastKidPos) {
      const centerX = (firstKidPos.x + lastKidPos.x + NODE_W) / 2;
      positions.set(nodeId, { x: centerX - NODE_W / 2, y: top });
    } else {
      positions.set(nodeId, { x: left + (widthCache.get(nodeId)! - NODE_W) / 2, y: top });
    }
  }

  // Center the whole tree in a reasonable viewport
  const treeWidth = widthCache.get(root.id)!;
  const startX = Math.max(40, 600 - treeWidth / 2);
  positionNode(root.id, startX, 40);

  // ── Phase 3: position any orphaned users (not reachable from root) ──
  let fallbackX = 100;
  let fallbackY = 40;
  const positioned = new Set(positions.keys());
  for (const u of users) {
    if (!positioned.has(u.id)) {
      positions.set(u.id, { x: fallbackX, y: fallbackY });
      fallbackX += NODE_W + H_GAP;
      if (fallbackX > 1800) {
        fallbackX = 100;
        fallbackY += NODE_H + V_GAP;
      }
    }
  }

  return positions;
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
  onNodeConnect,
  onEdgeDisconnect,
}: Props) {
  const [draggedOver, setDraggedOver] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // Compute tree layout (ignores saved positions for clean initial layout)
  const layoutPositions = useMemo(
    () => computeTreeLayout(users, links, isPlantAdmin),
    [users, links, isPlantAdmin]
  );

  // Build React Flow nodes
  const [nodes, setNodes, onNodesChange] = useNodesState(
    users.map((user) => ({
      id: user.id,
      type: "employee" as const,
      position: layoutPositions.get(user.id) ?? { x: 400, y: 400 },
      data: { user, isSelected: selectedUserId === user.id },
    }))
  );

  // Build React Flow edges
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    links
      .map((link) => {
        const parent = users.find((u) => u.whitelist_id === link.parent_id);
        const child = users.find((u) => u.whitelist_id === link.child_id);
        if (!parent || !child) return null;
        const isHighlighted =
          selectedUserId === parent.id || selectedUserId === child.id;
        return {
          id: link.id,
          source: parent.id,
          target: child.id,
          type: "smoothstep" as const,
          animated: false,
          interactionWidth: 12,
          style: {
            stroke: isHighlighted ? "#818cf8" : "#64748b",
            strokeWidth: isHighlighted ? 3 : 2.5,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 16,
            height: 16,
            color: isHighlighted ? "#818cf8" : "#64748b",
          },
        };
      })
      .filter(Boolean) as Edge[]
  );

  // Sync nodes/edges when data changes (useEffect, not useMemo)
  useEffect(() => {
    setNodes(
      users.map((user) => ({
        id: user.id,
        type: "employee" as const,
        position: layoutPositions.get(user.id) ?? { x: 400, y: 400 },
        data: { user, isSelected: selectedUserId === user.id },
      }))
    );
  }, [users, selectedUserId, layoutPositions, setNodes]);

  useEffect(() => {
    setEdges(
      links
        .map((link) => {
          const parent = users.find((u) => u.whitelist_id === link.parent_id);
          const child = users.find((u) => u.whitelist_id === link.child_id);
          if (!parent || !child) return null;
          const isHighlighted =
            selectedUserId === parent.id || selectedUserId === child.id;
          return {
            id: link.id,
            source: parent.id,
            target: child.id,
            type: "smoothstep" as const,
            animated: false,
            interactionWidth: 12,
            style: {
              stroke: isHighlighted ? "#818cf8" : "#64748b",
              strokeWidth: isHighlighted ? 3 : 2.5,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 16,
              height: 16,
              color: isHighlighted ? "#818cf8" : "#64748b",
            },
          };
        })
        .filter(Boolean) as Edge[]
    );
  }, [links, users, selectedUserId, setEdges]);

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

      // Role-based validation
      if (isPlantAdmin) {
        if (!fromUser.plant_id || !toUser.plant_id) return;
        if (fromUser.plant_id !== toUser.plant_id) return;
      }

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
    [companyId, users, nodes, onRefresh, isPlantAdmin]
  );

  // Validate connection based on role rules
  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      if (!canEdit) return false;
      const source = users.find((u) => u.id === connection.source);
      const target = users.find((u) => u.id === connection.target);
      if (!source || !target || source.id === target.id) return false;
      // Plant Admin: only link within same plant
      if (isPlantAdmin) {
        if (!source.plant_id || !target.plant_id) return false;
        return source.plant_id === target.plant_id;
      }
      return true;
    },
    [canEdit, isPlantAdmin, users]
  );

  // Handle manual connection from node handles
  const handleNodeConnect = useCallback(
    (connection: Connection) => {
      if (!canEdit || !connection.source || !connection.target) return;
      const parent = users.find((u) => u.id === connection.source);
      const child = users.find((u) => u.id === connection.target);
      if (!parent || !child || parent.id === child.id) return;
      onNodeConnect?.(parent, child);
    },
    [canEdit, users, onNodeConnect]
  );

  // Handle edge double-click for disconnect
  const handleEdgeDoubleClick = useCallback(
    (_: any, edge: Edge) => {
      if (!canEdit || !onEdgeDisconnect) return;
      if (window.confirm("Remove this workflow connection?")) {
        onEdgeDisconnect(edge.id);
      }
    },
    [canEdit, onEdgeDisconnect]
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
      <style>{`
        .react-flow__edge:hover path {
          stroke: #94a3b8 !important;
          stroke-width: 3 !important;
        }
        .react-flow__edge.selected path {
          stroke: #818cf8 !important;
          stroke-width: 3 !important;
        }
        .react-flow__connection-line path {
          stroke: #818cf8 !important;
          stroke-width: 2 !important;
          stroke-dasharray: 5 5;
        }
      `}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange as OnNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={handleNodeDragStop}
        onConnect={handleNodeConnect}
        onEdgeDoubleClick={handleEdgeDoubleClick}
        onNodeClick={(_, node) =>
          onSelectUser(selectedUserId === node.id ? null : node.id)
        }
        onPaneClick={() => onSelectUser(null)}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.08}
        maxZoom={2}
        connectionLineStyle={{ stroke: "#818cf8", strokeWidth: 2 }}
        connectionLineType={ConnectionLineType.SmoothStep}
        isValidConnection={isValidConnection}
        defaultEdgeOptions={{
          type: "smoothstep",
          style: { stroke: "#64748b", strokeWidth: 2.5 },
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "#64748b" },
          interactionWidth: 12,
        }}
        proOptions={{ hideAttribution: true }}
        className="!bg-transparent"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="rgba(148,163,184,0.08)"
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
