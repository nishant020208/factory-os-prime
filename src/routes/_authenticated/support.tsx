import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageCircle,
  Send,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2,
  HelpCircle,
  ShieldCheck,
  Plus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, StatusBadge } from "@/components/ui-parts";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({
    meta: [
      { title: "Support — FactoryOS AI" },
      { name: "description", content: "Ask your company admin questions and get direct answers." },
    ],
  }),
  component: SupportPage,
});

function formatTime(ts: string) {
  const d = new Date(ts);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function statusColor(status: string) {
  if (status === "answered") return "text-success border-success/30 bg-success/10";
  if (status === "closed")   return "text-muted-foreground border-white/10 bg-muted/20";
  return "text-warning border-warning/30 bg-warning/10";
}

function SupportPage() {
  const queryClient = useQueryClient();
  const { user, roles, companyId } = useAuth();
  const isCustomer = roles.includes("customer_portal");
  const isAdmin    = roles.includes("company_admin") || roles.includes("plant_admin") || roles.includes("root_super_admin");
  const isAuditor  = roles.includes("auditor");

  // UI state
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [showNewDialog,   setShowNewDialog]   = useState(false);
  const [newSubject,       setNewSubject]       = useState("");
  const [newMessage,       setNewMessage]       = useState("");
  const [replyText,        setReplyText]        = useState<Record<string, string>>({});
  const [submitting,       setSubmitting]       = useState(false);
  const [replyingId,       setReplyingId]       = useState<string | null>(null);

  // ── Fetch tickets ─────────────────────────────────────────────────────────
  const { data: tickets, isLoading } = useQuery({
    queryKey: ["support-tickets", companyId, user?.id],
    queryFn: async () => {
      // Customers see only their own tickets; admins see all
      let query = supabase
        .from("support_tickets")
        .select(`
          *,
          support_ticket_replies(id, message, is_admin, created_at, user_id),
          customers(name)
        `)
        .order("created_at", { ascending: false });

      if (isCustomer) {
        query = query.eq("user_id", user?.id ?? "");
      } else if (companyId) {
        query = query.eq("company_id", companyId);
      }

      const { data, error } = await query;
      // Graceful: if table doesn't exist yet, return []
      if (error && (error.code === "42P01" || error.message?.includes("does not exist"))) {
        return [];
      }
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Submit a new ticket (customer) ────────────────────────────────────────
  const submitTicket = async () => {
    if (!newSubject.trim() || !newMessage.trim()) {
      toast.error("Please fill in subject and message");
      return;
    }
    if (!companyId) {
      toast.error("Company not found");
      return;
    }
    setSubmitting(true);
    try {
      // Resolve this user's customer_id if available
      let customerId: string | null = null;
      if (user?.id) {
        const { data: p } = await supabase.from("profiles").select("email").eq("id", user.id).single();
        if (p?.email) {
          const { data: c } = await supabase
            .from("customers")
            .select("id")
            .or(`contact_email.eq.${p.email},user_id.eq.${user.id}`)
            .maybeSingle();
          customerId = c?.id ?? null;
        }
      }

      const { error } = await supabase.from("support_tickets").insert({
        company_id:  companyId,
        user_id:     user?.id ?? null,
        customer_id: customerId,
        subject:     newSubject.trim(),
        message:     newMessage.trim(),
        status:      "open",
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      toast.success("Your question has been sent!");
      setShowNewDialog(false);
      setNewSubject("");
      setNewMessage("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Post a reply (admin or customer) ─────────────────────────────────────
  const postReply = async (ticketId: string) => {
    const msg = replyText[ticketId]?.trim();
    if (!msg) return;
    setReplyingId(ticketId);
    try {
      const { error: replyErr } = await supabase.from("support_ticket_replies").insert({
        ticket_id: ticketId,
        user_id:   user?.id ?? null,
        message:   msg,
        is_admin:  isAdmin,
      });
      if (replyErr) throw replyErr;

      // If admin is replying, mark ticket as answered
      if (isAdmin) {
        await supabase
          .from("support_tickets")
          .update({ status: "answered", updated_at: new Date().toISOString() })
          .eq("id", ticketId);
      }

      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      setReplyText((prev) => ({ ...prev, [ticketId]: "" }));
      toast.success("Reply sent");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setReplyingId(null);
    }
  };

  const openCount     = tickets?.filter((t: any) => t.status === "open").length ?? 0;
  const answeredCount = tickets?.filter((t: any) => t.status === "answered").length ?? 0;

  return (
    <div className="max-w-[900px] mx-auto">
      <ModuleStatusBar moduleName="support" />
      <PageHeader
        eyebrow={isCustomer ? "My Account" : "Support"}
        title={isCustomer ? "Ask a Question" : "Support Tickets"}
        sub={
          isCustomer
            ? "Submit questions to the company admin — you'll get a direct reply here."
            : "Manage and respond to customer support questions."
        }
        actions={
          <div className="flex items-center gap-2">
            <ModuleCopilot moduleName="support" />
            {isCustomer && (
              <Button
                className="bg-[image:var(--gradient-primary)] shadow-glow"
                onClick={() => setShowNewDialog(true)}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Ask a Question
              </Button>
            )}
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <Kpi label="Open Tickets"    value={String(openCount)}     icon={HelpCircle}   tone="warning" />
        <Kpi label="Answered"        value={String(answeredCount)} icon={CheckCircle2} tone="success" />
        <Kpi label="Total"           value={String(tickets?.length ?? 0)} icon={MessageCircle} tone="info" />
      </div>

      {/* Ticket list */}
      {isLoading ? (
        <div className="text-center py-20 text-muted-foreground text-sm animate-pulse">
          Loading tickets…
        </div>
      ) : !tickets || tickets.length === 0 ? (
        <div className="glass rounded-2xl p-14 text-center">
          <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <div className="text-sm font-medium">
            {isCustomer ? "No questions yet" : "No support tickets"}
          </div>
          <div className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            {isCustomer
              ? "Hit 'Ask a Question' above to contact your account manager."
              : "Customer questions will appear here once they submit a ticket."}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket: any, idx: number) => {
            const isOpen = expandedTicket === ticket.id;
            const replies: any[] = ticket.support_ticket_replies ?? [];
            return (
              <motion.div
                key={ticket.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="glass rounded-2xl shadow-card overflow-hidden"
              >
                {/* Ticket header */}
                <button
                  className="w-full flex items-start justify-between gap-3 p-4 sm:p-5 text-left hover:bg-white/5 transition"
                  onClick={() => setExpandedTicket(isOpen ? null : ticket.id)}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`mt-0.5 h-8 w-8 rounded-xl border grid place-items-center shrink-0 ${
                        ticket.status === "answered"
                          ? "bg-success/10 border-success/20 text-success"
                          : "bg-warning/10 border-warning/20 text-warning"
                      }`}
                    >
                      {ticket.status === "answered" ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <Clock className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{ticket.subject}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-2">
                        {!isCustomer && ticket.customers?.name && (
                          <span className="font-medium text-foreground/70">{ticket.customers.name}</span>
                        )}
                        <span>{formatTime(ticket.created_at)}</span>
                        {replies.length > 0 && (
                          <span>{replies.length} {replies.length === 1 ? "reply" : "replies"}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-medium capitalize ${statusColor(ticket.status)}`}
                    >
                      {ticket.status}
                    </Badge>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {/* Expanded thread */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-white/5 px-4 sm:px-5 py-4 space-y-4">
                        {/* Original question */}
                        <div className="flex gap-3">
                          <div className="h-7 w-7 rounded-full bg-info/10 border border-info/20 grid place-items-center shrink-0">
                            <HelpCircle className="h-3.5 w-3.5 text-info" />
                          </div>
                          <div className="flex-1">
                            <div className="text-[10px] font-medium text-muted-foreground mb-1">
                              Customer question · {formatTime(ticket.created_at)}
                            </div>
                            <div className="text-sm bg-info/5 border border-info/10 rounded-xl px-3 py-2 leading-relaxed">
                              {ticket.message}
                            </div>
                          </div>
                        </div>

                        {/* Replies */}
                        {replies
                          .slice()
                          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                          .map((reply: any) => (
                            <div key={reply.id} className={`flex gap-3 ${reply.is_admin ? "flex-row-reverse" : ""}`}>
                              <div
                                className={`h-7 w-7 rounded-full border grid place-items-center shrink-0 ${
                                  reply.is_admin
                                    ? "bg-primary/10 border-primary/20 text-primary"
                                    : "bg-muted/40 border-white/10 text-muted-foreground"
                                }`}
                              >
                                {reply.is_admin ? (
                                  <ShieldCheck className="h-3.5 w-3.5" />
                                ) : (
                                  <HelpCircle className="h-3.5 w-3.5" />
                                )}
                              </div>
                              <div className={`flex-1 ${reply.is_admin ? "text-right" : ""}`}>
                                <div className="text-[10px] font-medium text-muted-foreground mb-1">
                                  {reply.is_admin ? "Company Admin" : "Customer"} · {formatTime(reply.created_at)}
                                </div>
                                <div
                                  className={`text-sm rounded-xl px-3 py-2 leading-relaxed inline-block max-w-full ${
                                    reply.is_admin
                                      ? "bg-primary/10 border border-primary/20 text-left"
                                      : "bg-muted/30 border border-white/10"
                                  }`}
                                >
                                  {reply.message}
                                </div>
                              </div>
                            </div>
                          ))}

                        {/* Reply box — visible to both customer and admin (never auditor) */}
                        {ticket.status !== "closed" && !isAuditor && (
                          <div className="flex gap-2 pt-1">
                            <Input
                              value={replyText[ticket.id] ?? ""}
                              onChange={(e) =>
                                setReplyText((prev) => ({ ...prev, [ticket.id]: e.target.value }))
                              }
                              placeholder={
                                isAdmin ? "Type your answer…" : "Add a follow-up question…"
                              }
                              className="h-9 bg-background/40 flex-1"
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  postReply(ticket.id);
                                }
                              }}
                            />
                            <Button
                              size="icon"
                              className="h-9 w-9 shrink-0 bg-[image:var(--gradient-primary)]"
                              disabled={!replyText[ticket.id]?.trim() || replyingId === ticket.id}
                              onClick={() => postReply(ticket.id)}
                            >
                              {replyingId === ticket.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* New Ticket Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-primary" />
              Ask the Company Admin
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Subject *</Label>
              <Input
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="e.g. Delivery date for SO-2026-042"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Your Question *</Label>
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Describe your question in detail…"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[image:var(--gradient-primary)]"
              onClick={submitTicket}
              disabled={submitting || !newSubject.trim() || !newMessage.trim()}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-1.5" />
              )}
              Send Question
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
