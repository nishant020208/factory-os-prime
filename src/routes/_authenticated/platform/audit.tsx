import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel } from "@/components/ui-parts";
import { ScrollText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/platform/audit")({
  head: () => ({ meta: [{ title: "Platform Audit Logs — FactoryOS AI" }] }),
  component: PlatformAudit,
});

function PlatformAudit() {
  const { data } = useQuery({
    queryKey: ["platform-audit"],
    queryFn: async () => (await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500)).data ?? [],
  });
  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader eyebrow="Platform" title="Platform Audit Logs" sub="Every action across every tenant, immutable and exportable." />
      <Panel title={`${data?.length ?? 0} events`}>
        <div className="divide-y divide-white/5 text-sm">
          {(data ?? []).map(l => (
            <div key={l.id} className="grid grid-cols-[auto_1fr_auto_auto] gap-3 py-2 items-center">
              <ScrollText className="h-4 w-4 text-muted-foreground" />
              <div><span className="font-medium">{l.action}</span> <span className="text-muted-foreground">· {l.entity ?? "system"}</span></div>
              <div className="text-[11px] text-muted-foreground font-mono">{l.company_id?.slice(0,8) ?? "platform"}</div>
              <div className="text-xs text-muted-foreground tabular-nums">{new Date(l.created_at).toLocaleString()}</div>
            </div>
          ))}
          {data?.length === 0 && <div className="py-8 text-xs text-muted-foreground text-center">No audit events yet.</div>}
        </div>
      </Panel>
    </div>
  );
}
