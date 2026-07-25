import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/ui-parts";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_MAP } from "@/lib/roles";
import { Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [
    { title: "Team — FactoryOS AI" },
    { name: "description", content: "Directory of people, roles and departments." },
  ]}),
  component: TeamPage,
});

function TeamPage() {
  const { profile, roles } = useAuth();
  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="team" />
      <PageHeader eyebrow="People" title="Team" sub="Everyone with access to your FactoryOS tenant."
        actions={<ModuleCopilot moduleName="team" />} />
      <Panel title="Your account">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-glow">
            <Users className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="text-lg font-semibold">{profile?.full_name ?? profile?.email}</div>
            <div className="text-sm text-muted-foreground">{profile?.email}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {roles.map(r => (
                <span key={r} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary">
                  {ROLE_MAP[r]?.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Panel>
      <div className="mt-4">
        <Panel title="Full directory">
          <div className="text-sm text-muted-foreground py-8 text-center">
            Employee directory syncs with HR. Invite teammates from the Whitelist page.
          </div>
        </Panel>
      </div>
    </div>
  );
}
