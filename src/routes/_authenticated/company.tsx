import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Save, Loader2, MapPin, CreditCard, Hash, Users, Factory } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CompanyRow = Record<string, any>;
import { PageHeader, Panel, Kpi } from "@/components/ui-parts";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/_authenticated/company")({
  head: () => ({ meta: [
    { title: "My Company — FactoryOS AI" },
    { name: "description", content: "Company profile, legal identity and corporate settings" },
  ]}),
  component: CompanyPage,
});

function CompanyPage() {
  const queryClient = useQueryClient();
  const { companyId } = useAuth();

  const { data: company, isLoading } = useQuery<CompanyRow | null>({
    queryKey: ["my-company", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data } = await supabase.from("companies").select("*").eq("id", companyId).single();
      return data as CompanyRow | null;
    },
    enabled: !!companyId,
  });

  const { data: counts } = useQuery({
    queryKey: ["company-counts", companyId],
    queryFn: async () => {
      if (!companyId) return { plants: 0, employees: 0, departments: 0, products: 0 };
      const [plants, employees, departments, products] = await Promise.all([
        supabase.from("plants").select("*", { count: "exact", head: true }).eq("company_id", companyId),
        supabase.from("employees").select("*", { count: "exact", head: true }).eq("company_id", companyId),
        supabase.from("departments").select("*", { count: "exact", head: true }).eq("company_id", companyId),
        supabase.from("products").select("*", { count: "exact", head: true }).eq("company_id", companyId),
      ]);
      return {
        plants: plants.count ?? 0,
        employees: employees.count ?? 0,
        departments: departments.count ?? 0,
        products: products.count ?? 0,
      };
    },
    enabled: !!companyId,
  });

  const [form, setForm] = useState({
    name: "",
    legal_name: "",
    address: "",
    country: "US",
    industry: "",
    currency: "USD",
    timezone: "America/Detroit",
    gst_number: "",
    registration_number: "",
    plan_tier: "starter",
  });

  useEffect(() => {
    if (company) {
      setForm({
        name: company.name ?? "",
        legal_name: company.legal_name ?? "",
        address: company.address ?? "",
        country: company.country ?? "US",
        industry: company.industry ?? "",
        currency: company.currency ?? "USD",
        timezone: company.timezone ?? "America/Detroit",
        gst_number: company.gst_number ?? "",
        registration_number: company.registration_number ?? "",
        plan_tier: company.plan_tier ?? "starter",
      });
    }
  }, [company]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company selected");
      const { error } = await supabase.from("companies").update({
        name: form.name,
        legal_name: form.legal_name || null,
        address: form.address || null,
        country: form.country,
        industry: form.industry || null,
        currency: form.currency,
        timezone: form.timezone,
        gst_number: form.gst_number || null,
        registration_number: form.registration_number || null,
        plan_tier: form.plan_tier,
        updated_at: new Date().toISOString(),
      }).eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-company"] });
      toast.success("Company updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="max-w-[1200px] mx-auto py-16 text-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        <div className="mt-2">Loading company info...</div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto space-y-4">
      <ModuleStatusBar moduleName="company" />
      <PageHeader
        eyebrow="Company Admin"
        title="My Company"
        sub="View and edit your company profile, legal identity and corporate settings."
        actions={<ModuleCopilot moduleName="company" />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Employees" value={String(counts?.employees ?? 0)} icon={Users} tone="primary" />
        <Kpi label="Departments" value={String(counts?.departments ?? 0)} icon={Building2} tone="info" />
        <Kpi label="Plants" value={String(counts?.plants ?? 0)} icon={Factory} tone="success" />
        <Kpi label="Products" value={String(counts?.products ?? 0)} icon={CreditCard} tone="warning" />
      </div>

      <Panel title="Company Details">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Company Name *" value={form.name} onChange={(v) => setForm(f => ({ ...f, name: v }))} />
          <Field label="Legal Name" value={form.legal_name} onChange={(v) => setForm(f => ({ ...f, legal_name: v }))} />
          <Field label="Address" value={form.address} onChange={(v) => setForm(f => ({ ...f, address: v }))} />
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Country</Label>
            <Select value={form.country} onValueChange={(v) => setForm(f => ({ ...f, country: v }))}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["US", "CA", "GB", "DE", "FR", "IN", "JP", "CN", "BR", "AU", "SG"].map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Field label="Industry" value={form.industry} onChange={(v) => setForm(f => ({ ...f, industry: v }))} />
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Currency</Label>
            <Select value={form.currency} onValueChange={(v) => setForm(f => ({ ...f, currency: v }))}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["USD", "EUR", "GBP", "INR", "JPY", "CNY", "CAD", "AUD"].map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Timezone</Label>
            <Select value={form.timezone} onValueChange={(v) => setForm(f => ({ ...f, timezone: v }))}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Detroit", "Europe/London", "Europe/Berlin", "Asia/Kolkata", "Asia/Tokyo", "Asia/Singapore"].map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Panel>

      <Panel title="Registration & Tax">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="GST / VAT Number" value={form.gst_number} onChange={(v) => setForm(f => ({ ...f, gst_number: v }))} />
          <Field label="Registration Number" value={form.registration_number} onChange={(v) => setForm(f => ({ ...f, registration_number: v }))} />
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Plan Tier</Label>
            <Select value={form.plan_tier} onValueChange={(v) => setForm(f => ({ ...f, plan_tier: v }))}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["starter", "growth", "enterprise", "custom"].map(t => (
                  <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Invoice QR</Label>
            <div className="flex items-center gap-2 text-sm text-muted-foreground h-10 px-3 border border-input rounded-md">
              Auto-generate QR on invoices at approval stage
            </div>
          </div>
        </div>
      </Panel>

      <div className="flex justify-end">
        <Button
          className="bg-[image:var(--gradient-primary)] shadow-glow"
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending || !form.name}
        >
          {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, icon,
}: { label: string; value: string; onChange: (v: string) => void; icon?: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</div>}
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={icon ? "pl-9 h-10" : "h-10"}
        />
      </div>
    </div>
  );
}
