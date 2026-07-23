import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [
    { title: "Settings — FactoryOS AI" },
    { name: "description", content: "Company, branding, integrations and API keys." },
  ]}),
  component: SettingsPage,
});

function SettingsPage() {
  const { profile } = useAuth();
  return (
    <div className="max-w-[1200px] mx-auto space-y-4">
      <PageHeader eyebrow="Configuration" title="Settings" sub="Company, branding, integrations and platform preferences." />
      <Panel title="Company">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Legal name" defaultValue="ABC Manufacturing Inc." />
          <Field label="Industry" defaultValue="Precision Manufacturing" />
          <Field label="Country" defaultValue="United States" />
          <Field label="Currency" defaultValue="USD" />
          <Field label="Timezone" defaultValue="America/Detroit" />
          <Field label="Fiscal year start" defaultValue="January" />
        </div>
      </Panel>
      <Panel title="Profile">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Full name" defaultValue={profile?.full_name ?? ""} />
          <Field label="Email" defaultValue={profile?.email ?? ""} />
        </div>
      </Panel>
      <Panel title="Integrations (architecture ready)">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          {["Email","SMS","WhatsApp","Slack","Teams","Google Calendar","Power BI","IoT","RFID","Barcode","QR","REST API"].map(x => (
            <div key={x} className="glass rounded-lg px-3 py-2 flex items-center justify-between">
              {x}<span className="text-[10px] text-muted-foreground">Ready</span>
            </div>
          ))}
        </div>
      </Panel>
      <div className="flex justify-end"><Button className="bg-[image:var(--gradient-primary)] shadow-glow">Save changes</Button></div>
    </div>
  );
}

function Field({ label, defaultValue }: { label: string; defaultValue?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input defaultValue={defaultValue} className="bg-background/40" />
    </div>
  );
}
