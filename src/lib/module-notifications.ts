/**
 * Central notification dispatcher for generic (LiveModule) CRUD.
 *
 * Most operational modules render through <LiveModule/>, so their create
 * actions had no place to fire the Chapter 4 notification triggers. This
 * maps a table + newly-created row to the correct targeted notification,
 * resolving the human-readable names the triggers expect.
 *
 * Every helper here is fail-soft: a notification must never break a write.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  notifyNewPOToSupplier,
  notifyGRNConfirmed,
  notifySupportTicket,
  notifyMachineIssue,
} from "@/lib/notifications";

async function lookup(
  table: string,
  id: unknown,
  columns: string,
): Promise<Record<string, any> | null> {
  if (!id || typeof id !== "string") return null;
  try {
    const { data } = (await supabase
      .from(table as never)
      .select(columns)
      .eq("id" as never, id)
      .maybeSingle()) as any;
    return (data as Record<string, any>) ?? null;
  } catch {
    return null;
  }
}

/**
 * Fire the notification that corresponds to creating `row` in `table`.
 * Returns silently when the table has no create-time trigger.
 */
export async function notifyOnCreate(
  table: string,
  row: Record<string, any>,
  companyId: string,
  actorName: string,
): Promise<void> {
  try {
    switch (table) {
      // Trigger: new PO issued → that supplier only
      case "purchase_orders": {
        const supplier = await lookup("suppliers", row.supplier_id, "user_id,name");
        if (!supplier?.user_id) return; // fail closed — never broadcast to all suppliers
        await notifyNewPOToSupplier(companyId, row.po_number ?? "PO", supplier.user_id, row.id);
        return;
      }

      // Trigger: goods receipt confirmed → Procurement + Finance
      case "goods_receipts": {
        const po = await lookup("purchase_orders", row.purchase_order_id, "po_number,supplier_id");
        const supplier = po ? await lookup("suppliers", po.supplier_id, "name") : null;
        await notifyGRNConfirmed(
          companyId,
          po?.po_number ?? row.grn_number ?? "GRN",
          supplier?.name ?? "Supplier",
        );
        return;
      }

      // Trigger: customer raises a support ticket → Company Admin + assignee
      case "support_tickets": {
        const customer = await lookup("customers", row.customer_id, "name,business_name");
        await notifySupportTicket(
          companyId,
          row.ticket_number ?? "TKT",
          customer?.business_name ?? customer?.name ?? actorName,
          row.id,
        );
        return;
      }

      // Trigger: machine issue flagged → Production Manager + Maintenance Engineer
      case "maintenance_tickets":
      case "machine_breakdowns": {
        const machine = await lookup("machines", row.machine_id, "name");
        await notifyMachineIssue(companyId, machine?.name ?? "a machine", actorName, row.id);
        return;
      }

      default:
        return;
    }
  } catch (err) {
    console.warn(`notifyOnCreate[${table}] skipped:`, err);
  }
}
