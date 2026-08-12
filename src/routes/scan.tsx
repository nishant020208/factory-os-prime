import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckCircle2,
  Clock,
  XCircle,
  QrCode,
  Loader2,
  PackageCheck,
  FileText,
  Truck,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "Scan QR Code — FactoryOS AI" },
      {
        name: "description",
        content: "Scan a FactoryOS QR code to verify shipment, invoice or package status.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    t: (search.t as string) ?? "",
  }),
  component: ScanPage,
});

type ScanResult = {
  found: boolean;
  qr_type: string | null;
  qr_status: string | null;
  entity_type: string | null;
  label: string | null;
  sub_label: string | null;
  scanned_at: string | null;
};

const TYPE_META: Record<
  string,
  { icon: React.ElementType; label: string; color: string; bg: string }
> = {
  invoice: {
    icon: FileText,
    label: "Invoice",
    color: "text-blue-400",
    bg: "from-blue-500/20 to-blue-900/10",
  },
  advance_payment: {
    icon: Clock,
    label: "Advance Payment",
    color: "text-amber-400",
    bg: "from-amber-500/20 to-amber-900/10",
  },
  shipment: {
    icon: Truck,
    label: "Shipment",
    color: "text-purple-400",
    bg: "from-purple-500/20 to-purple-900/10",
  },
  package: {
    icon: PackageCheck,
    label: "Package",
    color: "text-emerald-400",
    bg: "from-emerald-500/20 to-emerald-900/10",
  },
  quality_certificate: {
    icon: ShieldCheck,
    label: "Quality Certificate",
    color: "text-teal-400",
    bg: "from-teal-500/20 to-teal-900/10",
  },
  warranty: {
    icon: ShieldCheck,
    label: "Warranty",
    color: "text-indigo-400",
    bg: "from-indigo-500/20 to-indigo-900/10",
  },
};

const STATUS_META: Record<
  string,
  { icon: React.ElementType; label: string; color: string; ringColor: string }
> = {
  active: {
    icon: CheckCircle2,
    label: "Active",
    color: "text-emerald-400",
    ringColor: "ring-emerald-500/30",
  },
  used: {
    icon: CheckCircle2,
    label: "Verified",
    color: "text-emerald-400",
    ringColor: "ring-emerald-500/30",
  },
  paid: {
    icon: CheckCircle2,
    label: "Paid",
    color: "text-emerald-400",
    ringColor: "ring-emerald-500/30",
  },
  awaiting_payment: {
    icon: Clock,
    label: "Awaiting Payment",
    color: "text-amber-400",
    ringColor: "ring-amber-500/30",
  },
  sent: {
    icon: Clock,
    label: "Sent",
    color: "text-blue-400",
    ringColor: "ring-blue-500/30",
  },
  expired: {
    icon: XCircle,
    label: "Expired",
    color: "text-red-400",
    ringColor: "ring-red-500/30",
  },
  revoked: {
    icon: XCircle,
    label: "Revoked",
    color: "text-red-400",
    ringColor: "ring-red-500/30",
  },
};

function ScanPage() {
  const { t: token } = useSearch({ from: "/scan" });
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError("No QR token found. Please scan a valid FactoryOS QR code.");
      return;
    }

    const lookup = async () => {
      try {
        const { data, error: rpcErr } = await supabase.rpc("public_scan_qr", {
          p_token: token,
        });

        if (rpcErr) throw rpcErr;

        const row = Array.isArray(data) ? data[0] : data;
        setResult(row as ScanResult);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Unable to look up this QR code."
        );
      } finally {
        setLoading(false);
      }
    };

    lookup();
  }, [token]);

  const typeMeta =
    result?.qr_type ? (TYPE_META[result.qr_type] ?? TYPE_META["invoice"]) : null;
  const statusMeta =
    result?.qr_status
      ? (STATUS_META[result.qr_status] ?? STATUS_META["active"])
      : null;

  return (
    <div className="min-h-screen bg-[#0b0f1a] flex flex-col items-center justify-center px-4 py-12">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px]" />
      </div>

      {/* Logo */}
      <div className="mb-8 flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
          <QrCode className="h-4 w-4 text-primary" />
        </div>
        <span className="text-sm font-semibold text-white/80 tracking-wide">
          FactoryOS AI
        </span>
      </div>

      {/* Card */}
      <div className="relative w-full max-w-sm">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden">
          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center gap-4 py-16 px-8">
              <div className="relative">
                <div className="h-16 w-16 rounded-full border-2 border-primary/30 flex items-center justify-center">
                  <Loader2 className="h-7 w-7 text-primary animate-spin" />
                </div>
                <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-white/80">Verifying QR code…</p>
                <p className="text-xs text-white/40 mt-1">Connecting to FactoryOS</p>
              </div>
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="flex flex-col items-center gap-4 py-12 px-8 text-center">
              <div className="h-14 w-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <AlertTriangle className="h-7 w-7 text-red-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Lookup failed</p>
                <p className="text-xs text-white/50 mt-1 leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {/* Not found */}
          {!loading && !error && result && !result.found && (
            <div className="flex flex-col items-center gap-4 py-12 px-8 text-center">
              <div className="h-14 w-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <XCircle className="h-7 w-7 text-red-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">QR Code Not Found</p>
                <p className="text-xs text-white/50 mt-1 leading-relaxed">
                  This QR code doesn't exist or has been removed. Please contact the sender.
                </p>
              </div>
            </div>
          )}

          {/* Success */}
          {!loading && !error && result?.found && typeMeta && statusMeta && (
            <>
              {/* Header gradient band */}
              <div
                className={`bg-gradient-to-br ${typeMeta.bg} px-6 pt-8 pb-6 border-b border-white/5`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-12 w-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center`}
                  >
                    <typeMeta.icon className={`h-6 w-6 ${typeMeta.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-white/50 uppercase tracking-widest font-medium">
                      {typeMeta.label}
                    </p>
                    <p className="text-lg font-bold text-white leading-tight mt-0.5">
                      {result.label ?? "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-4">
                {/* Status pill */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40 uppercase tracking-wider">Status</span>
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ring-1 ${statusMeta.ringColor} bg-white/5`}
                  >
                    <statusMeta.icon className={`h-3.5 w-3.5 ${statusMeta.color}`} />
                    <span className={statusMeta.color}>{statusMeta.label}</span>
                  </div>
                </div>

                {/* Sub label */}
                {result.sub_label && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/40 uppercase tracking-wider">Details</span>
                    <span className="text-xs text-white/70 font-medium">{result.sub_label}</span>
                  </div>
                )}

                {/* Entity type */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40 uppercase tracking-wider">Category</span>
                  <span className="text-xs text-white/70 capitalize">
                    {result.entity_type?.replace(/_/g, " ") ?? "—"}
                  </span>
                </div>

                {/* Scanned at */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40 uppercase tracking-wider">Scanned</span>
                  <span className="text-xs text-white/60">
                    {result.scanned_at
                      ? new Date(result.scanned_at).toLocaleString()
                      : "—"}
                  </span>
                </div>
              </div>

              {/* Footer verify banner */}
              <div className="px-6 pb-6">
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                  <p className="text-xs text-emerald-300 leading-snug">
                    Verified by FactoryOS AI. This code is authentic and tamper-evident.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <p className="mt-8 text-xs text-white/20 text-center">
        Powered by{" "}
        <a
          href="/"
          className="underline underline-offset-2 hover:text-white/40 transition-colors"
        >
          FactoryOS AI
        </a>{" "}
        · Secure QR Verification
      </p>
    </div>
  );
}
