import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { safeDate } from "@/lib/utils";
import { FileCheck2, Plus, Loader2, Filter } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { ROLES, type AppRole } from "@/lib/roles";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/whitelist")({
  head: () => ({
    meta: [
      { title: "Whitelist — FactoryOS AI" },
      { name: "description", content: "Control who may register for your FactoryOS tenant." },
    ],
  }),
  component: WhitelistPage,
});

/** Plant-level roles a Plant Admin may invite — never company-level roles. */
const PLANT_LEVEL_ROLES: AppRole[] = [
  "plant_manager",
  "production_manager",
  "warehouse_manager",
  "procurement_manager",
  "quality_inspector",
  "maintenance_engineer",
  "hr_manager",
  "production_operator",
];

function WhitelistPage() {
  const qc = useQueryClient();
  const { companyId, roles, plantId } = useAuth();
  const isRoot = roles.includes("root_super_admin");
  const isCompanyAdmin = roles.includes("company_admin");
  const isPlantAdmin = roles.includes("plant_admin");
  const canInvite = isRoot || isCompanyAdmin || isPlantAdmin;

  const { data } = useQuery({
    queryKey: ["whitelist"],
    queryFn: async () =>
      (await supabase.from("whitelist").select("*").order("created_at", { ascending: false }))
        .data ?? [],
  });

  // Emails that have already created an account (logged in at least once).
  // Any whitelist row whose email has a real profile is shown as ACTIVE, not
  // the raw seed "pending" — a live account is proof positive the invite was
  // used, even if the seed never flipped to accepted.
  const { data: profiles } = useQuery({
    queryKey: ["whitelist-active-users", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("profiles")
          .select("email")
          .eq("company_id", companyId!)
      ).data ?? [],
    enabled: !!companyId,
  });
  const activeEmails = useMemo(
    () => new Set((profiles ?? []).map((p) => p.email?.toLowerCase()).filter(Boolean)),
    [profiles],
  );
  const displayStatus = (w: any) =>
    activeEmails.has(String(w.email).toLowerCase()) ? "active" : (w.status ?? "pending");

  const { data: plants } = useQuery({
    queryKey: ["whitelist-plants", companyId],
    queryFn: async () =>
      (await supabase.from("plants").select("id, name, code").eq("company_id", companyId!))
        .data ?? [],
    enabled: !!companyId,
  });
  const plantName = (id: string | null) =>
    id ? (plants?.find((p) => p.id === id)?.name ?? id) : "—";

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("production_operator");
  const [invitePlant, setInvitePlant] = useState<string>(plantId ?? "none");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const roleNeedsPlant = useMemo(
    () => !isRoot && PLANT_LEVEL_ROLES.includes(role as AppRole),
    [role, isRoot],
  );

  const invite = useMutation({
    mutationFn: async () => {
      const plant = roleNeedsPlant && invitePlant !== "none" ? invitePlant : null;
      const { error } = await supabase.from("whitelist").insert({
        email,
        role,
        company_id: companyId,
        plant_id: plant,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Invited ${email}`);
      setOpen(false);
      setEmail("");
      qc.invalidateQueries({ queryKey: ["whitelist"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Plant Admin's view is already RLS-scoped to their plant; filter in the
  // UI as well so the list is unambiguous.
  const visibleRows = useMemo(() => {
    let rows = data ?? [];
    if (isPlantAdmin && plantId) rows = rows.filter((w) => w.plant_id === plantId);
    if (roleFilter !== "all") rows = rows.filter((w) => w.role === roleFilter);
    return rows;
  }, [data, isPlantAdmin, plantId, roleFilter]);

  const inviteRoles = isPlantAdmin
    ? ROLES.filter((r) => PLANT_LEVEL_ROLES.includes(r.id))
    : ROLES.filter((r) => r.id !== "root_super_admin");

  const pending = visibleRows.filter((w) => displayStatus(w) === "pending").length;
  const accepted = visibleRows.filter((w) => displayStatus(w) === "accepted").length;
  const active = visibleRows.filter((w) => displayStatus(w) === "active").length;

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="whitelist" />
      <PageHeader
        eyebrow="Access Control"
        title="Whitelist"
        sub={
          isPlantAdmin
            ? "Invite plant-level roles for your plant. Each invite is plant-scoped."
            : "Only whitelisted emails may register. Assign a role, company and plant per invitation."
        }
        actions={
          <>
            {canInvite && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-[image:var(--gradient-primary)] shadow-glow">
                    <Plus className="h-4 w-4 mr-1.5" />
                    Invite
                  </Button>
                </DialogTrigger>
                <DialogContent className="glass-strong border-white/10">
                  <DialogHeader>
                    <DialogTitle>
                      {isPlantAdmin ? "Invite to your plant" : "Invite user"}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>Email</Label>
                      <Input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="jane@company.com"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Role</Label>
                      <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {inviteRoles.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {roleNeedsPlant && (
                      <div className="space-y-1.5">
                        <Label>Plant</Label>
                        {isPlantAdmin ? (
                          <div className="rounded-md border border-input bg-background/40 px-3 py-2 text-sm">
                            {plantName(plantId)} (your plant)
                          </div>
                        ) : (
                          <Select
                            value={invitePlant}
                            onValueChange={setInvitePlant}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No plant (company-level)</SelectItem>
                              {(plants ?? []).map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name} ({p.code})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => invite.mutate()}
                      disabled={!email || invite.isPending}
                      className="bg-[image:var(--gradient-primary)]"
                    >
                      {invite.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Send invite"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            <ModuleCopilot moduleName="whitelist" />
          </>
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi
          label="Total invites"
          value={String(visibleRows.length)}
          icon={FileCheck2}
          tone="primary"
        />
        <Kpi label="Pending" value={String(pending)} icon={FileCheck2} tone="warning" />
        <Kpi label="Accepted" value={String(accepted)} icon={FileCheck2} tone="success" />
        <Kpi label="Active" value={String(active)} icon={FileCheck2} tone="success" />
        <Kpi
          label="Revoked"
          value={String(visibleRows.filter((w) => w.status === "revoked").length)}
          icon={FileCheck2}
          tone="destructive"
        />
      </div>
      <div className="mt-4">
        <Panel
          title={`${visibleRows.length} invitations`}
          right={
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-48 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  {inviteRoles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
        >
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-white/5">
                {["Email", "Role", "Plant", "Status", "Invited"].map((h) => (
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
              {visibleRows.map((w) => (
                <TableRow key={w.id} className="border-white/5">
                  <TableCell className="font-medium">{w.email}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">
                    {w.role.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {plantName(w.plant_id)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={displayStatus(w)} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {safeDate(w.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      </div>
    </div>
  );
}