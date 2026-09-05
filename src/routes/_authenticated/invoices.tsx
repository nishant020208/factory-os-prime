import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Receipt,
  Download,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertTriangle,
  QrCode,
  Eye,
  Copy,
  Loader2,
  FileDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResourceView, type FormField } from "@/components/resource-view";
import { Kpi, StatusBadge, PageHeader, Panel } from "@/components/ui-parts";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { fmtMoney, fmtMoneyK } from "@/lib/currency";
import { notifyInvoiceGenerated, notifyPaymentStatusChanged } from "@/lib/notifications";
import { getCustomerUserId } from "@/lib/customer-lookup";
import { toast } from "sonner";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/invoices")({
  head: () => ({
    meta: [
      { title: "Invoices — FactoryOS AI" },
      {
        name: "description",
        content: "Customer invoices, AR aging, QR code payments and reminders.",
      },
    ],
  }),
  component: InvoicesPage,
});

const INVOICE_FORM_FIELDS: FormField[] = [
  {
    key: "invoice_number",
    label: "Invoice Number",
    type: "text",
    placeholder: "INV-2026-0001",
    required: true,
  },
  {
    key: "total_amount",
    label: "Total Amount",
    type: "number",
    placeholder: "5000.00",
    required: true,
  },
  { key: "tax_amount", label: "Tax Amount", type: "number", placeholder: "900.00" },
  { key: "due_date", label: "Due Date", type: "date" },
  {
    key: "status",
    label: "Status",
    type: "select",
    defaultValue: "draft",
    options: [
      { value: "draft", label: "Draft" },
      { value: "sent", label: "Sent" },
      { value: "paid", label: "Paid" },
      { value: "overdue", label: "Overdue" },
      { value: "cancelled", label: "Cancelled" },
    ],
  },
];

/** Determine status badge tone for the portal‐style invoice card */
function invoiceTone(status: string) {
  if (status === "paid") return "text-success border-success/30 bg-success/10";
  if (status === "overdue") return "text-destructive border-destructive/30 bg-destructive/10";
  if (status === "sent") return "text-warning border-warning/30 bg-warning/10";
  return "text-muted-foreground border-white/10 bg-white/5";
}

