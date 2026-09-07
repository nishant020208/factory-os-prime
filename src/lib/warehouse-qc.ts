import { supabase } from "@/integrations/supabase/client";
import { fireNotification } from "@/lib/notifications";

export interface ReceiveAndRequestQcParams {
  companyId: string;
  poId: string;
  warehouseId?: string | null;
  receivedBy?: string | null;
  items?: Array<{ material_id: string; quantity: number }>;
}

export interface ReceiveAndRequestQcResult {
  success: boolean;
  inspectionsCreated: number;
  warehouseId: string | null;
  warehouseName?: string;
  error?: string;
}

/**
 * Record warehouse material arrival and create pending QC inspection requests.
 * Ensures the Quality Inspector queue is immediately updated.
 */
export async function recordMaterialArrivalAndRequestQC(
  params: ReceiveAndRequestQcParams,
): Promise<ReceiveAndRequestQcResult> {
  const { companyId, poId, receivedBy } = params;
  if (!companyId || !poId) {
    return { success: false, inspectionsCreated: 0, warehouseId: null, error: "Missing companyId or poId" };
  }

  try {
    // 1. Fetch PO details
    const { data: po, error: poErr } = await (supabase.from("purchase_orders") as any)
      .select("*, suppliers(name), warehouses:delivery_warehouse_id(id, name, code)")
      .eq("id", poId)
      .single();

    if (poErr || !po) {
      return { success: false, inspectionsCreated: 0, warehouseId: null, error: poErr?.message ?? "PO not found" };
    }

    // 2. Resolve warehouse ID
    let whId = params.warehouseId || po.delivery_warehouse_id || (po.warehouses as any)?.id || null;
    let whName = (po.warehouses as any)?.name || "";

    if (!whId) {
      const { data: whs } = await supabase
        .from("warehouses")
        .select("id, name, code, plant_id")
        .eq("company_id", companyId)
        .order("name");

      if (whs && whs.length > 0) {
        const rawWh = whs.find(
          (w: any) =>
            w.code?.toLowerCase().includes("raw") || w.name?.toLowerCase().includes("raw"),
        );
        whId = rawWh ? rawWh.id : whs[0].id;
        whName = rawWh ? rawWh.name : whs[0].name;
      }
    }

    // Resolve plant_id for plant-scoped inspections
    let plantId: string | null = null;
    if (whId) {
      const { data: whRow } = await supabase
        .from("warehouses")
        .select("id, name, plant_id")
        .eq("id", whId)
        .maybeSingle();
      if (whRow) {
        plantId = whRow.plant_id ?? null;
        whName = whRow.name || whName;
      }
    }

    // 3. Mark PO as received if not already
    await (supabase.from("purchase_orders") as any)
      .update({
        status: "received",
        delivery_warehouse_id: whId,
      })
      .eq("id", poId);

    // 4. Also mark supplier_deliveries if existing
    await (supabase.from("supplier_deliveries") as any)
      .update({ status: "received" })
      .eq("po_id", poId);

    // 5. Get PO items if not provided
    let lineItems = params.items;
    if (!lineItems || lineItems.length === 0) {
      const { data: poItems } = await supabase
        .from("purchase_order_items")
        .select("material_id, quantity, materials(name, unit)")
        .eq("purchase_order_id", poId);

      lineItems = (poItems ?? []).map((it: any) => ({
        material_id: it.material_id,
        quantity: Number(it.quantity ?? 0),
        material_name: (it.materials as any)?.name,
        unit: (it.materials as any)?.unit,
      }));
    }

    // 6. Create goods receipt record (audit trail)
    let grId: string | null = null;
    try {
      const { data: grRow } = await (supabase.from("goods_receipts" as any) as any)
        .insert({
          company_id: companyId,
          purchase_order_id: poId,
          received_by: receivedBy || null,
          received_at: new Date().toISOString(),
          status: "received",
          inspection_status: "pending",
        })
        .select("id")
        .single();
      if (grRow?.id) grId = grRow.id;
    } catch {
      // non-fatal if table optional
    }

    // 7. Insert pending inspection records for each line
    let createdCount = 0;
    for (const it of lineItems) {
      if (!it.material_id) continue;
      
      // Check if pending inspection already exists for this PO & material
      const { data: existing } = await (supabase.from("incoming_material_inspections" as any) as any)
        .select("id, status")
        .eq("purchase_order_id", poId)
        .eq("material_id", it.material_id)
        .maybeSingle();

      if (existing) {
        // If it exists but was pending or created, count it
        createdCount++;
        continue;
      }

      const { data: inserted, error: insErr } = await (supabase.from("incoming_material_inspections" as any) as any)
        .insert({
          company_id: companyId,
          plant_id: plantId,
          goods_receipt_id: grId,
          purchase_order_id: poId,
          material_id: it.material_id,
          warehouse_id: whId,
          quantity: it.quantity,
          status: "pending",
        })
        .select("id")
        .single();

      if (!insErr && inserted?.id) {
        createdCount++;
      }
    }

    // 8. Send notification to Quality Inspector
    const poNum = po.po_number || poId.slice(0, 8);
    const supplierName = (po.suppliers as any)?.name || "Supplier";
    const bodyMsg = `Inbound shipment from ${supplierName} (${poNum}) has arrived at ${whName || "the warehouse"}. Please perform incoming material inspection before stock release.`;

    await fireNotification(
      companyId,
      "quality_inspector",
      null,
      `🔬 Incoming QC Required — ${poNum}`,
      bodyMsg,
      "warning",
      "purchase_orders",
      poId,
    );

    return {
      success: true,
      inspectionsCreated: createdCount,
      warehouseId: whId,
      warehouseName: whName,
    };
  } catch (err: any) {
    return {
      success: false,
      inspectionsCreated: 0,
      warehouseId: null,
      error: err?.message || "Failed to process arrival and QC request",
    };
  }
}
