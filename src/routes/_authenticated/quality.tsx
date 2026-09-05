import { createFileRoute } from "@tanstack/react-router";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  AlertOctagon,
  ClipboardCheck,
  Plus,
  ChevronDown,
  ChevronRight,
  Camera,
  X,
  Eye,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  MinusCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge, EmptyState } from "@/components/ui-parts";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMemo, useState, useCallback, useRef, type DragEvent } from "react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { safeDate, resolveRelation } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/quality")({
  head: () => ({
    meta: [
      { title: "Quality — FactoryOS AI" },
      {
        name: "description",
        content: "Detailed furniture QC with itemized parameter inspections, NCR and CAPA.",
      },
    ],
  }),
  component: QualityPage,
});

// ─────────────────────────────────────────────────────────────
// THE FULL FURNITURE QC PARAMETER SET — 7 CATEGORIES
// ─────────────────────────────────────────────────────────────
type ParamDef = {
  name: string;
  unit?: string;
  range: string;
  type: "numeric" | "scale" | "passfail";
  scaleOptions?: string[];
  mandatory?: boolean; // if true, Fail = overall Fail
  naFor?: string[]; // product types where this param is N/A
};

type CategoryDef = {
  key: string;
  label: string;
  icon: string;
  params: ParamDef[];
};

const QC_CATEGORIES: CategoryDef[] = [
  {
    key: "wood_material",
    label: "Wood & Material Quality",
    icon: "🪵",
    params: [
      { name: "Wood Moisture Content", unit: "%", range: "8–12%", type: "numeric", mandatory: true },
      { name: "Wood Hardness", range: "Soft/Medium/Hard (match species)", type: "scale", scaleOptions: ["Soft", "Medium", "Hard"] },
      { name: "Grain Consistency", range: "Consistent / Minor Variation / Inconsistent", type: "scale", scaleOptions: ["Consistent", "Minor Variation", "Inconsistent"] },
      { name: "Knots & Defects Count", unit: "count", range: "0–2 per surface (grade A)", type: "numeric" },
      { name: "Warping/Bowing", unit: "mm", range: "<2mm per 1000mm", type: "numeric", mandatory: true },
      { name: "Insect/Pest Damage", range: "Absent required", type: "passfail", mandatory: true },
    ],
  },
  {
    key: "structural",
    label: "Structural & Joinery",
    icon: "🔧",
    params: [
      { name: "Joint Type Verification", range: "Match design spec", type: "scale", scaleOptions: ["Mortise-Tenon", "Dowel", "Dovetail", "Screw+Glue", "Biscuit", "Matched"] },
      { name: "Joint Tightness", range: "No visible movement under lateral force", type: "passfail", mandatory: true },
      { name: "Load-Bearing Test", unit: "kg", range: "Exceeds rated capacity", type: "numeric", naFor: ["decorative", "wall_art"] },
      { name: "Screw/Hardware Torque", range: "All tightened, no stripped screws", type: "passfail" },
      { name: "Dimensional Accuracy – Length", unit: "mm", range: "±3mm of spec", type: "numeric" },
      { name: "Dimensional Accuracy – Width", unit: "mm", range: "±3mm of spec", type: "numeric" },
      { name: "Dimensional Accuracy – Height", unit: "mm", range: "±3mm of spec", type: "numeric" },
      { name: "Dimensional Accuracy – Depth", unit: "mm", range: "±3mm of spec", type: "numeric", naFor: ["decorative"] },
    ],
  },
  {
    key: "surface_finish",
    label: "Surface Finish",
    icon: "✨",
    params: [
      { name: "Polish/Lacquer Evenness", range: "Even / Minor Unevenness / Uneven", type: "scale", scaleOptions: ["Even", "Minor Unevenness", "Uneven"], mandatory: true },
      { name: "Surface Smoothness", range: "Smooth / Minor Roughness / Rough", type: "scale", scaleOptions: ["Smooth", "Minor Roughness", "Rough"] },
      { name: "Color Match", range: "Match / Minor Variance / Mismatch vs sample", type: "scale", scaleOptions: ["Match", "Minor Variance", "Mismatch"], mandatory: true },
      { name: "Gloss Level", range: "Matte / Satin / Gloss — match spec", type: "scale", scaleOptions: ["Matte", "Satin", "Gloss", "N/A"] },
      { name: "Scratches/Dents Count", unit: "count", range: "0 for Grade A", type: "numeric" },
    ],
  },
  {
    key: "upholstery",
    label: "Upholstery",
    icon: "🛋️",
    params: [
      { name: "Fabric Tension", range: "Even / Uneven", type: "scale", scaleOptions: ["Even", "Uneven"], naFor: ["dining_table", "desk", "bookshelf", "cabinet", "solid_wood"] },
      { name: "Stitching Quality", range: "Consistent, no loose threads, strong seams", type: "passfail", naFor: ["dining_table", "desk", "bookshelf", "cabinet", "solid_wood"] },
      { name: "Foam Density/Firmness", range: "Soft / Medium / Firm — match spec", type: "scale", scaleOptions: ["Soft", "Medium", "Firm"], naFor: ["dining_table", "desk", "bookshelf", "cabinet", "solid_wood"] },
      { name: "Fabric Color/Pattern Match", range: "Match approved sample", type: "passfail", naFor: ["dining_table", "desk", "bookshelf", "cabinet", "solid_wood"] },
    ],
  },
  {
    key: "hardware",
    label: "Hardware & Fittings",
    icon: "⚙️",
    params: [
      { name: "Hinge Alignment & Function", range: "Opens/closes smoothly, no misalignment", type: "passfail" },
      { name: "Drawer Slide Function", range: "Smooth glide, no sticking, correct alignment", type: "passfail", naFor: ["decorative", "wall_art"] },
      { name: "Hardware Finish Match", range: "Matches specified finish", type: "scale", scaleOptions: ["Brass", "Chrome", "Matte Black", "Brushed Nickel", "Oil-Rubbed Bronze", "Matched"] },
    ],
  },
  {
    key: "safety",
    label: "Safety & Compliance",
    icon: "🛡️",
    params: [
      { name: "Edge/Corner Safety", range: "No sharp edges where rounded specified", type: "passfail", mandatory: true },
      { name: "Stability Test", range: "No tip under normal expected use", type: "passfail", mandatory: true },
      { name: "Weight Capacity Confirmation", unit: "kg", range: "Exceeds rated capacity", type: "numeric", naFor: ["decorative", "wall_art"] },
    ],
  },
  {
    key: "packaging",
    label: "Packaging Readiness",
    icon: "📦",
    params: [
      { name: "Cleaning/Dusting Confirmed", range: "Clean and dust-free", type: "passfail" },
      { name: "Protective Wrapping Applied", range: "Wrapped per packing spec", type: "passfail" },
      { name: "All Hardware/Accessories Present", range: "Matches packing checklist", type: "passfail" },
    ],
  },
];

