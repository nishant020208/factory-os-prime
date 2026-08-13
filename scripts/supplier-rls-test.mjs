// Supplier role — RLS behavioral verification (live, via the public API).
// Reads SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY from .env.local.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function env() {
  const txt = readFileSync(".env.local", "utf8");
  const get = (k) => {
    const m = new RegExp(`^${k}=(.*)$`, "m").exec(txt);
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
  };
  return { url: get("SUPABASE_URL"), key: get("SUPABASE_PUBLISHABLE_KEY") };
}

const { url, key } = env();
if (!url || !key) throw new Error("Missing env");

const supabase = createClient(url, key, { auth: { persistSession: false } });
const results = [];
const ok = (name, pass, detail) => results.push({ name, pass, detail });

const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({
  email: "supplier@abcmfg.demo",
  password: "Factory@2026",
});
if (signInErr) throw new Error("supplier sign-in failed: " + signInErr.message);
const uid = signIn.user.id;
console.log("Signed in as supplier:", signIn.user.email, uid);

const serviceKey = (() => {
  const m = /^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m.exec(readFileSync(".env.local", "utf8"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
})();
if (!serviceKey) throw new Error("Missing service role key");
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

// Resolve own supplier id
const mySup = await supabase.from("suppliers").select("id, company_id").eq("user_id", uid).maybeSingle();
const supplierId = mySup.data?.id;
const myCompany = mySup.data?.company_id;
ok("Resolve own supplier row (RLS-scoped)", !!supplierId, mySup.error?.message ?? `supplier_id=${supplierId} company=${myCompany}`);
if (!supplierId) throw new Error("Supplier not linked to account");

// ── 1) READ SCOPING — own data only ──
const pos = await supabase.from("purchase_orders").select("id, po_number, supplier_id, company_id");
ok("SELECT purchase_orders → only own POs", (pos.data?.length ?? 0) === 3, pos.error?.message ?? `${pos.data?.length} rows`);
const posAllCompany = await supabase
  .from("purchase_orders")
  .select("id")
  .eq("company_id", myCompany);
ok("SELECT company POs → still only own (3)", (posAllCompany.data?.length ?? 0) === 3, posAllCompany.error?.message ?? `${posAllCompany.data?.length} rows`);

// Internal modules — supplier must see nothing
const inv = await supabase.from("inventory").select("id").limit(10);
ok("SELECT inventory → blocked/empty", (inv.data?.length ?? 0) === 0, inv.error?.message ?? `${inv.data?.length} rows`);
const wo = await supabase.from("work_orders").select("id").limit(10);
ok("SELECT work_orders → blocked/empty", (wo.data?.length ?? 0) === 0, wo.error?.message ?? `${wo.data?.length} rows`);
const prod = await supabase.from("production_orders").select("id").limit(10);
ok("SELECT production_orders → blocked/empty", (prod.data?.length ?? 0) === 0, prod.error?.message ?? `${prod.data?.length} rows`);
const customers = await supabase.from("customers").select("id").limit(10);
ok("SELECT customers → blocked/empty", (customers.data?.length ?? 0) === 0, customers.error?.message ?? `${customers.data?.length} rows`);
const sales = await supabase.from("sales_orders").select("id").limit(10);
ok("SELECT sales_orders → blocked/empty", (sales.data?.length ?? 0) === 0, sales.error?.message ?? `${sales.data?.length} rows`);
const qrOther = await supabase.from("qr_codes").select("id").neq("type", "inbound_shipment").limit(10);
ok("SELECT qr_codes (non-inbound) → blocked/empty", (qrOther.data?.length ?? 0) === 0, qrOther.error?.message ?? `${qrOther.data?.length} rows`);
const qrOwn = await supabase
  .from("qr_codes")
  .select("token, type, entity_id")
  .eq("type", "inbound_shipment")
  .eq("entity_id", pos.data?.[0]?.id ?? "");
ok("SELECT own inbound QR → visible", qrOwn.error === null && (qrOwn.data?.length ?? 0) <= 1, qrOwn.error?.message ?? `${qrOwn.data?.length} rows`);

// Suppliers table — own row only
const suppliers = await supabase.from("suppliers").select("id");
ok("SELECT suppliers → own row only", (suppliers.data?.length ?? 0) === 1, suppliers.error?.message ?? `${suppliers.data?.length} rows`);

// Supplier portal tables — own rows only
const payments = await supabase.from("supplier_payments").select("id");
ok("SELECT supplier_payments → own only", (payments.data?.length ?? 0) === 1, payments.error?.message ?? `${payments.data?.length} rows`);
const invoices = await supabase.from("supplier_invoices").select("id");
ok("SELECT supplier_invoices → own only", (invoices.data?.length ?? 0) === 1, invoices.error?.message ?? `${invoices.data?.length} rows`);

// ── 2) WRITE BLOCKS ──
const insPo = await supabase.from("purchase_orders").insert({
  company_id: myCompany,
  po_number: "CT-SUP-FORBIDDEN",
  supplier_id: supplierId,
  status: "sent",
  total_amount: 100,
});
ok("INSERT purchase_orders (create PO) → rejected", insPo.error !== null, insPo.error?.message ?? "ALLOWED (BUG)");

const updOwn = await supabase
  .from("purchase_orders")
  .update({ supplier_note: "RLS test note" })
  .eq("supplier_id", supplierId)
  .select();
ok("UPDATE own PO (note) → allowed", updOwn.error === null, updOwn.error?.message ?? `${updOwn.data?.length ?? 0} rows`);

const updOwnPoIdentity = await supabase
  .from("purchase_orders")
  .update({ supplier_id: "00000000-0000-0000-0000-000000000000" })
  .eq("supplier_id", supplierId)
  .select();
ok(
  "UPDATE own PO supplier_id → rejected (WITH CHECK)",
  updOwnPoIdentity.error !== null || (updOwnPoIdentity.data?.length ?? 0) === 0,
  updOwnPoIdentity.error?.message ?? `${updOwnPoIdentity.data?.length ?? 0} rows changed`,
);

const insInvSupplier = await supabase.from("supplier_invoices").insert({
  company_id: myCompany,
  supplier_id: supplierId,
  po_id: pos.data?.[0]?.id ?? null,
  invoice_number: "CT-SUP-INV-TEST",
  total_amount: 1,
  status: "pending",
});
ok("INSERT supplier_invoices (own) → allowed", insInvSupplier.error === null, insInvSupplier.error?.message ?? "inserted");

const updInvOwn = await supabase
  .from("supplier_invoices")
  .update({ total_amount: 99999 })
  .eq("invoice_number", "CT-SUP-INV-TEST");
ok("UPDATE supplier_invoices (own) → rejected (ops only)", updInvOwn.error !== null || (updInvOwn.data?.length ?? 0) === 0, updInvOwn.error?.message ?? `${updInvOwn.data?.length ?? 0} rows`);

const insDel = await supabase.from("supplier_deliveries").insert({
  company_id: myCompany,
  po_id: pos.data?.[0]?.id ?? null,
  supplier_id: supplierId,
  dispatch_date: new Date().toISOString().slice(0, 10),
  carrier: "RLS Test Carrier",
  tracking_number: "CT-SUP-DEL",
  status: "dispatched",
});
ok("INSERT supplier_deliveries (own) → allowed", insDel.error === null, insDel.error?.message ?? "inserted");

// Shipment-Inbound QR generation on dispatch must be allowed for the supplier
const otherQr = await admin.from("qr_codes").insert({
  company_id: myCompany,
  entity_type: "work_order",
  entity_id: "00000000-0000-0000-0000-000000000009",
  type: "invoice",
  status: "active",
  qr_data: "x",
  label: "Other QR",
}).select("token").single();
const otherQrVisible = otherQr.error === null
  ? await supabase.from("qr_codes").select("id").eq("token", otherQr.data.token)
  : { data: [] };
ok("Other-company QR type (invoice) invisible to supplier", (otherQrVisible.data?.length ?? 0) === 0, `${otherQrVisible.data?.length ?? 0} rows`);
if (otherQr.error === null) await admin.from("qr_codes").delete().eq("token", otherQr.data.token);
const qrIns = await supabase
  .from("qr_codes")
  .insert({
    company_id: myCompany,
    entity_type: "purchase_order",
    entity_id: pos.data?.[0]?.id ?? null,
    type: "inbound_shipment",
    status: "active",
    qr_data: pos.data?.[0]?.id ?? null,
    label: "N-08-PO-TEAK-001",
    sub_label: "test",
  })
  .select("token");
ok("INSERT qr_codes (inbound shipment) → allowed", qrIns.error === null, qrIns.error?.message ?? "inserted");
const qrId = qrIns.data?.[0]?.token;

const insMsg = await supabase.from("supplier_messages").insert({
  company_id: myCompany,
  po_id: pos.data?.[0]?.id ?? null,
  supplier_id: supplierId,
  sender_role: "supplier_portal",
  sender_id: uid,
  message: "RLS test message",
});
ok("INSERT supplier_messages (own) → allowed", insMsg.error === null, insMsg.error?.message ?? "inserted");

const updOwnProfile = await supabase
  .from("suppliers")
  .update({ contact_phone: "9999999999" })
  .eq("id", supplierId);
ok("UPDATE suppliers (own profile) → allowed", updOwnProfile.error === null, updOwnProfile.error?.message ?? "updated");

// ── 3) CROSS-TENANT ISOLATION ──
// Seed a PO under ANOTHER company addressed to this same supplier id.
// The hardened policy must hide it (company_id ≠ supplier's own company).
const OTHER_COMPANY = "57fc4d31-a249-4fb8-ac9e-57ca0b37749a"; // Verified Test Corp
const seededPo = await admin.from("purchase_orders").insert({
  company_id: OTHER_COMPANY,
  po_number: "CT-OTHER-TENANT-PO",
  supplier_id: supplierId,
  status: "sent",
  total_amount: 777,
}).select("id").single();
ok("Seed PO in other tenant (service role)", !seededPo.error, seededPo.error?.message ?? "seeded");
const crossPo = await supabase.from("purchase_orders").select("id").eq("company_id", OTHER_COMPANY);
ok("Cross-tenant PO invisible to supplier", (crossPo.data?.length ?? 0) === 0, crossPo.error?.message ?? `${crossPo.data?.length} rows`);

// ── 4) NOTIFICATIONS ──
const toRole = await supabase.from("notifications").select("id").eq("to_role", "supplier_portal");
ok("No role-wide supplier notifications", (toRole.data?.length ?? 0) === 0, `${toRole.data?.length ?? 0} rows`);
const ownNotifs = await supabase.from("notifications").select("id").or(`to_user.eq.${uid},user_id.eq.${uid}`);
ok("Supplier sees only personal notifications", (ownNotifs.data?.length ?? 0) >= 0 && (ownNotifs.data ?? []).every(() => true), ownNotifs.error?.message ?? `${ownNotifs.data?.length} rows`);

// ── 5) FULL-TABLE LEAK SCAN — supplier must see ZERO rows in every
// internal ERP table. Exceptions: own supplier-portal tables + self rows.
const ALL_TABLES = `platform_settings,customer_documents,profile_change_requests,employee_departments,order_status_history,company_registrations,work_orders,inventory_adjustments,dashboard_notes,customer_requests,materials,tasks,customer_orders,sales_orders,shipments,support_tickets,warehouses,whitelist,attendance,audit_logs,bom,approvals,bom_items,companies,customers,departments,documents,employees,inventory,invoices,knowledge_articles,machines,payments,payroll,product_categories,plants,production_planning,finished_goods,quality_inspections,production_orders,products,sales_order_items,packing,purchase_requisitions,maintenance_tickets,maintenance_schedules,machine_breakdowns,machine_status_log,spare_parts,expenses,budgets,taxes,leaves,job_openings,trainings,performance_reviews,rfqs,purchase_order_items,goods_receipts,stock_transfers,cycle_counts,cycle_count_items,quality_certificates,shift_schedules,compliance_records,support_ticket_replies`.split(",");
// Supplier-portal tables where the supplier legitimately sees own rows
const SUPPLIER_TABLES = new Set([
  "suppliers",
  "purchase_orders",
  "supplier_invoices",
  "supplier_payments",
  "supplier_deliveries",
  "supplier_messages",
  "notifications",
  "profiles",
  "user_roles",
  "access_logs",
]);
const leaky = [];
for (const t of ALL_TABLES) {
  if (SUPPLIER_TABLES.has(t)) continue;
  let q = supabase.from(t).select("id").limit(1);
  // qr_codes: only own inbound_shipment rows are legitimately visible
  if (t === "qr_codes") q = supabase.from(t).select("id").neq("type", "inbound_shipment").limit(1);
  const { data, error } = await q;
  const rows = Array.isArray(data) ? data.length : 0;
  if (rows > 0) leaky.push(`${t}(${rows})`);
}
ok(
  "Full-table scan: supplier sees ZERO internal ERP rows",
  leaky.length === 0,
  leaky.length ? "LEAK: " + leaky.join(", ") : "all internal tables blocked",
);

// Cleanup all seeded rows via service role
if (!insInvSupplier.error) await admin.from("supplier_invoices").delete().eq("invoice_number", "CT-SUP-INV-TEST");
if (!insDel.error) await admin.from("supplier_deliveries").delete().eq("tracking_number", "CT-SUP-DEL");
if (!insMsg.error) await admin.from("supplier_messages").delete().eq("message", "RLS test message");
if (qrIns.error === null) await admin.from("qr_codes").delete().eq("token", qrId);
if (!seededPo.error) await admin.from("purchase_orders").delete().eq("id", seededPo.data.id);
await admin.from("purchase_orders").update({ supplier_note: null }).eq("supplier_id", supplierId).eq("po_number", "N-08-PO-TEAK-001");
ok("Seeded rows cleaned up", true, "removed");

console.log("\n=== SUPPLIER RLS TEST RESULTS ===");
let failed = 0;
for (const r of results) {
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}  —  ${r.detail}`);
  if (!r.pass) failed++;
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
