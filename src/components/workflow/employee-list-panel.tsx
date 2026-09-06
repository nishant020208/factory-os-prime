import { useState, useMemo } from "react";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Search,
  GripVertical,
  ChevronDown,
  ChevronRight,
  LinkIcon,
  Unlink,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_MAP, type AppRole } from "@/lib/roles";

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

interface Props {
  users: WorkflowUser[];
  links: WorkflowLink[];
  canEdit: boolean;
  selectedUserId: string | null;
  onSelectUser: (id: string | null) => void;
  onRefresh: () => void;
}

const ROLE_GROUPS = [
  {
    label: "Company Admin",
    roles: ["company_admin"],
    color: "bg-indigo-500/10 text-indigo-600",
    stripColor: "bg-indigo-500",
  },
  {
    label: "Plant Admin",
    roles: ["plant_admin"],
    color: "bg-violet-500/10 text-violet-600",
    stripColor: "bg-violet-500",
  },
  {
    label: "Operations",
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
    color: "bg-blue-500/10 text-blue-600",
    stripColor: "bg-blue-500",
  },
  {
    label: "Operators",
    roles: ["production_operator"],
    color: "bg-teal-500/10 text-teal-600",
    stripColor: "bg-teal-500",
  },
];

export function EmployeeListPanel({
  users,
  links,
  canEdit,
  selectedUserId,
  onSelectUser,
  onRefresh,
}: Props) {
  const [search, setSearch] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set()
  );

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.full_name?.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [users, search]);

  const groupedUsers = useMemo(() => {
    const groups: { label: string; users: WorkflowUser[]; color: string; stripColor: string }[] = [];
    const used = new Set<string>();

    ROLE_GROUPS.forEach((group) => {
      const groupUsers = filteredUsers.filter((u) =>
        group.roles.includes(u.role)
      );
      if (groupUsers.length > 0) {
        groups.push({
          label: group.label,
          users: groupUsers,
          color: group.color,
          stripColor: group.stripColor,
        });
        groupUsers.forEach((u) => used.add(u.id));
      }
    });

    const ungrouped = filteredUsers.filter((u) => !used.has(u.id));
    if (ungrouped.length > 0) {
      groups.push({
        label: "Other",
        users: ungrouped,
        color: "bg-muted text-muted-foreground",
        stripColor: "bg-muted-foreground",
      });
    }

    return groups;
  }, [filteredUsers]);

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const getLinkedCount = (whitelistId: string) =>
    links.filter(
      (l) => l.parent_id === whitelistId || l.child_id === whitelistId
    ).length;

  const handleDragStart = (
    e: React.DragEvent,
    user: WorkflowUser
  ) => {
    if (!canEdit) return;
    e.dataTransfer.setData(
      "application/workflow-drag",
      JSON.stringify({ userId: user.id, fromRole: user.role })
    );
    e.dataTransfer.effectAllowed = "link";
  };

  return (
    <div className="w-64 border-r border-border bg-card/50 backdrop-blur-sm flex flex-col shrink-0">
      {/* Header */}
      <div className="p-3 border-b border-border/50">
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Employees
          </span>
          <Badge variant="secondary" className="text-[10px] h-4 ml-auto">
            {users.length}
          </Badge>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 pl-8 text-xs bg-muted/50 border-0"
          />
        </div>
      </div>

      {/* Employee groups */}
      <div className="flex-1 overflow-y-auto">
        {groupedUsers.length === 0 && (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No employees found
          </div>
        )}

        {groupedUsers.map((group) => {
          const isCollapsed = collapsedGroups.has(group.label);
          return (
            <div key={group.label} className="border-b border-border/30">
              {/* Group header */}
              <button
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                )}
                <div
                  className={cn(
                    "h-2 w-2 rounded-full",
                    group.stripColor
                  )}
                />
                <span className="text-xs font-medium text-muted-foreground flex-1 text-left">
                  {group.label}
                </span>
                <Badge
                  variant="secondary"
                  className="text-[10px] h-4 tabular-nums"
                >
                  {group.users.length}
                </Badge>
              </button>

              {/* Employee cards */}
              {!isCollapsed && (
                <div className="px-2 pb-2 space-y-1">
                  {group.users.map((user) => {
                    const linkedCount = getLinkedCount(user.whitelist_id);
                    const isSelected = selectedUserId === user.id;
                    return (
                      <div
                        key={user.id}
                        draggable={canEdit}
                        onDragStart={(e) => handleDragStart(e, user)}
                        onClick={() =>
                          onSelectUser(isSelected ? null : user.id)
                        }
                        className={cn(
                          "flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all",
                          "hover:bg-muted/80",
                          canEdit && "cursor-grab active:cursor-grabbing",
                          isSelected && "bg-primary/5 ring-1 ring-primary/20"
                        )}
                      >
                        {canEdit && (
                          <GripVertical className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                        )}
                        <UserAvatar
                          name={user.full_name ?? user.email}
                          url={user.avatar_url}
                          className="h-7 w-7"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium truncate leading-tight">
                            {user.full_name ?? user.email.split("@")[0]}
                          </p>
                          <p className="text-[9px] text-muted-foreground truncate leading-tight">
                            {ROLE_MAP[user.role as AppRole]?.label ?? user.role}
                          </p>
                        </div>
                        {linkedCount > 0 && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge
                                variant="secondary"
                                className="text-[9px] h-3.5 px-1 tabular-nums"
                              >
                                <LinkIcon className="h-2 w-2 mr-0.5" />
                                {linkedCount}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              {linkedCount} link{linkedCount !== 1 ? "s" : ""}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      {canEdit && (
        <div className="p-2 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground text-center">
            Drag an employee onto a node in the canvas to create a reporting link
          </p>
        </div>
      )}
    </div>
  );
}
