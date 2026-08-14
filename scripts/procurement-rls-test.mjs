// Procurement Manager — RLS behavioral verification (live, via the public API).
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
const serviceKey = (() => {
  const m = /^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m.exec(readFileSync(".env.local", "utf8"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
})();
if (!serviceKey) throw new Error("Missing service role key");
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const results = [];
const ok = (name, pass, detail) => results.push({ name, pass, detail });

async function signIn(email, password = "Factory@2026") {
  const c = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`${email} sign-in failed: ${error.message}`);
  return { client: c, user: data.user };
}

const proc = await signIn("procurement@abcmfg.demo"); // procurement_manager
const wh = await signIn("warehouse@abcmfg.demo"); // warehouse_manager
const supplierPortal = await signIn("supplier@abcmfg.demo"); // supplier_portal

const COMPANY = "11111111-1111-1111-1111-111111111111";
const OTHER_COMPANY = "57fc4d31-a249-4fb8-ac9e-57ca0b37749a";

console.log("Signed in:", proc.user.email, wh.user.email, supplierPortal.user.email);

const cleanup = [];
const track = (id, table) => cleanup.push({ id, table });

// ── 1) PROCUREMENT READS — its own company's supply data ──
for (const [table, name] of [
  ["purchase_orders", "purchase orders"],
  ["purchase_requisitions", "purchase requisitions"],
  ["suppliers", "suppliers"],
  ["rfqs", "RFQs"],
  ["rfq_responses", "RFQ responses"],
  ["inventory", "inventory (view)"],
]) {
  const { data, error } = await proc.client.from(table).select("id").limit(1);
  ok(`Procurement reads ${name}`, error === null, error?.message ?? `${data?.length} rows`);
}

// ── 2) PROCUREMENT WRITES — requisitions, POs, suppliers, RFQs ──
const mat = (await admin.from("materials").select("id").limit(1)).data?.[0];
if (mat) {
  const req = await proc.client
    .from("purchase_requisitions")
    .insert({
      company_id: COMPANY,
      pr_number: `RLS-PR-${Date.now().toString().slice(-5)}`,
      material_id: mat.id,
      quantity: 5,
      status: "pending",
      created_by: proc.user.id,
    })
    .select("id")
    .single();
  ok("Procurement creates a purchase requisition", req.error === null, req.error?.message ?? "inserted");
  if (req.error === null) track(req.data.id, "purchase_requisitions");

  const rfq = await proc.client
    .from("rfqs")
    .insert({
      company_id: COMPANY,
      title: "RLS test RFQ",
      material_id: mat.id,
      quantity: 5,
      status: "draft",
      created_by: proc.user.id,
    })
    .select("id")
    .single();
  ok("Procurement creates an RFQ", rfq.error === null, rfq.error?.message ?? "inserted");
  if (rfq.error === null) {
    track(rfq.data.id, "rfqs");
    const supplier = (await admin.from("suppliers").select("id").eq("company_id", COMPANY).limit(1)).data?.[0];
    if (supplier) {
      const resp = await proc.client
        .from("rfq_responses")
        .insert({ rfq_id: rfq.data.id, supplier_id: supplier.id, unit_price: 100, status: "pending" })
        .select("id")
        .single();
      ok("Procurement routes RFQ to a supplier (creates response slot)", resp.error === null, resp.error?.message ?? "inserted");
      if (resp.error === null) track(resp.data.id, "rfq_responses");
    }
  }
} else {
  ok("Procurement creates a purchase requisition", false, "no materials row");
}

const supDir = (await admin.from("suppliers").select("id, user_id").eq("company_id", COMPANY).limit(1)).data?.[0];
const po = await proc.client
  .from("purchase_orders")
  .insert({
    company_id: COMPANY,
    po_number: `RLS-PO-${Date.now().toString().slice(-5)}`,
    supplier_id: supDir?.id ?? null,
    status: "sent",
    total_amount: 1000,
    created_by: proc.user.id,
  })
  .select("id")
  .single();
ok("Procurement creates a Purchase Order (PO)", po.error === null, po.error?.message ?? "inserted");
if (po.error === null) track(po.data.id, "purchase_orders");

// ── 3) PROCUREMENT CANNOT — act on behalf of the supplier ──
const del = await proc.client
  .from("supplier_deliveries")
  .insert({
    company_id: COMPANY,
    supplier_id: supDir?.id ?? "00000000-0000-0000-0000-000000000000",
    po_id: po.data?.id ?? "00000000-0000-0000-0000-000000000000",
    carrier: "RLS",
    tracking_number: `TRK-${Date.now().toString().slice(-6)}`,
    status: "dispatched",
  })
  .select("id")
  .single();
ok(
  "Procurement CANNOT dispatch on behalf of the supplier (supplier_deliveries)",
  del.error !== null,
  del.error?.message ?? "inserted — LEAK",
);

// Supplier CAN (sanity check the supplier's own side still works)
if (supDir?.id) {
  const supDel = await supplierPortal.client
    .from("supplier_deliveries")
    .insert({
      company_id: COMPANY,
      supplier_id: supDir.id,
      po_id: po.data?.id ?? "00000000-0000-0000-0000-000000000000",
      carrier: "RLS Supplier",
      tracking_number: `TRK-${Date.now().toString().slice(-6)}`,
      status: "dispatched",
    })
    .select("id")
    .single();
  ok("Supplier CAN dispatch their own shipment", supDel.error === null, supDel.error?.message ?? "inserted");
  if (supDel.error === null) track(supDel.data.id, "supplier_deliveries");
}

// ── 4) PROCUREMENT CANNOT — edit stock (tightened this build) ──
const inv = (await admin.from("inventory").select("id, quantity, product_id, warehouse_id").eq("company_id", COMPANY).limit(1)).data?.[0];
if (inv) {
  const invUpd = await proc.client.from("inventory").update({ quantity: 999999 }).eq("id", inv.id).select("id");
  ok(
    "Procurement CANNOT edit stock quantities (warehouse exclusive)",
    invUpd.error !== null || (invUpd.data?.length ?? 0) === 0,
    invUpd.error?.message ?? `${invUpd.data?.length ?? 0} updated — LEAK`,
  );
  const adj = await proc.client
    .from("inventory_adjustments")
    .insert({
      company_id: COMPANY,
      product_id: inv.product_id,
      warehouse_id: inv.warehouse_id,
      old_quantity: 0,
      new_quantity: 999,
      delta: 999,
      reason: "RLS test",
      adjusted_by: proc.user.id,
    })
    .select("id")
    .single();
  ok("Procurement CANNOT log a stock adjustment", adj.error !== null, adj.error?.message ?? "inserted — LEAK");
} else {
  ok("Procurement CANNOT edit stock quantities (warehouse exclusive)", false, "no inventory row found");
}

// ── 5) CROSS-COMPANY ISOLATION ──
for (const [table, name] of [
  ["purchase_orders", "purchase orders"],
  ["suppliers", "suppliers"],
  ["rfqs", "RFQs"],
]) {
  const { data, error } = await proc.client.from(table).select("id").eq("company_id", OTHER_COMPANY);
  ok(`Procurement sees 0 rows of other-company ${name}`, error === null && (data?.length ?? 0) === 0, `${data?.length ?? 0} rows`);
}

// ── 6) PROCUREMENT CANNOT — write to production / customer order tables ──
const woInsert = await proc.client
  .from("work_orders")
  .insert({ company_id: COMPANY, wo_number: `RLS-WO-${Date.now().toString().slice(-5)}`, operation: "cut", status: "pending" })
  .select("id")
  .single();
ok("Procurement CANNOT create a Work Order", woInsert.error !== null, woInsert.error?.message ?? "inserted — LEAK");

// ── SUMMARY ──
const fails = results.filter((r) => !r.pass);
const passes = results.length - fails.length;
console.log(`\nPROCUREMENT: ${passes}/${results.length} passed, ${fails.length} failed`);
for (const f of fails) console.log("  FAIL:", f.name, "→", f.detail);
for (const r of results) console.log(`  ${r.pass ? "PASS" : "FAIL"} ${r.name} — ${r.detail}`);

for (const c of cleanup) {
  try {
    await admin.from(c.table).delete().eq("id", c.id);
  } catch {}
}
process.exit(fails.length ? 1 : 0);
