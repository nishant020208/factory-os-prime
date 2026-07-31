import { useState } from "react";
import { motion } from "framer-motion";
import { BrainCircuit, Shield, Radio, Send, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { primaryRole } from "@/lib/route-access";
import { answerCopilot } from "@/lib/copilot-engine";

/**
 * Status bar shown on every module page:
 * "Top status: in_progress" | "Company scope: RLS on"
 */
export function ModuleStatusBar({ moduleName }: { moduleName: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full bg-info/10 text-info border border-info/20">
        <Radio className="h-3 w-3 animate-pulse" />
        Top status: <span className="font-semibold">in_progress</span>
      </span>
      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full bg-success/10 text-success border border-success/20">
        <Shield className="h-3 w-3" />
        Company scope: <span className="font-semibold">RLS on</span>
      </span>
      <span className="text-[10px] text-muted-foreground hidden sm:inline">
        Module: {moduleName} · Realtime sync active
      </span>
    </div>
  );
}



/**
 * Working AI Copilot for every module.
 * Shows contextual insights, answers questions, and provides recommendations.
 * Now role-scoped: blocks answers about domains outside the user's role.
 */
export function ModuleCopilot({ moduleName }: { moduleName: string }) {
  const { roles, companyId, user } = useAuth();
  const role = primaryRole(roles);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    const nextHistory = [...messages, { role: "user" as const, text: userMsg }];
    setMessages(nextHistory);
    setInput("");
    setLoading(true);

    // Conversational answer — real data, role-scoped, with multi-turn memory
    const { text } = await answerCopilot({
      question: userMsg,
      role,
      companyId,
      userId: user?.id ?? null,
      history: messages, // prior turns give follow-up context like "and production?"
    });
    setMessages(prev => [...prev, { role: "ai", text }]);
    setLoading(false);
  };

  return (
    <>
      <Button
        variant="outline"
        className="glass border-primary/20 text-primary hover:bg-primary/10"
        onClick={() => {
          setOpen(true);
          if (messages.length === 0) {
            setMessages([{
              role: "ai",
              text: `Hey! 👋 I'm your **${moduleName}** Copilot. Ask me anything about this module — I'll pull live, role-scoped data. Try "show the latest orders", "any low stock?", or "how do I create a record?".`,
            }]);
          }
        }}
      >
        <BrainCircuit className="h-4 w-4 mr-1.5" />
        <span className="hidden sm:inline">AI Copilot</span>
        <span className="sm:hidden">AI</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh] flex flex-col p-0">
          <DialogHeader className="px-4 pt-4 pb-2 border-b border-white/5">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-primary" />
              {moduleName} AI Copilot
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px] max-h-[400px]">
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`text-sm leading-relaxed ${msg.role === "ai"
                  ? "bg-card/80 border border-white/5 rounded-xl p-3"
                  : "bg-primary/10 border border-primary/20 rounded-xl p-3 ml-8"
                }`}
              >
            {msg.text.replace(/\*\*/g, "")}
              </motion.div>
            ))}
            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 text-sm text-muted-foreground bg-card/40 rounded-xl p-3"
              >
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Analyzing {moduleName} data...
              </motion.div>
            )}
          </div>

          <div className="px-4 pb-4 pt-2 border-t border-white/5">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Ask about ${moduleName}...`}
                className="h-9 bg-background/40"
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
              />
              <Button
                size="icon"
                className="h-9 w-9 shrink-0 bg-[image:var(--gradient-primary)]"
                onClick={handleSend}
                disabled={!input.trim() || loading}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {["Summary", "Insights", "Alerts", "Create new"].map(q => (
                <button
                  key={q}
                  className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 bg-muted/30 text-muted-foreground hover:bg-primary/10 hover:text-primary transition"
                  onClick={() => { setInput(q); }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
