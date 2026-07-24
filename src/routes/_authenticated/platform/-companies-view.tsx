import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel, StatusBadge, Kpi } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { Building2, ShieldCheck, ClipboardX, Trash2, Play, Pause } from "lucide-react";

type Filter = "pending" | "active" | "suspended" | "all";

function CompaniesView({ filter, title, sub, eyebrow }: { filter: Filter; title: string; sub: string; eyebrow: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["platform-companies", filter],
    queryFn: async () => {
      let q = supabase.from("companies").select("*").order("created_at", { ascending: false });
      if (filter !== "all") q = q.eq("status", filter);
      return (await q).data ?? [];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("companies").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-companies"] }); toast.success("Updated"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("companies").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-companies"] }); toast.success("Company deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader eyebrow={eyebrow} title={title} sub={sub} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Total" value={String(data?.length ?? 0)} icon={Building2} tone="primary" />
        <Kpi label="Active" value={String(data?.filter(c => (c.status ?? "active") === "active").length ?? 0)} icon={ShieldCheck} tone="success" />
        <Kpi label="Pending" value={String(data?.filter(c => c.status === "pending").length ?? 0)} icon={Building2} tone="warning" />
        <Kpi label="Suspended" value={String(data?.filter(c => c.status === "suspended").length ?? 0)} icon={ClipboardX} tone="destructive" />
      </div>
      <div className="mt-4">
        <Panel title={`${data?.length ?? 0} tenants`}>
          <div className="divide-y divide-white/5 text-sm">
            {(data ?? []).map(c => (
              <div key={c.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-3">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-[11px] text-muted-foreground">{c.industry ?? "—"} · {c.country ?? "—"} · {c.currency ?? "—"}</div>
                </div>
                <StatusBadge status={c.status ?? "active"} />
                <div className="flex gap-1">
                  {c.status === "pending" && (
                    <Button size="sm" variant="outline" className="h-7" onClick={() => setStatus.mutate({ id: c.id, status: "active" })}>
                      <Play className="h-3 w-3 mr-1" />Approve
                    </Button>
                  )}
                  {c.status === "active" && (
                    <Button size="sm" variant="outline" className="h-7" onClick={() => setStatus.mutate({ id: c.id, status: "suspended" })}>
                      <Pause className="h-3 w-3 mr-1" />Suspend
                    </Button>
                  )}
                  {c.status === "suspended" && (
                    <Button size="sm" variant="outline" className="h-7" onClick={() => setStatus.mutate({ id: c.id, status: "active" })}>
                      <Play className="h-3 w-3 mr-1" />Reactivate
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => { if (confirm(`Delete ${c.name}? This cannot be undone.`)) del.mutate(c.id); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            {data?.length === 0 && <div className="py-8 text-xs text-muted-foreground text-center">No tenants in this bucket.</div>}
          </div>
        </Panel>
      </div>
    </div>
  );
}

export { CompaniesView };
