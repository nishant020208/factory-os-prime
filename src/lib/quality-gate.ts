// quality-gate.ts — one owner for the "final QC pass releases the SO" step.
//
// Stage 2 of the quality gate: when the Quality Inspector submits a PASS on a
// final inspection, the linked sales order becomes dispatch_ready so Dispatch
// can hand it to the customer. The DB trigger (migration
// 20260907000000_two_stage_quality_gate.sql) enforces the same transition
// server-side; this helper adds the client-side status-history entry and the
// customer notification so the trail is complete from either path.
import { supabase } from "@/integrations/supabase/client";
import { fireNotification } from "@/lib/notifications";
import { recordTransition } from "@/lib/order-lifecycle";

export async function releaseOrderAfterQcPass(opts: {
  companyId: string;
  salesOrderId: string;
  inspectionNumber: string;
}): Promise<void> {
  const { companyId, salesOrderId, inspectionNumber } = opts;

  // Only advance orders still inside production — matches the DB trigger.
  const { data: so } = await supabase
    .from("sales_orders")
    .select("id, so_number, status, progress, customer_id")
    .eq("id", salesOrderId)
    .maybeSingle();

  if (!so || !["in_production", "material_reserved", "approved", "quality_failed"].includes(so.status)) {
    return;
  }

  const { error } = await supabase
    .from("sales_orders")
    .update({ status: "dispatch_ready", progress: Math.max(Number(so.progress ?? 0), 70) })
    .eq("id", salesOrderId);
  if (error) throw error;

  // Status history trail.
  try {
    await recordTransition(
      companyId,
      salesOrderId,
      "sales_order",
      so.status,
      "dispatch_ready",
      (await supabase.auth.getUser()).data.user?.id ?? "",
      `Final QC ${inspectionNumber} passed — released for dispatch`,
    );
  } catch {
    /* non-fatal */
  }

  // Notify the customer (best-effort — the DB trigger also notifies).
  try {
    if (so.customer_id) {
      const { data: cust } = await supabase
        .from("customers")
        .select("user_id")
        .eq("id", so.customer_id)
        .maybeSingle();
      if (cust?.user_id) {
        await fireNotification(
          companyId,
          null,
          cust.user_id,
          "✅ Quality Cleared — Ready to Ship",
          `Your order ${so.so_number ?? ""} passed final quality inspection and is being prepared for dispatch.`,
          "success",
          "sales_orders",
          salesOrderId,
        );
      }
    }
  } catch {
    /* non-fatal */
  }
}
