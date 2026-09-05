import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PackageOpen, ScanLine, CheckCircle2, Loader2, Camera, Warehouse } from "lucide-react";
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
        .select(
          "*, suppliers(name, user_id), supplier_deliveries(*), warehouses:delivery_warehouse_id(id, name, code)",
        )
        .not("supplier_id", "is", null)
        .in("status", ["dispatched", "accepted", "received", "fulfilled"])
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!companyId,
  });

  // All warehouses – fallback lookup when PO has no delivery_warehouse_id
  const { data: allWarehouses } = useQuery({
    queryKey: ["warehouses", companyId],
    queryFn: async () =>
      (await supabase.from("warehouses").select("id, name, code").eq("company_id", companyId ?? "").order("name"))
        .data ?? [],
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

      // 4) Resolve delivery warehouse: use PO's delivery_warehouse_id if set,
      //    else fall back to raw-materials or first warehouse.
      const poWarehouseObj = (po as any).warehouses as { id?: string } | null;
      let whId: string | null = poWarehouseObj?.id ?? null;
      if (!whId) {
        const rawWh = (allWarehouses ?? []).find(
          (w: any) => w.code?.toLowerCase().includes("raw") || w.name?.toLowerCase().includes("raw"),
        );
        whId = (rawWh as any)?.id ?? (allWarehouses as any[])?.[0]?.id ?? null;
      }

      // 5) Fetch PO items
      const { data: items } = await supabase
        .from("purchase_order_items")
        .select("material_id, quantity")
        .eq("purchase_order_id", poId);

      // 6) Create goods receipt header (audit record)
      //    Do NOT stock directly — stock flows in only after Quality Inspector approves.
      let grId: string | null = null;
      try {
        const userRes = await supabase.auth.getUser();
        const { data: grRow, error: grErr } = await (supabase
          .from("goods_receipts" as any) as any)
          .insert({
            company_id: companyId,
            purchase_order_id: poId,
            received_by: userRes.data.user?.id,
            received_at: new Date().toISOString(),
            status: "received",
            inspection_status: "pending",
          })
          .select("id")
          .single();
        if (!grErr && grRow?.id) grId = grRow.id;
      } catch (_) {
        // goods_receipts table may not exist in all environments — non-fatal
      }

      // 7) Insert pending inspection records for each line
      for (const it of items ?? []) {
        if (!it.material_id || !whId) continue;
        try {
          await (supabase.from("incoming_material_inspections" as any) as any).insert({
            company_id: companyId,
            goods_receipt_id: grId,
            purchase_order_id: poId,
            material_id: it.material_id,
            warehouse_id: whId,
            quantity: Number(it.quantity ?? 0),
            status: "pending",
          });
        } catch (_) {/* non-fatal */}
      }

      // 8) Resume waiting production orders (stock check will pass post-inspection,
      //    but run it anyway so approved backlog auto-resumes)
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

      // 9) Notify Finance + Supplier
      await notifyGRNConfirmed(companyId, po.po_number ?? "PO", supplier?.name ?? "Supplier");
      await notifyGRNToSupplier(companyId, po.po_number ?? "PO", supplier?.name ?? "Supplier", supplier?.user_id ?? null);
    },
    onSuccess: (_d, poId) => {
      queryClient.invalidateQueries({ queryKey: ["grn-pos"] });
      queryClient.invalidateQueries({ queryKey: ["incoming-inspections"] });
      toast.success(
        "Goods receipt confirmed — pending Quality Inspection before stock is usable",
      );
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
        sub="Receive inbound supplier shipments. Scan the Shipment-Inbound QR or confirm manually — materials go to Quality Inspection before entering usable stock."
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
                {["PO #", "Supplier", "Dest. Warehouse", "Amount", "Status", "Inbound QR Token", "Action"].map((h) => (
                  <TableHead key={h} className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(pos ?? []).map((po) => {
                const supplier = (po as any).suppliers as { name?: string } | null;
                const wh = (po as any).warehouses as { name?: string; code?: string } | null;
                const canReceive = ["dispatched", "accepted"].includes(po.status);
                return (
                  <TableRow key={po.id} className="border-white/5">
                    <TableCell className="font-medium">{po.po_number ?? po.id.slice(0, 8)}</TableCell>
                    <TableCell className="text-xs">{supplier?.name ?? "—"}</TableCell>
                    <TableCell>
                      {wh?.name ? (
                        <span className="inline-flex items-center gap-1 text-xs">
                          <Warehouse className="h-3 w-3 text-muted-foreground" />
                          <span className="font-mono text-muted-foreground">{wh.code}</span>
                          {wh.name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
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
                          loading={receivingId === po.id}
                          onClick={() => {
                            setReceivingId(po.id);
                            grnMutation.mutate(po.id);
                          }}
                          disabled={receivingId === po.id}
                        >
                          <PackageOpen className="h-3.5 w-3.5 mr-1" />
                          Confirm Receipt
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {po.status === "received" ? "Pending Inspection" : "—"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(pos ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    No supplier POs yet. Dispatched shipments from suppliers will appear here.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="mt-3">
          <Label className="text-[11px] text-muted-foreground">
            Confirming receipt creates a pending Quality Inspection — the Quality Inspector must
            approve before stock enters usable inventory.
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
