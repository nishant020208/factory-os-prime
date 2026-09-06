import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GripVertical, Unlink, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_MAP, type AppRole } from "@/lib/roles";

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

interface NodePosition {
  x: number;
  y: number;
}

interface Props {
  users: WorkflowUser[];
  links: WorkflowLink[];
  zoom: number;
  selectedUserId: string | null;
  onSelectUser: (id: string | null) => void;
  onRefresh: () => void;
  canEdit: boolean;
}

// Layout constants
const NODE_W = 180;
const NODE_H = 72;
const COL_GAP = 80;
const ROW_GAP = 24;
const LEVEL_HEIGHT = NODE_H + ROW_GAP;

// Role grouping order (top to bottom in the graph)
const ROLE_LEVELS = [
  { role: "company_admin", label: "Company Admin" },
  { role: "plant_admin", label: "Plant Admin" },
  {
    roles: [
      "plant_manager",
      "production_manager",
      "warehouse_manager",
      "procurement_manager",
      "quality_inspector",
      "maintenance_engineer",
      "finance_manager",
      "hr_manager",
    ],
    label: "Operations",
  },
  { role: "production_operator", label: "Operators" },
];

function computeLayout(
  users: WorkflowUser[],
  links: WorkflowLink[]
): Map<string, NodePosition> {
  const pos = new Map<string, NodePosition>();
  const userMap = new Map(users.map((u) => [u.id, u]));
  const linkMap = new Map<string, string[]>();
  links.forEach((l) => {
    if (!linkMap.has(l.from_user_id)) linkMap.set(l.from_user_id, []);
    linkMap.get(l.from_user_id)!.push(l.to_user_id);
  });

  // Find the company_admin (root)
  const companyAdmin = users.find((u) => u.role === "company_admin");
  if (!companyAdmin) return pos;

  // BFS to assign levels
  const visited = new Set<string>();
  const levelUsers: WorkflowUser[][] = [];

  // Level 0: Company Admin
  visited.add(companyAdmin.id);
  levelUsers.push([companyAdmin]);

  // Level 1: Plant Admins (direct reports of company_admin)
  const plantAdmins = users.filter(
    (u) =>
      u.role === "plant_admin" &&
      !visited.has(u.id) &&
      links.some(
        (l) => l.from_user_id === companyAdmin.id && l.to_user_id === u.id
      )
  );
  plantAdmins.forEach((u) => visited.add(u.id));
  if (plantAdmins.length) levelUsers.push(plantAdmins);

  // Level 2: Operations roles (report to plant_admin or company_admin)
  const opsRoles = new Set([
    "plant_manager",
    "production_manager",
    "warehouse_manager",
    "procurement_manager",
    "quality_inspector",
    "maintenance_engineer",
    "finance_manager",
    "hr_manager",
  ]);
  const opsUsers = users.filter(
    (u) => opsRoles.has(u.role) && !visited.has(u.id)
  );
  opsUsers.forEach((u) => visited.add(u.id));
  if (opsUsers.length) levelUsers.push(opsUsers);

  // Level 3: Operators
  const operators = users.filter(
    (u) => u.role === "production_operator" && !visited.has(u.id)
  );
  operators.forEach((u) => visited.add(u.id));
  if (operators.length) levelUsers.push(operators);

  // Remaining unvisited
  const remaining = users.filter((u) => !visited.has(u.id));
  if (remaining.length) levelUsers.push(remaining);

  // Compute positions
  levelUsers.forEach((level, li) => {
    const totalW = level.length * NODE_W + (level.length - 1) * COL_GAP;
    const startX = -totalW / 2;
    level.forEach((user, ui) => {
      pos.set(user.id, {
        x: startX + ui * (NODE_W + COL_GAP),
        y: li * LEVEL_HEIGHT,
      });
    });
  });

  return pos;
}

