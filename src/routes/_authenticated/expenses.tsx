import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DollarSign, Plus, Loader2, Pencil, Trash2, PiggyBank, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge, EmptyState } from "@/components/ui-parts";
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
import { useAuth } from "@/hooks/use-auth";
import { fmtMoneyK } from "@/lib/currency";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({
    meta: [
      { title: "Expenses — FactoryOS AI" },
      { name: "description", content: "Operational expenses: utilities, rent, misc." },
    ],
  }),
  component: ExpensesPage,
});

const CATEGORIES = ["Utilities", "Rent", "Salaries", "Raw Material", "Maintenance", "Logistics", "Misc"];

function ExpensesPage() {
  const queryClient = useQueryClient();
  const { companyId, user, roles } = useAuth();
  const isAuditor = roles.includes("auditor");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ category: "Misc", amount: "", expense_date: "", description: "", receipt_url: "" });

  const { data: expenses } = useQuery({
    queryKey: ["expenses", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("expenses")
          .select("*")
          .eq("company_id", companyId!)
          .order("expense_date", { ascending: false })
      ).data ?? [],
    enabled: !!companyId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !user) throw new Error("Not authenticated");
      const amount = parseFloat(form.amount);
      if (!amount || amount <= 0) throw new Error("Amount is required");
      const payload: any = {
        category: form.category,
        amount,
        expense_date: form.expense_date || new Date().toISOString().slice(0, 10),
        description: form.description.trim() || null,
        receipt_url: form.receipt_url.trim() || null,
      };
      if (editing) {
        const { error } = await supabase.from("expenses").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Expense updated");
      } else {
        const { error } = await supabase.from("expenses").insert({ ...payload, company_id: companyId, created_by: user.id });
        if (error) throw error;
        toast.success("Expense recorded");
      }
    },
    onSuccess: () => {
      setShowForm(false);
      setEditing(null);
      setForm({ category: "Misc", amount: "", expense_date: "", description: "", receipt_url: "" });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Expense deleted");
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = (expenses ?? []).reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthTotal = (expenses ?? [])
    .filter((e: any) => (e.expense_date ?? "").startsWith(thisMonth))
    .reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0);

  const openNew = () => {
    setEditing(null);
    setForm({ category: "Misc", amount: "", expense_date: new Date().toISOString().slice(0, 10), description: "", receipt_url: "" });
    setShowForm(true);
  };
  const openEdit = (row: any) => {
    setEditing(row);
    setForm({
      category: row.category ?? "Misc",
      amount: String(row.amount ?? ""),
      expense_date: row.expense_date?.slice(0, 10) ?? "",
      description: row.description ?? "",
      receipt_url: row.receipt_url ?? "",
    });
    setShowForm(true);
  };

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="Finance"
        title="Expenses"
        sub="Operational expenses entered directly — utilities, rent, maintenance and misc."
        actions={
          !isAuditor ? (
            <Button className="bg-[image:var(--gradient-primary)] shadow-glow" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add Expense
            </Button>
          ) : null
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Total Expenses" value={fmtMoneyK(total)} icon={DollarSign} tone="primary" />
        <Kpi label="This Month" value={fmtMoneyK(monthTotal)} icon={PiggyBank} tone="info" />
        <Kpi label="Entries" value={String(expenses?.length ?? 0)} icon={FileText} tone="success" />
        <Kpi label="Categories" value={String(new Set((expenses ?? []).map((e: any) => e.category)).size)} icon={DollarSign} tone="warning" />
      </div>

      <div className="mt-4">
        <Panel title={`${expenses?.length ?? 0} Expense Entries`}>
          {(expenses ?? []).length === 0 ? (
            <EmptyState title="No expenses recorded" sub="Add an expense to start tracking operational spend." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    {["Category", "Description", "Date", "Amount", "Status", ""].map((h) => (
                      <th key={h} className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(expenses ?? []).map((e: any) => (
                    <tr key={e.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="py-2.5 px-2">
                        <span className="text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5">
                          {e.category ?? "Misc"}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-muted-foreground">{e.description ?? "—"}</td>
                      <td className="py-2.5 px-2 font-mono text-xs">{e.expense_date?.slice(0, 10) ?? "—"}</td>
                      <td className="py-2.5 px-2 font-mono text-xs">${Number(e.amount ?? 0).toLocaleString()}</td>
                      <td className="py-2.5 px-2">
                        <StatusBadge status={e.receipt_url ? "approved" : "pending"} />
                      </td>
                      <td className="py-2.5 px-2">
                        {!isAuditor && (
                          <div className="flex items-center gap-1.5">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(e)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteMutation.mutate(e.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Expense" : "Add Expense"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Category</Label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Amount ($) *</Label>
                <Input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Date</Label>
                <Input type="date" value={form.expense_date} onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Description</Label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. July electricity bill" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Receipt URL (optional)</Label>
              <Input value={form.receipt_url} onChange={(e) => setForm((f) => ({ ...f, receipt_url: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button className="bg-[image:var(--gradient-primary)]" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editing ? "Save Changes" : "Add Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
