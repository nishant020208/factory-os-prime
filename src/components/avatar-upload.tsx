// avatar-upload.tsx — profile photo uploader for ALL roles (Bug 3 fix).
//
// Drag-and-drop zone with a fallback "Click to upload" button (mobile-friendly).
// Accepts jpg/png/webp only, enforces a 5MB limit with a clear error, shows a
// live preview immediately, uploads to the `avatars` storage bucket under the
// user's own {uid}/ folder (owner-only write policy), then persists the public
// URL to profiles.avatar_url so it renders everywhere avatars are shown.
import { useRef, useState, type DragEvent } from "react";
import { Loader2, ImagePlus, UploadCloud, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function AvatarUpload({
  userId,
  currentUrl,
  onSaved,
  className,
}: {
  userId: string;
  currentUrl?: string | null;
  /** Called with the new public URL after the profile row is updated. */
  onSaved?: (url: string | null) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    if (!ACCEPT.includes(file.type)) {
      toast.error(`Unsupported format — please use JPG, PNG or WebP (got ${file.type || "unknown"})`);
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(`File too large — maximum size is 5MB (yours is ${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      return;
    }
    setUploading(true);
    try {
      // Live preview before confirming save.
      const local = URL.createObjectURL(file);
      setPreview(local);

      const ext = EXT[file.type] ?? "png";
      const path = `${userId}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw new Error(upErr.message);

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = pub?.publicUrl ?? "";
      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar_url: url || null })
        .eq("id", userId);
      if (dbErr) throw new Error(dbErr.message);

      toast.success("Profile photo updated");
      onSaved?.(url || null);
    } catch (err: any) {
      toast.error(`Upload failed: ${err?.message ?? "unknown error"}`);
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    void handleFile(e.dataTransfer.files?.[0]);
  }

  const shown = preview ?? currentUrl ?? null;

  return (
    <div className={cn("space-y-2", className)}>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload profile photo"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "relative flex items-center gap-3 rounded-lg border border-dashed p-3 cursor-pointer transition-colors",
          dragging
            ? "border-primary bg-primary/10"
            : "border-input bg-card/40 hover:border-primary/50 hover:bg-card/60",
        )}
      >
        {shown ? (
          <img
            src={shown}
            alt="Profile preview"
            className="h-14 w-14 rounded-full object-cover border border-white/10"
          />
        ) : (
          <div className="h-14 w-14 rounded-full bg-primary/15 text-primary grid place-items-center">
            <ImagePlus className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0 text-left">
          <div className="text-sm font-medium flex items-center gap-1.5">
            {uploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…
              </>
            ) : (
              <>
                <UploadCloud className="h-3.5 w-3.5" />
                {currentUrl ? "Replace photo" : "Upload photo"}
              </>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Drag &amp; drop here, or click to browse — JPG / PNG / WebP, max 5MB
          </div>
        </div>
        {shown && !uploading && (
          <button
            type="button"
            aria-label="Remove photo"
            onClick={(e) => {
              e.stopPropagation();
              void (async () => {
                const { error } = await supabase
                  .from("profiles")
                  .update({ avatar_url: null })
                  .eq("id", userId);
                if (error) {
                  toast.error(error.message);
                  return;
                }
                setPreview(null);
                onSaved?.(null);
                toast.success("Profile photo removed");
              })();
            }}
            className="ml-auto h-7 w-7 shrink-0 rounded-full grid place-items-center text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT.join(",")}
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
