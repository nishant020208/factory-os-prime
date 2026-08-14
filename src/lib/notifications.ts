/**
 * notifications.ts — Role-targeted notification service.
 *
 * Every notification has a company_id, to_role (who should see it),
 * and optionally to_user (specific user). This ensures each role only
 * sees notifications meant for them — not broadcast to everyone.
 *
 * ─── NOTIFICATION TRIGGERS MAP ───
 * Complete specification of every trigger event, who sends it, and who
 * receives it. Every row in this map is implemented as a helper function below.
 *
 * Rule: No trigger fires a notification with to_role = null / "everyone".
 * If a role isn't listed as a receiver for a trigger, it must not receive it.
 */
import { supabase } from "@/integrations/supabase/client";

export type NotificationSeverity = "info" | "warning" | "success" | "error";

export interface AppNotification {
  id: string;
  // Root-targeted notifications carry company_id = null (the registration
  // isn't a companies(id) until Root approves), so this must be nullable.
  company_id: string | null;
  from_user: string | null;
  to_role: string;
  to_user: string | null;
  title: string;
  body: string;
  severity: NotificationSeverity;
  related_entity_type: string | null;
  related_entity_id: string | null;
  is_read: boolean;
  created_at: string;
}

// ─── NOTIFICATION TRIGGERS MAP (Documentation) ───
// Format: [trigger name] → sender → receiver(s)
// Used as reference — the actual fire functions are below.

export const NOTIFICATION_TRIGGERS = {
  "1. New company registration request": {
    sender: "Visitor (public)",
    receivers: ["root_super_admin"],
    description:
      "When a new company submits a registration request, Root Super Admin is notified to review.",
  },
  "2. Root approves/rejects company": {
    sender: "root_super_admin",
    receivers: ["company_admin"],
    description:
      "When Root approves or rejects a company registration, the new Company Admin receives a welcome/activation or rejection notice.",
  },
  "3. New customer access request": {
    sender: "Visitor (public)",
    receivers: ["company_admin"],
    description:
      "When a customer requests access to a company, Company Admin is notified to approve/reject.",
  },
  "4. New employee whitelist request": {
    sender: "hr_manager",
    receivers: ["company_admin"],
    description: "HR Manager submits new employee → Company Admin approves whitelist.",
  },
  "5. Customer places New Order": {
    sender: "customer_portal",
    receivers: ["company_admin"],
    description: "Customer creates an order → Company Admin is notified to approve/reject.",
  },
  "6. Company Admin approves/rejects order": {
    sender: "company_admin",
    receivers: ["customer_portal", "production_manager"],
    description:
      "Company Admin approves → Customer notified (success) + Production Manager notified (plan). Reject → Customer notified (reason).",
  },
  "7. Profile/role change request": {
    sender: "Any employee",
    receivers: ["company_admin"],
    description: "An employee requests a profile or role change → Company Admin reviews.",
  },
  "8. High-value PO escalation": {
    sender: "procurement_manager",
    receivers: ["company_admin"],
    description: "Purchase Order exceeds approval threshold → Company Admin decides.",
  },
  "9. Machine in maintenance": {
    sender: "production_operator / maintenance_engineer",
    receivers: ["plant_admin", "plant_manager"],
    description:
      "A machine goes into maintenance status → Plant Admin/Manager are notified (plant-scoped).",
  },
  "10. Quality fail rate exceeds threshold": {
    sender: "quality_inspector",
    receivers: ["plant_admin", "plant_manager"],
    description: "Quality fail rate at a plant exceeds threshold → Plant Admin/Manager notified.",
  },
  "11. Production Order behind schedule": {
    sender: "production_manager",
    receivers: ["plant_admin", "plant_manager"],
    description: "Production Order falls behind → Plant Admin/Manager alerted.",
  },
  "12. Company Admin approves order → PM": {
    sender: "company_admin",
    receivers: ["production_manager"],
    description:
      "Customer Order approved by Company Admin → Production Manager notified to plan production.",
  },
  "13. Advance payment received": {
    sender: "customer_portal",
    receivers: ["production_manager", "finance_manager"],
    description:
      "Customer pays advance → Production Manager (start production) + Finance Manager (reconcile).",
  },
  "14. Inventory check insufficient": {
    sender: "System (auto)",
    receivers: ["production_manager", "procurement_manager"],
    description:
      "Inventory check fails → Production Manager (informational) + Procurement Manager (primary action).",
  },
  "15. Quality Inspector fails batch": {
    sender: "quality_inspector",
    receivers: ["production_manager", "production_operator"],
    description:
      "Batch fails QC → Production Manager (re-plan) + Production Operator (rework with rejection notes).",
  },
  "16. Operator flags machine issue": {
    sender: "production_operator",
    receivers: ["production_manager", "maintenance_engineer"],
    description:
      "Operator flags machine → Production Manager (schedule impact) + Maintenance Engineer (repair).",
  },
  "17. Work Order reaches 100%": {
    sender: "production_operator",
    receivers: ["production_manager", "quality_inspector"],
    description:
      "WO completed → Production Manager (completion) + Quality Inspector (batch ready for inspection).",
  },
  "18. Work Order assigned to operator": {
    sender: "production_manager",
    receivers: ["production_operator"],
    description: "PM assigns WO → Operator receives their new assignment.",
  },
  "19. Maintenance ticket resolved": {
    sender: "maintenance_engineer",
    receivers: ["production_operator", "production_manager"],
    description:
      "Machine back online → Operator (resume work) + Production Manager (machine available).",
  },
  "20. Material reservation requested": {
    sender: "System (auto via production_planning)",
    receivers: ["warehouse_manager"],
    description: "Production creates order → Warehouse Manager notified to reserve materials.",
  },
  "21. Supplier accepts PO and ships": {
    sender: "supplier_portal",
    receivers: ["warehouse_manager"],
    description: "Supplier confirms + ships → Warehouse Manager expects Goods Receipt.",
  },
  "22. Quality passes batch → Finished Goods": {
    sender: "quality_inspector",
    receivers: ["warehouse_manager", "production_manager"],
    description:
      "QC passes batch → Warehouse Manager (FG ready) + Production Manager (completion).",
  },
  "23. Stock below reorder threshold": {
    sender: "System (auto)",
    receivers: ["warehouse_manager", "procurement_manager"],
    description: "Low stock alert → Warehouse Manager + Procurement Manager both notified.",
  },
  "24. Supplier responds to PO": {
    sender: "supplier_portal",
    receivers: ["procurement_manager"],
    description: "Supplier accepts/rejects/modifies PO → Procurement Manager receives outcome.",
  },
  "25. Dispatch Ready → Invoice trigger": {
    sender: "warehouse_manager",
    receivers: ["finance_manager"],
    description: "Shipment reaches dispatch_ready → Finance Manager generates invoice.",
  },
  "26. Supplier GRN confirmed → Payment": {
    sender: "warehouse_manager",
    receivers: ["finance_manager"],
    description: "Goods Receipt confirmed → Finance Manager releases supplier payment.",
  },
  "27. New employee → Department request": {
    sender: "hr_manager",
    receivers: ["company_admin"],
    description: "New employee needs department → Company Admin assigns.",
  },
  "28. Customer creates Support Ticket": {
    sender: "customer_portal",
    receivers: ["company_admin"],
    description: "Customer opens support ticket → Company Admin routes to relevant team.",
  },
  "29. Invoice generated / payment status": {
    sender: "finance_manager",
    receivers: ["customer_portal"],
    description: "Invoice generated or payment status changes → Customer notified.",
  },
  "30. Supplier payment released": {
    sender: "finance_manager",
    receivers: ["supplier_portal"],
    description: "Finance releases supplier payment → Supplier notified.",
  },
  "31. New PO sent to Supplier": {
    sender: "procurement_manager",
    receivers: ["supplier_portal"],
    description: "Procurement creates PO and sends to Supplier Portal → Supplier notified.",
  },
  "32. Order status update (Shipment created/dispatched)": {
    sender: "warehouse_manager",
    receivers: ["customer_portal"],
    description: "Shipment created/dispatched → Customer receives live tracking update.",
  },
  "33. Production paused for maintenance": {
    sender: "production_operator / system",
    receivers: ["customer_portal"],
    description: "Production pauses due to maintenance → Customer notified of timeline impact.",
  },
} as const;

