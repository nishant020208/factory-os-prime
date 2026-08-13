import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel } from "@/components/ui-parts";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { primaryRole } from "@/lib/route-access";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({
    meta: [
      { title: "Messages — FactoryOS AI" },
      { name: "description", content: "PO-scoped conversation with the buyer" },
    ],
  }),
  component: MessagesPage,
});

function MessagesPage() {
  const queryClient = useQueryClient();
  const { user, companyId, roles } = useAuth();
  const role = primaryRole(roles);
  const isSupplier = role === "supplier_portal";
  const isAuditor = roles.includes("auditor");
  const [selectedPo, setSelectedPo] = useState<string>("");
  const [draft, setDraft] = useState("");

  const { data: mySupplier } = useQuery({
    queryKey: ["my-supplier", user?.id],
    queryFn: async () => {
      if (!isSupplier || !user) return null;
      const { data } = await supabase
        .from("suppliers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      return (data?.id as string) ?? null;
    },
    enabled: isSupplier,
  });

  // PO list — supplier sees own POs, ops sees company POs
  const { data: pos } = useQuery({
    queryKey: ["msg-pos", companyId, mySupplier, isSupplier],
    queryFn: async () => {
      if (isSupplier) {
        if (!mySupplier) return [];
        const { data } = await supabase
          .from("purchase_orders")
          .select("id, po_number, status")
          .eq("supplier_id", mySupplier)
          .order("created_at", { ascending: false });
        return data ?? [];
      }
      const { data } = await supabase
        .from("purchase_orders")
        .select("id, po_number, status, suppliers(name)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!companyId,
  });

  // Messages — supplier sees own thread, ops sees company threads
  const { data: messages } = useQuery({
    queryKey: ["msg-threads", companyId, mySupplier, isSupplier],
    queryFn: async () => {
      let query = supabase.from("supplier_messages").select("*");
      if (isSupplier) {
        query = query.eq("supplier_id", mySupplier ?? "");
      } else {
        query = query.eq("company_id", companyId ?? "");
      }
      const { data } = await query.order("created_at", { ascending: true });
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const thread = (messages ?? []).filter(
    (m) => selectedPo && m.po_id === selectedPo,
  );

  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!selectedPo || !draft.trim()) throw new Error("Select a PO and write a message");
      if (!companyId) throw new Error("Missing company");
      const { error } = await supabase.from("supplier_messages").insert({
        company_id: companyId,
        po_id: selectedPo,
        supplier_id: isSupplier ? mySupplier : null,
        sender_role: isSupplier ? "supplier_portal" : (role ?? "procurement_manager"),
        sender_id: user?.id ?? null,
        message: draft.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["msg-threads"] });
      setDraft("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const poLabel = (id: string) => {
    const po = (pos ?? []).find((p) => p.id === id);
    if (!po) return id.slice(0, 8);
    const sup = (po as any).suppliers as { name?: string } | null;
    return `${po.po_number}${sup?.name ? ` · ${sup.name}` : ""}`;
  };

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="messages" />
      <PageHeader
        eyebrow={isSupplier ? "Supplier Portal" : "Procurement"}
        title="Messages"
        sub={
          isSupplier
            ? "PO-scoped conversation with the buyer's procurement team."
            : "PO-scoped conversation with your suppliers."
        }
        actions={<ModuleCopilot moduleName="messages" />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* PO selector */}
        <Panel title="Threads">
          <ul className="space-y-1">
            {(pos ?? []).map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => setSelectedPo(p.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                    selectedPo === p.id
                      ? "bg-[image:var(--gradient-primary)] text-white"
                      : "hover:bg-white/5 text-muted-foreground"
                  }`}
                >
                  <div className="font-medium">{p.po_number}</div>
                  <div className={selectedPo === p.id ? "text-white/70" : "text-muted-foreground/70"}>
                    {p.status}
                  </div>
                </button>
              </li>
            ))}
            {(pos ?? []).length === 0 && (
              <li className="text-xs text-muted-foreground py-8 text-center">
                No purchase orders to discuss yet.
              </li>
            )}
          </ul>
        </Panel>

        {/* Thread */}
        <div className="lg:col-span-2">
        <Panel title={selectedPo ? poLabel(selectedPo) : "Select a PO to view its thread"}>
          {selectedPo ? (
            <>
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 mb-4">
                {thread.length === 0 && (
                  <p className="text-xs text-muted-foreground py-8 text-center">
                    No messages yet. Start the conversation about this PO.
                  </p>
                )}
                {thread.map((m) => {
                  const mine =
                    (isSupplier && m.sender_role === "supplier_portal") ||
                    (!isSupplier && m.sender_role !== "supplier_portal");
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] rounded-xl px-3 py-2 text-xs ${
                          mine
                            ? "bg-[image:var(--gradient-primary)] text-white"
                            : "bg-white/5 text-foreground"
                        }`}
                      >
                        <div className={mine ? "text-white/70" : "text-muted-foreground"}>
                          {m.sender_role.replace(/_/g, " ")} ·{" "}
                          {new Date(m.created_at).toLocaleString()}
                        </div>
                        <p className="mt-0.5 whitespace-pre-wrap">{m.message}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              {!isAuditor && (
                <div className="flex items-end gap-2">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={
                      isSupplier
                        ? "Ask about quantities, delivery dates, pricing…"
                        : "Reply to the supplier about this PO…"
                    }
                    rows={2}
                    className="text-xs"
                  />
                  <Button
                    size="sm"
                    className="bg-[image:var(--gradient-primary)] h-9"
                    onClick={() => sendMessage.mutate()}
                    disabled={sendMessage.isPending || !draft.trim()}
                  >
                    {sendMessage.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}
              {isAuditor && (
                <p className="text-xs text-muted-foreground text-center py-3">
                  Auditor — read-only access to supplier conversations.
                </p>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Select a purchase order on the left to open its thread.</p>
            </div>
          )}
        </Panel>
        </div>
      </div>
    </div>
  );
}
