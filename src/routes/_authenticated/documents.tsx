import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Upload,
  Download,
  Trash2,
  File,
  Image,
  FileSpreadsheet,
  Loader2,
  Eye,
  Search,
  FolderOpen,
  FilePlus2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Kpi, StatusBadge, PageHeader, Panel } from "@/components/ui-parts";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useState, useRef, useMemo } from "react";
import { safeDate } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({
    meta: [
      { title: "Documents — FactoryOS AI" },
      {
        name: "description",
        content: "SOPs, manuals, policies, delivery notes and shared documents with customer upload support.",
      },
    ],
  }),
  component: DocumentsPage,
});

// ── Categories config ────────────────────────────────────────────────────────
const ALL_CATEGORIES = [
  { value: "all",         label: "All",           icon: FolderOpen },
  { value: "general",     label: "General",       icon: File },
  { value: "sop",         label: "SOP",           icon: FileText },
  { value: "iso",         label: "ISO/Compliance", icon: FileText },
  { value: "shipping",    label: "Shipping",      icon: FileText },
  { value: "contract",    label: "Contract",      icon: FileText },
  { value: "customer",    label: "Customer Upload", icon: FilePlus2 },
  { value: "hr",          label: "HR",            icon: FileText },
  { value: "finance",     label: "Finance",       icon: FileText },
  { value: "engineering", label: "Engineering",   icon: FileSpreadsheet },
] as const;

// Customer-visible categories (docs the company has shared with them)
const CUSTOMER_VIEW_CATEGORIES = ["general", "shipping", "contract", "customer"];

function fileIcon(fileType: string | null) {
  if (!fileType) return File;
  if (fileType === "pdf") return FileText;
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(fileType)) return Image;
  if (["xls", "xlsx", "csv"].includes(fileType)) return FileSpreadsheet;
  return File;
}

function fileIconColor(fileType: string | null) {
  if (!fileType) return "bg-primary/10 border-primary/20 text-primary";
  if (fileType === "pdf") return "bg-destructive/10 border-destructive/20 text-destructive";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(fileType))
    return "bg-info/10 border-info/20 text-info";
  if (["xls", "xlsx", "csv"].includes(fileType))
    return "bg-success/10 border-success/20 text-success";
  return "bg-primary/10 border-primary/20 text-primary";
}