function InvoicesPage() {
  const queryClient = useQueryClient();
  const { companyId, roles, user } = useAuth();
  const isCustomer = roles.includes("customer_portal");
  const isAuditor = roles.includes("auditor");

  const [qrDialog, setQrDialog] = useState<{
    open: boolean;
    invoice: any | null;
    scanUrl: string | null;
    generating: boolean;
  }>({
    open: false,
    invoice: null,
    scanUrl: null,
    generating: false,
  });

  const [genDialog, setGenDialog] = useState<{ open: boolean; order: any | null; gstPercent: string }>({
    open: false,
    order: null,
    gstPercent: "18",
  });

  // ── Data fetch: admin gets all invoices; customer gets only their own ─────
  const { data } = useQuery({
    queryKey: ["invoices", companyId, isCustomer, user?.id],
    queryFn: async () => {
      let query = supabase
        .from("invoices")
        .select("*, customers!inner(name, contact_email, user_id)")
        .order("issue_date", { ascending: false });

      // Customer portal: filter to only invoices linked to this user's customer record
      if (isCustomer && user?.id) {
        query = supabase
          .from("invoices")
          .select("*, customers!inner(name, contact_email, user_id)")
          .eq("customers.user_id", user.id)
          .order("issue_date", { ascending: false });
      }

      const { data } = await query;
      return (data ?? []).map((inv: any) => ({
        ...inv,
        customer_name: inv.customers?.name ?? "—",
      }));
    },
  });

  const { data: payments } = useQuery({
    queryKey: ["invoice-payments", companyId],
    queryFn: async () =>
      (await supabase.from("payments").select("*").order("paid_at", { ascending: false })).data ??
      [],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { error } = await supabase.from("invoices").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // ── QR helpers ─────────────────────────────────────────────────────────────
  const createOrGetQrToken = async (invoice: any) => {
    const { data: existing } = await supabase
      .from("qr_codes")
      .select("token")
      .eq("entity_id", invoice.id)
      .eq("entity_type", "invoice")
      .eq("status", "active")
      .maybeSingle();

    let token: string;
    if (existing?.token) {
      token = existing.token;
    } else {
      const { data: inserted, error } = await supabase
        .from("qr_codes")
        .insert({
          company_id: invoice.company_id ?? companyId,
          entity_type: "invoice",
          entity_id: invoice.id,
          type: "invoice",
          status: "active",
          qr_data: invoice.id,
          label: invoice.invoice_number,
          sub_label: `Status: ${invoice.status}`,
        })
        .select("token")
        .single();
      if (error) throw error;
      token = inserted.token;
    }

    const scanUrl = `${window.location.origin}/scan?t=${token}`;
    const imageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=0&data=${encodeURIComponent(scanUrl)}`;
    return { token, scanUrl, imageUrl };
  };

  const openQrDialog = async (invoice: any) => {
    setQrDialog({ open: true, invoice, scanUrl: null, generating: true });
    try {
      const { scanUrl } = await createOrGetQrToken(invoice);
      setQrDialog((d) => ({ ...d, scanUrl, generating: false }));
    } catch (err: any) {
      toast.error("Failed to generate QR: " + err.message);
      setQrDialog((d) => ({ ...d, generating: false }));
    }
  };

  const handleMarkPaid = async (invoice: any) => {
    try {
      await supabase
        .from("invoices")
        .update({ status: "paid", paid_date: new Date().toISOString() })
        .eq("id", invoice.id);

      if (invoice.customer_id && companyId) {
        const customerUserId = await getCustomerUserId(invoice.customer_id);
        await notifyPaymentStatusChanged(
          companyId,
          invoice.invoice_number,
          customerUserId ?? "",
          "paid",
          invoice.id,
        );
      }

      await supabase.from("payments").insert({
        company_id: companyId!,
        payment_number: `PAY-${Date.now().toString().slice(-6)}`,
        invoice_id: invoice.id,
        customer_id: invoice.customer_id,
        amount: invoice.total_amount,
        method: "bank_transfer",
        status: "completed",
        paid_at: new Date().toISOString(),
      });

      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-payments"] });
      toast.success("Invoice marked as paid");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Orders ready for a final invoice (real balance_due from customer_orders).
  const { data: invoicableOrders } = useQuery({
    queryKey: ["invoicable-orders", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("customer_orders")
          .select("*, customers!left(business_name, name)")
          .eq("company_id", companyId!)
          .in("status", ["advance_paid", "in_production", "dispatch_ready", "delivered", "completed"])
          .gt("balance_due", 0)
          .order("created_at", { ascending: false })
      ).data ?? [],
    enabled: !!companyId && !isCustomer,
  });

  const generateFinalMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !genDialog.order) throw new Error("No order selected");
      const order = genDialog.order;
      const balance = Number(order.balance_due ?? 0);
      const gst = (parseFloat(genDialog.gstPercent) || 0) / 100;
      const tax = Math.round(balance * gst * 100) / 100;
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String((data?.length ?? 0) + 1).padStart(4, "0")}`;
      const { data: inserted, error } = await supabase
        .from("invoices")
        .insert({
          company_id: companyId,
          customer_id: order.customer_id,
          invoice_number: invoiceNumber,
          total_amount: balance,
          tax_amount: tax,
          status: "sent",
          issue_date: new Date().toISOString(),
          due_date: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
        })
        .select("id")
        .single();
      if (error) throw error;
      const customerUserId = await getCustomerUserId(order.customer_id);
      await notifyInvoiceGenerated(companyId, invoiceNumber, customerUserId ?? "", inserted.id);
      return invoiceNumber;
    },
    onSuccess: (invNum) => {
      toast.success(`Final invoice ${invNum} generated — customer notified`);
      setGenDialog({ open: false, order: null, gstPercent: "18" });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoicable-orders"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const total = (data ?? []).reduce((s: number, inv: any) => s + Number(inv.total_amount ?? 0), 0);
  const paid = (data ?? []).filter((inv: any) => inv.status === "paid").length;
  const outstanding = (data ?? []).filter(
    (inv: any) => inv.status === "sent" || inv.status === "overdue",
  ).length;
  const overdue = (data ?? []).filter((inv: any) => {
    if (inv.status === "paid") return false;
    if (!inv.due_date) return false;
    return new Date(inv.due_date) < new Date();
  }).length;

  const rows = (data ?? []).map((inv: any) => ({
    ...inv,
    payments: payments?.filter((p: any) => p.invoice_id === inv.id) ?? [],
  }));

  // ── Customer Portal view: clean card-based read-only layout ───────────────
  if (isCustomer) {
    return (
      <div className="max-w-[900px] mx-auto">
        <ModuleStatusBar moduleName="invoices" />
        <PageHeader
          eyebrow="My Account"
          title="My Invoices"
          sub="View and download your invoices. Contact your account manager for billing queries."
          actions={<ModuleCopilot moduleName="invoices" />}
        />

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <Kpi
            label="Total Billed"
            value={fmtMoneyK(total)}
            icon={Receipt}
            tone="primary"
          />
          <Kpi label="Paid" value={String(paid)} icon={CheckCircle2} tone="success" />
          <Kpi label="Outstanding" value={String(outstanding)} icon={Clock} tone="warning" />
        </div>

        {/* Invoice list */}
        {rows.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center text-muted-foreground text-sm">
            No invoices found for your account yet.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((inv: any) => (
              <div
                key={inv.id}
                className="glass rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-card"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 grid place-items-center shrink-0">
                    <Receipt className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{inv.invoice_number}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                      {inv.issue_date && (
                        <span>Issued {new Date(inv.issue_date).toLocaleDateString()}</span>
                      )}
                      {inv.due_date && (
                        <>
                          <span>·</span>
                          <span>Due {new Date(inv.due_date).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="text-right">
                    <div className="font-mono font-semibold text-sm">
                      {fmtMoney(inv.total_amount)}
                    </div>
                    {inv.tax_amount > 0 && (
                      <div className="text-[10px] text-muted-foreground">
                        +{fmtMoney(inv.tax_amount)} tax
                      </div>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-medium capitalize ${invoiceTone(inv.status)}`}
                  >
                    {inv.status}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    title="View QR code"
                    onClick={() => openQrDialog(inv)}
                  >
                    <QrCode className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* QR Dialog (shared below) */}
        <QrCodeDialog
          dialog={qrDialog}
          onOpenChange={(o) => setQrDialog((d) => ({ ...d, open: o }))}
        />
      </div>
    );
  }

  // ── Admin / Finance view: full ResourceView with QR + Mark Paid ───────────
  return (
    <>
      {!isAuditor && (invoicableOrders ?? []).length > 0 && (
        <div className="mb-4 glass rounded-2xl p-4 border-white/5">
          <div className="text-sm font-medium mb-2 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            Orders Ready for Final Invoice
          </div>
          <div className="divide-y divide-white/5">
            {(invoicableOrders ?? []).map((o: any) => (
              <div key={o.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{o.order_number}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {o.customers?.business_name ?? o.customers?.name ?? "—"} · Balance {fmtMoney(o.balance_due)}
                  </div>
                </div>
                <Button
                  size="sm"
                  className="h-7 text-xs bg-[image:var(--gradient-primary)]"
                  onClick={() => setGenDialog({ open: true, order: o, gstPercent: "18" })}
                >
                  <FileDown className="h-3.5 w-3.5 mr-1" />
                  Generate Final Invoice
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
      <ResourceView
        eyebrow="Finance"
        title="Invoices"
        sub="Customer invoices with QR code, AR aging and payment tracking."
        moduleName="invoices"
        rows={rows}
        searchKeys={["invoice_number", "customer_name", "status"]}
        formFields={isAuditor ? undefined : INVOICE_FORM_FIELDS}
        onSubmit={isAuditor ? undefined : async (formData) => {
          if (!companyId) return;
          const { data: inserted, error } = await supabase
            .from("invoices")
            .insert({
              company_id: companyId,
              invoice_number: formData.invoice_number,
              total_amount: parseFloat(formData.total_amount) || 0,
              tax_amount: parseFloat(formData.tax_amount) || 0,
              due_date: formData.due_date || null,
              status: formData.status || "draft",
              issue_date: new Date().toISOString(),
            })
            .select("id")
            .single();
          if (error) throw error;

          if (inserted) {
            // Auto-generate QR code for the newly created invoice
            try {
              await supabase.from("qr_codes").insert({
                company_id: companyId,
                entity_type: "invoice",
                entity_id: inserted.id,
                type: "invoice",
                status: "active",
                qr_data: inserted.id,
                label: formData.invoice_number,
                sub_label: `Status: ${formData.status || "draft"}`,
              });
            } catch (qrError) {
              console.error("Failed to auto-generate QR code for invoice:", qrError);
            }

            if (formData.customer_id) {
              try {
                const customerUserId = await getCustomerUserId(formData.customer_id);
                await notifyInvoiceGenerated(
                  companyId,
                  formData.invoice_number,
                  customerUserId ?? "",
                  inserted.id,
                );
              } catch (notifyErr) {
                console.error("Failed to notify customer for invoice:", notifyErr);
              }
            }
          }
        }}
        kpis={
          <>
            <Kpi
              label="Total Invoiced"
              value={fmtMoneyK(total)}
              icon={Receipt}
              tone="primary"
            />
            <Kpi label="Paid" value={String(paid)} icon={CheckCircle2} tone="success" />
            <Kpi label="Outstanding" value={String(outstanding)} icon={Clock} tone="warning" />
            {overdue > 0 && (
              <Kpi
                label="Overdue"
                value={String(overdue)}
                icon={AlertTriangle}
                tone="destructive"
              />
            )}
            <Kpi
              label="Total Payments"
              value={String(payments?.length ?? 0)}
              icon={DollarSign}
              tone="info"
            />
          </>
        }
        columns={[
          {
            key: "invoice_number",
            header: "Invoice #",
            render: (r: any) => <span className="font-medium">{r.invoice_number}</span>,
          },
          {
            key: "customer_name",
            header: "Customer",
            render: (r: any) => <span className="text-sm">{r.customer_name}</span>,
          },
          {
            key: "total_amount",
            header: "Amount",
            render: (r: any) => (
              <span className="font-mono text-xs">{fmtMoney(r.total_amount)}</span>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (r: any) => <StatusBadge status={r.status} />,
          },
          {
            key: "due_date",
            header: "Due",
            hideOnMobile: true,
            render: (r: any) => (r.due_date ? new Date(r.due_date).toLocaleDateString() : "—"),
          },
          {
            key: "paid_date",
            header: "Paid",
            hideOnMobile: true,
            render: (r: any) => (r.paid_date ? new Date(r.paid_date).toLocaleDateString() : "—"),
          },
          {
            key: "qr",
            header: "Actions",
            hideOnMobile: true,
            render: (r: any) => (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  title="View scannable QR code"
                  onClick={(e) => {
                    e.stopPropagation();
                    openQrDialog(r);
                  }}
                >
                  <QrCode className="h-3.5 w-3.5" />
                </Button>
                {r.status === "sent" && !isAuditor && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-success"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMarkPaid(r);
                    }}
                  >
                    <DollarSign className="h-3 w-3 mr-1" />
                    Mark Paid
                  </Button>
                )}
              </div>
            ),
          },
        ]}
      />

      <QrCodeDialog
        dialog={qrDialog}
        onOpenChange={(o) => setQrDialog((d) => ({ ...d, open: o }))}
      />

      {/* Generate final invoice dialog — real balance_due from the order */}
      <Dialog open={genDialog.open} onOpenChange={(o) => setGenDialog((d) => ({ ...d, open: o }))}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Generate Final Invoice</DialogTitle>
          </DialogHeader>
          {genDialog.order && (
            <div className="space-y-4 py-2">
              <div className="text-sm">
                <span className="text-muted-foreground">Order:</span>{" "}
                {genDialog.order.order_number} —{" "}
                {genDialog.order.customers?.business_name ?? genDialog.order.customers?.name ?? ""}
              </div>
              <div className="rounded-xl bg-card/60 border border-white/5 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Balance Due (real)</span>
                  <span className="font-medium">{fmtMoney(genDialog.order.balance_due)}</span>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">GST %</Label>
                  <input
                    type="number"
                    value={genDialog.gstPercent}
                    onChange={(e) => setGenDialog((d) => ({ ...d, gstPercent: e.target.value }))}
                    className="flex h-8 w-24 rounded-md border border-input bg-transparent px-2 text-xs"
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">GST Amount</span>
                  <span className="font-medium text-primary">
                    $
                    {((Number(genDialog.order.balance_due ?? 0) * (parseFloat(genDialog.gstPercent) || 0)) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="border-t border-white/5 pt-2 flex justify-between">
                  <span className="font-medium">Total (excl. GST)</span>
                  <span className="font-medium">{fmtMoney(genDialog.order.balance_due)}</span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Creates a real invoice row, embeds its QR, and notifies the customer (to_user).
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenDialog({ open: false, order: null, gstPercent: "18" })}>
              Cancel
            </Button>
            <Button
              className="bg-[image:var(--gradient-primary)]"
              onClick={() => generateFinalMutation.mutate()}
              disabled={generateFinalMutation.isPending}
            >
              Generate Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Shared QR Code Dialog ────────────────────────────────────────────────────
function QrCodeDialog({
  dialog,
  onOpenChange,
}: {
  dialog: { open: boolean; invoice: any | null; scanUrl: string | null; generating: boolean };
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={dialog.open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-4 w-4 text-primary" />
            Invoice QR Code
          </DialogTitle>
        </DialogHeader>
        {dialog.invoice && (
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="bg-white rounded-2xl p-4 shadow-lg flex items-center justify-center">
              {dialog.generating ? (
                <div className="w-48 h-48 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
              ) : dialog.scanUrl ? (
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=0&data=${encodeURIComponent(dialog.scanUrl)}`}
                  alt="Invoice QR Code"
                  className="w-48 h-48 rounded-lg object-contain"
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-xs text-muted-foreground text-center p-4">
                  QR code not available for this invoice
                </div>
              )}
            </div>

            <div className="text-center space-y-1">
              <div className="font-semibold">{dialog.invoice.invoice_number}</div>
              <div className="text-xs text-muted-foreground">
                Status: <StatusBadge status={dialog.invoice.status} />
              </div>
            </div>

            {dialog.scanUrl && (
              <div className="w-full rounded-lg bg-muted/50 border border-border px-3 py-2 flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground flex-1 truncate font-mono">
                  {dialog.scanUrl}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 shrink-0"
                  onClick={() => {
                    navigator.clipboard.writeText(dialog.scanUrl!);
                    toast.success("Scan link copied!");
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            )}

            <p className="text-[10px] text-muted-foreground text-center max-w-xs">
              Scan with any phone camera — no app needed. Links to the public FactoryOS
              verification page.
            </p>

            <div className="flex gap-2">
              {dialog.scanUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(dialog.scanUrl!, "_blank")}
                >
                  <Eye className="h-3.5 w-3.5 mr-1" />
                  Preview
                </Button>
              )}
              {dialog.scanUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=0&data=${encodeURIComponent(dialog.scanUrl!)}`;
                    link.download = `qr-${dialog.invoice!.invoice_number}.png`;
                    link.click();
                    toast.success("QR code downloaded");
                  }}
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Download
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
