import { useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Search, SlidersHorizontal, Download, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, Panel } from "@/components/ui-parts";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
}

export function ResourceView<T extends Record<string, any>>({
  eyebrow, title, sub, rows, columns, searchKeys, kpis, extraActions,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  rows: T[] | undefined;
  columns: Column<T>[];
  searchKeys: (keyof T)[];
  kpis?: ReactNode;
  extraActions?: ReactNode;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    if (!rows) return [];
    if (!q.trim()) return rows;
    const s = q.toLowerCase();
    return rows.filter((r) => searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(s)));
  }, [rows, q, searchKeys]);

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        sub={sub}
        actions={
          <>
            <Button variant="outline" className="glass border-white/5"><Download className="h-4 w-4 mr-1.5" />Export</Button>
            {extraActions}
            <Button className="bg-[image:var(--gradient-primary)] shadow-glow"><Plus className="h-4 w-4 mr-1.5" />New</Button>
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
        <div className="overflow-x-auto -mx-2">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-white/5">
                {columns.map((c) => (
                  <TableHead key={c.key} className={`text-[11px] uppercase tracking-wider text-muted-foreground ${c.className ?? ""}`}>
                    {c.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row, i) => (
                <motion.tr
                  key={row.id ?? i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.4) }}
                  className="border-white/5 hover:bg-white/[0.02] transition"
                >
                  {columns.map((c) => (
                    <TableCell key={c.key} className={`text-sm ${c.className ?? ""}`}>
                      {c.render ? c.render(row) : (row as any)[c.key]}
                    </TableCell>
                  ))}
                </motion.tr>
              ))}
              {filtered.length === 0 && (
                <TableRow className="border-white/5"><TableCell colSpan={columns.length} className="text-center text-muted-foreground py-8 text-sm">No records</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Panel>
    </div>
  );
}
