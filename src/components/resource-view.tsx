import { useMemo, useState, useCallback, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, SlidersHorizontal, Download, Plus, X, Check, Trash2, Edit3, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, Panel, StatusBadge } from "@/components/ui-parts";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
  hideOnMobile?: boolean;
}

export interface FormField {
  key: string;
  label: string;
  type: "text" | "email" | "number" | "select" | "textarea" | "date";
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  defaultValue?: string;
}

export interface ResourceViewProps<T extends Record<string, any>> {
  eyebrow: string;
  title: string;
  sub?: string;
  moduleName?: string;
  rows: T[] | undefined;
  columns: Column<T>[];
  searchKeys: (keyof T)[];
  kpis?: ReactNode;
  extraActions?: ReactNode;
  formFields?: FormField[];
  onRowClick?: (row: T) => void;
  onDelete?: (row: T) => void;
  onSubmit?: (data: Record<string, string>, editingRow?: T) => Promise<void> | void;
  tableName?: string;
  selectFields?: string;
}

function exportToCSV<T>(rows: T[], columns: Column<T>[]) {
  const headers = columns.map(c => c.header).join(",");
  const data = rows.map(row =>
    columns.map(c => {
      const val = (row as any)[c.key];
      const str = String(val ?? "");
      return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(",")
  );
  const csv = [headers, ...data].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("Exported to CSV");
}

export function ResourceView<T extends Record<string, any>>({
  eyebrow, title, sub, moduleName, rows, columns, searchKeys, kpis, extraActions,
  formFields, onRowClick, onDelete, onSubmit,
}: ResourceViewProps<T>) {
  const [q, setQ] = useState("");
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedRow, setSelectedRow] = useState<T | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const isMobile = useIsMobile();

  const filtered = useMemo(() => {
    let result = rows ?? [];
    if (q.trim()) {
      const s = q.toLowerCase();
      result = result.filter((r) => searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(s)));
    }
    if (sortKey) {
      result = [...result].sort((a, b) => {
        const aVal = a[sortKey] ?? "";
        const bVal = b[sortKey] ?? "";
        const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [rows, q, searchKeys, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const handleNew = () => {
    const defaults: Record<string, string> = {};
    formFields?.forEach(f => { defaults[f.key] = f.defaultValue ?? ""; });
    setFormData(defaults);
    setShowNewDialog(true);
  };

  const handleEdit = (row: T) => {
    setSelectedRow(row);
    const data: Record<string, string> = {};
    formFields?.forEach(f => { data[f.key] = String(row[f.key] ?? ""); });
    setFormData(data);
    setShowEditDialog(true);
  };

  const handleDeleteClick = (row: T) => {
    setSelectedRow(row);
    setShowDeleteDialog(true);
  };  const handleFormSubmit = async () => {
    if (formFields?.some(f => f.required && !formData[f.key])) {
      toast.error("Please fill all required fields");
      return;
    }
    try {
      if (onSubmit) {
        await onSubmit(formData, selectedRow ?? undefined);
        // Parent handles its own toast via onSuccess/onError
      } else {
        toast.success(selectedRow ? "Record updated" : "Record created");
      }
      setShowNewDialog(false);
      setShowEditDialog(false);
      setFormData({});
      setSelectedRow(null);
    } catch (err: any) {
      toast.error(err?.message ?? "Something went wrong");
    }
  };

  const handleConfirmDelete = async () => {
    try {
      await onDelete?.(selectedRow!);
      // Parent handles its own toast via onSuccess/onError
    } catch {
      // Ignore — parent handles error toast
    }
    setShowDeleteDialog(false);
    setSelectedRow(null);
  };

  const visibleColumns = useMemo(() => {
    if (!isMobile) return columns;
    return columns.filter(c => !c.hideOnMobile);
  }, [columns, isMobile]);

  return (
    <div className="max-w-[1600px] mx-auto">
      {moduleName && <ModuleStatusBar moduleName={moduleName} />}
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        sub={sub}
        actions={
          <>
            {moduleName && <ModuleCopilot moduleName={moduleName} />}
            <Button variant="outline" className="glass border-white/5" onClick={() => exportToCSV(filtered, columns)}>
              <Download className="h-4 w-4 mr-1.5" />
              {isMobile ? "Export" : "Export CSV"}
            </Button>
            {extraActions}
            {formFields && (
              <Button className="bg-[image:var(--gradient-primary)] shadow-glow" onClick={handleNew}>
                <Plus className="h-4 w-4 mr-1.5" />New
              </Button>
            )}
          </>
        }
      />
      {kpis && <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">{kpis}</div>}
      <Panel
        title={`${filtered.length} record${filtered.length === 1 ? "" : "s"}`}
        right={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-8 pl-8 w-56 bg-background/40" />
            </div>
            <Button variant="ghost" size="sm" className="h-8"><SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />Filters</Button>
          </div>
        }
      >
        {/* Mobile Card View */}
        {isMobile ? (
          <div className="space-y-2 -mx-2 px-2">
            {filtered.map((row, i) => {
              const rowId = String(row.id ?? i);
              const isExpanded = expandedRow === rowId;
              const primaryCol = columns[0];
              const statusCol = columns.find(c => c.key === "status");
              return (
                <motion.div
                  key={rowId}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  className="rounded-xl border border-white/5 bg-card/60 p-3"
                >
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedRow(isExpanded ? null : rowId)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {primaryCol?.render ? primaryCol.render(row) : (row as any)[primaryCol?.key]}
                      </div>
                      {statusCol && (
                        <div className="mt-1">
                          <StatusBadge status={(row as any)[statusCol.key]} />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      {formFields && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleEdit(row); }}>
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteClick(row); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 pt-3 border-t border-white/5 grid grid-cols-2 gap-2">
                          {columns.slice(1).map(c => (
                            <div key={c.key} className="text-xs">
                              <div className="text-muted-foreground">{c.header}</div>
                              <div className="mt-0.5 text-sm">
                                {c.render ? c.render(row) : String((row as any)[c.key] ?? "—")}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Button variant="outline" size="sm" className="flex-1 h-8" onClick={() => onRowClick?.(row)}>
                            View Details
                          </Button>
                          {formFields && (
                            <Button variant="outline" size="sm" className="h-8" onClick={() => handleEdit(row)}>
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center text-muted-foreground py-8 text-sm">No records</div>
            )}
          </div>
        ) : (
          /* Desktop Table View */
          <div className="overflow-x-auto -mx-2">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-white/5">
                  {visibleColumns.map((c) => (
                    <TableHead
                      key={c.key}
                      className={`text-[11px] uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-white/80 transition-colors ${c.className ?? ""}`}
                      onClick={() => handleSort(c.key)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {c.header}
                        {sortKey === c.key && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </span>
                    </TableHead>
                  ))}
                  {(formFields || onDelete) && <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground w-24">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row, i) => (
                  <motion.tr
                    key={row.id ?? i}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.4) }}
                    className="border-white/5 hover:bg-white/[0.02] transition cursor-pointer"
                    onClick={() => onRowClick?.(row)}
                  >
                    {visibleColumns.map((c) => (
                      <TableCell key={c.key} className={`text-sm ${c.className ?? ""}`}>
                        {c.render ? c.render(row) : (row as any)[c.key]}
                      </TableCell>
                    ))}
                    {(formFields || onDelete) && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {formFields && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleEdit(row); }}>
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {onDelete && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteClick(row); }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </motion.tr>
                ))}
                {filtered.length === 0 && (
                  <TableRow className="border-white/5"><TableCell colSpan={visibleColumns.length + 1} className="text-center text-muted-foreground py-8 text-sm">No records found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      {/* New / Edit Dialog */}
      <Dialog open={showNewDialog || showEditDialog} onOpenChange={(open) => { if (!open) { setShowNewDialog(false); setShowEditDialog(false); setSelectedRow(null); } }}>
        <DialogContent className="sm:max-w-[480px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{showEditDialog ? "Edit Record" : "New Record"}</DialogTitle>
            <DialogDescription>{showEditDialog ? "Update the record details below." : "Fill in the details to create a new record."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {formFields?.map(field => (
              <div key={field.key} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {field.label} {field.required && <span className="text-destructive">*</span>}
                </Label>
                {field.type === "select" ? (
                  <Select value={formData[field.key] ?? ""} onValueChange={(v) => setFormData(d => ({ ...d, [field.key]: v }))}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={field.placeholder ?? `Select ${field.label}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options?.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : field.type === "textarea" ? (
                  <textarea
                    value={formData[field.key] ?? ""}
                    onChange={(e) => setFormData(d => ({ ...d, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px]"
                  />
                ) : (
                  <Input
                    type={field.type}
                    value={formData[field.key] ?? ""}
                    onChange={(e) => setFormData(d => ({ ...d, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="h-9"
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNewDialog(false); setShowEditDialog(false); setSelectedRow(null); }}>Cancel</Button>
            <Button className="bg-[image:var(--gradient-primary)]" onClick={handleFormSubmit}>
              <Check className="h-4 w-4 mr-1.5" />
              {showEditDialog ? "Save Changes" : "Create Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={(open) => { if (!open) { setShowDeleteDialog(false); setSelectedRow(null); } }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Record</DialogTitle>
            <DialogDescription>Are you sure you want to delete this record? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeleteDialog(false); setSelectedRow(null); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
