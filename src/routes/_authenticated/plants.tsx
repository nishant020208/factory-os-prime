import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Factory, MapPin, Users, Cog, ShieldAlert, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResourceView, type FormField } from "@/components/resource-view";
import { Kpi, StatusBadge } from "@/components/ui-parts";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/plants")({
  head: () => ({
    meta: [
      { title: "Plants — FactoryOS AI" },
      { name: "description", content: "All manufacturing plants belonging to your company." },
    ],
  }),
  component: PlantsPage,
});

const PLANT_FORM_FIELDS: FormField[] = [
  {
    key: "name",
    label: "Plant Name",
    type: "text",
    placeholder: "Detroit Assembly Plant",
    required: true,
  },
  { key: "code", label: "Plant Code", type: "text", placeholder: "DET-01", required: true },
  { key: "city", label: "City", type: "text", placeholder: "Detroit" },
  { key: "country", label: "Country", type: "text", placeholder: "United States" },
  { key: "address", label: "Address", type: "text", placeholder: "123 Industrial Blvd" },
  {
    key: "latitude",
    label: "Latitude",
    type: "text",
    placeholder: "42.3314 (optional, for nearest-plant routing)",
  },
  {
    key: "longitude",
    label: "Longitude",
    type: "text",
    placeholder: "-83.0458 (optional, for nearest-plant routing)",
  },
  {
    key: "status",
    label: "Status",
    type: "select",
    defaultValue: "active",
    options: [
      { value: "active", label: "Active" },
      { value: "inactive", label: "Inactive" },
      { value: "maintenance", label: "Under Maintenance" },
    ],
  },
];

