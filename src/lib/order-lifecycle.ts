/**
 * Order Lifecycle Service
 *
 * Central nervous system for the customer order end-to-end flow.
 * Every status transition, notification, and cross-role handoff goes through here.
 */
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type OrderStatus =
  | "pending_approval"
  | "approved"
  | "rejected"
  | "changes_requested"
  | "pending_payment"
  | "material_reserved"
  | "procurement_pending"
  | "in_production"
  | "production_paused_maintenance"
  | "quality_pending"
  | "quality_passed"
  | "quality_failed"
  | "dispatch_ready"
  | "out_for_delivery"
  | "delivered"
  | "completed"
  | "cancelled";

export type NotificationSeverity = "info" | "warning" | "success" | "error";

interface NotificationInput {
  companyId: string;
  userId?: string | null;
  title: string;
  body: string;
  severity?: NotificationSeverity;
  entity?: string;
  entityId?: string;
  action?: string;
}

/**
 * Create a notification and optionally log it to audit trail.
 * Root admin actions are EXCLUDED from audit logs by passing null action.
 */
export async function createNotification({
  companyId,
  userId,
  title,
  body,
  severity = "info",
  entity,
  entityId,
  action,
}: NotificationInput) {
  try {
    // Never insert an untargeted (broadcast) notification row. A row with
    // no to_role / no to_user is visible company-wide — the integration
    // sweep flagged the legacy triggers that did this. This path is always
    // called with userId === undefined from the order lifecycle; the real,
    // correctly-targeted notifications fire via fireNotification() helpers
    // (notifyOrderApproved / notifyOrderRejected).
    if (userId) {
      await supabase.from("notifications").insert({
        company_id: companyId,
        user_id: userId,
        title,
        body,
        severity,
      });
    }

    // Only log to audit if action is provided (Root Admin passes null)
    if (action) {
      await supabase.from("audit_logs").insert({
        company_id: companyId,
        user_id: userId || null,
        action,
        entity: entity || null,
        entity_id: entityId || null,
        metadata: { title, body },
      });
    }
  } catch (err) {
    console.error("Failed to create notification:", err);
  }
}

/**
 * Record a status transition in order_status_history.
 */
export async function recordTransition(
  companyId: string,
  orderId: string,
  orderType: string,
  fromStatus: string | null,
  toStatus: string,
  changedBy: string,
  notes?: string,
) {
  try {
    await supabase.from("order_status_history").insert({
      company_id: companyId,
      order_id: orderId,
      order_type: orderType,
      from_status: fromStatus,
      to_status: toStatus,
      changed_by: changedBy,
      notes: notes || null,
    });
  } catch (err) {
    console.error("Failed to record transition:", err);
  }
}

/**
 * Update a sales order status and record the transition.
 */
export async function updateSalesOrderStatus(
  orderId: string,
  companyId: string,
  newStatus: OrderStatus,
  changedBy: string,
  currentStatus?: string,
  additional?: Record<string, unknown>,
) {
  // Update the order
  const updateData: Record<string, unknown> = { status: newStatus };
  if (additional) Object.assign(updateData, additional);

  const { error } = await supabase
    .from("sales_orders")
    .update(updateData as any)
    .eq("id", orderId)
    .eq("company_id", companyId);

  if (error) throw error;

  // Record the transition
  await recordTransition(
    companyId,
    orderId,
    "sales_order",
    currentStatus || null,
    newStatus,
    changedBy,
  );
}

/**
 * Handle order approval by Company Admin.
 * This triggers notifications and kicks off the production chain.
 */
export async function approveCustomerOrder(
  orderId: string,
  companyId: string,
  approvedBy: string,
  customerId: string,
) {
  // Update status
  await updateSalesOrderStatus(orderId, companyId, "approved", approvedBy, "pending_approval", {
    approved_by: approvedBy,
    approved_at: new Date().toISOString(),
  });

  // Notify customer
  await createNotification({
    companyId,
    userId: undefined, // will be scoped to customer role
    title: "Order Approved",
    body: "Your order has been approved and is now being processed for production.",
    severity: "success",
    entity: "sales_orders",
    entityId: orderId,
    action: "order_approved",
  });

  // Notify Production Manager
  await createNotification({
    companyId,
    title: "New Approved Order",
    body: "A customer order has been approved. Please create a production order.",
    severity: "info",
    entity: "sales_orders",
    entityId: orderId,
    action: "production_notified",
  });
}

