import { createFileRoute } from "@tanstack/react-router";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { useQuery } from "@tanstack/react-query";
import { FileText, FolderOpen, Upload, Download, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({ meta: [
    { title: "Documents — FactoryOS AI" },
    { name: "description", content: "Document management, sharing and version control." },
  ]}),
  component: DocumentsPage,
});

// Demo documents derived from ERP context
const DEMO_DOCS = [
  { id: "1", name: "Production Report Q1 2026", category: "Reports", type: "PDF", size: "2.4 MB", updated: "2 hours ago", status: "active", author: "Admin" },
  { id: "2", name: "ISO 9001 Quality Manual", category: "Compliance", type: "PDF", size: "8.1 MB", updated: "1 week ago", status: "active", author: "Quality Manager" },
  { id: "3", name: "Machine Maintenance Schedule", category: "Maintenance", type: "XLSX", size: "156 KB", updated: "3 days ago", status: "active", author: "Maintenance Eng." },
  { id: "4", name: "Supplier Agreement - Nordic Steel", category: "Contracts", type: "PDF", size: "1.2 MB", updated: "2 weeks ago", status: "active", author: "Procurement" },
  { id: "5", name: "Safety Data Sheet - Ti Alloy", category: "Safety", type: "PDF", size: "3.8 MB", updated: "1 month ago", status: "active", author: "HSE" },
  { id: "6", name: "Customer Invoice Template", category: "Finance", type: "DOCX", size: "89 KB", updated: "5 days ago", status: "active", author: "Finance" },
  { id: "7", name: "Employee Handbook 2026", category: "HR", type: "PDF", size: "4.2 MB", updated: "3 weeks ago", status: "active", author: "HR Manager" },
  { id: "8", name: "Plant Layout Blueprint", category: "Engineering", type: "DWG", size: "12.5 MB", updated: "1 month ago", status: "active", author: "Engineering" },
];

function DocumentsPage() {
  const [search, setSearch] = useState("");
  const docs = DEMO_DOCS.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.category.toLowerCase().includes(search.toLowerCase())
  );
  const categories = [...new Set(DEMO_DOCS.map(d => d.category))];
  const categoryCount = categories.length;

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="Knowledge"
        title="Documents"
        sub="Centralized document management with categories, versioning and sharing."
        actions={
          <Button className="bg-[image:var(--gradient-primary)] shadow-glow" onClick={() => toast.info("Upload feature — coming soon")}>
            <Upload className="h-4 w-4 mr-1.5" />Upload Document
          </Button>
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Total Documents" value={String(DEMO_DOCS.length)} icon={FileText} tone="primary" />
        <Kpi label="Categories" value={String(categoryCount)} icon={FolderOpen} tone="info" />
        <Kpi label="This Week" value="3" icon={FileText} tone="success" />
        <Kpi label="Shared" value="6" icon={FolderOpen} tone="warning" />
      </div>

      <div className="mt-4">
        <Panel title={`${docs.length} Documents`} right={
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search documents…" className="h-8 pl-8 w-48 bg-background/40" />
          </div>
        }>
          <div className="space-y-2">
            {docs.map(doc => (
              <div key={doc.id} className="flex items-center justify-between gap-3 py-3 px-2 rounded-lg hover:bg-white/[0.02] transition-colors border-b border-white/5 last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{doc.name}</div>
                    <div className="text-[11px] text-muted-foreground">{doc.author} · {doc.updated}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant="outline" className="text-[10px] font-medium hidden sm:inline-flex">{doc.category}</Badge>
                  <Badge variant="outline" className="text-[10px] font-medium bg-info/10 text-info border-info/20 hidden md:inline-flex">{doc.type}</Badge>
                  <span className="text-[11px] text-muted-foreground hidden lg:inline">{doc.size}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toast.info(`Download ${doc.name}`)}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
