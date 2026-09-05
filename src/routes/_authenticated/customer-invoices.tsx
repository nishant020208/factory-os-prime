import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Receipt,
  Download,
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
import { Kpi, StatusBadge, PageHeader } from "@/components/ui-parts";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { fmtMoney, fmtMoneyK } from "@/lib/currency";
import { toast } from "sonner";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/customer-invoices")({
  head: () => ({
    meta: [
      { title: "My Invoices — FactoryOS AI" },
      { name: "description", content: "Outstanding and paid invoices for your account" },
    ],
  }),
  component: CustomerInvoicesPage,
});

function invoiceTone(status: string) {
  if (status === "paid") return "text-success border-success/30 bg-success/10";
  if (status === "overdue") return "text-destructive border-destructive/30 bg-destructive/10";
  if (status === "sent") return "text-warning border-warning/30 bg-warning/10";
  return "text-muted-foreground border-white/10 bg-white/5";
}

function CustomerInvoicesPage() {
  const { user } = useAuth();
  const [qrDialog, setQrDialog] = useState<{
    open: boolean;
    invoice: any | null;
    scanUrl: string | null;
    generating: boolean;
  }>({ open: false, invoice: null, scanUrl: null, generating: false });

  // Resolve this customer's customer_id (by user_id linkage, then email fallback)
  const { data: myCustomerId } = useQuery({
    queryKey: ["my-customer-id-invoices", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", user.id)
        .single();
      if (profile?.email) {
        const { data: matched } = await supabase
          .from("customers")
          .select("id")
          .or(`contact_email.eq.${profile.email},user_id.eq.${user.id}`)
          .maybeSingle();
        return matched?.id ?? null;
      }
      return null;
    },
    enabled: !!user,
  });

  // Read-only: invoices scoped to THIS customer only
  const { data: invoices } = useQuery({
    queryKey: ["customer-invoices", myCustomerId],
    queryFn: async () => {
      if (!myCustomerId) return [];
      const { data } = await supabase
        .from("invoices")
        .select("*")
        .eq("customer_id", myCustomerId)
        .order("issue_date", { ascending: false });
      return data ?? [];
    },
    enabled: !!myCustomerId,
  });

  const rows = invoices ?? [];
  const total = rows.reduce((s: number, inv: any) => s + Number(inv.total_amount ?? 0), 0);
  const paid = rows.filter((inv: any) => inv.status === "paid").length;
  const outstanding = rows.filter(
    (inv: any) => inv.status === "sent" || inv.status === "overdue",
  ).length;

  const getQrToken = async (invoice: any) => {
    const { data: existing, error } = await supabase
      .from("qr_codes")
      .select("token")
      .eq("entity_id", invoice.id)
      .eq("entity_type", "invoice")
      .eq("status", "active")
      .maybeSingle();

    if (error) throw error;
    return existing?.token ?? null;
  };

  const openQrDialog = async (invoice: any) => {
    setQrDialog({ open: true, invoice, scanUrl: null, generating: true });
    try {
      const token = await getQrToken(invoice);
      if (token) {
        const scanUrl = `${window.location.origin}/scan?t=${token}`;
        setQrDialog((d) => ({ ...d, scanUrl, generating: false }));
      } else {
        setQrDialog((d) => ({ ...d, generating: false, scanUrl: null }));
        toast.info("QR code not yet available for this invoice");
      }
    } catch (err: any) {
      toast.error("Failed to load QR: " + err.message);
      setQrDialog((d) => ({ ...d, generating: false }));
    }
  };

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

      {/* Invoice list — read-only, no "New" button */}
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

      {/* QR Dialog */}
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
              <div className="bg-white rounded-2xl p-4 shadow-lg flex items-center justify-center">
                {qrDialog.generating ? (
                  <div className="w-48 h-48 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  </div>
                ) : qrDialog.scanUrl ? (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=0&data=${encodeURIComponent(qrDialog.scanUrl)}`}
                    alt="Invoice QR Code"
                    className="w-48 h-48 rounded-lg object-contain"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-xs text-muted-foreground text-center p-4">
                    QR code not yet available for this invoice
                  </div>
                )}
              </div>

              <div className="text-center space-y-1">
                <div className="font-semibold">{qrDialog.invoice.invoice_number}</div>
                <div className="text-xs text-muted-foreground">
                  Status: <StatusBadge status={qrDialog.invoice.status} />
                </div>
              </div>

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
                      link.href = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=0&data=${encodeURIComponent(qrDialog.scanUrl!)}`;
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
    </div>
  );
}
