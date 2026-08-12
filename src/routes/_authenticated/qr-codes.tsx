import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  QrCode,
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  Download,
  Eye,
  Trash2,
  ShieldCheck,
  FileText,
  Truck,
  PackageCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatusBadge } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/qr-codes")({
  head: () => ({
    meta: [
      { title: "QR Codes — FactoryOS AI" },
      {
        name: "description",
        content: "Manage and track all QR codes generated for invoices, orders, shipments and packages.",
      },
    ],
  }),
  component: QrCodesPage,
});

const TYPE_ICON: Record<string, React.ElementType> = {
  invoice: FileText,
  advance_payment: Clock,
  shipment: Truck,
  package: PackageCheck,
  quality_certificate: ShieldCheck,
  warranty: ShieldCheck,
};

const TYPE_LABEL: Record<string, string> = {
  invoice: "Invoice",
  advance_payment: "Advance Payment",
  shipment: "Shipment",
  package: "Package",
  quality_certificate: "Quality Certificate",
  warranty: "Warranty",
};

const STATUS_COLOR: Record<string, string> = {
  active: "text-emerald-400",
  used: "text-blue-400",
  expired: "text-red-400",
  revoked: "text-red-400",
};

function QrCodesPage() {
  const queryClient = useQueryClient();
  const { companyId } = useAuth();
  const [previewDialog, setPreviewDialog] = useState<{
    open: boolean;
    row: any | null;
  }>({ open: false, row: null });
  const [search, setSearch] = useState("");

  const { data: codes, isLoading } = useQuery({
    queryKey: ["qr-codes", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qr_codes")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("qr_codes")
        .update({ status: "revoked" })
        .eq("id", id)
        .eq("company_id", companyId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qr-codes"] });
      toast.success("QR code revoked");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const getScanUrl = (row: any) =>
    row.token ? `${window.location.origin}/scan?t=${row.token}` : null;

  const getQrImageUrl = (row: any) => {
    const scanUrl = getScanUrl(row);
    if (!scanUrl) return null;
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(scanUrl)}`;
  };

  const filtered = (codes ?? []).filter((row: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      row.label?.toLowerCase().includes(s) ||
      row.entity_type?.toLowerCase().includes(s) ||
      row.type?.toLowerCase().includes(s) ||
      row.status?.toLowerCase().includes(s)
    );
  });

  const active = (codes ?? []).filter((r: any) => r.status === "active").length;
  const used = (codes ?? []).filter((r: any) => r.status === "used").length;
  const revoked = (codes ?? []).filter((r: any) => r.status === "revoked").length;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Operations"
        title="QR Codes"
        sub="All scannable QR codes generated for invoices, orders, shipments and packages."
      />

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-2xl font-bold mt-0.5">{(codes ?? []).length}</div>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <div className="text-xs text-emerald-400">Active</div>
          <div className="text-2xl font-bold mt-0.5 text-emerald-400">{active}</div>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
          <div className="text-xs text-red-400">Revoked</div>
          <div className="text-2xl font-bold mt-0.5 text-red-400">{revoked}</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search by label, type or status…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-9 rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/10 bg-card overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <QrCode className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {search ? "No codes match your search." : "No QR codes generated yet."}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Generate QR codes from the Invoices or Approved Orders pages.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3">Type</th>
                  <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3">Label</th>
                  <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3 hidden md:table-cell">Details</th>
                  <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3">Status</th>
                  <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3 hidden lg:table-cell">Created</th>
                  <th className="text-right text-xs text-muted-foreground font-medium px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row: any) => {
                  const TypeIcon = TYPE_ICON[row.type] ?? QrCode;
                  const scanUrl = getScanUrl(row);
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Type */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                            <TypeIcon className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <span className="text-xs text-muted-foreground hidden sm:block">
                            {TYPE_LABEL[row.type] ?? row.type}
                          </span>
                        </div>
                      </td>

                      {/* Label */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-sm">{row.label ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{row.entity_type}</div>
                      </td>

                      {/* Sub label */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {row.sub_label ?? "—"}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <div className={`flex items-center gap-1 text-xs font-medium ${STATUS_COLOR[row.status] ?? "text-muted-foreground"}`}>
                          {row.status === "active" && <CheckCircle2 className="h-3 w-3" />}
                          {row.status === "used" && <CheckCircle2 className="h-3 w-3" />}
                          {(row.status === "expired" || row.status === "revoked") && <XCircle className="h-3 w-3" />}
                          <span className="capitalize">{row.status}</span>
                        </div>
                      </td>

                      {/* Created */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {new Date(row.created_at).toLocaleDateString()}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {/* View scan page */}
                          {scanUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              title="Preview scan page"
                              onClick={() => window.open(scanUrl, "_blank")}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          )}

                          {/* Copy link */}
                          {scanUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              title="Copy scan link"
                              onClick={() => {
                                navigator.clipboard.writeText(scanUrl);
                                toast.success("Scan link copied!");
                              }}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          )}

                          {/* QR preview dialog */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            title="View QR code"
                            onClick={() => setPreviewDialog({ open: true, row })}
                          >
                            <QrCode className="h-3.5 w-3.5" />
                          </Button>

                          {/* Revoke */}
                          {row.status === "active" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              title="Revoke QR code"
                              onClick={() => revokeMutation.mutate(row.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* QR Preview Dialog */}
      <Dialog
        open={previewDialog.open}
        onOpenChange={(o) => setPreviewDialog((d) => ({ ...d, open: o }))}
      >
        <DialogContent className="sm:max-w-[340px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-primary" />
              {previewDialog.row?.label ?? "QR Code"}
            </DialogTitle>
          </DialogHeader>
          {previewDialog.row && (() => {
            const scanUrl = getScanUrl(previewDialog.row);
            const imgUrl = getQrImageUrl(previewDialog.row);
            return (
              <div className="flex flex-col items-center gap-4 py-2">
                <div className="bg-white rounded-2xl p-3 shadow-lg">
                  {imgUrl ? (
                    <img src={imgUrl} alt="QR Code" className="w-44 h-44 rounded-lg" />
                  ) : (
                    <div className="w-44 h-44 flex items-center justify-center text-xs text-muted-foreground">
                      No token available
                    </div>
                  )}
                </div>

                {/* Type + status */}
                <div className="text-center space-y-1">
                  <div className="font-semibold">{previewDialog.row.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {TYPE_LABEL[previewDialog.row.type] ?? previewDialog.row.type} ·{" "}
                    <span className={`capitalize ${STATUS_COLOR[previewDialog.row.status] ?? ""}`}>
                      {previewDialog.row.status}
                    </span>
                  </div>
                  {previewDialog.row.sub_label && (
                    <div className="text-xs text-muted-foreground">{previewDialog.row.sub_label}</div>
                  )}
                </div>

                {/* Scan URL */}
                {scanUrl && (
                  <div className="w-full rounded-lg bg-muted/50 border border-border px-3 py-2 flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground flex-1 truncate font-mono">
                      {scanUrl}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 shrink-0"
                      onClick={() => {
                        navigator.clipboard.writeText(scanUrl);
                        toast.success("Copied!");
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {scanUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(scanUrl, "_blank")}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      Preview
                    </Button>
                  )}
                  {imgUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const link = document.createElement("a");
                        link.href = imgUrl;
                        link.download = `qr-${previewDialog.row!.label ?? "code"}.png`;
                        link.click();
                        toast.success("Downloaded");
                      }}
                    >
                      <Download className="h-3.5 w-3.5 mr-1" />
                      Download
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