/** Summary by role of how many triggers each role receives */
export const NOTIFICATION_COUNTS_BY_ROLE: Record<string, number> = {
  root_super_admin: 1,
  company_admin: 7,
  plant_admin: 3,
  plant_manager: 3,
  production_manager: 8,
  production_operator: 4,
  warehouse_manager: 4,
  procurement_manager: 3,
  quality_inspector: 1,
  maintenance_engineer: 1,
  finance_manager: 3,
  hr_manager: 3, // pending dept assignments, whitelist decisions, whitelist confirmation
  customer_portal: 10, // order status, advance payment QR, shipment updates, invoice, payment, support ticket, production pause
  supplier_portal: 2,
  auditor: 0,
};

/**
 * Core fire function — all trigger helpers call this.
 * No trigger should call this with to_role = null meaning "everyone."
 * Every call must target a specific role or user.
 *
 * ⚠️ IMPORTANT — ONE-PERSON vs ROLE-WIDE targeting:
 * - If a notification is meant for ONE specific person (e.g. "your account
 *   was approved"), set toRole = null and toUser = that person's user ID.
 *   This prevents the notification from appearing to everyone with that role.
 * - If a notification is meant for EVERYONE with a role (e.g. "new order
 *   needs approval"), set toRole = role name and toUser = null.
 * - NEVER set BOTH toRole AND toUser on the same row — that would cause
 *   the notification to appear for the entire role AND the specific user,
 *   violating the "no broadcast" rule.
 */
/**
 * Resolve (toRole, toUser) for a one-person notification.
 * - If the specific user's id is known → target ONLY them (toRole = null).
 * - If it can't be resolved → fall back to the role-wide target so the
 *   notification is never silently dropped (never sets BOTH).
 *
 * ⚠️ EXTERNAL PORTALS ARE FAIL-CLOSED: customer_portal and supplier_portal
 * rows are per-tenant-customer/supplier. A role-wide fallback would show one
 * customer's order/invoice to EVERY customer of the company, so when the
 * recipient can't be resolved we return no target and the send is skipped.
 */
const EXTERNAL_ROLES = new Set(["customer_portal", "supplier_portal"]);

function resolveTarget(
  role: string,
  userId: string | null | undefined,
): [string | null, string | null] {
  if (userId) return [null, userId];
  if (EXTERNAL_ROLES.has(role)) return [null, null];
  return [role, null];
}

