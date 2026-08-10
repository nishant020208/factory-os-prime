import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Save,
  Settings2,
  Globe,
  Shield,
  Bell,
  CreditCard,
  Database,
  Lock,
  Sliders,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel } from "@/components/ui-parts";
import { ModuleCopilot } from "@/components/module-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/_authenticated/platform/settings")({
  head: () => ({ meta: [{ title: "Platform Settings — FactoryOS AI" }] }),
  component: PlatformSettings,
});

interface PlatformSetting {
  key: string;
  value: any;
  description: string;
}

const DEFAULT_SETTINGS: Record<string, PlatformSetting> = {
  invoice_qr_at_approval: {
    key: "invoice_qr_at_approval",
    value: true,
    description: "Auto-generate QR code on invoice at order approval",
  },
  auto_notify_next_role: {
    key: "auto_notify_next_role",
    value: true,
    description: "Auto-notify the next role at every status transition",
  },
  company_auto_approve: {
    key: "company_auto_approve",
    value: false,
    description: "Auto-approve new company registrations",
  },
  max_companies_per_admin: {
    key: "max_companies_per_admin",
    value: 5,
    description: "Maximum companies a Root Admin can manage",
  },
  audit_retention_days: {
    key: "audit_retention_days",
    value: 365,
    description: "Days to retain audit logs",
  },
  session_timeout_minutes: {
    key: "session_timeout_minutes",
    value: 480,
    description: "User session timeout in minutes",
  },
  allow_self_registration: {
    key: "allow_self_registration",
    value: true,
    description: "Allow users to self-register (whitelist required)",
  },
  require_mfa: {
    key: "require_mfa",
    value: false,
    description: "Require multi-factor authentication for all users",
  },
  default_currency: {
    key: "default_currency",
    value: "USD",
    description: "Default currency for new companies",
  },
  default_timezone: {
    key: "default_timezone",
    value: "America/New_York",
    description: "Default timezone for new companies",
  },
};

