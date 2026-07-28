import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Upload, Download, Trash2, File, Image, FileSpreadsheet, Loader2, Plus, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResourceView, type FormField } from "@/components/resource-view";
import { Kpi, StatusBadge, Panel, PageHeader } from "@/components/ui-parts";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useState, useRef } from "react";
import { safeDate } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({ meta: [
    { title: "Documents — FactoryOS AI" },
    { name: "description", content: "SOPs, manuals, policies, delivery notes and shared documents with customer upload support." },
  ]}),
  component: DocumentsPage,
});

const DOC_FORM_FIELDS: FormField[] = [
  { key: "title", label: "Title", type: "text", placeholder: "Document title", required: true },
  { key: "category", label: "Category", type: "select", defaultValue: "general", options: [
    { value: "general", label: "General" },
    { value: "sop", label: "SOP" },
    { value: "iso", label: "ISO/Compliance" },
    { value: "shipping", label: "Shipping" },
    { value: "contract", label: "Contract" },
    { value: "customer", label: "Customer Upload" },
    { value: "hr", label: "HR" },
    { value: "finance", label: "Finance" },
    { value: "engineering", label: "Engineering" },
  ]},
  { key: "description", label: "Description", type: "textarea" },
  { key: "visibility", label: "Visibility", type: "select", defaultValue: "company", options: [
    { value: "company", label: "Company" },
    { value: "public", label: "Public (Read-only)" },
    { value: "customer", label: "Customer Only" },
  ]},
];

function DocumentsPage() {
  const queryClient = useQueryClient();
  const { companyId, user, roles } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: "",
    category: "customer",
    description: "",
    visibility: "customer",
  });
  const [uploading, setUploading] = useState(false);

  const isCustomer = roles.includes("customer_portal");

  const { data } = useQuery({
    queryKey: ["documents", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Customer documents table
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

  const handleFileUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Please select a file");
      return;
    }
    if (!uploadForm.title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    setUploading(true);
    try {
      // For demo: create a document record with a placeholder URL
      // In production, upload to Supabase Storage
      const { error } = await supabase.from("documents").insert({
        company_id: companyId!,
        title: uploadForm.title,
        description: uploadForm.description || null,
        category: uploadForm.category,
        file_type: file.name.split(".").pop() || "unknown",
        file_url: URL.createObjectURL(file), // In production, use uploaded URL
        uploaded_by: user?.id,
        visibility: uploadForm.visibility,
        version: "v1",
        status: "published",
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Document uploaded");
      setShowUpload(false);
      setUploadForm({ title: "", category: "customer", description: "", visibility: "customer" });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const totalDocs = data?.length ?? 0;
  const customerUploaded = data?.filter((d: any) => d.category === "customer").length ?? 0;
  const published = data?.filter((d: any) => d.status === "published").length ?? 0;

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="documents" />
      <PageHeader
        eyebrow="Knowledge"
        title={isCustomer ? "My Documents" : "Documents"}
        sub={isCustomer
          ? "Upload and manage your documents — certificates, contracts, drawings, and more."
          : "SOPs, manuals, policies, delivery notes and customer-uploaded documents."}
        actions={
          <div className="flex items-center gap-2">
            <ModuleCopilot moduleName="documents" />
            <Button className="bg-[image:var(--gradient-primary)] shadow-glow" onClick={() => setShowUpload(true)}>
              <Upload className="h-4 w-4 mr-1.5" />Upload
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Kpi label="Total Documents" value={String(totalDocs)} icon={FileText} tone="primary" />
        <Kpi label="Published" value={String(published)} icon={FileText} tone="success" />
        <Kpi label="Customer Uploaded" value={String(customerUploaded)} icon={Upload} tone="info" />
        <Kpi label="Categories" value={String(new Set(data?.map((d: any) => d.category).filter(Boolean)).size)} icon={FileSpreadsheet} tone="warning" />
      </div>

      {/* Customer Documents section */}
      {!isCustomer && customerDocs && customerDocs.length > 0 && (
        <div className="mb-4">
        <Panel title={`Customer Documents (${customerDocs.length})`}>
          <div className="divide-y divide-white/5">
            {customerDocs.map((doc: any) => (
              <div key={doc.id} className="flex items-center justify-between py-2.5 text-sm">
                <div className="flex items-center gap-3">
                  <File className="h-4 w-4 text-primary/60" />
                  <div>
                    <div className="font-medium">{doc.title}</div>
                    <div className="text-xs text-muted-foreground">{doc.customers?.name ?? "—"} · {doc.file_type ?? "—"}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{safeDate(doc.created_at)}</span>
                  {doc.file_url && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(doc.file_url, "_blank")}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Panel>
        </div>
      )}

      {/* Main documents table */}
      <Panel title={`${data?.length ?? 0} documents`}>
        {(!data || data.length === 0) ? (
          <div className="text-center text-muted-foreground py-12 text-sm">
            No documents yet. Upload your first document to get started.
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {data.map((doc: any) => (
              <div key={doc.id} className="flex items-center justify-between py-2.5 text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`h-8 w-8 rounded-lg grid place-items-center ${
                    doc.file_type === "pdf" ? "bg-destructive/10 text-destructive" :
                    doc.file_type?.startsWith("image") ? "bg-info/10 text-info" :
                    "bg-primary/10 text-primary"
                  }`}>
                    {doc.file_type === "pdf" ? <FileText className="h-4 w-4" /> :
                     doc.file_type?.startsWith("image") ? <Image className="h-4 w-4" /> :
                     <File className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{doc.title}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <span>{doc.category ?? "general"}</span>
                      {doc.version && <><span>·</span><span>v{doc.version}</span></>}
                      {doc.file_type && <><span>·</span><span>{doc.file_type}</span></>}
                      {doc.visibility && <><span>·</span><StatusBadge status={doc.visibility} /></>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={doc.status ?? "published"} />
                  <span className="text-xs text-muted-foreground hidden sm:inline">{safeDate(doc.created_at)}</span>
                  {doc.file_url && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(doc.file_url, "_blank")}>
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(doc.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Title *</Label>
              <Input
                value={uploadForm.title}
                onChange={(e) => setUploadForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Document title"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Category</Label>
              <Select value={uploadForm.category} onValueChange={(v) => setUploadForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer Upload</SelectItem>
                  <SelectItem value="shipping">Shipping</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="sop">SOP</SelectItem>
                  <SelectItem value="iso">ISO/Compliance</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Description</Label>
              <Textarea
                value={uploadForm.description}
                onChange={(e) => setUploadForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional description"
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Visibility</Label>
              <Select value={uploadForm.visibility} onValueChange={(v) => setUploadForm(f => ({ ...f, visibility: v }))}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer Only</SelectItem>
                  <SelectItem value="company">Company</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">File *</Label>
              <div className="border-2 border-dashed border-white/10 rounded-lg p-6 text-center hover:border-primary/30 transition cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                <div className="text-sm text-muted-foreground">Click to select a file</div>
                <div className="text-[10px] text-muted-foreground mt-1">PDF, Images, Documents accepted</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg,.gif,.doc,.docx,.xls,.xlsx,.csv"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpload(false)}>Cancel</Button>
            <Button
              className="bg-[image:var(--gradient-primary)]"
              onClick={handleFileUpload}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
              Upload Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