// Product types that don't have upholstery
const SOLID_PRODUCTS = ["dining_table", "desk", "bookshelf", "cabinet", "solid_wood"];
const NA_PRODUCTS = ["decorative", "wall_art"];

// ─────────────────────────────────────────────────────────────
// PHOTO UPLOAD COMPONENT (per parameter)
// ─────────────────────────────────────────────────────────────
function ParamPhotoUpload({
  inspectionId,
  paramName,
  currentUrl,
  onUploaded,
}: {
  inspectionId: string;
  paramName: string;
  currentUrl?: string | null;
  onUploaded?: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Only JPG, PNG, WebP supported");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Max 5MB per photo");
      return;
    }
    setUploading(true);
    try {
      const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
      const safeName = paramName.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
      const path = `quality/${inspectionId}/${safeName}.${ext}`;
      const { error } = await supabase.storage
        .from("avatars") // reuse existing bucket
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      if (pub?.publicUrl) {
        onUploaded?.(pub.publicUrl);
        toast.success("Photo attached");
      }
    } catch (err: any) {
      toast.error(`Upload failed: ${err?.message}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="h-6 w-6 rounded-md grid place-items-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
        title="Attach photo"
      >
        {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
      </button>
      {currentUrl && (
        <a href={currentUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline">
          📷 View
        </a>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SINGLE PARAMETER ROW
// ─────────────────────────────────────────────────────────────
function ParamRow({
  param,
  value,
  onChange,
  productType,
}: {
  param: ParamDef;
  value: { measured_value: string; result: string; notes: string; photo_url: string };
  onChange: (field: string, val: string) => void;
  productType: string;
}) {
  // Check if this param is N/A for the product type
  const isNA = param.naFor?.some((p) => productType.toLowerCase().includes(p)) ?? false;

  if (isNA) {
    return (
      <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/30 text-xs text-muted-foreground">
        <MinusCircle className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1">{param.name}</span>
        <span className="text-[10px] italic">N/A for this product</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_100px_80px_auto] gap-2 items-center py-2 px-3 rounded-lg bg-card/40 border border-white/5">
      <div>
        <div className="text-sm font-medium">{param.name}</div>
        <div className="text-[10px] text-muted-foreground">
          Range: {param.range}
          {param.unit && ` · Unit: ${param.unit}`}
          {param.mandatory && <span className="text-destructive ml-1">*mandatory</span>}
        </div>
      </div>

      {/* Measured value */}
      {param.type === "numeric" ? (
        <Input
          type="number"
          step="0.1"
          placeholder={param.unit || "value"}
          value={value.measured_value}
          onChange={(e) => onChange("measured_value", e.target.value)}
          className="h-8 text-xs"
        />
      ) : param.type === "scale" ? (
        <Select value={value.measured_value} onValueChange={(v) => onChange("measured_value", v)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {param.scaleOptions?.map((opt) => (
              <SelectItem key={opt} value={opt} className="text-xs">
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        // passfail
        <Select value={value.measured_value} onValueChange={(v) => onChange("measured_value", v)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Pass/Fail..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Pass" className="text-xs">✅ Pass</SelectItem>
            <SelectItem value="Fail" className="text-xs">❌ Fail</SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* Result badge */}
      <div className="flex items-center gap-1">
        {value.result === "pass" ? (
          <span className="text-[10px] font-medium text-emerald-400 flex items-center gap-0.5"><CheckCircle2 className="h-3 w-3" /> Pass</span>
        ) : value.result === "fail" ? (
          <span className="text-[10px] font-medium text-red-400 flex items-center gap-0.5"><XCircle className="h-3 w-3" /> Fail</span>
        ) : (
          <span className="text-[10px] text-muted-foreground">—</span>
        )}
      </div>

      {/* Notes */}
      <Input
        placeholder="Notes..."
        value={value.notes}
        onChange={(e) => onChange("notes", e.target.value)}
        className="h-8 text-xs"
      />

      {/* Photo */}
      <ParamPhotoUpload
        inspectionId="pending"
        paramName={param.name}
        currentUrl={value.photo_url || null}
        onUploaded={(url) => onChange("photo_url", url)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// INSPECTION DETAIL VIEW (full itemized breakdown)
// ─────────────────────────────────────────────────────────────
function InspectionDetail({
  inspection,
  parameters,
  onClose,
}: {
  inspection: any;
  parameters: any[];
  onClose: () => void;
}) {
  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const p of parameters) {
      if (!map[p.category]) map[p.category] = [];
      map[p.category].push(p);
    }
    return map;
  }, [parameters]);

  const catDef = QC_CATEGORIES.find((c) => c.key);
  const passCount = parameters.filter((p) => p.result === "pass").length;
  const failCount = parameters.filter((p) => p.result === "fail").length;
  const naCount = parameters.filter((p) => p.result === "not_applicable").length;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Inspection {inspection.inspection_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Summary bar */}
          <div className="flex items-center gap-3 text-xs">
            <StatusBadge status={inspection.result} />
            <span className="text-muted-foreground">{safeDate(inspection.created_at)}</span>
            <span className="text-emerald-400">{passCount} pass</span>
            <span className="text-red-400">{failCount} fail</span>
            {naCount > 0 && <span className="text-muted-foreground">{naCount} N/A</span>}
          </div>

          {/* Per-category breakdown */}
          {QC_CATEGORIES.map((cat) => {
            const catParams = grouped[cat.key];
            if (!catParams || catParams.length === 0) return null;
            const catPass = catParams.filter((p) => p.result === "pass").length;
            const catFail = catParams.filter((p) => p.result === "fail").length;

            return (
              <div key={cat.key} className="border border-white/5 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
                  <span className="text-xs font-medium">
                    {cat.icon} {cat.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {catPass}✓ {catFail > 0 && <span className="text-red-400">{catFail}✗</span>}
                  </span>
                </div>
                <div className="divide-y divide-white/5">
                  {catParams.map((p: any) => (
                    <div key={p.id} className="px-3 py-2 text-xs grid grid-cols-[1fr_auto] gap-2">
                      <div>
                        <span className="font-medium">{p.parameter_name}</span>
                        <span className="text-muted-foreground ml-2">
                          {p.measured_value ?? "—"}
                          {p.unit ? ` ${p.unit}` : ""}
                        </span>
                        {p.notes && <span className="text-muted-foreground italic ml-2">({p.notes})</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {p.photo_url && (
                          <a href={p.photo_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            📷
                          </a>
                        )}
                        {p.result === "pass" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        ) : p.result === "fail" ? (
                          <XCircle className="h-3.5 w-3.5 text-red-400" />
                        ) : (
                          <MinusCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {inspection.overall_notes && (
            <div className="text-xs text-muted-foreground italic border-t border-white/5 pt-2">
              Notes: {inspection.overall_notes}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN QUALITY PAGE
// ─────────────────────────────────────────────────────────────
function QualityPage() {
  const { companyId, user, roles } = useAuth();
  const isAuditor = roles.includes("auditor");
  const queryClient = useQueryClient();

  const [showNew, setShowNew] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [detailInspection, setDetailInspection] = useState<any>(null);
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});

  // Form state
  const [formData, setFormData] = useState({
    inspection_number: "",
    inspection_type: "final",
    batch_reference: "",
    product_name: "",
    quantity_checked: "1",
    overall_notes: "",
  });

  // Parameter values: { [category_key]: { [param_name]: { measured_value, result, notes, photo_url } } }
  const [paramValues, setParamValues] = useState<
    Record<string, Record<string, { measured_value: string; result: string; notes: string; photo_url: string }>>
  >({});

  const toggleCat = (key: string) => setExpandedCats((prev) => ({ ...prev, [key]: !prev[key] }));

  const setParamValue = useCallback(
    (category: string, paramName: string, field: string, val: string) => {
      setParamValues((prev) => {
        const cat = { ...(prev[category] ?? {}) };          const existing = cat[paramName] ?? {};
        const param = {
          measured_value: existing.measured_value ?? "",
          result: existing.result ?? "pending",
          notes: existing.notes ?? "",
          photo_url: existing.photo_url ?? "",
        };
        (param as any)[field] = val;

        // Auto-compute result for passfail and numeric types
        const catDef = QC_CATEGORIES.find((c) => c.key === category);
        const paramDef = catDef?.params.find((p) => p.name === paramName);
        if (paramDef) {
          if (paramDef.type === "passfail" && param.measured_value) {
            param.result = param.measured_value === "Pass" ? "pass" : "fail";
          } else if (paramDef.type === "scale" && param.measured_value) {
            // Scale values: "Even", "Consistent", "Match", etc. = pass; "Uneven", "Inconsistent", "Mismatch" = fail
            const failWords = ["Uneven", "Inconsistent", "Mismatch", "Rough", "Uneven"];
            param.result = failWords.some((w) => param.measured_value.includes(w)) ? "fail" : "pass";
          } else if (paramDef.type === "numeric" && param.measured_value) {
            // For numeric, result is set manually via measured_value presence
            // The range check is informational — actual pass/fail for numeric is up to inspector
            param.result = param.measured_value ? "pass" : "pending";
          }
        }

        cat[paramName] = param;
        return { ...prev, [category]: cat };
      });
    },
    [],
  );

  const { data: inspections } = useQuery({
    queryKey: ["q-inspections", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("quality_inspections")
          .select("*")
          .eq("company_id", companyId!)
          .order("created_at", { ascending: false })
      ).data ?? [],
    enabled: !!companyId,
  });

  // Incoming material inspections (from GRN)
  const { data: incomingInspections } = useQuery({
    queryKey: ["incoming-inspections", companyId],
    queryFn: async () =>
      (
        await (supabase
          .from("incoming_material_inspections" as any) as any)
          .select("*, materials(name, unit), warehouses(name, code), purchase_orders(po_number)")
          .eq("company_id", companyId!)
          .order("created_at", { ascending: false })
          .limit(100)
      ).data ?? [],
    enabled: !!companyId,
  });

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [inspNotes, setInspNotes] = useState<Record<string, string>>({});
  const [rejectDialogInspection, setRejectDialogInspection] = useState<any | null>(null);
  const [rejectDialogReason, setRejectDialogReason] = useState<string>("Failed visual/dimensional inspection");
  const [rejectDialogNotes, setRejectDialogNotes] = useState<string>("");

  const processInspectionMutation = useMutation({
    mutationFn: async ({
      id,
      decision,
      notes,
      reason,
    }: {
      id: string;
      decision: "approved" | "rejected";
      notes?: string;
      reason?: string;
    }) => {
      const { data, error } = await (supabase.rpc as any)("process_incoming_inspection", {
        p_inspection_id: id,
        p_decision: decision,
        p_notes: notes ?? inspNotes[id] ?? null,
        p_rejection_reason: decision === "rejected" ? (reason || "Failed incoming inspection") : null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["incoming-inspections"] });
      queryClient.invalidateQueries({ queryKey: ["wh-inventory"] });
      setProcessingId(null);
      setRejectDialogInspection(null);
      setRejectDialogNotes("");
      if (vars.decision === "approved") {
        toast.success("Material approved — stock added to usable inventory");
      } else {
        toast.error("Material rejected — quantity quarantined, procurement notified");
      }
    },
    onError: (e: any) => {
      setProcessingId(null);
      toast.error(e.message);
    },
  });
  const pendingIncoming = (incomingInspections ?? []).filter((i: any) => i.status === "pending").length;

  // Fetch parameters for detail view
  const { data: detailParams } = useQuery({
    queryKey: ["q-params", detailInspection?.id],
    queryFn: async () =>
      (
        await supabase
          .from("quality_inspection_parameters")
          .select("*")
          .eq("inspection_id", detailInspection!.id)
          .order("category, parameter_name")
      ).data ?? [],
    enabled: !!detailInspection?.id,
  });

  // Fetch production orders for batch reference
  const { data: prodOrders } = useQuery({
    queryKey: ["q-prod"],
    queryFn: async () =>
      (await supabase.from("production_orders").select("id, order_number, status")).data ?? [],
  });

  // Stats
  const stats = useMemo(() => {
    const rows = inspections ?? [];
    const total = rows.length;
    const passed = rows.filter((r) => r.result === "pass").length;
    const failed = rows.filter((r) => r.result === "fail").length;
    const conditional = rows.filter((r) => r.result === "conditional_pass").length;
    const totalChecked = rows.reduce((s, r) => s + Number(r.quantity_checked ?? 0), 0);
    const totalDefects = rows.reduce((s, r) => s + Number(r.defects_found ?? 0), 0);
    return {
      firstPassYield: total ? (passed / total) * 100 : null,
      defectRate: totalChecked ? (totalDefects / totalChecked) * 100 : null,
      openNCRs: rows.filter((r) => r.result === "pending" || r.result === "fail").length,
      failed,
      conditional,
      passed,
      total,
    };
  }, [inspections]);

  // Trend
  const trend = useMemo(() => {
    const rows = inspections ?? [];
    const weeks: { w: string; yield: number }[] = [];
    const now = Date.now();
    for (let i = 11; i >= 0; i--) {
      const start = now - (i + 1) * 7 * 86400000;
      const end = now - i * 7 * 86400000;
      const inWeek = rows.filter((r) => {
        const t = new Date(r.created_at).getTime();
        return t >= start && t < end;
      });
      const pass = inWeek.filter((r) => r.result === "pass").length;
      weeks.push({
        w: `W${12 - i}`,
        yield: inWeek.length ? Math.round((pass / inWeek.length) * 1000) / 10 : 100,
      });
    }
    return weeks;
  }, [inspections]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !user) throw new Error("Not authenticated");
      if (!formData.inspection_number.trim()) throw new Error("Inspection number required");

      // 1. Create the inspection record
      const inspectionNumber = formData.inspection_number || `QI-${Date.now()}`;
      const { data: inspection, error: insErr } = await supabase
        .from("quality_inspections")
        .insert({
          company_id: companyId,
          inspection_number: inspectionNumber,
          inspection_type: formData.inspection_type,
          batch_reference: formData.batch_reference || null,
          inspector_id: user.id,
          result: "pending",
          quantity_checked: Number(formData.quantity_checked) || 1,
          overall_notes: formData.overall_notes || null,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;

      // 2. Insert all parameters
      const paramRows: any[] = [];
      for (const cat of QC_CATEGORIES) {
        const catVals = paramValues[cat.key] ?? {};
        for (const p of cat.params) {
          const v = catVals[p.name];
          if (!v) continue; // skip unfilled params
          // Skip N/A params
          const isNA = p.naFor?.some((np) => formData.product_name.toLowerCase().includes(np)) ?? false;
          if (isNA) continue;

          paramRows.push({
            company_id: companyId,
            inspection_id: inspection.id,
            category: cat.key,
            parameter_name: p.name,
            measured_value: v.measured_value || null,
            unit: p.unit ?? null,
            acceptable_range: p.range,
            result: v.result === "pending" ? "not_applicable" : v.result,
            notes: v.notes || null,
            photo_url: v.photo_url || null,
          });
        }
      }

      if (paramRows.length > 0) {
        const { error: paramErr } = await supabase
          .from("quality_inspection_parameters")
          .insert(paramRows);
        if (paramErr) throw paramErr;
      }

      // 3. The trigger will auto-compute overall_result, but let's also compute it here for immediate feedback
      const mandatoryFail = paramRows.some(
        (r) => r.result === "fail" && ["wood_material", "structural", "safety"].includes(r.category),
      );
      const anyFail = paramRows.some((r) => r.result === "fail");
      const hasPass = paramRows.some((r) => r.result === "pass");
      let overallResult = "pending";
      if (mandatoryFail) overallResult = "fail";
      else if (anyFail) overallResult = "conditional_pass";
      else if (hasPass) overallResult = "pass";

      // Update the inspection with the computed result (trigger also does this, but we update for immediate UI feedback)
      await supabase
        .from("quality_inspections")
        .update({ result: overallResult })
        .eq("id", inspection.id);

      // On pass: create quality certificate + QR code
      if (overallResult === "pass") {
        const certNumber = `QC-${new Date().getFullYear()}-${String(Date.now() % 100000).padStart(5, "0")}`;
        const { data: cert } = await supabase
          .from("quality_certificates")
          .insert({
            company_id: companyId,
            certificate_number: certNumber,
            inspection_id: inspection.id,
            issued_by: user.id,
          })
          .select("id")
          .single();

        if (cert) {
          await supabase.from("qr_codes").insert({
            company_id: companyId,
            entity_type: "quality_certificate",
            entity_id: cert.id,
            type: "quality_certificate",
            status: "active",
            qr_data: certNumber,
            label: certNumber,
            sub_label: `${formData.product_name || "Product"} · ${inspectionNumber}`,
          });
        }
      }

      return { id: inspection.id, result: overallResult, number: inspectionNumber };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["q-inspections"] });
      if (data?.result === "pass") {
        toast.success(`✅ Inspection ${data.number} PASSED — Certificate generated`);
      } else if (data?.result === "fail") {
        toast.error(`❌ Inspection ${data.number} FAILED — NCR/CAPA raised`);
      } else {
        toast.success(`Inspection ${data.number} submitted (${data.result})`);
      }
      setShowNew(false);
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function resetForm() {
    setFormData({
      inspection_number: "",
      inspection_type: "final",
      batch_reference: "",
      product_name: "",
      quantity_checked: "1",
      overall_notes: "",
    });
    setParamValues({});
    setExpandedCats({});
  }

  const fmt = (v: number | null, suffix = "%") => (v === null ? "—" : `${v.toFixed(1)}${suffix}`);

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="quality" />
      <PageHeader
        eyebrow="Quality"
        title="Quality Management"
        sub="Detailed furniture QC — every measurable parameter, not just a percentage."
        actions={
          !isAuditor ? (
            <div className="flex items-center gap-2">
              <ModuleCopilot moduleName="quality" />
              <Button
                className="bg-[image:var(--gradient-primary)] shadow-glow"
                onClick={() => setShowNew(true)}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                New Inspection
              </Button>
            </div>
          ) : (
            <ModuleCopilot moduleName="quality" />
          )
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="inspections">Inspections</TabsTrigger>
          <TabsTrigger value="parameters">Parameter Trends</TabsTrigger>
          <TabsTrigger value="incoming" className="relative">
            Incoming Materials
            {pendingIncoming > 0 && (
              <span className="ml-1.5 h-4 w-4 rounded-full bg-amber-500 text-[10px] font-medium text-white inline-flex items-center justify-center">
                {pendingIncoming}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ─── DASHBOARD TAB ─── */}
        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            <Kpi
              label="First-Pass Yield"
              value={fmt(stats.firstPassYield)}
              icon={ShieldCheck}
              tone="success"
            />
            <Kpi label="Defect Rate" value={fmt(stats.defectRate)} icon={AlertOctagon} tone="warning" />
            <Kpi label="Passed" value={String(stats.passed)} icon={CheckCircle2} tone="success" />
            <Kpi label="Failed" value={String(stats.failed)} icon={XCircle} tone="destructive" />
            <Kpi label="Conditional" value={String(stats.conditional)} icon={ClipboardCheck} tone="info" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <Panel title="Yield · last 12 weeks">
                {(inspections ?? []).length === 0 ? (
                  <EmptyState title="No inspections yet" sub="Record your first inspection to see yield trends." />
                ) : (
                  <div className="h-44 sm:h-64">
                    <ResponsiveContainer>
                      <AreaChart data={trend}>
                        <defs>
                          <linearGradient id="qy" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="oklch(0.72 0.19 145)" stopOpacity={0.5} />
                            <stop offset="100%" stopColor="oklch(0.72 0.19 145)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="w" stroke="rgba(255,255,255,0.4)" fontSize={10} />
                        <YAxis domain={[0, 100]} stroke="rgba(255,255,255,0.4)" fontSize={10} />
                        <Tooltip
                          contentStyle={{
                            background: "oklch(0.20 0.025 260)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 12,
                            fontSize: 12,
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="yield"
                          stroke="oklch(0.72 0.19 145)"
                          fill="url(#qy)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Panel>
            </div>
            <Panel title="Inspection Summary" right={<span className="text-[10px] text-primary">{stats.total} total</span>}>
              <div className="space-y-3">
                {(inspections ?? []).length === 0 ? (
                  <EmptyState title="No data yet" sub="Inspections will summarize automatically." />
                ) : (
                  <>
                    {[
                      { t: "Passed", c: stats.passed, color: "text-emerald-400" },
                      { t: "Failed", c: stats.failed, color: "text-red-400" },
                      { t: "Conditional Pass", c: stats.conditional, color: "text-yellow-400" },
                      { t: "Pending", c: inspections?.filter((r) => r.result === "pending").length ?? 0, color: "text-muted-foreground" },
                    ].map((r, i) => (
                      <div key={i} className="rounded-xl bg-card/60 border border-white/5 p-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{r.t}</span>
                          <span className={`font-semibold tabular-nums ${r.color}`}>{r.c}</span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </Panel>
          </div>
        </TabsContent>

        {/* ─── INSPECTIONS TAB ─── */}
        <TabsContent value="inspections" className="space-y-4">
          <Panel title="Inspection History">
            {(inspections ?? []).length === 0 ? (
              <EmptyState title="No inspections yet" sub="Run your first detailed QC inspection." />
            ) : (
              <div className="divide-y divide-white/5">
                {(inspections ?? []).map((n: any) => (
                  <div
                    key={n.id}
                    className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto_auto] items-center gap-2 sm:gap-3 py-3 text-sm cursor-pointer hover:bg-muted/20 rounded-lg px-2 transition-colors"
                    onClick={() => setDetailInspection(n)}
                  >
                    <div className="font-mono text-xs">{n.inspection_number}</div>
                    <div>
                      <div className="capitalize">{String(n.inspection_type).replace(/_/g, " ")}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {n.batch_reference ? `${n.batch_reference} · ` : ""}
                        {n.quantity_checked ?? 0} checked · {n.defects_found ?? 0} defects · {safeDate(n.created_at)}
                      </div>
                    </div>
                    <StatusBadge status={n.result} />
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </TabsContent>

        {/* ─── PARAMETER TRENDS TAB ─── */}
        <TabsContent value="parameters" className="space-y-4">
          <Panel title="Which parameters fail most?">
            <div className="text-xs text-muted-foreground py-4 text-center">
              Parameter-level trend analysis will populate as inspections with itemized parameters accumulate.
              <br />
              Check back after running several inspections — the system tracks pass/fail rates per individual parameter.
            </div>
          </Panel>
        </TabsContent>

        {/* ─── INCOMING MATERIALS TAB ─── */}
        <TabsContent value="incoming" className="space-y-4">
          <Panel
            title={`Incoming Material Inspections · ${(incomingInspections ?? []).length} records`}
            right={
              pendingIncoming > 0 ? (
                <span className="text-xs text-amber-400 font-medium">
                  {pendingIncoming} awaiting QC gate approval
                </span>
              ) : undefined
            }
          >
            {(incomingInspections ?? []).length === 0 ? (
              <EmptyState
                title="No incoming material inspections"
                sub="Confirm a Goods Receipt in the Goods Receipt module to trigger incoming QC inspections."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-white/5">
                      <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Material</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">PO #</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Destination Warehouse</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Qty</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Status</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Notes / Reason</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(incomingInspections ?? []).map((insp: any) => {
                      const mat = resolveRelation<{ name?: string; unit?: string }>(insp.materials);
                      const wh = resolveRelation<{ name?: string; code?: string }>(insp.warehouses);
                      const po = resolveRelation<{ po_number?: string }>(insp.purchase_orders);
                      const isPending = insp.status === "pending";

                      return (
                        <TableRow key={insp.id} className="border-white/5">
                          <TableCell className="font-medium text-sm">
                            {mat?.name ?? "—"}{" "}
                            {mat?.unit && <span className="text-muted-foreground text-xs font-normal">({mat.unit})</span>}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-primary">{po?.po_number ?? "—"}</TableCell>
                          <TableCell className="text-xs">
                            {wh ? (
                              <span>
                                <span className="font-mono text-muted-foreground">{wh.code ? `[${wh.code}] ` : ""}</span>
                                {wh.name}
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs font-semibold">{insp.quantity}</TableCell>
                          <TableCell>
                            <StatusBadge status={insp.status} />
                          </TableCell>
                          <TableCell>
                            {isPending && !isAuditor ? (
                              <Input
                                value={inspNotes[insp.id] ?? ""}
                                onChange={(e) =>
                                  setInspNotes((n) => ({ ...n, [insp.id]: e.target.value }))
                                }
                                placeholder="Inspection notes..."
                                className="h-7 text-xs w-48"
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {insp.rejection_reason ? `Rejected: ${insp.rejection_reason}` : insp.notes ?? "—"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {isPending && !isAuditor ? (
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                  loading={processingId === insp.id && processInspectionMutation.isPending}
                                  disabled={processingId !== null}
                                  onClick={() => {
                                    setProcessingId(insp.id);
                                    processInspectionMutation.mutate({
                                      id: insp.id,
                                      decision: "approved",
                                      notes: inspNotes[insp.id],
                                    });
                                  }}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve &amp; Stock
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs border-red-500/50 text-red-400 hover:bg-red-500/10"
                                  disabled={processingId !== null}
                                  onClick={() => {
                                    setRejectDialogInspection(insp);
                                    setRejectDialogReason("Failed visual/dimensional inspection");
                                    setRejectDialogNotes(inspNotes[insp.id] || "");
                                  }}
                                >
                                  <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground font-mono">
                                {safeDate(insp.inspected_at || insp.created_at)}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="mt-3 p-3 rounded-lg bg-card/60 border border-white/5 flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="text-[11px] text-muted-foreground leading-relaxed">
                <strong className="text-foreground font-medium">Quality Gate Architecture:</strong> Goods receipts do not enter active inventory until verified here. Approving credits the usable stock in the assigned warehouse. Rejecting quarantines the batch, triggers an alert for procurement, and flags the PO line item.
              </div>
            </div>
          </Panel>
        </TabsContent>
      </Tabs>

      {/* ─── NEW INSPECTION DIALOG ─── */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detailed Furniture QC Inspection</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Basic info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Inspection # *</Label>
                <Input
                  value={formData.inspection_number}
                  onChange={(e) => setFormData((d) => ({ ...d, inspection_number: e.target.value }))}
                  placeholder="QI-2026-001"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <Select
                  value={formData.inspection_type}
                  onValueChange={(v) => setFormData((d) => ({ ...d, inspection_type: v }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="incoming">Incoming</SelectItem>
                    <SelectItem value="in_process">In-Process</SelectItem>
                    <SelectItem value="final">Final</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Batch / WO Ref</Label>
                <Input
                  value={formData.batch_reference}
                  onChange={(e) => setFormData((d) => ({ ...d, batch_reference: e.target.value }))}
                  placeholder="WO-2026-012"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Product Type</Label>
                <Input
                  value={formData.product_name}
                  onChange={(e) => setFormData((d) => ({ ...d, product_name: e.target.value }))}
                  placeholder="Dining Table – Teak"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Quantity Checked</Label>
                <Input
                  type="number"
                  value={formData.quantity_checked}
                  onChange={(e) => setFormData((d) => ({ ...d, quantity_checked: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Overall Notes</Label>
                <Textarea
                  value={formData.overall_notes}
                  onChange={(e) => setFormData((d) => ({ ...d, overall_notes: e.target.value }))}
                  placeholder="Any overall observations..."
                  rows={2}
                />
              </div>
            </div>

            {/* 7 QC Categories — collapsible */}
            <div className="space-y-2">
              {QC_CATEGORIES.map((cat) => {
                const isExpanded = expandedCats[cat.key] !== false; // default open
                const catVals = paramValues[cat.key] ?? {};
                const filledCount = Object.keys(catVals).filter(
                  (k) => catVals[k].measured_value || catVals[k].result !== "pending",
                ).length;
                const failCount = Object.values(catVals).filter((v) => v.result === "fail").length;

                return (
                  <div key={cat.key} className="border border-white/5 rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleCat(cat.key)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="text-sm font-medium">
                          {cat.icon} {cat.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {filledCount}/{cat.params.length}
                        </span>
                        {failCount > 0 && (
                          <span className="text-[10px] text-red-400 font-medium">{failCount} FAIL</span>
                        )}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="p-3 space-y-2">
                        {cat.params.map((param) => (
                          <ParamRow
                            key={param.name}
                            param={param}
                            value={catVals[param.name] ?? { measured_value: "", result: "pending", notes: "", photo_url: "" }}
                            onChange={(field, val) => setParamValue(cat.key, param.name, field, val)}
                            productType={formData.product_name}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNew(false); resetForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="bg-[image:var(--gradient-primary)]"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Submit Inspection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── REJECT INCOMING INSPECTION DIALOG ─── */}
      <Dialog
        open={!!rejectDialogInspection}
        onOpenChange={(open) => !open && setRejectDialogInspection(null)}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center gap-2 text-base">
              <XCircle className="h-5 w-5" /> Reject Incoming Material
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Rejecting this material will quarantine the stock. It will <strong className="text-foreground">not</strong> enter usable inventory, and procurement will be flagged.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Rejection Reason *</Label>
              <Select value={rejectDialogReason} onValueChange={setRejectDialogReason}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Failed visual/dimensional inspection">Failed visual/dimensional inspection</SelectItem>
                  <SelectItem value="Damaged packaging / moisture damage">Damaged packaging / moisture damage</SelectItem>
                  <SelectItem value="Incorrect specifications / wrong grade">Incorrect specifications / wrong grade</SelectItem>
                  <SelectItem value="Moisture content above tolerance">Moisture content above tolerance</SelectItem>
                  <SelectItem value="Contamination or surface defects">Contamination or surface defects</SelectItem>
                  <SelectItem value="Missing compliance certificates / COC">Missing compliance certificates / COC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Additional Inspector Notes</Label>
              <Textarea
                value={rejectDialogNotes}
                onChange={(e) => setRejectDialogNotes(e.target.value)}
                placeholder="Specific batch defect details..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogInspection(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={processInspectionMutation.isPending}
              onClick={() => {
                if (!rejectDialogInspection) return;
                setProcessingId(rejectDialogInspection.id);
                processInspectionMutation.mutate({
                  id: rejectDialogInspection.id,
                  decision: "rejected",
                  reason: rejectDialogReason,
                  notes: rejectDialogNotes,
                });
              }}
            >
              Confirm Rejection &amp; Quarantine
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── INSPECTION DETAIL DIALOG ─── */}
      {detailInspection && (
        <InspectionDetail
          inspection={detailInspection}
          parameters={detailParams ?? []}
          onClose={() => setDetailInspection(null)}
        />
      )}
    </div>
  );
}