function DocumentsPage() {
  const queryClient = useQueryClient();
  const { companyId, user, roles } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showUpload,  setShowUpload]  = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({
    title:       "",
    category:    "general",
    description: "",
    visibility:  "company",
  });
  const [uploading, setUploading] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQ, setSearchQ] = useState("");

  const isCustomer = roles.includes("customer_portal");
  const isAdmin    = roles.includes("company_admin") || roles.includes("plant_admin") || roles.includes("root_super_admin");

  // ── Fetch documents ────────────────────────────────────────────────────────
  const { data: allDocs } = useQuery({
    queryKey: ["documents", companyId, isCustomer],
    queryFn: async () => {
      let query = supabase.from("documents").select("*").order("created_at", { ascending: false });

      // Customers only see public or customer-visible docs
      if (isCustomer) {
        query = query.in("visibility", ["public", "customer"]);
      }

      const { data } = await query;
      return data ?? [];
    },
  });

  // Customer documents submitted by customers (admin only)
  const { data: customerDocs } = useQuery({
    queryKey: ["customer-documents", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("customer_documents")
        .select("*, customers!inner(name)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !isCustomer,
  });

  // ── Derived data ──────────────────────────────────────────────────────────
  const filteredDocs = useMemo(() => {
    let docs = allDocs ?? [];
    if (activeCategory !== "all") {
      docs = docs.filter((d: any) => d.category === activeCategory);
    }
    if (searchQ.trim()) {
      const s = searchQ.toLowerCase();
      docs = docs.filter(
        (d: any) =>
          d.title?.toLowerCase().includes(s) ||
          d.category?.toLowerCase().includes(s) ||
          d.description?.toLowerCase().includes(s),
      );
    }
    return docs;
  }, [allDocs, activeCategory, searchQ]);

  // Category counts for tabs
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allDocs?.length ?? 0 };
    (allDocs ?? []).forEach((d: any) => {
      counts[d.category ?? "general"] = (counts[d.category ?? "general"] ?? 0) + 1;
    });
    return counts;
  }, [allDocs]);

  const totalDocs        = allDocs?.length ?? 0;
  const published        = allDocs?.filter((d: any) => d.status === "published").length ?? 0;
  const customerUploaded = allDocs?.filter((d: any) => d.category === "customer").length ?? 0;
  const categories       = new Set(allDocs?.map((d: any) => d.category).filter(Boolean)).size;

  // ── Mutations ─────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Document deleted");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // ── Upload ─────────────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setSelectedFile(f);
    if (f && !uploadForm.title) {
      // Auto-fill title from filename (without extension)
      setUploadForm((prev) => ({
        ...prev,
        title: f.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
      }));
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file");
      return;
    }
    if (!uploadForm.title.trim()) {
      toast.error("Please enter a title");
      return;
    }
    setUploading(true);
    try {
      const { error } = await supabase.from("documents").insert({
        company_id:  companyId!,
        title:       uploadForm.title,
        description: uploadForm.description || null,
        category:    uploadForm.category,
        file_type:   selectedFile.name.split(".").pop()?.toLowerCase() || "unknown",
        file_url:    URL.createObjectURL(selectedFile),
        uploaded_by: user?.id,
        visibility:  uploadForm.visibility,
        version:     "v1",
        status:      "published",
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Document uploaded");
      setShowUpload(false);
      setSelectedFile(null);
      setUploadForm({ title: "", category: "general", description: "", visibility: "company" });
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  // Visible categories in tabs (customers see a subset)
  const visibleCats = isCustomer
    ? ALL_CATEGORIES.filter(
        (c) => c.value === "all" || CUSTOMER_VIEW_CATEGORIES.includes(c.value as any),
      )
    : ALL_CATEGORIES;

  return (
    <div className="max-w-[1400px] mx-auto">
      <ModuleStatusBar moduleName="documents" />
      <PageHeader
        eyebrow={isCustomer ? "My Account" : "Knowledge"}
        title={isCustomer ? "My Documents" : "Documents"}
        sub={
          isCustomer
            ? "Documents shared with you — certificates, contracts, and shipping notices."
            : "SOPs, manuals, policies, delivery notes and customer-uploaded documents."
        }
        actions={
          <div className="flex items-center gap-2">
            <ModuleCopilot moduleName="documents" />
            <Button
              className="bg-[image:var(--gradient-primary)] shadow-glow"
              onClick={() => setShowUpload(true)}
            >
              <Upload className="h-4 w-4 mr-1.5" />
              Upload
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Kpi label="Total Documents"   value={String(totalDocs)}        icon={FileText}      tone="primary" />
        <Kpi label="Published"         value={String(published)}        icon={FileText}      tone="success" />
        <Kpi label="Customer Uploaded" value={String(customerUploaded)} icon={Upload}        tone="info" />
        <Kpi label="Categories"        value={String(categories)}       icon={FileSpreadsheet} tone="warning" />
      </div>

      {/* Search + Category tabs */}
      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search documents…"
            className="pl-9 h-10 bg-background/40"
          />
          {searchQ && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearchQ("")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-2">
          {visibleCats.map((cat) => {
            const count = categoryCounts[cat.value] ?? 0;
            const isActive = activeCategory === cat.value;
            return (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-glow"
                    : "bg-muted/30 text-muted-foreground border-white/10 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                }`}
              >
                <cat.icon className="h-3 w-3" />
                {cat.label}
                {count > 0 && (
                  <span
                    className={`ml-0.5 px-1.5 py-0 rounded-full text-[9px] font-semibold ${
                      isActive ? "bg-white/20 text-white" : "bg-white/10 text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Customer documents section (admin only) */}
      {!isCustomer && customerDocs && customerDocs.length > 0 && (
        <div className="mb-4">
          <Panel title={`Customer Documents (${customerDocs.length})`}>
            <div className="divide-y divide-white/5">
              {customerDocs.map((doc: any) => {
                const Icon = fileIcon(doc.file_type);
                return (
                  <div key={doc.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-lg border grid place-items-center ${fileIconColor(doc.file_type)}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium">{doc.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {doc.customers?.name ?? "—"} · {doc.file_type ?? "—"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{safeDate(doc.created_at)}</span>
                      {doc.file_url && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => window.open(doc.file_url, "_blank")}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      )}

      {/* Main documents table */}
      <Panel
        title={`${filteredDocs.length} document${filteredDocs.length !== 1 ? "s" : ""}${
          activeCategory !== "all" ? ` · ${ALL_CATEGORIES.find((c) => c.value === activeCategory)?.label}` : ""
        }${searchQ ? ` matching "${searchQ}"` : ""}`}
      >
        {filteredDocs.length === 0 ? (
          <div className="text-center text-muted-foreground py-12 text-sm">
            {searchQ
              ? `No documents matching "${searchQ}".`
              : activeCategory !== "all"
              ? `No ${ALL_CATEGORIES.find((c) => c.value === activeCategory)?.label} documents yet.`
              : "No documents yet. Upload your first document to get started."}
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            <AnimatePresence mode="popLayout">
              {filteredDocs.map((doc: any, idx: number) => {
                const Icon = fileIcon(doc.file_type);
                return (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ delay: idx * 0.02 }}
                    className="flex items-center justify-between py-3 text-sm group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-9 w-9 rounded-xl border grid place-items-center shrink-0 ${fileIconColor(doc.file_type)}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{doc.title}</div>
                        <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-1 mt-0.5">
                          <Badge
                            variant="outline"
                            className="text-[9px] h-4 px-1.5 capitalize bg-muted/30 border-white/10 text-muted-foreground"
                          >
                            {doc.category ?? "general"}
                          </Badge>
                          {doc.version && <span className="text-muted-foreground/60">v{doc.version}</span>}
                          {doc.file_type && <span className="text-muted-foreground/60 uppercase">{doc.file_type}</span>}
                          {doc.description && (
                            <span className="hidden md:inline text-muted-foreground/50 truncate max-w-[200px]">
                              · {doc.description}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={doc.status ?? "published"} />
                      {!isCustomer && (
                        <StatusBadge status={doc.visibility ?? "company"} />
                      )}
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        {safeDate(doc.created_at)}
                      </span>
                      {doc.file_url && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-60 group-hover:opacity-100 transition"
                          title="Preview / Download"
                          onClick={() => window.open(doc.file_url, "_blank")}
                        >
                          {["pdf", "png", "jpg", "jpeg", "gif"].includes(doc.file_type ?? "")
                            ? <Eye className="h-3.5 w-3.5" />
                            : <Download className="h-3.5 w-3.5" />
                          }
                        </Button>
                      )}
                      {!isCustomer && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition"
                          onClick={() => deleteMutation.mutate(doc.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </Panel>

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-primary" />
              Upload Document
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* File picker — shown first so title can auto-fill */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">File *</Label>
              <div
                className={`border-2 border-dashed rounded-xl p-5 text-center hover:border-primary/40 transition cursor-pointer ${
                  selectedFile ? "border-primary/40 bg-primary/5" : "border-white/10"
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <File className="h-5 w-5 text-primary" />
                    <div className="text-sm font-medium text-left">
                      <div className="truncate max-w-[280px]">{selectedFile.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                    <button
                      className="ml-2 text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                    <div className="text-sm text-muted-foreground">Click to select a file</div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      PDF, Images, Documents accepted
                    </div>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg,.gif,.doc,.docx,.xls,.xlsx,.csv"
                  onChange={handleFileChange}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Title *</Label>
              <Input
                value={uploadForm.title}
                onChange={(e) => setUploadForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Document title"
                className="h-10"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Category</Label>
                <Select
                  value={uploadForm.category}
                  onValueChange={(v) => setUploadForm((f) => ({ ...f, category: v }))}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_CATEGORIES.filter((c) => c.value !== "all").map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Visibility</Label>
                <Select
                  value={uploadForm.visibility}
                  onValueChange={(v) => setUploadForm((f) => ({ ...f, visibility: v }))}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company">Company Only</SelectItem>
                    <SelectItem value="customer">Customer Only</SelectItem>
                    <SelectItem value="public">Public</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Description</Label>
              <Textarea
                value={uploadForm.description}
                onChange={(e) => setUploadForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional description"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpload(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[image:var(--gradient-primary)]"
              onClick={handleFileUpload}
              disabled={uploading || !selectedFile || !uploadForm.title.trim()}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-1.5" />
              )}
              Upload Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