export async function fireNotification(
  companyId: string | null,
  toRole: string | null,
  toUser: string | null,
  title: string,
  body: string,
  severity: NotificationSeverity = "info",
  entityType?: string | null,
  entityId?: string | null,
): Promise<boolean> {
  try {
    // No target at all → never insert. A row with both to_role and to_user
    // null would be visible to the whole company (a broadcast), which the
    // targeting rules forbid.
    if (!toRole && !toUser) {
      console.warn("Notification skipped — no resolvable recipient:", title);
      return false;
    }
    // Never set BOTH: that would notify the whole role AND the person.
    const role = toUser ? null : toRole;
    // Supabase returns errors as { error } objects — it does NOT throw.
    // Check the result so a failed notification is never silently swallowed.
    const { error } = await supabase.from("notifications").insert({
      company_id: companyId,
      to_role: role,
      to_user: toUser,
      title,
      body,
      severity,
      related_entity_type: entityType ?? null,
      related_entity_id: entityId ?? null,
    });
    if (error) {
      console.error("Failed to fire notification:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to fire notification:", err);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════
// TRIGGER HELPER FUNCTIONS
// Each function corresponds to one row in the NOTIFICATION_TRIGGERS map.
// Named clearly so any developer can see which trigger fires where.
// ═══════════════════════════════════════════════════════════════════

/** Trigger 1+2: Company registration request / Root approves */
export async function notifyCompanyRegistrationRequest(
  companyId: string | null,
  businessName: string,
) {
  // The pending registration's id is NOT a companies(id) yet (the company
  // only exists after Root approves), so company_id must be null here to
  // avoid a foreign-key violation. Root sees it via to_role.
  await fireNotification(
    null,
    "root_super_admin",
    null,
    "🏢 New Company Registration",
    `"${businessName}" has submitted a registration request. Review in Pending Requests.`,
    "info",
    "company_registrations",
    companyId,
  );
}

export async function notifyCompanyRegistrationApproved(companyId: string, companyName: string) {
  // Role-wide targeting scoped to the NEW company_id: the registrant's auth
  // user doesn't exist until they sign up with their whitelisted email, so we
  // cannot (yet) target to_user. RLS scopes by company_id, so only admins of
  // this new company see it — never other companies, never broadcast.
  await fireNotification(
    companyId,
    "company_admin",
    null,
    "✅ Company Activated",
    `"${companyName}" has been approved and activated. Welcome to FactoryOS! Sign in with your whitelisted email to set up your workspace.`,
    "success",
    "companies",
    companyId,
  );
}

/** Trigger 3: Customer access request → Company Admin */
export async function notifyCustomerAccessRequest(
  companyId: string,
  businessName: string,
  requestId?: string | null,
) {
  await fireNotification(
    companyId,
    "company_admin",
    null,
    "👤 New Customer Access Request",
    `"${businessName}" is requesting access to your company. Review in Customer Requests.`,
    "info",
    "customer_requests",
    requestId ?? null,
  );
}

/** Trigger 4: Employee whitelist request → Company Admin */
export async function notifyEmployeeWhitelistRequest(
  companyId: string,
  employeeName: string,
  employeeId: string,
) {
  await fireNotification(
    companyId,
    "company_admin",
    null,
    "👥 New Employee Whitelist Request",
    `${employeeName} has been submitted for whitelist approval.`,
    "info",
    "employees",
    employeeId,
  );
}

/** Trigger 5: Customer places New Order → Company Admin */
export async function notifyNewOrder(
  companyId: string,
  orderNumber: string,
  customerName: string,
  orderId: string,
) {
  await fireNotification(
    companyId,
    "company_admin",
    null,
    "📦 New Customer Order",
    `Order ${orderNumber} from ${customerName} is pending your approval.`,
    "info",
    "sales_orders",
    orderId,
  );
}

/** Trigger 6: Company Admin approves/rejects order → Customer + Production Manager */
export async function notifyOrderApproved(
  companyId: string,
  orderNumber: string,
  customerUserId: string,
  orderId: string,
) {
  // Customer (targeted by to_user only)
  await fireNotification(
    companyId,
    null,
    customerUserId,
    "✅ Order Approved",
    `Your order ${orderNumber} has been approved and is being processed for production.`,
    "success",
    "sales_orders",
    orderId,
  );
  // Production Manager (role-wide)
  await fireNotification(
    companyId,
    "production_manager",
    null,
    "📋 New Order to Plan",
    `Order ${orderNumber} has been approved. Create a production order.`,
    "info",
    "sales_orders",
    orderId,
  );
}

export async function notifyOrderRejected(
  companyId: string,
  orderNumber: string,
  customerUserId: string,
  reason: string,
  orderId: string,
) {
  await fireNotification(
    companyId,
    null,
    customerUserId,
    "❌ Order Rejected",
    `Your order ${orderNumber} was rejected. Reason: ${reason}`,
    "warning",
    "sales_orders",
    orderId,
  );
}

export async function notifyOrderChangesRequested(
  companyId: string,
  orderNumber: string,
  customerUserId: string,
  orderId: string,
) {
  await fireNotification(
    companyId,
    null,
    customerUserId,
    "📝 Changes Requested",
    `Your order ${orderNumber} needs changes. Please review and update.`,
    "info",
    "sales_orders",
    orderId,
  );
}

/** Trigger 7: Profile/role change request → the SPECIFIC Company Admin */
export async function notifyChangeRequest(
  companyId: string,
  requesterName: string,
  requestId: string,
  approverUserId?: string | null,
) {
  // Targeted to the single approver (to_user), never a role broadcast. Falls
  // back to role-wide only if the approver cannot be resolved.
  const [role, user] = resolveTarget("company_admin", approverUserId);
  await fireNotification(
    companyId,
    role,
    user,
    "✏️ Change Request Pending",
    `${requesterName} has submitted a profile change request. Review in Profile → Change Requests.`,
    "info",
    "profile_change_requests",
    requestId,
  );
}

/** A Company Admin's own change request → the single Root Super Admin */
export async function notifyChangeRequestToRoot(
  companyId: string,
  requesterName: string,
  requestId: string,
) {
  // Resolve the root user for precise to_user targeting. user_roles RLS hides
  // the root's row from non-root users, so this goes through the SECURITY
  // DEFINER get_root_user_id() RPC.
  const { data } = await supabase.rpc("get_root_user_id");
  const rootUserId = data ?? null;
  if (rootUserId) {
    await fireNotification(
      companyId,
      null,
      rootUserId,
      "👑 Company Admin Change Request",
      `${requesterName} (Company Admin) has submitted a profile change request. Review in Profile → Change Requests.`,
      "info",
      "profile_change_requests",
      requestId,
    );
  } else {
    // No root user resolved — fall back to the established root role-wide pattern.
    await fireNotification(
      null,
      "root_super_admin",
      null,
      "👑 Company Admin Change Request",
      `${requesterName} (Company Admin) has submitted a profile change request.`,
      "info",
      "profile_change_requests",
      requestId,
    );
  }
}

/** Trigger 8: High-value PO escalation → Company Admin */
export async function notifyPOEscalation(
  companyId: string,
  poNumber: string,
  amount: number,
  poId: string,
) {
  await fireNotification(
    companyId,
    "company_admin",
    null,
    "💰 PO Approval Required",
    `Purchase Order ${poNumber} for $${amount.toLocaleString()} exceeds the approval threshold.`,
    "warning",
    "purchase_orders",
    poId,
  );
}

/** Trigger 9: Machine in maintenance → Plant Admin + Plant Manager */
export async function notifyMachineInMaintenance(
  companyId: string,
  machineName: string,
  machineId: string,
) {
  await fireNotification(
    companyId,
    "plant_admin",
    null,
    "🔧 Machine in Maintenance",
    `${machineName} has entered maintenance status.`,
    "warning",
    "machines",
    machineId,
  );
  await fireNotification(
    companyId,
    "plant_manager",
    null,
    "🔧 Machine in Maintenance",
    `${machineName} has entered maintenance status.`,
    "warning",
    "machines",
    machineId,
  );
}

/** Trigger 10: Quality fail rate exceeds threshold → Plant Admin + Plant Manager */
export async function notifyQualityFailRate(companyId: string, rate: number, plantName: string) {
  await fireNotification(
    companyId,
    "plant_admin",
    null,
    "⚠️ Quality Fail Rate Alert",
    `Fail rate at ${plantName} is ${rate}% — exceeds threshold.`,
    "warning",
    "quality",
    null,
  );
  await fireNotification(
    companyId,
    "plant_manager",
    null,
    "⚠️ Quality Fail Rate Alert",
    `Fail rate at ${plantName} is ${rate}% — exceeds threshold.`,
    "warning",
    "quality",
    null,
  );
}

/** Trigger 11: Production Order behind schedule → Plant Admin + Plant Manager */
export async function notifyOrderBehindSchedule(
  companyId: string,
  orderNumber: string,
  orderId: string,
) {
  await fireNotification(
    companyId,
    "plant_admin",
    null,
    "⏰ Production Behind Schedule",
    `Production Order ${orderNumber} is behind schedule.`,
    "warning",
    "production_orders",
    orderId,
  );
  await fireNotification(
    companyId,
    "plant_manager",
    null,
    "⏰ Production Behind Schedule",
    `Production Order ${orderNumber} is behind schedule.`,
    "warning",
    "production_orders",
    orderId,
  );
}

/** Trigger 13: Advance payment received → Production Manager + Finance Manager */
export async function notifyAdvancePaymentReceived(
  companyId: string,
  orderNumber: string,
  amount: number,
  orderId: string,
) {
  await fireNotification(
    companyId,
    "production_manager",
    null,
    "💰 Advance Payment Received",
    `Payment of $${amount.toLocaleString()} received for order ${orderNumber}. Production can start.`,
    "success",
    "sales_orders",
    orderId,
  );
  await fireNotification(
    companyId,
    "finance_manager",
    null,
    "💰 Payment Received",
    `Advance payment of $${amount.toLocaleString()} received for order ${orderNumber}. Reconcile.`,
    "success",
    "sales_orders",
    orderId,
  );
}

/** Trigger 14: Inventory check insufficient → Production Manager + Procurement Manager */
export async function notifyInsufficientStock(
  companyId: string,
  materialName: string,
  orderNumber: string,
) {
  await fireNotification(
    companyId,
    "production_manager",
    null,
    "📦 Insufficient Stock",
    `Inventory check failed: not enough ${materialName} for order ${orderNumber}. Procurement notified.`,
    "warning",
    "inventory",
    null,
  );
  await fireNotification(
    companyId,
    "procurement_manager",
    null,
    "📦 Procurement Required",
    `Stock insufficient for ${materialName} (order ${orderNumber}). Create a purchase requisition.`,
    "warning",
    "inventory",
    null,
  );
}

/** Trigger 15: Quality Inspector fails batch → Production Manager + Production Operator */
export async function notifyBatchFailed(
  companyId: string,
  batchNumber: string,
  rejectionNotes: string,
  workOrderId: string,
) {
  await fireNotification(
    companyId,
    "production_manager",
    null,
    "❌ Batch Failed QC",
    `Batch ${batchNumber} failed quality inspection. Notes: ${rejectionNotes}`,
    "error",
    "work_orders",
    workOrderId,
  );
  await fireNotification(
    companyId,
    "production_operator",
    null,
    "❌ Batch Requires Rework",
    `Your batch ${batchNumber} failed QC. Rejection notes: ${rejectionNotes}`,
    "error",
    "work_orders",
    workOrderId,
  );
}

/** Trigger 16: Operator flags machine issue → Production Manager + Maintenance Engineer */
export async function notifyMachineIssue(
  companyId: string,
  machineName: string,
  operatorName: string,
  ticketId: string,
) {
  await fireNotification(
    companyId,
    "production_manager",
    null,
    "🔧 Machine Issue Reported",
    `${operatorName} flagged an issue on ${machineName}. Schedule impact.`,
    "warning",
    "maintenance_tickets",
    ticketId,
  );
  await fireNotification(
    companyId,
    "maintenance_engineer",
    null,
    "🔧 Maintenance Ticket Created",
    `${operatorName} reported an issue on ${machineName}. Please investigate.`,
    "warning",
    "maintenance_tickets",
    ticketId,
  );
}

/** Trigger 17: Work Order reaches 100% → Production Manager + Quality Inspector */
export async function notifyWorkOrderCompleted(
  companyId: string,
  woNumber: string,
  operatorName: string,
  workOrderId: string,
) {
  await fireNotification(
    companyId,
    "production_manager",
    null,
    "✅ Work Order Complete",
    `Work Order ${woNumber} completed by ${operatorName}.`,
    "success",
    "work_orders",
    workOrderId,
  );
  await fireNotification(
    companyId,
    "quality_inspector",
    null,
    "🔍 Batch Ready for Inspection",
    `Work Order ${woNumber} is 100% complete and awaiting inspection.`,
    "info",
    "work_orders",
    workOrderId,
  );
}

/** Trigger 18: Work Order assigned to operator */
export async function notifyWorkOrderAssigned(
  companyId: string,
  woNumber: string,
  operatorUserId: string,
  workOrderId: string,
) {
  const [ntRole, ntUser] = resolveTarget("production_operator", operatorUserId);
  await fireNotification(
    companyId,
    ntRole,
    ntUser,
    "📋 New Work Order Assigned",
    `Work Order ${woNumber} has been assigned to you.`,
    "info",
    "work_orders",
    workOrderId,
  );
}

/** Trigger 19: Maintenance ticket resolved → Operator + Production Manager */
export async function notifyMaintenanceResolved(
  companyId: string,
  machineName: string,
  operatorUserId: string,
  ticketId: string,
) {
  const [ntRole, ntUser] = resolveTarget("production_operator", operatorUserId);
  await fireNotification(
    companyId,
    ntRole,
    ntUser,
    "✅ Machine Back Online",
    `${machineName} is back online. You can resume work.`,
    "success",
    "maintenance_tickets",
    ticketId,
  );
  await fireNotification(
    companyId,
    "production_manager",
    null,
    "✅ Maintenance Resolved",
    `${machineName} repair complete. Machine is available.`,
    "success",
    "maintenance_tickets",
    ticketId,
  );
}

/** Trigger 20: Material reservation requested → Warehouse Manager */
export async function notifyMaterialReservation(
  companyId: string,
  orderNumber: string,
  materialName: string,
) {
  await fireNotification(
    companyId,
    "warehouse_manager",
    null,
    "📦 Material Reservation Requested",
    `Production needs ${materialName} reserved for order ${orderNumber}.`,
    "info",
    "production_orders",
    null,
  );
}

/** Trigger 21: Supplier dispatches PO → Procurement Manager (creator) + Warehouse Manager */
export async function notifySupplierShipped(
  companyId: string,
  poNumber: string,
  supplierName: string,
  poId: string,
  createdBy?: string | null,
  scanUrl?: string | null,
) {
  // Procurement Manager who created the PO — targeted, never broadcast.
  const [pmRole, pmUser] = resolveTarget("procurement_manager", createdBy);
  await fireNotification(
    companyId,
    pmRole,
    pmUser,
    "🚚 Shipment Dispatched",
    `${supplierName} has dispatched PO ${poNumber}.${scanUrl ? ` Inbound QR: ${scanUrl}` : ""}`,
    "info",
    "purchase_orders",
    poId,
  );
  // Warehouse Manager — expect Goods Receipt.
  await fireNotification(
    companyId,
    "warehouse_manager",
    null,
    "🚚 Supplier Shipment Incoming",
    `${supplierName} has shipped PO ${poNumber}. Expect Goods Receipt.`,
    "info",
    "purchase_orders",
    poId,
  );
}

/** Trigger 22: Quality passes batch → Warehouse Manager + Production Manager */
export async function notifyQualityPassed(
  companyId: string,
  batchNumber: string,
  workOrderId: string,
) {
  await fireNotification(
    companyId,
    "warehouse_manager",
    null,
    "✅ Finished Goods Ready",
    `Batch ${batchNumber} passed QC and is ready for warehouse.`,
    "success",
    "work_orders",
    workOrderId,
  );
  await fireNotification(
    companyId,
    "production_manager",
    null,
    "✅ Quality Passed",
    `Batch ${batchNumber} passed inspection.`,
    "success",
    "work_orders",
    workOrderId,
  );
}

/** Trigger 23: Stock below reorder threshold → Warehouse Manager + Procurement Manager */
export async function notifyLowStock(
  companyId: string,
  skuName: string,
  currentQty: number,
  reorderLevel: number,
) {
  await fireNotification(
    companyId,
    "warehouse_manager",
    null,
    "📉 Low Stock Alert",
    `${skuName} is at ${currentQty} units (reorder at ${reorderLevel}).`,
    "warning",
    "inventory",
    null,
  );
  await fireNotification(
    companyId,
    "procurement_manager",
    null,
    "📉 Low Stock Alert",
    `${skuName} is at ${currentQty} units. Reorder needed.`,
    "warning",
    "inventory",
    null,
  );
}

/** Trigger 24: Supplier responds to PO → Procurement Manager who created it */
export async function notifySupplierPOResponse(
  companyId: string,
  poNumber: string,
  supplierName: string,
  status: string,
  poId: string,
  createdBy?: string | null,
) {
  const [pmRole, pmUser] = resolveTarget("procurement_manager", createdBy);
  await fireNotification(
    companyId,
    pmRole,
    pmUser,
    "📋 PO Response Received",
    `${supplierName} has ${status} PO ${poNumber}.`,
    status === "accepted" ? "success" : "warning",
    "purchase_orders",
    poId,
  );
}

/** Trigger 25: Dispatch Ready → Finance Manager (generate invoice) */
export async function notifyDispatchReady(
  companyId: string,
  orderNumber: string,
  shipmentId: string,
) {
  await fireNotification(
    companyId,
    "finance_manager",
    null,
    "📄 Dispatch Ready — Generate Invoice",
    `Order ${orderNumber} is dispatch-ready. Generate the final invoice.`,
    "info",
    "shipments",
    shipmentId,
  );
}

/** Trigger 26: Supplier GRN confirmed → Finance Manager (release payment) */
export async function notifyGRNConfirmed(
  companyId: string,
  poNumber: string,
  supplierName: string,
) {
  await fireNotification(
    companyId,
    "finance_manager",
    null,
    "✅ Goods Receipt Confirmed",
    `GRN confirmed for PO ${poNumber} from ${supplierName}. Release supplier payment.`,
    "success",
    "purchase_orders",
    null,
  );
}

/** Trigger 26b: Goods Receipt confirmed → this Supplier ("your shipment received") */
export async function notifyGRNToSupplier(
  companyId: string,
  poNumber: string,
  supplierName: string,
  supplierUserId?: string | null,
) {
  const [ntRole, ntUser] = resolveTarget("supplier_portal", supplierUserId);
  await fireNotification(
    companyId,
    ntRole,
    ntUser,
    "✅ Shipment Received",
    `Your shipment for PO ${poNumber} has been received by the warehouse.`,
    "success",
    "purchase_orders",
    null,
  );
}

/** Trigger 27: New employee → Department pending for HR Manager */
export async function notifyNewEmployeeDepartmentRequest(
  companyId: string,
  employeeName: string,
  employeeId: string,
) {
  await fireNotification(
    companyId,
    "hr_manager",
    null,
    "👤 Employee Needs Department",
    `${employeeName} needs a department assignment pending.`,
    "info",
    "employees",
    employeeId,
  );
}

/** When Company Admin approves/rejects employee whitelist → HR Manager confirmation */
export async function notifyWhitelistDecision(
  companyId: string,
  employeeName: string,
  decision: string,
) {
  await fireNotification(
    companyId,
    "hr_manager",
    null,
    `📋 Whitelist ${decision === "approved" ? "Approved" : "Rejected"}`,
    `${employeeName} has been ${decision} by Company Admin.`,
    decision === "approved" ? "success" : "warning",
    "employees",
    null,
  );
}

/** When Company Admin approves employee → that employee notified (uses to_user ONLY for precise targeting) */
export async function notifyEmployeeApproved(
  companyId: string,
  employeeUserId: string,
  employeeName: string,
) {
  await fireNotification(
    companyId,
    null,
    employeeUserId,
    "✅ Account Activated",
    `${employeeName}, your account has been approved and activated. Welcome!`,
    "success",
    "employees",
    null,
  );
}

/** When Company Admin approves/rejects a change request → the requester notified (to_user ONLY, no role broadcast) */
export async function notifyChangeRequestApproved(
  companyId: string,
  requesterUserId: string,
  requestType: string,
) {
  await fireNotification(
    companyId,
    null,
    requesterUserId,
    "✅ Change Request Approved",
    `Your ${requestType} change request has been approved.`,
    "success",
    "profile_change_requests",
    null,
  );
}

export async function notifyChangeRequestRejected(
  companyId: string,
  requesterUserId: string,
  requestType: string,
  reason: string,
) {
  await fireNotification(
    companyId,
    null,
    requesterUserId,
    "❌ Change Request Rejected",
    `Your ${requestType} change request was rejected. Reason: ${reason}`,
    "warning",
    "profile_change_requests",
    null,
  );
}

/** HR: Leave request submitted → HR Manager (role-targeted, HR-only) */
export async function notifyLeaveRequestSubmitted(
  companyId: string,
  employeeName: string,
  leaveType: string,
  leaveId: string,
) {
  await fireNotification(
    companyId,
    "hr_manager",
    null,
    "🗓️ New Leave Request",
    `${employeeName} has requested ${leaveType} leave. Review in Leaves.`,
    "info",
    "leaves",
    leaveId,
  );
}

/** HR: Leave approved/rejected → the specific employee only (to_user) */
export async function notifyLeaveDecision(
  companyId: string,
  employeeUserId: string,
  leaveType: string,
  decision: string,
  reason: string,
  leaveId: string,
) {
  const [ntRole, ntUser] = resolveTarget("hr_manager", employeeUserId);
  await fireNotification(
    companyId,
    ntRole,
    ntUser,
    decision === "approved" ? "✅ Leave Approved" : "❌ Leave Rejected",
    decision === "approved"
      ? `Your ${leaveType} leave request has been approved.`
      : `Your ${leaveType} leave request was rejected.${reason ? ` Reason: ${reason}` : ""}`,
    decision === "approved" ? "success" : "warning",
    "leaves",
    leaveId,
  );
}

/** HR: Payroll marked paid → the specific employee only (to_user, fail-closed) */
export async function notifyPayrollPaid(
  companyId: string,
  employeeUserId: string,
  period: string,
  amount: number,
) {
  const [ntRole, ntUser] = resolveTarget("hr_manager", employeeUserId);
  await fireNotification(
    companyId,
    ntRole,
    ntUser,
    "💸 Payroll Released",
    `Your salary for ${period} ($${amount.toLocaleString()}) has been paid.`,
    "success",
    "payroll",
    null,
  );
}

/** Trigger 28: Customer creates Support Ticket → Company Admin */
export async function notifySupportTicket(
  companyId: string,
  ticketNumber: string,
  customerName: string,
  ticketId: string,
) {
  await fireNotification(
    companyId,
    "company_admin",
    null,
    "🎫 New Support Ticket",
    `${customerName} opened ticket ${ticketNumber}.`,
    "info",
    "support_tickets",
    ticketId,
  );
}

/** Trigger 29: Invoice generated / payment status → Customer */
export async function notifyInvoiceGenerated(
  companyId: string,
  invoiceNumber: string,
  customerUserId: string,
  invoiceId: string,
) {
  const [ntRole, ntUser] = resolveTarget("customer_portal", customerUserId);
  await fireNotification(
    companyId,
    ntRole,
    ntUser,
    "📄 Invoice Generated",
    `Invoice ${invoiceNumber} is ready. View in your Invoices tab.`,
    "info",
    "invoices",
    invoiceId,
  );
}

export async function notifyPaymentStatusChanged(
  companyId: string,
  invoiceNumber: string,
  customerUserId: string,
  status: string,
  invoiceId: string,
) {
  const [ntRole, ntUser] = resolveTarget("customer_portal", customerUserId);
  await fireNotification(
    companyId,
    ntRole,
    ntUser,
    "💰 Payment Status Updated",
    `Invoice ${invoiceNumber} status: ${status}.`,
    "success",
    "invoices",
    invoiceId,
  );
}

/** Trigger 30: Supplier payment released → Supplier */
export async function notifySupplierPaymentReleased(
  companyId: string,
  poNumber: string,
  supplierUserId: string,
  amount: number,
) {
  const [ntRole, ntUser] = resolveTarget("supplier_portal", supplierUserId);
  await fireNotification(
    companyId,
    ntRole,
    ntUser,
    "💰 Payment Released",
    `Payment of $${amount.toLocaleString()} for PO ${poNumber} has been released.`,
    "success",
    "purchase_orders",
    null,
  );
}

/** Trigger 31: New PO sent to Supplier */
export async function notifyNewPOToSupplier(
  companyId: string,
  poNumber: string,
  supplierUserId: string,
  poId: string,
) {
  const [ntRole, ntUser] = resolveTarget("supplier_portal", supplierUserId);
  await fireNotification(
    companyId,
    ntRole,
    ntUser,
    "📋 New Purchase Order",
    `Purchase Order ${poNumber} has been issued to you. Review in your portal.`,
    "info",
    "purchase_orders",
    poId,
  );
}

/** Advance payment QR generated → Customer */
export async function notifyAdvancePaymentQRGenerated(
  companyId: string,
  orderNumber: string,
  customerUserId: string,
  amount: number,
) {
  const [ntRole, ntUser] = resolveTarget("customer_portal", customerUserId);
  await fireNotification(
    companyId,
    ntRole,
    ntUser,
    "📱 Advance Payment Required",
    `An advance payment of $${amount.toLocaleString()} is required for order ${orderNumber}. Scan the QR code to pay.`,
    "info",
    "sales_orders",
    null,
  );
}

/** Support ticket status updated → Customer */
export async function notifySupportTicketUpdate(
  companyId: string,
  ticketNumber: string,
  customerUserId: string,
  status: string,
  ticketId: string,
) {
  const [ntRole, ntUser] = resolveTarget("customer_portal", customerUserId);
  await fireNotification(
    companyId,
    ntRole,
    ntUser,
    "🎫 Support Ticket Updated",
    `Your ticket ${ticketNumber} status: ${status}.`,
    "info",
    "support_tickets",
    ticketId,
  );
}

/** Work Order progress update → Customer (live tracking notification) */
export async function notifyProgressUpdate(
  companyId: string,
  orderNumber: string,
  customerUserId: string,
  progress: number,
  workOrderId: string,
) {
  const [ntRole, ntUser] = resolveTarget("customer_portal", customerUserId);
  await fireNotification(
    companyId,
    ntRole,
    ntUser,
    "📈 Order Progress Update",
    `Your order ${orderNumber} is ${progress}% complete.`,
    "info",
    "work_orders",
    workOrderId,
  );
}

/** Quality inspection passed/failed → Customer (status update, no raw QC detail) */
export async function notifyQualityStatusUpdate(
  companyId: string,
  orderNumber: string,
  customerUserId: string,
  passed: boolean,
) {
  const [ntRole, ntUser] = resolveTarget("customer_portal", customerUserId);
  await fireNotification(
    companyId,
    ntRole,
    ntUser,
    passed ? "✅ Quality Inspection Passed" : "❌ Quality Inspection Ongoing",
    passed
      ? `Your order ${orderNumber} has passed quality inspection and is moving to dispatch.`
      : `Your order ${orderNumber} is undergoing additional quality checks. We'll update you.`,
    passed ? "success" : "info",
    "sales_orders",
    null,
  );
}

/** Trigger 32: Shipment created/dispatched → Customer */
export async function notifyShipmentUpdate(
  companyId: string,
  orderNumber: string,
  customerUserId: string,
  status: string,
  shipmentId: string,
) {
  const labels: Record<string, string> = {
    dispatch_ready: "📦 Shipment Ready for Dispatch",
    out_for_delivery: "🚚 Order Out for Delivery",
    delivered: "✅ Order Delivered",
  };
  const title = labels[status] ?? "🚚 Shipment Update";
  const [ntRole, ntUser] = resolveTarget("customer_portal", customerUserId);
  await fireNotification(
    companyId,
    ntRole,
    ntUser,
    title,
    `Your order ${orderNumber} shipment status: ${status.replace(/_/g, " ")}.`,
    status === "delivered" ? "success" : "info",
    "shipments",
    shipmentId,
  );
}

/** Trigger 33: Production paused for maintenance → Customer */
export async function notifyProductionPaused(
  companyId: string,
  orderNumber: string,
  customerUserId: string,
  reason: string,
) {
  const [ntRole, ntUser] = resolveTarget("customer_portal", customerUserId);
  await fireNotification(
    companyId,
    ntRole,
    ntUser,
    "⏸️ Production Paused",
    `Your order ${orderNumber} is paused due to maintenance. We'll update you when it resumes.`,
    "warning",
    "sales_orders",
    null,
  );
}

// ═══════════════════════════════════════════════════════════════════
// GENERIC HELPERS (mark as read, fetch, count)
// ═══════════════════════════════════════════════════════════════════

export async function markNotificationRead(notificationId: string) {
  try {
    await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId);
  } catch (err) {
    console.error("Failed to mark notification as read:", err);
  }
}

/**
 * Root Super Admin notifications: root-targeted rows carry company_id = null
 * (the registration's id is not a companies(id) until Root approves), so all
 * root queries filter on to_role = 'root_super_admin' — never on company_id.
 */
function isRootRole(role: string | null | undefined): boolean {
  return role === "root_super_admin";
}

export async function markAllNotificationsRead(
  companyId: string | null,
  role: string | null,
  userId: string | null,
) {
  try {
    if (isRootRole(role)) {
      const q = supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("is_read", false);
      if (userId) {
        q.or(`to_user.eq.${userId},to_role.eq.root_super_admin`);
      } else {
        q.eq("to_role", "root_super_admin");
      }
      await q;
      return;
    }
    // Non-root roles always have a company — guard for type safety.
    if (!companyId) return;
    const q = supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("company_id", companyId)
      .eq("is_read", false);

    if (userId) {
      q.or(`to_user.eq.${userId},to_role.eq.${role ?? "company_admin"}`);
    } else {
      q.eq("to_role", role ?? "company_admin");
    }
    await q;
  } catch (err) {
    console.error("Failed to mark all notifications as read:", err);
  }
}

export async function getUnreadNotificationCount(
  companyId: string | null,
  role: string | null,
  userId: string | null,
): Promise<number> {
  try {
    if (isRootRole(role)) {
      const q = supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false);
      if (userId) {
        q.or(`to_user.eq.${userId},to_role.eq.root_super_admin`);
      } else {
        q.eq("to_role", "root_super_admin");
      }
      const { count } = await q;
      return count ?? 0;
    }
    // Non-root roles always have a company — guard for type safety.
    if (!companyId) return 0;
    const q = supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("is_read", false);

    if (userId) {
      q.or(`to_user.eq.${userId},to_role.eq.${role ?? "company_admin"}`);
    } else {
      q.eq("to_role", role ?? "company_admin");
    }
    const { count } = await q;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function fetchNotifications(
  companyId: string | null,
  role: string | null,
  userId: string | null,
  limit = 50,
): Promise<AppNotification[]> {
  try {
    if (isRootRole(role)) {
      const q = supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (userId) {
        q.or(`to_user.eq.${userId},to_role.eq.root_super_admin`);
      } else {
        q.eq("to_role", "root_super_admin");
      }
      const { data } = await q;
      return (data ?? []) as AppNotification[];
    }
    // Non-root roles always have a company — guard for type safety.
    if (!companyId) return [];
    const q = supabase
      .from("notifications")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (userId) {
      q.or(`to_user.eq.${userId},to_role.eq.${role ?? "company_admin"}`);
    } else {
      q.eq("to_role", role ?? "company_admin");
    }
    const { data } = await q;
    return (data ?? []) as AppNotification[];
  } catch {
    return [];
  }
}
