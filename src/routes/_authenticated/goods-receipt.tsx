import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PackageOpen, ScanLine, CheckCircle2, Loader2, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge } from "@/components/ui-parts";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { fmtMoney } from "@/lib/currency";
import { notifyGRNConfirmed, notifyGRNToSupplier, notifyMaterialsReceivedForOrder } from "@/lib/notifications";
import { toast } from "sonner";
import { useState } from "react";
import { QrCameraScanner } from "@/components/qr-camera-scanner";

export const Route = createFileRoute("/_authenticated/goods-receipt")({
  head: () => ({
    meta: [
      { title: "Goods Receipt — FactoryOS AI" },
      { name: "description", content: "Match inbound POs against physical receipt" },
    ],
  }),
  component: GoodsReceiptPage,
});

function GoodsReceiptPage() {
  const queryClient = useQueryClient();
  const { companyId, roles } = useAuth();
  const isAuditor = roles.includes("auditor");
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerPoId, setScannerPoId] = useState<string | null>(null);

  const { data: pos } = useQuery({
    queryKey: ["grn-pos", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase
        .from("purchase_orders")
        .select("*, suppliers(name, user_id), supplier_deliveries(*)")
        .not("supplier_id", "is", null)
        .in("status", ["dispatched", "accepted", "received", "fulfilled"])
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const awaiting =
    pos?.filter((p) => ["dispatched", "accepted"].includes(p.status)).length ?? 0;
  const received = pos?.filter((p) => ["received", "fulfilled"].includes(p.status)).length ?? 0;

  const grnMutation = useMutation({
    mutationFn: async (poId: string) => {
      if (!companyId) throw new Error("Missing company");
      const po = pos?.find((p) => p.id === poId);
      if (!po) throw new Error("PO not found");
      const supplier = (po as any).suppliers as { name?: string; user_id?: string | null } | null;

      // 1) Verify the inbound QR token if one was provided
      const token = (tokens[poId] ?? "").trim();
      if (token) {
        const { data: qr, error: qrErr } = await supabase
          .from("qr_codes")
          .select("id, status")
          .eq("token", token)
          .eq("type", "inbound_shipment")
          .eq("entity_id", poId)
          .eq("company_id", companyId)
          .maybeSingle();
        if (qrErr) throw qrErr;
        if (!qr) throw new Error("QR does not match this shipment");
        if (qr.status !== "active") throw new Error("QR has already been used for this shipment");
        // Mark used — cannot be rescanned
        const { error: usedErr } = await supabase
          .from("qr_codes")
          .update({ status: "used" })
          .eq("id", qr.id);
        if (usedErr) throw usedErr;
      }

      // 2) Mark the delivery received
      const { error: delErr } = await supabase
        .from("supplier_deliveries")
        .update({ status: "received" })
        .eq("po_id", poId);
      if (delErr) throw delErr;

      // 3) Mark the PO received
      const { error: poErr } = await supabase
        .from("purchase_orders")
        .update({ status: "received" })
        .eq("id", poId)
        .eq("company_id", companyId);
      if (poErr) throw poErr;

      // 4) Stock the received raw materials into the company's raw-materials
      // warehouse (creating the row when the material has none yet), so the
      // Production Manager's BOM shortage check sees the new stock.
      const { data: rawWarehouses } = await supabase
        .from("warehouses")
        .select("id")
        .eq("company_id", companyId)
        .or("code.ilike.%raw%,name.ilike.%raw%")
        .limit(1);
      let whId = rawWarehouses?.[0]?.id ?? null;
      if (!whId) {
        const { data: anyWh } = await supabase
          .from("warehouses")
          .select("id")
          .eq("company_id", companyId)
          .order("created_at", { ascending: true })
          .limit(1);
        whId = anyWh?.[0]?.id ?? null;
      }
      try {
        const { data: items } = await supabase
          .from(
            "purchase_order_items",
          )
          .select("material_id, quantity")
          .eq("purchase_order_id", poId);
        for (const it of items ?? []) {
          if (!it.material_id || !whId) continue;
          const { data: inv } = await supabase
            .from("inventory")
            .select("id, quantity")
            .eq("company_id", companyId)
            .eq("warehouse_id", whId)
            .eq("material_id", it.material_id)
            .maybeSingle();
          if (inv?.id) {
            await supabase
              .from("inventory")
              .update({ quantity: Number(inv.quantity ?? 0) + Number(it.quantity ?? 0) })
              .eq("id", inv.id);
          } else {
            await supabase.from("inventory").insert({
              company_id: companyId,
              warehouse_id: whId,
              material_id: it.material_id,
              quantity: Number(it.quantity ?? 0),
            });
          }
        }
      } catch (e) {
        console.warn("Inventory stock-in skipped:", e);
      }

      // 5) Resume any production orders that were waiting on these materials —
      // once every BOM component is covered, flip them back to approved and
      // notify the order's Production Manager to start production.
      try {
        const { data: rpc } = await supabase.rpc("resume_orders_when_stocked", {
          p_company_id: companyId,
        });
        const resumed = ((rpc as any)?.resumed ?? []) as {
          id: string;
          so_number: string;
          plant_id?: string | null;
        }[];
        for (const r of resumed) {
          await notifyMaterialsReceivedForOrder(companyId, r.so_number, r.id, r.plant_id ?? null);
        }
      } catch (e) {
        console.warn("Order resume skipped:", e);
      }

      // 6) Notify Finance (release payment) + this Supplier (shipment received)
      await notifyGRNConfirmed(companyId, po.po_number ?? "PO", supplier?.name ?? "Supplier");
      await notifyGRNToSupplier(companyId, po.po_number ?? "PO", supplier?.name ?? "Supplier", supplier?.user_id ?? null);
    },
    onSuccess: (_d, poId) => {
      queryClient.invalidateQueries({ queryKey: ["grn-pos"] });
      toast.success("Goods receipt confirmed — stock updated, supplier & finance notified");
      setReceivingId(null);
      setTokens((t) => ({ ...t, [poId]: "" }));
    },
    onError: (err: any) => {
      toast.error(err.message);
      setReceivingId(null);
    },
  });

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="goods-receipt" />
      <PageHeader
        eyebrow="Warehouse"
        title="Goods Receipt"
        sub="Receive inbound supplier shipments. Scan the Shipment-Inbound QR or confirm manually — the QR becomes single-use."
        actions={<ModuleCopilot moduleName="goods-receipt" />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <Kpi label="Awaiting Receipt" value={String(awaiting)} icon={PackageOpen} tone="warning" />
        <Kpi label="Received" value={String(received)} icon={CheckCircle2} tone="success" />
        <Kpi label="All Supplier POs" value={String(pos?.length ?? 0)} icon={ScanLine} tone="primary" />
      </div>

      <Panel title={`${pos?.length ?? 0} Supplier Purchase Orders`}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-white/5">
                {["PO #", "Supplier", "Amount", "Status", "Inbound QR Token", "Action"].map((h) => (
                  <TableHead key={h} className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(pos ?? []).map((po) => {
                const supplier = (po as any).suppliers as { name?: string } | null;
                const canReceive = ["dispatched", "accepted"].includes(po.status);
                return (
                  <TableRow key={po.id} className="border-white/5">
                    <TableCell className="font-medium">{po.po_number ?? po.id.slice(0, 8)}</TableCell>
                    <TableCell className="text-xs">{supplier?.name ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {fmtMoney(po.total_amount)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={po.status} />
                    </TableCell>
                    <TableCell>
                      {canReceive && !isAuditor ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={tokens[po.id] ?? ""}
                            onChange={(e) => setTokens((t) => ({ ...t, [po.id]: e.target.value }))}
                            placeholder="Scan or paste token"
                            className="h-8 text-xs font-mono flex-1 min-w-[120px]"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 flex-shrink-0"
                            title="Open camera to scan QR code"
                            onClick={() => {
                              setScannerPoId(po.id);
                              setScannerOpen(true);
                            }}
                          >
                            <Camera className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {canReceive && !isAuditor ? (
                        <Button
                          size="sm"
                          className="h-8 text-xs bg-[image:var(--gradient-primary)]"
                          onClick={() => {
                            setReceivingId(po.id);
                            grnMutation.mutate(po.id);
                          }}
                          disabled={receivingId === po.id}
                        >
                          {receivingId === po.id ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                          ) : (
                            <PackageOpen className="h-3.5 w-3.5 mr-1" />
                          )}
                          Confirm Receipt
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {po.status === "received" ? "In stock" : "—"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(pos ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                    No supplier POs yet. Dispatched shipments from suppliers will appear here.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="mt-3">
          <Label className="text-[11px] text-muted-foreground">
            Entering the inbound QR token verifies the shipment and marks the QR as used (single-use). Leaving it blank
            confirms the receipt manually.
          </Label>
        </div>
      </Panel>

      {/* Camera QR Scanner */}
      <QrCameraScanner
        open={scannerOpen}
        onClose={() => {
          setScannerOpen(false);
          setScannerPoId(null);
        }}
        onScan={(decoded) => {
          if (scannerPoId) {
            setTokens((t) => ({ ...t, [scannerPoId]: decoded }));
          }
          setScannerOpen(false);
          setScannerPoId(null);
        }}
        title="Scan Inbound Shipment QR"
      />
    </div>
  );
}
