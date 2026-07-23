import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel } from "@/components/ui-parts";
import { ScrollText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({ meta: [
    { title: "Audit Logs — FactoryOS AI" },
    { name: "description", content: "Immutable audit trail of every action across the platform." },
  ]}),
  component: AuditPage,
});

function AuditPage() {
  const { data } = useQuery({
    queryKey: ["audit"],
    queryFn: async () => (await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader eyebrow="Compliance" title="Audit Logs" sub="Every action logged with actor, entity, IP and payload — immutable and exportable." />
      <Panel title={`${data?.length ?? 0} events`}>
        {data?.length ? (
          <div className="divide-y divide-white/5 text-sm">
            {data.map(l => (
              <div key={l.id} className="grid grid-cols-[auto_1fr_auto] gap-3 py-2 items-center">
                <ScrollText className="h-4 w-4 text-muted-foreground" />
                <div><span className="font-medium">{l.action}</span> <span className="text-muted-foreground">· {l.entity ?? "system"}</span></div>
                <div className="text-xs text-muted-foreground tabular-nums">{new Date(l.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-sm text-muted-foreground py-12">
            No audit events yet — actions will appear here as your team uses FactoryOS.
          </div>
        )}
      </Panel>
    </div>
  );
}
