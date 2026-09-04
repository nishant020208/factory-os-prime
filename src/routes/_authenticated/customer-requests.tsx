import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus, CheckCircle2, XCircle, Clock, Building2, Mail, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
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
import { nearestPlantForLocation } from "@/lib/plant-location";

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
  const { companyId, user } = useAuth();
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; requestId: string }>({
    open: false,
    requestId: "",
  });
  const [rejectReason, setRejectReason] = useState("");

  const { data: requests } = useQuery({
    queryKey: ["customer-requests", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("customer_requests")
          .select("*")
          .eq("company_id", companyId!)
          .order("created_at", { ascending: false })
      ).data ?? [],
    enabled: !!companyId,
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

      // Auto-assign the customer to their nearest plant based on the
      // geocoded location captured at registration (city dictionary +
      // Nominatim fallback). Falls back to the company's primary plant.
      const nearest = await nearestPlantForLocation(
        companyId,
        request.latitude ?? null,
        request.longitude ?? null,
      );

      // Create customer account. `name` is NOT NULL in the customers schema,
      // so we mirror business_name into it (this is the field every customers
      // list/table renders). email is set on both `email` and `contact_email`
      // so downstream lookups and the signup-linking trigger can find the row.
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
        plant_id: nearest?.id ?? null,
        is_active: true,
      });
      if (custError) throw custError;

      // Whitelist the customer's email so they can actually sign in once
      // approved. Same pattern as every other role in the app: whitelist row
      // → user signs up with that email → handle_new_user trigger creates
      // profile + user_roles and links customers.user_id to their auth uid.
      // Upsert on the UNIQUE (email, role) constraint so re-approval or an
      // existing invite never errors.
      const { error: wlError } = await supabase.from("whitelist").upsert(
        {
          email: request.email,
          role: "customer_portal",
          company_id: companyId,
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
        sub="Approve or reject company-specific customer registration requests."
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
              {["Business Name", "Contact", "Email", "Phone", "Status", "Submitted"].map((h) => (
                <TableHead
                  key={h}
                  className="text-[11px] uppercase tracking-wider text-muted-foreground"
                >
                  {h}
                </TableHead>
              ))}
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
                <TableCell className="text-xs">{r.phone || "—"}</TableCell>
                <TableCell>
                  <StatusBadge status={r.status} />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {r.status === "pending" ? (
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
