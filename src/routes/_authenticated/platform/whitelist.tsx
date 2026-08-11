import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { safeDate } from "@/lib/utils";
import { FileCheck2, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel, StatusBadge, Kpi } from "@/components/ui-parts";
import { ModuleCopilot } from "@/components/module-status";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/platform/whitelist")({
  head: () => ({ meta: [{ title: "Company Admin Whitelist — FactoryOS AI" }] }),
  component: WhitelistPage,
});

function WhitelistPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["platform-whitelist"],
    queryFn: async () =>
      (
        await supabase
          .from("whitelist")
          .select("*")
          .eq("role", "company_admin")
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [industry, setIndustry] = useState("Custom Furniture Manufacturing");
  const [country, setCountry] = useState("India");
  const [currency, setCurrency] = useState("INR");
  const [timezone, setTimezone] = useState("Asia/Kolkata");

  const invite = useMutation({
    mutationFn: async () => {
      // Create the tenant company first so the admin lands into an isolated tenant.
      const { data: co, error: coErr } = await supabase
        .from("companies")
        .insert({
          name: companyName,
          legal_name: legalName || null,
          industry,
          country: country || null,
          currency,
          timezone,
          status: "pending",
        })
        .select("id")
        .single();
      if (coErr) throw coErr;
      const { error } = await supabase.from("whitelist").insert({
        email,
        role: "company_admin",
        company_id: co.id,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Whitelisted ${email} for ${companyName}`);
      setOpen(false);
      setEmail("");
      setCompanyName("");
      setLegalName("");
      setIndustry("Custom Furniture Manufacturing");
      setCountry("India");
      setCurrency("INR");
      setTimezone("Asia/Kolkata");
      qc.invalidateQueries({ queryKey: ["platform-whitelist"] });
      qc.invalidateQueries({ queryKey: ["p-companies"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = data?.filter((w) => w.status === "pending").length ?? 0;
  const accepted = data?.filter((w) => w.status === "accepted").length ?? 0;

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="Platform"
        title="Company Admin Whitelist"
        sub="Only whitelisted emails can register as Company Admins. Each invite provisions a brand new isolated tenant."
        actions={
          <>
            <ModuleCopilot moduleName="whitelist" />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[image:var(--gradient-primary)] shadow-glow">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Whitelist Company Admin
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-strong border-white/10 max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Whitelist a new Company Admin</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Company Name</Label>
                      <Input
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Artisan Woodworks"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Legal Name</Label>
                      <Input
                        value={legalName}
                        onChange={(e) => setLegalName(e.target.value)}
                        placeholder="Artisan Woodworks Pvt Ltd"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Admin Email</Label>
                    <Input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@artisanwood.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Industry</Label>
                    <Input
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      placeholder="Custom Furniture Manufacturing"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Country</Label>
                    <Input
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="India"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Currency</Label>
                      <Select value={currency} onValueChange={setCurrency}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["INR", "USD", "EUR", "GBP", "JPY"].map((curr) => (
                            <SelectItem key={curr} value={curr}>
                              {curr}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Timezone</Label>
                      <Select value={timezone} onValueChange={setTimezone}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-[200px]">
                          {[
                            "Asia/Kolkata",
                            "UTC",
                            "America/New_York",
                            "America/Los_Angeles",
                            "Europe/London",
                            "Asia/Tokyo",
                            "Asia/Singapore",
                          ].map((tz) => (
                            <SelectItem key={tz} value={tz}>
                              {tz}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground pt-1">
                    A new isolated tenant will be created. The admin can sign up with this email and
                    takes full control of their company only.
                  </p>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => invite.mutate()}
                    disabled={!email || !companyName || invite.isPending}
                    className="bg-[image:var(--gradient-primary)] w-full sm:w-auto"
                  >
                    {invite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Whitelist"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Total" value={String(data?.length ?? 0)} icon={FileCheck2} tone="primary" />
        <Kpi label="Pending" value={String(pending)} icon={FileCheck2} tone="warning" />
        <Kpi label="Accepted" value={String(accepted)} icon={FileCheck2} tone="success" />
        <Kpi
          label="Revoked"
          value={String(data?.filter((w) => w.status === "revoked").length ?? 0)}
          icon={FileCheck2}
          tone="destructive"
        />
      </div>
      <div className="mt-4">
        <Panel title={`${data?.length ?? 0} invitations`}>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-white/5">
                {["Email", "Company", "Status", "Invited"].map((h) => (
                  <TableHead
                    key={h}
                    className="text-[11px] uppercase tracking-wider text-muted-foreground"
                  >
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((w) => (
                <TableRow key={w.id} className="border-white/5">
                  <TableCell className="font-medium">{w.email}</TableCell>
                  <TableCell className="text-muted-foreground text-xs font-mono">
                    {w.company_id?.slice(0, 8) ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={w.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {safeDate(w.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      </div>
    </div>
  );
}
