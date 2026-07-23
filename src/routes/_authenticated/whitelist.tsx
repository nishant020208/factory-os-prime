import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { FileCheck2, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel, StatusBadge, Kpi } from "@/components/ui-parts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ROLES, type AppRole } from "@/lib/roles";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/whitelist")({
  head: () => ({ meta: [
    { title: "Whitelist — FactoryOS AI" },
    { name: "description", content: "Control who may register for your FactoryOS tenant." },
  ]}),
  component: WhitelistPage,
});

function WhitelistPage() {
  const qc = useQueryClient();
  const { companyId, roles } = useAuth();
  const canInvite = roles.includes("root_super_admin") || roles.includes("company_admin");

  const { data } = useQuery({
    queryKey: ["whitelist"],
    queryFn: async () => (await supabase.from("whitelist").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("production_operator");

  const invite = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("whitelist").insert({ email, role, company_id: companyId, status: "pending" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Invited ${email}`);
      setOpen(false); setEmail("");
      qc.invalidateQueries({ queryKey: ["whitelist"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = data?.filter(w => w.status === "pending").length ?? 0;
  const accepted = data?.filter(w => w.status === "accepted").length ?? 0;

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="Access Control"
        title="Whitelist"
        sub="Only whitelisted emails may register. Assign a role, company and plant per invitation."
        actions={canInvite && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[image:var(--gradient-primary)] shadow-glow"><Plus className="h-4 w-4 mr-1.5" />Invite</Button>
            </DialogTrigger>
            <DialogContent className="glass-strong border-white/10">
              <DialogHeader><DialogTitle>Invite user</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@company.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.filter(r => r.id !== "root_super_admin").map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => invite.mutate()} disabled={!email || invite.isPending} className="bg-[image:var(--gradient-primary)]">
                  {invite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send invite"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Total invites" value={String(data?.length ?? 0)} icon={FileCheck2} tone="primary" />
        <Kpi label="Pending" value={String(pending)} icon={FileCheck2} tone="warning" />
        <Kpi label="Accepted" value={String(accepted)} icon={FileCheck2} tone="success" />
        <Kpi label="Revoked" value={String(data?.filter(w => w.status === "revoked").length ?? 0)} icon={FileCheck2} tone="destructive" />
      </div>
      <div className="mt-4">
        <Panel title={`${data?.length ?? 0} invitations`}>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-white/5">
                {["Email","Role","Status","Invited"].map(h => <TableHead key={h} className="text-[11px] uppercase tracking-wider text-muted-foreground">{h}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map(w => (
                <TableRow key={w.id} className="border-white/5">
                  <TableCell className="font-medium">{w.email}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{w.role.replace(/_/g, " ")}</TableCell>
                  <TableCell><StatusBadge status={w.status} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      </div>
    </div>
  );
}
