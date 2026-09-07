/**
 * qr-dialog.tsx — the single polished QR viewer used across every QR type
 * (Package, Shipment, Invoice, Quality Certificate, Warranty, Inbound).
 *
 * One owner for the modal's visual language: crisp QR rendering, consistent
 * status badge, readable scan URL with copy, clearly separated Preview /
 * Download actions, subtle entrance motion and mobile-safe sizing. Page code
 * passes its entity + scan URL; nothing else should re-implement this layout.
 */
import { motion } from "framer-motion";
import { Check, Copy, Download, ExternalLink, Loader2, QrCode } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui-parts";

/** Higher-res PNG keeps the QR crisp when shown at large sizes. */
export function qrImageUrl(scanUrl: string, size = 600): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=2&data=${encodeURIComponent(scanUrl)}`;
}

export type QrDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Short modal title, e.g. "Shipment QR", "Advance Payment QR". */
  title: string;
  /** Entity reference shown under the QR (PO # / invoice # / order # …). */
  reference?: string | null;
  /** Entity status rendered with the app-wide badge system. */
  status?: string | null;
  /** Resolved scan URL (window.origin/scan?t=…). */
  scanUrl?: string | null;
  /** True while the token/URL is being fetched. */
  loading?: boolean;
  /** File name prefix used when downloading the PNG. */
  downloadName?: string;
  /** Optional helper line under the QR, defaults to the camera hint. */
  helperText?: string;
  /** Extra entity rows (amounts, tracking, dates …) rendered under the ref. */
  children?: ReactNode;
};

export function QrDialog({
  open,
  onOpenChange,
  title,
  reference,
  status,
  scanUrl,
  loading = false,
  downloadName = "qr-code",
  helperText = "Scan with any phone camera — no app needed.",
  children,
}: QrDialogProps) {
  const [copied, setCopied] = useState(false);

  async function copyUrl() {
    if (!scanUrl) return;
    try {
      await navigator.clipboard.writeText(scanUrl);
      setCopied(true);
      toast.success("Scan link copied!");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Could not copy the link");
    }
  }

  function downloadPng() {
    if (!scanUrl) return;
    const link = document.createElement("a");
    link.href = qrImageUrl(scanUrl);
    link.download = `${downloadName}.png`;
    link.click();
    toast.success("QR code downloaded");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] max-h-[90vh] overflow-y-auto w-[92vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
              <QrCode className="h-4 w-4" />
            </span>
            {title}
          </DialogTitle>
        </DialogHeader>

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="flex flex-col items-center gap-4 py-2"
        >
          {/* QR image area — consistent frame, crisp rendering */}
          <div className="rounded-2xl border border-white/10 bg-white p-3.5 shadow-lg shadow-black/20">
            {loading ? (
              <div className="h-52 w-52 grid place-items-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : scanUrl ? (
              <img
                src={qrImageUrl(scanUrl)}
                alt={`${title} — scannable QR code`}
                className="h-52 w-52 rounded-lg object-contain"
              />
            ) : (
              <div className="h-52 w-52 grid place-items-center px-6 text-center text-xs text-muted-foreground">
                QR code not available for this record
              </div>
            )}
          </div>

          {/* Reference + status */}
          {reference && (
            <div className="flex flex-col items-center gap-1 text-center">
              <div className="font-mono text-sm font-semibold tracking-tight">{reference}</div>
              {status && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  Status: <StatusBadge status={status} />
                </div>
              )}
            </div>
          )}

          {/* Entity-specific rows */}
          {children}

          {/* Scan URL — readable + copyable */}
          {scanUrl && (
            <div className="flex w-full items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground">
                {scanUrl}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 gap-1 px-2 text-[11px]"
                onClick={copyUrl}
              >
                {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          )}

          <p className="max-w-xs text-center text-[10px] text-muted-foreground">{helperText}</p>

          {/* Clearly separated actions */}
          <div className="flex w-full gap-2">
            {scanUrl && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => window.open(scanUrl!, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Preview
              </Button>
            )}
            {scanUrl && (
              <Button variant="outline" size="sm" className="flex-1" onClick={downloadPng}>
                <Download className="h-3.5 w-3.5" />
                Download PNG
              </Button>
            )}
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
