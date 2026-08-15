import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, UserX, UserCheck, Loader2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel, StatusBadge, Kpi } from "@/components/ui-parts";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { safeDate } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { ROLES } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { title: "Users & Roles — FactoryOS AI" },
      {
        name: "description",
        content: "All staff across every plant and department — roles, plant assignment and account status.",
      },
    ],
  }),
  component: UsersPage,
});

const ROLE_LABEL: Record<string, string> = Object.fromEntries(
  ROLES.map((r) => [r.id, r.label]),
);

function UsersPage() {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const { data: profiles } = useQuery({
    queryKey: ["users-roster", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("profiles")
          .select("id, full_name, email, status, plant_id, created_at")
          .eq("company_id", companyId!)
          .order("full_name")
      ).data ?? [],
    enabled: !!companyId,
  });

  const { data: roles } = useQuery({
    queryKey: ["users-roles", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("user_roles")
          .select("user_id, role, plant_id")
          .eq("company_id", companyId!)
      ).data ?? [],
    enabled: !!companyId,
  });

  const { data: plants } = useQuery({
    queryKey: ["users-plants"],
    queryFn: async () =>
      (await supabase.from("plants").select("id, name").eq("company_id", companyId!)).data ?? [],
    enabled: !!companyId,
  });

  const roleByUser = new Map<string, { role: string; plant_id: string | null }[]>();
  for (const r of roles ?? []) {
    const list = roleByUser.get(r.user_id) ?? [];
    list.push(r);
    roleByUser.set(r.user_id, list);
  }
  const plantName = new Map((plants ?? []).map((p) => [p.id, p.name]));

  const toggleStatus = useMutation({
    mutationFn: async ({ id, to }: { id: string; to: "active" | "inactive" }) => {
      const { error } = await supabase.from("profiles").update({ status: to }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("User status updated");
      qc.invalidateQueries({ queryKey: ["users-roster"] });
      setConfirmId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const active = (profiles ?? []).filter((p) => p.status !== "inactive").length;
  const deactivated = (profiles ?? []).filter((p) => p.status === "inactive").length;

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="users" />
      <PageHeader
        eyebrow="People"
        title="Users & Roles"
        sub="Every staff account in your company — role, plant assignment and whether the account can sign in."
        actions={<ModuleCopilot moduleName="users" />}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <Kpi label="Staff accounts" value={String(profiles?.length ?? 0)} icon={Users} tone="primary" />
        <Kpi label="Active" value={String(active)} icon={UserCheck} tone="success" />
        <Kpi label="Deactivated" value={String(deactivated)} icon={UserX} tone="destructive" />
        <Kpi
          label="Roles granted"
          value={String(new Set((roles ?? []).map((r) => r.role)).size)}
          icon={ShieldCheck}
          tone="info"
        />
      </div>
      <Panel title={`${profiles?.length ?? 0} staff accounts`}>
        <div className="overflow-x-auto -mx-2">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-white/5">
                {["Name", "Email", "Role", "Plant", "Status", "Joined", "Actions"].map((h) => (
                  <TableHead
                    key={h}
                    className="text-[11px] uppercase tracking-wider text-muted-foreground"
                  >
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(profiles ?? []).map((p) => {
                const userRoles = roleByUser.get(p.id) ?? [];
                const plantId = p.plant_id ?? userRoles.find((r) => r.plant_id)?.plant_id ?? null;
                return (
                  <TableRow key={p.id} className="border-white/5">
                    <TableCell className="font-medium">{p.full_name || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {userRoles.length === 0 && (
                          <span className="text-xs text-muted-foreground">No role</span>
                        )}
                        {userRoles.map((r) => (
                          <span
                            key={r.role}
                            className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] capitalize"
                          >
                            {ROLE_LABEL[r.role] ?? r.role.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {plantId ? plantName.get(plantId) ?? plantId.slice(0, 8) : "Company-wide"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={p.status === "inactive" ? "inactive" : "active"} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {safeDate(p.created_at)}
                    </TableCell>
                    <TableCell>
                      {confirmId === p.id ? (
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() =>
                              toggleStatus.mutate({
                                id: p.id,
                                to: p.status === "inactive" ? "active" : "inactive",
                              })
                            }
                          >
                            {toggleStatus.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "Confirm"
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => setConfirmId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant={p.status === "inactive" ? "outline" : "ghost"}
                          className={`h-7 text-xs ${
                            p.status === "inactive" ? "text-success" : "text-destructive"
                          }`}
                          onClick={() => setConfirmId(p.id)}
                        >
                          {p.status === "inactive" ? (
                            <>
                              <UserCheck className="h-3 w-3 mr-1" /> Reactivate
                            </>
                          ) : (
                            <>
                              <UserX className="h-3 w-3 mr-1" /> Deactivate
                            </>
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(profiles ?? []).length === 0 && (
                <TableRow className="border-white/5">
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground py-8 text-sm"
                  >
                    No staff accounts yet — invite staff from the Whitelist tab.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Panel>
      <p className="mt-3 text-xs text-muted-foreground">
        Deactivating an account blocks sign-in immediately. Role changes and new accounts are
        handled through the Whitelist, not here.
      </p>
    </div>
  );
}
