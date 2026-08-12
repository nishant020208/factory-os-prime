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
  Plus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResourceView, type FormField } from "@/components/resource-view";
import { Kpi, StatusBadge } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { notifyInvoiceGenerated, notifyPaymentStatusChanged } from "@/lib/notifications";
import { getCustomerUserId } from "@/lib/customer-lookup";
import { toast } from "sonner";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
    label: "Total Amount ($)",
    type: "number",
    placeholder: "5000.00",
    required: true,
  },
  { key: "tax_amount", label: "Tax Amount ($)", type: "number", placeholder: "900.00" },
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

function InvoicesPage() {
  const queryClient = useQueryClient();
  const { companyId } = useAuth();
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

  const { data } = useQuery({
    queryKey: ["invoices", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("*, customers!inner(name, contact_email)")
        .order("issue_date", { ascending: false });
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

  // Upsert a qr_codes row and return { token, scanUrl, imageUrl }
  const createOrGetQrToken = async (invoice: any) => {
    // Check for existing active token
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
    const imageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(scanUrl)}`;
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
        .update({
          status: "paid",
          paid_date: new Date().toISOString(),
        })
        .eq("id", invoice.id);

      // Fire payment notification to Customer
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

      // Create payment record
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

  // Attach payment info to each invoice
  const rows = (data ?? []).map((inv: any) => ({
    ...inv,
    payments: payments?.filter((p: any) => p.invoice_id === inv.id) ?? [],
  }));

  return (
    <>
      <ResourceView
        eyebrow="Finance"
        title="Invoices"
        sub="Customer invoices with QR code, AR aging and payment tracking."
        moduleName="invoices"
        rows={rows}
        searchKeys={["invoice_number", "customer_name", "status"]}
        formFields={INVOICE_FORM_FIELDS}
        onSubmit={async (formData) => {
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

          // Fire notification if invoice has a customer
          if (inserted && formData.customer_id) {
            const customerUserId = await getCustomerUserId(formData.customer_id);
            await notifyInvoiceGenerated(
              companyId,
              formData.invoice_number,
              customerUserId ?? "",
              inserted.id,
            );
          }
        }}
        kpis={
          <>
            <Kpi
              label="Total Invoiced"
              value={`$${(total / 1000).toFixed(0)}k`}
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
              <span className="font-mono text-xs">
                ${Number(r.total_amount ?? 0).toLocaleString()}
              </span>
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
            header: "QR",
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
                {r.status === "sent" && (
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

      {/* QR Code Dialog */}
      <Dialog open={qrDialog.open} onOpenChange={(o) => setQrDialog((d) => ({ ...d, open: o }))}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-primary" />
              Invoice QR Code
            </DialogTitle>
          </DialogHeader>
          {qrDialog.invoice && (
            <div className="flex flex-col items-center gap-4 py-2">
              {/* QR image */}
              <div className="bg-white rounded-2xl p-3 shadow-lg">
                {qrDialog.generating ? (
                  <div className="w-48 h-48 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  </div>
                ) : qrDialog.scanUrl ? (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(qrDialog.scanUrl)}`}
                    alt="Invoice QR Code"
                    className="w-48 h-48 rounded-lg"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-xs text-muted-foreground">
                    Failed to generate
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="text-center space-y-1">
                <div className="font-semibold">{qrDialog.invoice.invoice_number}</div>
                <div className="text-xs text-muted-foreground">
                  Status: <StatusBadge status={qrDialog.invoice.status} />
                </div>
              </div>

              {/* Scan URL */}
              {qrDialog.scanUrl && (
                <div className="w-full rounded-lg bg-muted/50 border border-border px-3 py-2 flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground flex-1 truncate font-mono">
                    {qrDialog.scanUrl}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={() => {
                      navigator.clipboard.writeText(qrDialog.scanUrl!);
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

              {/* Actions */}
              <div className="flex gap-2">
                {qrDialog.scanUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(qrDialog.scanUrl!, "_blank")}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    Preview
                  </Button>
                )}
                {qrDialog.scanUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const link = document.createElement("a");
                      link.href = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(qrDialog.scanUrl!)}`;
                      link.download = `qr-${qrDialog.invoice!.invoice_number}.png`;
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
    </>
  );
}
