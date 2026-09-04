import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserPlus,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  Mail,
  Phone,
  MapPin,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useState } from "react";
import { geocodeAddress, nearestPlantForLocation } from "@/lib/plant-location";

export const Route = createFileRoute("/_authenticated/customer-requests")({
  head: () => ({
    meta: [
      { title: "Customer Requests — FactoryOS AI" },
      {
        name: "description",
        content: "Approve or reject company-specific customer registration requests.",
      },
    ],
  }),
  component: CustomerRequestsPage,
});

function CustomerRequestsPage() {
  const queryClient = useQueryClient();
  const { companyId, user, roles, plantId } = useAuth();
  const isCompanyAdmin = roles.includes("company_admin");
  const isPlantAdmin = roles.includes("plant_admin");
  const isRoot = roles.includes("root_super_admin");
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; requestId: string }>({
    open: false,
    requestId: "",
  });
  const [rejectReason, setRejectReason] = useState("");
  // Invite-customer dialog (like whitelist invite)
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    business_name: "",
    contact_person: "",
    email: "",
    phone: "",
    city: "",
    address: "",
  });

  const { data: plants } = useQuery({
    queryKey: ["customer-requests-plants", companyId],
    queryFn: async () =>
      (await supabase.from("plants").select("id, name, code").eq("company_id", companyId!))
        .data ?? [],
    enabled: !!companyId,
  });
  const plantName = (id: string | null) =>
    id ? (plants?.find((p) => p.id === id)?.name ?? id) : "—";

  // Company Admin sees every request for the company; Plant Admin sees only
  // requests already tagged to their plant (RLS also enforces this, the
  // filter here keeps the picker/approve paths unambiguous).
  const { data: requests } = useQuery({
    queryKey: ["customer-requests", companyId, isPlantAdmin ? plantId : "all"],
    queryFn: async () => {
      let q = supabase
        .from("customer_requests")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (isPlantAdmin && plantId) q = q.eq("plant_id", plantId);
      return (await q).data ?? [];
    },
    enabled: !!companyId,
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Not authenticated");
      if (!inviteForm.email || !inviteForm.business_name) {
        throw new Error("Business name and email are required");
      }
      // Resolve the plant: Plant Admin → their own plant; Company Admin →
      // nearest plant from the invite's location (falls back to primary).
      let plant_id: string | null = null;
      if (isPlantAdmin && plantId) {
        plant_id = plantId;
      } else {
        const geoQuery = [inviteForm.address, inviteForm.city].filter(Boolean).join(", ");
        let lat: number | null = null;
        let lng: number | null = null;
        if (geoQuery) {
          const coords = await geocodeAddress(geoQuery);
          lat = coords?.lat ?? null;
          lng = coords?.lng ?? null;
        }
        const nearest = await nearestPlantForLocation(companyId, lat, lng);
        plant_id = nearest?.id ?? null;
      }

      const { error } = await supabase.from("customer_requests").insert({
        company_id: companyId,
        business_name: inviteForm.business_name,
        contact_person: inviteForm.contact_person || inviteForm.business_name,
        email: inviteForm.email,
        phone: inviteForm.phone || null,
        address: inviteForm.address || null,
        city: inviteForm.city || null,
        plant_id,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Customer invite created — pending approval");
      queryClient.invalidateQueries({ queryKey: ["customer-requests"] });
      setInviteOpen(false);
      setInviteForm({
        business_name: "",
        contact_person: "",
        email: "",
        phone: "",
        city: "",
        address: "",
      });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      if (!companyId || !user) throw new Error("Not authenticated");
      const cid = companyId;
      const request = requests?.find((r: any) => r.id === requestId);
      if (!request) throw new Error("Request not found");

      // Update status
      const { error: updateError } = await supabase
        .from("customer_requests")
        .update({ status: "approved", reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq("id", requestId);
      if (updateError) throw updateError;

      // The customer's plant: a Plant Admin surfaces only their own plant's
      // requests, so the stored nearest plant IS their plant. For Company
      // Admin, re-resolve nearest so an untagged request still lands right.
      let plantIdForCust = request.plant_id ?? null;
      if (!plantIdForCust) {
        const nearest = await nearestPlantForLocation(
          cid,
          request.latitude ?? null,
          request.longitude ?? null,
        );
        plantIdForCust = nearest?.id ?? null;
      }

      // Create customer account.
      const { error: custError } = await supabase.from("customers").insert({
        company_id: companyId,
        name: request.business_name,
        business_name: request.business_name,
        contact_person: request.contact_person,
        email: request.email,
        contact_email: request.email,
        phone: request.phone || null,
        gst_number: request.gst_number || null,
        billing_address: request.address || null,
        latitude: request.latitude ?? null,
        longitude: request.longitude ?? null,
        plant_id: plantIdForCust,
        is_active: true,
      });
      if (custError) throw custError;

      // Whitelist the customer's email. Plant Admin's row must carry their
      // plant (RLS: plant admins may only whitelist customer_portal at their
      // plant); Company Admin rows stay company-level (null plant).
      const { error: wlError } = await supabase.from("whitelist").upsert(
        {
          email: request.email,
          role: "customer_portal",
          company_id: companyId,
          plant_id: isPlantAdmin ? plantIdForCust : null,
          status: "pending",
        },
        { onConflict: "email,role", ignoreDuplicates: true },
      );
      if (wlError) throw wlError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-requests"] });
      toast.success("Customer approved and account created");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("customer_requests")
        .update({
          status: "rejected",
          rejection_reason: reason,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-requests"] });
      toast.success("Customer request rejected");
      setRejectDialog({ open: false, requestId: "" });
      setRejectReason("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const pending = (requests ?? []).filter((r: any) => r.status === "pending").length;
  const approved = (requests ?? []).filter((r: any) => r.status === "approved").length;

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="Customers"
        title="Customer Requests"
        sub={
          isPlantAdmin
            ? "Customers requesting access to your plant — approve to grant order access."
            : "Approve or reject company-specific customer registration requests."
        }
        actions={
          (isCompanyAdmin || isPlantAdmin || isRoot) && (
            <Button
              variant="outline"
              onClick={() => setInviteOpen(true)}
              className="border-primary/30 text-primary"
            >
              <UserPlus className="h-4 w-4 mr-1.5" />
              Invite Customer
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <Kpi
          label="Total Requests"
          value={String(requests?.length ?? 0)}
          icon={UserPlus}
          tone="primary"
        />
        <Kpi label="Pending" value={String(pending)} icon={Clock} tone="warning" />
        <Kpi label="Approved" value={String(approved)} icon={CheckCircle2} tone="success" />
        <Kpi
          label="Rejected"
          value={String((requests ?? []).filter((r: any) => r.status === "rejected").length)}
          icon={XCircle}
          tone="destructive"
        />
      </div>

      <Panel title={`${requests?.length ?? 0} customer requests`}>
        <Table>
          <TableHeader>
            <TableRow className="border-white/5">
              {["Business Name", "Contact", "Email", "Nearest Plant", "Status", "Submitted"].map(
                (h) => (
                  <TableHead
                    key={h}
                    className="text-[11px] uppercase tracking-wider text-muted-foreground"
                  >
                    {h}
                  </TableHead>
                ),
              )}
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(requests ?? []).map((r: any) => (
              <TableRow key={r.id} className="border-white/5">
                <TableCell className="font-medium">{r.business_name}</TableCell>
                <TableCell>{r.contact_person}</TableCell>
                <TableCell className="text-xs">
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {r.email}
                  </span>
                </TableCell>
                <TableCell className="text-xs">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {plantName(r.plant_id)}
                  </span>
                </TableCell>
                <TableCell>
                  <StatusBadge status={r.status} />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {r.status === "pending" && (isCompanyAdmin || isPlantAdmin || isRoot) ? (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => approveMutation.mutate(r.id)}
                        disabled={approveMutation.isPending}
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs text-destructive"
                        onClick={() => setRejectDialog({ open: true, requestId: r.id })}
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {r.rejection_reason || "—"}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>

      {/* Invite Customer Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Invite Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Business Name *</Label>
              <Input
                value={inviteForm.business_name}
                onChange={(e) => setInviteForm((f) => ({ ...f, business_name: e.target.value }))}
                placeholder="e.g. Kochi Home Living"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Contact Email *</Label>
              <Input
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="proc@buyer.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Contact Person</Label>
              <Input
                value={inviteForm.contact_person}
                onChange={(e) => setInviteForm((f) => ({ ...f, contact_person: e.target.value }))}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Phone</Label>
              <Input
                value={inviteForm.phone}
                onChange={(e) => setInviteForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+91 98765 43210"
              />
            </div>
            {!isPlantAdmin && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">City / Location</Label>
                  <Input
                    value={inviteForm.city}
                    onChange={(e) => setInviteForm((f) => ({ ...f, city: e.target.value }))}
                    placeholder="e.g. Kochi"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Shop / Business Address</Label>
                  <Input
                    value={inviteForm.address}
                    onChange={(e) => setInviteForm((f) => ({ ...f, address: e.target.value }))}
                    placeholder="Street address"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  The nearest plant is chosen automatically from this location.
                </p>
              </>
            )}
            {isPlantAdmin && (
              <p className="text-xs text-muted-foreground">
                This invite is tagged to your plant ({plantName(plantId)}). Once approved, the
                customer places orders that flow to your plant.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => inviteMutation.mutate()}
              disabled={inviteMutation.isPending || !inviteForm.business_name || !inviteForm.email}
            >
              {inviteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Create Invite"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog
        open={rejectDialog.open}
        onOpenChange={(o) => setRejectDialog((d) => ({ ...d, open: o }))}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Reject Customer Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs text-muted-foreground">Reason for rejection *</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Insufficient verification, duplicate request..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialog({ open: false, requestId: "" })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                rejectMutation.mutate({ requestId: rejectDialog.requestId, reason: rejectReason })
              }
              disabled={!rejectReason.trim()}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}