function PlatformSettings() {
  const queryClient = useQueryClient();
  const { companyId } = useAuth();
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [tab, setTab] = useState("general");

  // Load settings from DB (or use defaults)
  const { data: dbSettings } = useQuery({
    queryKey: ["platform-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_settings").select("*");
      return data ?? [];
    },
  });

  useEffect(() => {
    const merged: Record<string, any> = {};
    for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
      const dbVal = dbSettings?.find((s: any) => s.key === key);
      merged[key] = dbVal ? dbVal.value : def.value;
    }
    setSettings(merged);
  }, [dbSettings]);

  const updateSetting = async (key: string, value: any) => {
    try {
      const existing = dbSettings?.find((s: any) => s.key === key);
      if (existing) {
        await supabase.from("platform_settings").update({ value }).eq("key", key);
      } else {
        const desc = DEFAULT_SETTINGS[key]?.description ?? "";
        await supabase.from("platform_settings").insert({ key, value, description: desc });
      }
      queryClient.invalidateQueries({ queryKey: ["platform-settings"] });
      toast.success(`Setting updated: ${key}`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const SettingToggle = ({ key: k, label }: { key: string; label: string }) => {
    const desc = DEFAULT_SETTINGS[k]?.description ?? "";
    return (
      <div className="flex items-center justify-between py-3 border-b border-white/5">
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground">{desc}</div>
        </div>
        <Switch
          checked={!!settings[k]}
          onCheckedChange={(v) => {
            setSettings((s) => ({ ...s, [k]: v }));
            updateSetting(k, v);
          }}
        />
      </div>
    );
  };

  return (
    <div className="max-w-[1000px] mx-auto space-y-4">
      <PageHeader
        eyebrow="Platform"
        title="Platform Settings"
        sub="Global configuration, feature flags, security rules and company defaults."
        actions={<ModuleCopilot moduleName="platform-settings" />}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="general">
            <Settings2 className="h-4 w-4 mr-1.5" />
            General
          </TabsTrigger>
          <TabsTrigger value="security">
            <Lock className="h-4 w-4 mr-1.5" />
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-1.5" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="defaults">
            <Globe className="h-4 w-4 mr-1.5" />
            Defaults
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Panel title="General Settings">
            <SettingToggle key="invoice_qr_at_approval" label="Invoice QR at Approval" />
            <SettingToggle key="auto_notify_next_role" label="Auto Notify Next Role" />
            <SettingToggle key="company_auto_approve" label="Auto-Approve Companies" />
            <SettingToggle key="allow_self_registration" label="Allow Self-Registration" />
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div>
                <div className="text-sm font-medium">Max Companies Per Admin</div>
                <div className="text-xs text-muted-foreground">
                  {DEFAULT_SETTINGS.max_companies_per_admin.description}
                </div>
              </div>
              <Input
                type="number"
                value={settings.max_companies_per_admin ?? 5}
                onChange={(e) => {
                  const v = parseInt(e.target.value) || 5;
                  setSettings((s) => ({ ...s, max_companies_per_admin: v }));
                  updateSetting("max_companies_per_admin", v);
                }}
                className="w-20 h-8 text-xs text-right"
              />
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="security">
          <Panel title="Security Settings">
            <SettingToggle key="require_mfa" label="Require Multi-Factor Authentication" />
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div>
                <div className="text-sm font-medium">Session Timeout</div>
                <div className="text-xs text-muted-foreground">
                  {DEFAULT_SETTINGS.session_timeout_minutes.description}
                </div>
              </div>
              <Select
                value={String(settings.session_timeout_minutes ?? 480)}
                onValueChange={(v) => {
                  setSettings((s) => ({ ...s, session_timeout_minutes: parseInt(v) }));
                  updateSetting("session_timeout_minutes", parseInt(v));
                }}
              >
                <SelectTrigger className="w-28 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="240">4 hours</SelectItem>
                  <SelectItem value="480">8 hours</SelectItem>
                  <SelectItem value="720">12 hours</SelectItem>
                  <SelectItem value="1440">24 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div>
                <div className="text-sm font-medium">Audit Retention</div>
                <div className="text-xs text-muted-foreground">
                  {DEFAULT_SETTINGS.audit_retention_days.description}
                </div>
              </div>
              <Select
                value={String(settings.audit_retention_days ?? 365)}
                onValueChange={(v) => {
                  setSettings((s) => ({ ...s, audit_retention_days: parseInt(v) }));
                  updateSetting("audit_retention_days", parseInt(v));
                }}
              >
                <SelectTrigger className="w-28 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="180">180 days</SelectItem>
                  <SelectItem value="365">1 year</SelectItem>
                  <SelectItem value="730">2 years</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="notifications">
          <Panel title="Notification Defaults">
            <SettingToggle key="auto_notify_next_role" label="Auto Notify Next Role" />
            <div className="text-xs text-muted-foreground mt-4 p-3 bg-card/30 rounded-lg">
              Notification channels (email, SMS, Slack) will be configurable in a future update.
              Currently, all notifications appear in-app and in the audit log.
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="defaults">
          <Panel title="Default Values for New Companies">
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-sm font-medium">Default Currency</div>
                  <div className="text-xs text-muted-foreground">
                    Used when creating new companies
                  </div>
                </div>
                <Select
                  value={settings.default_currency ?? "USD"}
                  onValueChange={(v) => {
                    setSettings((s) => ({ ...s, default_currency: v }));
                    updateSetting("default_currency", v);
                  }}
                >
                  <SelectTrigger className="w-24 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["USD", "EUR", "GBP", "INR", "JPY", "CNY"].map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-sm font-medium">Default Timezone</div>
                  <div className="text-xs text-muted-foreground">
                    Used when creating new companies
                  </div>
                </div>
                <Select
                  value={settings.default_timezone ?? "America/New_York"}
                  onValueChange={(v) => {
                    setSettings((s) => ({ ...s, default_timezone: v }));
                    updateSetting("default_timezone", v);
                  }}
                >
                  <SelectTrigger className="w-40 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "America/New_York",
                      "America/Chicago",
                      "America/Los_Angeles",
                      "Europe/London",
                      "Asia/Kolkata",
                      "Asia/Tokyo",
                      "Asia/Singapore",
                    ].map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
