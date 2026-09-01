import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, X, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface QrCameraScannerProps {
  /** Called when a QR code is successfully scanned */
  onScan: (decodedText: string) => void;
  /** Whether the scanner dialog is open */
  open: boolean;
  /** Close the scanner dialog */
  onClose: () => void;
  /** Optional title for the dialog */
  title?: string;
}

export function QrCameraScanner({
  onScan,
  open,
  onClose,
  title = "Scan QR Code",
}: QrCameraScannerProps) {
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const isStarting = useRef(false);

  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        const state = html5QrCodeRef.current.getState();
        if (state === 2) {
          // SCANNING state
          await html5QrCodeRef.current.stop();
        }
      } catch {
        // Already stopped or not started
      }
      html5QrCodeRef.current = null;
    }
    setScanning(false);
  }, []);

  const startScanner = useCallback(async () => {
    if (isStarting.current || scanning) return;
    isStarting.current = true;
    setError(null);

    try {
      // Check if camera is available
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        setError("No camera found. Please connect a camera and try again.");
        setHasPermission(false);
        isStarting.current = false;
        return;
      }

      setHasPermission(true);

      // Find the rear camera (environment) or fallback to first camera
      const rearCamera = devices.find(
        (d) =>
          d.label.toLowerCase().includes("back") ||
          d.label.toLowerCase().includes("rear") ||
          d.label.toLowerCase().includes("environment")
      );
      const cameraId = rearCamera?.id ?? devices[0].id;

      if (!containerRef.current) {
        isStarting.current = false;
        return;
      }

      const html5QrCode = new Html5Qrcode("qr-scanner-region");
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          // On successful scan
          onScan(decodedText);
          // Don't auto-stop — let the parent decide
        },
        () => {
          // Ignore scan failures (no QR found yet)
        }
      );

      setScanning(true);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to start camera";
      if (msg.includes("Permission")) {
        setError(
          "Camera permission denied. Please allow camera access in your browser settings."
        );
        setHasPermission(false);
      } else {
        setError(`Camera error: ${msg}`);
      }
    } finally {
      isStarting.current = false;
    }
  }, [onScan, scanning]);

  // Start camera when dialog opens
  useEffect(() => {
    if (open) {
      // Small delay to let the dialog mount
      const timer = setTimeout(() => startScanner(), 300);
      return () => clearTimeout(timer);
    } else {
      stopScanner();
    }
  }, [open, startScanner, stopScanner]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  const handleClose = async () => {
    await stopScanner();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Camera className="h-4 w-4 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>

        {/* Scanner viewport */}
        <div className="relative mx-4 mb-2 rounded-xl overflow-hidden bg-black/80 border border-white/10">
          <div
            ref={containerRef}
            id="qr-scanner-region"
            className="w-full min-h-[280px]"
          />

          {/* Overlay corners for visual guidance */}
          {scanning && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-4 left-4 w-12 h-12 border-t-2 border-l-2 border-primary rounded-tl-lg" />
              <div className="absolute top-4 right-4 w-12 h-12 border-t-2 border-r-2 border-primary rounded-tr-lg" />
              <div className="absolute bottom-4 left-4 w-12 h-12 border-b-2 border-l-2 border-primary rounded-bl-lg" />
              <div className="absolute bottom-4 right-4 w-12 h-12 border-b-2 border-r-2 border-primary rounded-br-lg" />
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-black/60 text-[10px] text-white/70">
                Point camera at QR code
              </div>
            </div>
          )}

          {/* Loading overlay */}
          {!scanning && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
              <span className="text-xs text-white/60">Starting camera…</span>
            </div>
          )}
        </div>

        {/* Error state */}
        {error && (
          <div className="mx-4 mb-2 flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-300 leading-relaxed">{error}</p>
          </div>
        )}

        {/* Retry / Close buttons */}
        <div className="px-4 pb-4 flex items-center gap-2">
          {error && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => {
                setError(null);
                startScanner();
              }}
            >
              Retry
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs ml-auto"
            onClick={handleClose}
          >
            <X className="h-3 w-3 mr-1" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