export function WorkflowGraph({
  users,
  links,
  zoom,
  selectedUserId,
  onSelectUser,
  onRefresh,
  canEdit,
}: Props) {
  const { companyId } = useAuth();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [dragOver, setDragOver] = useState(false);
  const [linkToDelete, setLinkToDelete] = useState<string | null>(null);

  const positions = useMemo(
    () => computeLayout(users, links),
    [users, links]
  );

  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  // Auto-fit on first load
  useEffect(() => {
    if (positions.size > 0 && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setPan({ x: rect.width / 2, y: 80 });
    }
  }, [positions.size]);

  // Pan handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.target !== canvasRef.current && !(e.target as HTMLElement).classList.contains("canvas-bg")) return;
      setIsPanning(true);
      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
    },
    [pan]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning) return;
      setPan({
        x: panStart.current.panX + (e.clientX - panStart.current.x),
        y: panStart.current.panY + (e.clientY - panStart.current.y),
      });
    },
    [isPanning]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Wheel zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      // Zoom is controlled from parent, just prevent default scroll
    },
    []
  );

  // Drop handler (from employee list drag)
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const data = e.dataTransfer.getData("application/workflow-drag");
      if (!data) return;

      const { userId: fromUserId, fromRole } = JSON.parse(data);

      // Find the closest node to the drop position
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const dropX = (e.clientX - rect.left - pan.x) / zoom;
      const dropY = (e.clientY - rect.top - pan.y) / zoom;

      // Find nearest user node
      let nearestId: string | null = null;
      let nearestDist = Infinity;
      positions.forEach((pos, id) => {
        if (id === fromUserId) return;
        const cx = pos.x + NODE_W / 2;
        const cy = pos.y + NODE_H / 2;
        const dist = Math.sqrt(
          (dropX - cx) ** 2 + (dropY - cy) ** 2
        );
        if (dist < nearestDist && dist < 200) {
          nearestDist = dist;
          nearestId = id;
        }
      });

      if (!nearestId || !companyId) return;

      const targetUser = userMap.get(nearestId);
      if (!targetUser) return;

      // Create the link
      const { error } = await supabase.from("workflow_links" as any).upsert(
        {
          company_id: companyId,
          from_user_id: fromUserId,
          to_user_id: nearestId,
          from_role: fromRole,
          to_role: targetUser.role,
        },
        { onConflict: "company_id,from_user_id,to_user_id" }
      );

      if (!error) {
        onRefresh();
      }
    },
    [pan, zoom, positions, companyId, userMap, onRefresh]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "link";
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  // Delete link
  const handleDeleteLink = useCallback(
    async (linkId: string) => {
      await supabase.from("workflow_links" as any).delete().eq("id", linkId);
      setLinkToDelete(null);
      onRefresh();
    },
    [onRefresh]
  );

  // Build edges from links
  const edges = useMemo(() => {
    return links
      .map((link) => {
        const from = positions.get(link.from_user_id);
        const to = positions.get(link.to_user_id);
        if (!from || !to) return null;
        return {
          id: link.id,
          x1: from.x + NODE_W / 2,
          y1: from.y + NODE_H,
          x2: to.x + NODE_W / 2,
          y2: to.y,
        };
      })
      .filter(Boolean) as { id: string; x1: number; y1: number; x2: number; y2: number }[];
  }, [links, positions]);

  return (
    <div
      ref={canvasRef}
      className={cn(
        "w-full h-full relative select-none",
        isPanning ? "cursor-grabbing" : "cursor-grab",
        dragOver && "ring-2 ring-primary/40 ring-inset"
      )}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      style={{ background: "radial-gradient(circle at 50% 50%, hsl(var(--muted) / 0.3), hsl(var(--background)))" }}
    >
      {/* Grid pattern */}
      <div
        className="canvas-bg absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Transform container */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      >
        {/* Edges (SVG) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <polygon
                points="0 0, 8 3, 0 6"
                className="fill-muted-foreground/40"
              />
            </marker>
          </defs>
          {edges.map((edge) => {
            const midY = (edge.y1 + edge.y2) / 2;
            const d = `M ${edge.x1} ${edge.y1} C ${edge.x1} ${midY}, ${edge.x2} ${midY}, ${edge.x2} ${edge.y2}`;
            const isRelatedToSelected =
              selectedUserId &&
              (links.some(
                (l) =>
                  l.id === edge.id &&
                  (l.from_user_id === selectedUserId ||
                    l.to_user_id === selectedUserId)
              ));
            return (
              <g key={edge.id}>
                {/* Invisible thick hit area */}
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={12}
                  className="pointer-events-stroke cursor-pointer"
                  style={{ pointerEvents: "stroke" }}
                  onClick={() => setLinkToDelete(edge.id)}
                />
                {/* Visible line */}
                <path
                  d={d}
                  fill="none"
                  className={cn(
                    "transition-colors",
                    isRelatedToSelected
                      ? "stroke-primary/60"
                      : "stroke-muted-foreground/25"
                  )}
                  strokeWidth={isRelatedToSelected ? 2 : 1.5}
                  markerEnd="url(#arrowhead)"
                />
              </g>
            );
          })}
        </svg>

        {/* Nodes */}
        {Array.from(positions.entries()).map(([userId, pos]) => {
          const user = userMap.get(userId);
          if (!user) return null;
          const isSelected = selectedUserId === userId;
          const isLinkedToSelected =
            selectedUserId &&
            links.some(
              (l) =>
                (l.from_user_id === selectedUserId &&
                  l.to_user_id === userId) ||
                (l.to_user_id === selectedUserId &&
                  l.from_user_id === userId)
            );
          const roleColor = getRoleColor(user.role);

          return (
            <div
              key={userId}
              className={cn(
                "absolute rounded-xl border bg-card shadow-sm transition-all duration-150 cursor-pointer",
                "hover:shadow-md hover:border-primary/30",
                isSelected && "ring-2 ring-primary border-primary shadow-md",
                isLinkedToSelected &&
                  !isSelected &&
                  "border-primary/40 shadow-sm",
                !isSelected && !isLinkedToSelected && "border-border/60"
              )}
              style={{
                left: pos.x,
                top: pos.y,
                width: NODE_W,
                height: NODE_H,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectUser(isSelected ? null : userId);
              }}
            >
              <div className="flex items-center gap-2 p-2.5 h-full">
                <div className="relative shrink-0">
                  <UserAvatar
                    name={user.full_name ?? user.email}
                    url={user.avatar_url}
                    className="h-8 w-8"
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
              {/* Role indicator strip */}
              <div
                className={cn(
                  "absolute top-0 left-0 w-1 h-full rounded-l-xl",
                  roleColor.replace("text-", "bg-")
                )}
              />
            </div>
          );
        })}
      </div>

      {/* Minimap */}
      <Minimap
        users={users}
        links={links}
        positions={positions}
        pan={pan}
        zoom={zoom}
        canvasRef={canvasRef}
      />

      {/* Link delete tooltip */}
      {linkToDelete && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
          <div className="bg-card border border-border rounded-lg shadow-lg p-3 flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Remove this link?</span>
            <Button
              size="sm"
              variant="destructive"
              className="h-6 text-xs"
              onClick={() => handleDeleteLink(linkToDelete)}
            >
              <Unlink className="h-3 w-3 mr-1" />
              Remove
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs"
              onClick={() => setLinkToDelete(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {users.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <MapPin className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No employees found</p>
            <p className="text-xs mt-1">
              Add employees via the Whitelist tab to see the org graph
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Minimap component
function Minimap({
  users,
  links,
  positions,
  pan,
  zoom,
  canvasRef,
}: {
  users: WorkflowUser[];
  links: WorkflowLink[];
  positions: Map<string, NodePosition>;
  pan: { x: number; y: number };
  zoom: number;
  canvasRef: React.RefObject<HTMLDivElement | null>;
}) {
  const MINIMAP_W = 160;
  const MINIMAP_H = 100;

  // Compute bounds
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  positions.forEach((pos) => {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + NODE_W);
    maxY = Math.max(maxY, pos.y + NODE_H);
  });

  if (positions.size === 0) return null;

  const padding = 40;
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  const worldW = maxX - minX;
  const worldH = maxY - minY;
  const scale = Math.min(MINIMAP_W / worldW, MINIMAP_H / worldH);

  return (
    <div
      className="absolute bottom-3 right-3 z-10 rounded-lg border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden"
      style={{ width: MINIMAP_W, height: MINIMAP_H }}
    >
      <svg width={MINIMAP_W} height={MINIMAP_H}>
        {/* Edges */}
        {links.map((link) => {
          const from = positions.get(link.from_user_id);
          const to = positions.get(link.to_user_id);
          if (!from || !to) return null;
          return (
            <line
              key={link.id}
              x1={(from.x + NODE_W / 2 - minX) * scale}
              y1={(from.y + NODE_H / 2 - minY) * scale}
              x2={(to.x + NODE_W / 2 - minX) * scale}
              y2={(to.y + NODE_H / 2 - minY) * scale}
              className="stroke-muted-foreground/20"
              strokeWidth={0.5}
            />
          );
        })}
        {/* Nodes */}
        {Array.from(positions.entries()).map(([userId, pos]) => {
          const user = users.find((u) => u.id === userId);
          if (!user) return null;
          return (
            <rect
              key={userId}
              x={(pos.x - minX) * scale}
              y={(pos.y - minY) * scale}
              width={NODE_W * scale}
              height={NODE_H * scale}
              rx={2}
              className="fill-muted-foreground/30"
            />
          );
        })}
        {/* Viewport indicator */}
        {canvasRef.current && (
          <rect
            x={(-pan.x / zoom - minX) * scale}
            y={(-pan.y / zoom - minY) * scale}
            width={(canvasRef.current.clientWidth / zoom) * scale}
            height={(canvasRef.current.clientHeight / zoom) * scale}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={1}
            opacity={0.5}
          />
        )}
      </svg>
    </div>
  );
}

// Role-based color mapping
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
    auditor: "bg-slate-500/10 text-slate-600 border-slate-200",
  };
  return colors[role] ?? "bg-muted text-muted-foreground border-border";
}