/**
 * Handle order rejection by Company Admin.
 */
export async function rejectCustomerOrder(
  orderId: string,
  companyId: string,
  rejectedBy: string,
  reason: string,
) {
  await updateSalesOrderStatus(orderId, companyId, "rejected", rejectedBy, "pending_approval", {
    approved_by: rejectedBy,
    approved_at: new Date().toISOString(),
    rejection_reason: reason,
  });

  await createNotification({
    companyId,
    title: "Order Rejected",
    body: `Your order was rejected. Reason: ${reason}`,
    severity: "warning",
    entity: "sales_orders",
    entityId: orderId,
    action: "order_rejected",
  });
}

/**
 * Auto-check inventory after production order creation.
 * Returns whether stock is sufficient.
 */
export async function autoCheckInventory(
  companyId: string,
  productId: string,
  requiredQty: number,
): Promise<{ sufficient: boolean; currentStock: number }> {
  const { data } = await supabase
    .from("inventory")
    .select("quantity")
    .eq("company_id", companyId)
    .eq("product_id", productId)
    .maybeSingle();

  const currentStock = data ? Number(data.quantity) : 0;
  return { sufficient: currentStock >= requiredQty, currentStock };
}

/**
 * Record an inventory adjustment (fixes Bug A).
 */
export async function adjustInventory(
  companyId: string,
  productId: string,
  warehouseId: string,
  newQuantity: number,
  reason: string,
  adjustedBy: string,
): Promise<boolean> {
  // Get current quantity
  const { data: current } = await supabase
    .from("inventory")
    .select("quantity")
    .eq("company_id", companyId)
    .eq("product_id", productId)
    .eq("warehouse_id", warehouseId)
    .maybeSingle();

  const oldQuantity = current ? Number(current.quantity) : 0;
  const delta = newQuantity - oldQuantity;

  // Update inventory
  const { error: updateError } = await supabase
    .from("inventory")
    .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
    .eq("company_id", companyId)
    .eq("product_id", productId)
    .eq("warehouse_id", warehouseId);

  if (updateError) throw updateError;

  // Log the adjustment
  const { error: logError } = await supabase.from("inventory_adjustments").insert({
    company_id: companyId,
    product_id: productId,
    warehouse_id: warehouseId,
    old_quantity: oldQuantity,
    new_quantity: newQuantity,
    delta,
    reason,
    adjusted_by: adjustedBy,
  });

  if (logError) {
    console.error("Failed to log inventory adjustment:", logError);
  }

  // Create audit log
  await supabase.from("audit_logs").insert({
    company_id: companyId,
    user_id: adjustedBy,
    action: "inventory_adjusted",
    entity: "inventory",
    entity_id: productId,
    metadata: {
      product_id: productId,
      warehouse_id: warehouseId,
      old_quantity: oldQuantity,
      new_quantity: newQuantity,
      delta,
      reason,
    },
  });

  return true;
}

/**
 * Create a notification for a dashboard note (fixes Bug B).
 */
export async function saveDashboardNote(
  companyId: string,
  userId: string,
  dashboardType: string,
  content: string,
  source: "ai" | "manual" = "ai",
) {
  const { error } = await supabase.from("dashboard_notes").insert({
    company_id: companyId,
    user_id: userId,
    dashboard_type: dashboardType,
    content,
    source,
  });

  if (error) throw error;
}

/**
 * Fetch dashboard notes for a specific dashboard type.
 */
export async function getDashboardNotes(companyId: string, dashboardType: string) {
  const { data } = await supabase
    .from("dashboard_notes")
    .select("*")
    .eq("company_id", companyId)
    .eq("dashboard_type", dashboardType)
    .order("created_at", { ascending: false })
    .limit(10);

  return data ?? [];
}
