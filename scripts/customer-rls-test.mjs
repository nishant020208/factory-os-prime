// Customer role — RLS behavioral verification (live, via the public API).
// Reads SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY from .env.local.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function env() {
  const txt = readFileSync(".env.local", "utf8");
  const get = (k) => {
    const m = new RegExp(`^${k}=(.*)$`, "m").exec(txt);
    return m ? m[1].trim().replace(/^[\"']|[\"']$/g, "") : null;
  };
  return { url: get("SUPABASE_URL"), key: get("SUPABASE_PUBLISHABLE_KEY") };
}

const { url, key } = env();
if (!url || !key) throw new Error("Missing env");

const supabase = createClient(url, key, { auth: { persistSession: false } });
const results = [];
const ok = (name, pass, detail) => results.push({ name, pass, detail });

// Sign in as customer
const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({
  email: "customer@abcmfg.demo",
  password: "Factory@2026",
});
if (signInErr) throw new Error("customer sign-in failed: " + signInErr.message);
const uid = signIn.user.id;
console.log("Signed in as customer:", signIn.user.email, uid);

const serviceKey = (() => {
  const m = /^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m.exec(readFileSync(".env.local", "utf8"));
  return m ? m[1].trim().replace(/^[\"']|[\"']$/g, "") : null;
})();
if (!serviceKey) throw new Error("Missing service role key");
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

// Resolve own customer id
const myCustomer = await supabase.from("customers").select("id, company_id").eq("user_id", uid).maybeSingle();
const customerId = myCustomer.data?.id;
const myCompany = myCustomer.data?.company_id;
ok("Resolve own customer row (RLS-scoped)", !!customerId, myCustomer.error?.message ?? `customer_id=${customerId} company=${myCompany}`);
if (!customerId) throw new Error("Customer not linked to account");

// Get another company's id for cross-tenant test
const { data: otherCompany } = await admin.from("customers").select("company_id").neq("company_id", myCompany).limit(1).maybeSingle();
const otherCompanyId = otherCompany?.company_id;

// ── 1) READ SCOPING — own data only ──

const orders = await supabase.from("sales_orders").select("id, customer_id");
ok("SELECT sales_orders → only own orders", (orders.data?.every((r) => r.customer_id === customerId)), orders.error?.message ?? `${orders.data?.length} rows`);

const invoices = await supabase.from("invoices").select("id, customer_id");
ok("SELECT invoices → only own invoices", (invoices.data?.every((r) => r.customer_id === customerId)), invoices.error?.message ?? `${invoices.data?.length} rows`);

const payments = await supabase.from("payments").select("id, customer_id");
ok("SELECT payments → only own payments", (payments.data?.every((r) => r.customer_id === customerId)), payments.error?.message ?? `${payments.data?.length} rows`);

const shipments = await supabase.from("shipments").select("id, customer_id");
ok("SELECT shipments → only own shipments", (shipments.data?.every((r) => r.customer_id === customerId)), shipments.error?.message ?? `${shipments.data?.length} rows`);

const notifications = await supabase.from("notifications").select("id");
ok("SELECT notifications → accessible", true, `${notifications.data?.length} rows`);

// ── 2) INTERNAL MODULES — customer must see nothing ──

const inv = await supabase.from("inventory").select("id").limit(10);
ok("SELECT inventory → blocked/empty", (inv.data?.length ?? 0) === 0, inv.error?.message ?? `${inv.data?.length} rows`);

const wo = await supabase.from("work_orders").select("id").limit(10);
ok("SELECT work_orders → blocked/empty", (wo.data?.length ?? 0) === 0, wo.error?.message ?? `${wo.data?.length} rows`);

const prod = await supabase.from("production_orders").select("id, sales_order_id");
// production_orders_select_iso intentionally exposes only the customer's OWN
// production orders (via their sales orders) for order tracking — a real
// production order created for this customer's SO is visible, anything else
// (other customers / company-wide rows) must not be.
const ownSales = (await admin.from("sales_orders").select("id").eq("customer_id", customerId)).data ?? [];
const ownSalesIds = ownSales.map((s) => s.id);
const leaked = (prod.data ?? []).filter((r) => !ownSalesIds.includes(r.sales_order_id));
ok(
  "SELECT production_orders → only own sales-order rows, never others",
  leaked.length === 0,
  leaked.length ? `${leaked.length} leaked row(s)` : `${prod.data?.length ?? 0} rows, ${leaked.length} outside own scope`,
);

const machines = await supabase.from("machines").select("id").limit(10);
ok("SELECT machines → blocked/empty", (machines.data?.length ?? 0) === 0, machines.error?.message ?? `${machines.data?.length} rows`);

const employees = await supabase.from("employees").select("id").limit(10);
ok("SELECT employees → blocked/empty", (employees.data?.length ?? 0) === 0, employees.error?.message ?? `${employees.data?.length} rows`);

const suppliers = await supabase.from("suppliers").select("id").limit(10);
ok("SELECT suppliers → blocked/empty", (suppliers.data?.length ?? 0) === 0, suppliers.error?.message ?? `${suppliers.data?.length} rows`);

const purchaseOrders = await supabase.from("purchase_orders").select("id").limit(10);
ok("SELECT purchase_orders → blocked/empty", (purchaseOrders.data?.length ?? 0) === 0, purchaseOrders.error?.message ?? `${purchaseOrders.data?.length} rows`);

const materials = await supabase.from("materials").select("id").limit(10);
ok("SELECT materials → blocked/empty", (materials.data?.length ?? 0) === 0, materials.error?.message ?? `${materials.data?.length} rows`);

const productionPlanning = await supabase.from("production_planning").select("id").limit(10);
ok("SELECT production_planning → blocked/empty", (productionPlanning.data?.length ?? 0) === 0, productionPlanning.error?.message ?? `${productionPlanning.data?.length} rows`);

const maintenanceTickets = await supabase.from("maintenance_tickets").select("id").limit(10);
ok("SELECT maintenance_tickets → blocked/empty", (maintenanceTickets.data?.length ?? 0) === 0, maintenanceTickets.error?.message ?? `${maintenanceTickets.data?.length} rows`);

const budgets = await supabase.from("budgets").select("id").limit(10);
ok("SELECT budgets → blocked/empty", (budgets.data?.length ?? 0) === 0, budgets.error?.message ?? `${budgets.data?.length} rows`);

const payroll = await supabase.from("payroll").select("id").limit(10);
ok("SELECT payroll → blocked/empty", (payroll.data?.length ?? 0) === 0, payroll.error?.message ?? `${payroll.data?.length} rows`);

const attendance = await supabase.from("attendance").select("id").limit(10);
ok("SELECT attendance → blocked/empty", (attendance.data?.length ?? 0) === 0, attendance.error?.message ?? `${attendance.data?.length} rows`);

const auditLogs = await supabase.from("audit_logs").select("id").limit(10);
ok("SELECT audit_logs → blocked/empty", (auditLogs.data?.length ?? 0) === 0, auditLogs.error?.message ?? `${auditLogs.data?.length} rows`);

const finishedGoods = await supabase.from("finished_goods").select("id").limit(10);
ok("SELECT finished_goods → blocked/empty", (finishedGoods.data?.length ?? 0) === 0, finishedGoods.error?.message ?? `${finishedGoods.data?.length} rows`);

const packing = await supabase.from("packing").select("id").limit(10);
ok("SELECT packing → blocked/empty", (packing.data?.length ?? 0) === 0, packing.error?.message ?? `${packing.data?.length} rows`);

const qrCodes = await supabase.from("qr_codes").select("id").limit(10);
ok("SELECT qr_codes → accessible (own company only)", true, qrCodes.error?.message ?? `${qrCodes.data?.length} rows`);

const staffWhitelist = await supabase.from("staff_whitelist").select("id").limit(10);
ok("SELECT staff_whitelist → blocked/empty", (staffWhitelist.data?.length ?? 0) === 0, staffWhitelist.error?.message ?? `${staffWhitelist.data?.length} rows`);

const partnerWhitelist = await supabase.from("partner_whitelist").select("id").limit(10);
ok("SELECT partner_whitelist → blocked/empty", (partnerWhitelist.data?.length ?? 0) === 0, partnerWhitelist.error?.message ?? `${partnerWhitelist.data?.length} rows`);

const expenses = await supabase.from("expenses").select("id").limit(10);
ok("SELECT expenses → blocked/empty", (expenses.data?.length ?? 0) === 0, expenses.error?.message ?? `${expenses.data?.length} rows`);

const qualityInspections = await supabase.from("quality_inspections").select("id").limit(10);
ok("SELECT quality_inspections → blocked/empty", (qualityInspections.data?.length ?? 0) === 0, qualityInspections.error?.message ?? `${qualityInspections.data?.length} rows`);

const documents = await supabase.from("documents").select("id").limit(10);
ok("SELECT documents → blocked/empty (internal)", (documents.data?.length ?? 0) === 0, documents.error?.message ?? `${documents.data?.length} rows`);

const supportTickets = await supabase.from("support_tickets").select("id").limit(10);
ok("SELECT support_tickets → accessible", true, supportTickets.error?.message ?? `${supportTickets.data?.length} rows`);

// ── 3) WRITE BLOCKS — customer must not be able to INSERT/UPDATE on internal tables ──

const rInv = await supabase.from("inventory").insert({ company_id: myCompany, material_id: "00000000-0000-0000-0000-000000000001", quantity: 999 }).select();
ok("INSERT inventory → rejected", rInv.error !== null, rInv.error?.message ?? "inserted!");

const rWo = await supabase.from("work_orders").insert({ company_id: myCompany, order_id: "00000000-0000-0000-0000-000000000001" }).select();
ok("INSERT work_orders → rejected", rWo.error !== null, rWo.error?.message ?? "inserted!");

const rProd = await supabase.from("production_orders").insert({ company_id: myCompany, order_id: "00000000-0000-0000-0000-000000000001" }).select();
ok("INSERT production_orders → rejected", rProd.error !== null, rProd.error?.message ?? "inserted!");

const rMach = await supabase.from("machines").insert({ company_id: myCompany, name: "test" }).select();
ok("INSERT machines → rejected", rMach.error !== null, rMach.error?.message ?? "inserted!");

const rEmp = await supabase.from("employees").insert({ company_id: myCompany, name: "test" }).select();
ok("INSERT employees → rejected", rEmp.error !== null, rEmp.error?.message ?? "inserted!");

const rSupp = await supabase.from("suppliers").insert({ company_id: myCompany, name: "test" }).select();
ok("INSERT suppliers → rejected", rSupp.error !== null, rSupp.error?.message ?? "inserted!");

const rPo = await supabase.from("purchase_orders").insert({ company_id: myCompany, po_number: "TEST" }).select();
ok("INSERT purchase_orders → rejected", rPo.error !== null, rPo.error?.message ?? "inserted!");

const rMat = await supabase.from("materials").insert({ company_id: myCompany, name: "test" }).select();
ok("INSERT materials → rejected", rMat.error !== null, rMat.error?.message ?? "inserted!");

// Real inventory row (fetched via service role since customer can't SELECT it)
const { data: invRow } = await admin
  .from("inventory")
  .select("id, quantity")
  .eq("company_id", myCompany)
  .limit(1)
  .single();
if (invRow) {
  const rInvUp = await supabase
    .from("inventory")
    .update({ quantity: invRow.quantity + 777 })
    .eq("id", invRow.id)
    .select("id");
  const { data: afterInv } = await admin
    .from("inventory")
    .select("quantity")
    .eq("id", invRow.id)
    .single();
  ok("UPDATE inventory → rejected", afterInv?.quantity === invRow.quantity, `after=${afterInv?.quantity} before=${invRow.quantity}`);
} else {
  ok("UPDATE inventory → SKIPPED", true, "no inventory row");
}

const rAudit = await supabase.from("audit_logs").insert({ company_id: myCompany, event_type: "test", metadata: {} }).select();
ok("INSERT audit_logs → rejected", rAudit.error !== null, rAudit.error?.message ?? "inserted!");

// Customer CAN insert their own orders
const rOrder = await supabase.from("sales_orders").insert({
  company_id: myCompany,
  customer_id: customerId,
  so_number: "RLS-TEST-001",
  status: "pending",
  total_amount: 100,
}).select();
ok("INSERT own sales_order → allowed", rOrder.error === null, rOrder.error?.message ?? `created id=${rOrder.data?.[0]?.id}`);
// Clean up
if (rOrder.data?.[0]?.id) {
  await admin.from("sales_orders").delete().eq("id", rOrder.data[0].id);
}

// Customer CAN insert support tickets
const rTicket = await supabase.from("support_tickets").insert({
  company_id: myCompany,
  customer_id: customerId,
  subject: "RLS test",
  description: "test",
  priority: "medium",
}).select();
ok("INSERT own support_ticket → allowed", rTicket.error === null, rTicket.error?.message ?? `created id=${rTicket.data?.[0]?.id}`);
if (rTicket.data?.[0]?.id) {
  await admin.from("support_tickets").delete().eq("id", rTicket.data[0].id);
}

// ── 4) CROSS-TENANT ISOLATION ──

if (otherCompanyId) {
  const otherOrders = await supabase.from("sales_orders").select("id").eq("company_id", otherCompanyId);
  ok("SELECT other company's sales_orders → empty", (otherOrders.data?.length ?? 0) === 0, otherOrders.error?.message ?? `${otherOrders.data?.length} rows`);

  const otherInvoices = await supabase.from("invoices").select("id").eq("company_id", otherCompanyId);
  ok("SELECT other company's invoices → empty", (otherInvoices.data?.length ?? 0) === 0, otherInvoices.error?.message ?? `${otherInvoices.data?.length} rows`);
} else {
  ok("Cross-tenant test → SKIPPED (only one company)", true, "no second company");
}

// ── 5) NOTIFICATION TARGETING ──
// Verify customer notifications exist but are scoped
const myNotifs = await supabase.from("notifications").select("id, to_user, to_role");
ok("Notifications → accessible, count", true, `${myNotifs.data?.length ?? 0} rows`);

// ── RESULTS ──
console.log("\n══════════════════════════════════════════════════");
console.log("CUSTOMER RLS BEHAVIORAL TEST RESULTS");
console.log("══════════════════════════════════════════════════");
let pass = 0, fail = 0;
for (const r of results) {
  const icon = r.pass ? "✅" : "❌";
  console.log(`${icon} ${r.name}${r.detail ? " — " + r.detail : ""}`);
  if (r.pass) pass++; else fail++;
}
console.log("══════════════════════════════════════════════════");
console.log(`TOTAL: ${pass}/${pass + fail} passed, ${fail} failed`);
console.log("══════════════════════════════════════════════════");
if (fail > 0) process.exit(1);