function PlantsPage() {
  const queryClient = useQueryClient();
  const { companyId } = useAuth();
  const [newPlant, setNewPlant] = useState<{ id: string; name: string } | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [invitingAdmin, setInvitingAdmin] = useState(false);

  const { data } = useQuery({
    queryKey: ["plants", companyId],
    queryFn: async () => (await supabase.from("plants").select("*").order("name")).data ?? [],
  });

  const { data: machines } = useQuery({
    queryKey: ["plants-machines"],
    queryFn: async () => (await supabase.from("machines").select("plant_id, status")).data ?? [],
  });

  // plant_admin whitelist rows → which plants already have an administrator
  const { data: plantAdmins } = useQuery({
    queryKey: ["plants-admins", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("whitelist")
          .select("plant_id")
          .eq("company_id", companyId!)
          .eq("role", "plant_admin")
      ).data ?? [],
    enabled: !!companyId,
  });
  const plantAdminIds = new Set(
    (plantAdmins ?? []).map((w: any) => w.plant_id).filter(Boolean),
  );

  const createMutation = useMutation({
    mutationFn: async (formData: Record<string, string>) => {
      const lat = formData.latitude ? parseFloat(formData.latitude) : null;
      const lng = formData.longitude ? parseFloat(formData.longitude) : null;
      const { data, error } = await supabase
        .from("plants")
        .insert({
          company_id: companyId!,
          name: formData.name,
          code: formData.code,
          city: formData.city || null,
          country: formData.country || null,
          address: formData.address || null,
          latitude: lat && !Number.isNaN(lat) ? lat : null,
          longitude: lng && !Number.isNaN(lng) ? lng : null,
          status: formData.status || "active",
        })
        .select("id, name")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (plant) => {
      queryClient.invalidateQueries({ queryKey: ["plants"] });
      toast.success("Plant created");
      // Section 3: prompt to whitelist a Plant Admin for this new plant.
      if (plant?.id) setNewPlant({ id: plant.id, name: plant.name });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const invitePlantAdmin = useMutation({
    mutationFn: async () => {
      if (!newPlant) throw new Error("No plant selected");
      const { error } = await supabase.from("whitelist").insert({
        email: adminEmail,
        role: "plant_admin",
        company_id: companyId!,
        plant_id: newPlant.id,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Plant Admin invite sent to ${adminEmail}`);
      queryClient.invalidateQueries({ queryKey: ["plants-admins"] });
      setNewPlant(null);
      setAdminEmail("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data: d }: { id: string; data: Record<string, string> }) => {
      const lat = d.latitude ? parseFloat(d.latitude) : null;
      const lng = d.longitude ? parseFloat(d.longitude) : null;
      const { error } = await supabase
        .from("plants")
        .update({
          name: d.name,
          code: d.code,
          city: d.city || null,
          country: d.country || null,
          address: d.address || null,
          latitude: lat && !Number.isNaN(lat) ? lat : null,
          longitude: lng && !Number.isNaN(lng) ? lng : null,
          status: d.status || "active",
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plants"] });
      toast.success("Plant updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plants"] });
      toast.success("Plant deleted");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const activePlants = data?.filter((p: any) => p.status === "active").length ?? 0;
  const totalMachines = machines?.length ?? 0;

  return (
    <>
      <ResourceView
        eyebrow="Infrastructure"
      title="Plants"
      sub="Manufacturing facilities, locations and operational status."
      moduleName="plants"
      rows={data}
      searchKeys={["name", "code", "city", "country"]}
      formFields={PLANT_FORM_FIELDS}
      onSubmit={async (formData, editingRow) => {
        if (editingRow) await updateMutation.mutateAsync({ id: editingRow.id, data: formData });
        else await createMutation.mutateAsync(formData);
      }}
      onDelete={(row) => deleteMutation.mutateAsync(row.id)}
      kpis={
        <>
          <Kpi
            label="Total Plants"
            value={String(data?.length ?? 0)}
            icon={Factory}
            tone="primary"
          />
          <Kpi label="Active" value={String(activePlants)} icon={MapPin} tone="success" />
          <Kpi label="Total Machines" value={String(totalMachines)} icon={Cog} tone="info" />
          <Kpi
            label="Countries"
            value={String(new Set(data?.map((p: any) => p.country).filter(Boolean)).size)}
            icon={MapPin}
            tone="warning"
          />
        </>
      }
      columns={[
        {
          key: "code",
          header: "Code",
          render: (r) => <span className="font-mono text-xs">{r.code}</span>,
        },
        {
          key: "name",
          header: "Name",
          render: (r) => <span className="font-medium">{r.name}</span>,
        },
        { key: "city", header: "City", hideOnMobile: true, render: (r) => r.city ?? "—" },
        { key: "country", header: "Country", hideOnMobile: true, render: (r) => r.country ?? "—" },
        {
          key: "admin",
          header: "Plant Admin",
          render: (r: any) =>
            plantAdminIds.has(r.id) ? (
              <span className="inline-flex items-center gap-1 text-xs text-success">
                <ShieldAlert className="h-3 w-3" /> Assigned
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                <ShieldAlert className="h-3 w-3" /> No Plant Admin assigned yet
              </span>
            ),
        },
        { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
      ]}
      />

      {/* Section 3: after creating a plant, prompt to whitelist its Plant Admin */}
      <Dialog open={!!newPlant} onOpenChange={(o) => !o && setNewPlant(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Plant created — whitelist an administrator</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{newPlant?.name}</strong> needs a Plant Admin
              to manage its staff and orders. Invite one now — they'll be assigned to this plant
              exclusively.
            </p>
            <div className="space-y-1.5">
              <Label>Plant Admin email</Label>
              <Input
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="plant.admin@company.com"
                type="email"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewPlant(null)}>
              Later
            </Button>
            <Button
              className="bg-[image:var(--gradient-primary)]"
              disabled={!adminEmail || invitingAdmin}
              onClick={() => {
                setInvitingAdmin(true);
                invitePlantAdmin.mutate(undefined, {
                  onSettled: () => setInvitingAdmin(false),
                });
              }}
            >
              {invitingAdmin ? <Loader2 className="h-4 w-4 animate-spin" /> : "Invite Plant Admin"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
