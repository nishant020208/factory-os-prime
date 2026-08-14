// Warehouse Manager — RLS behavioral verification (live, via the public API).
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

const wh = await signIn("warehouse@abcmfg.demo"); // warehouse_manager
const proc = await signIn("procurement@abcmfg.demo"); // procurement_manager
const quality = await signIn("quality@abcmfg.demo"); // quality_inspector

const COMPANY = "11111111-1111-1111-1111-111111111111";
const OTHER_COMPANY = "57fc4d31-a249-4fb8-ac9e-57ca0b37749a";

console.log("Signed in:", wh.user.email, proc.user.email, quality.user.email);

const cleanup = [];
const track = (id, table) => cleanup.push({ id, table });

// ── 1) WAREHOUSE READS — stock, movements, shipments, POs, QR ──
for (const [table, name] of [
  ["inventory", "inventory"],
  ["finished_goods", "finished goods"],
  ["packing", "packing"],
  ["shipments", "shipments"],
  ["inventory_adjustments", "stock adjustments"],
  ["stock_transfers", "stock transfers"],
  ["purchase_orders", "purchase orders"],
  ["qr_codes", "QR codes"],
  ["suppliers", "suppliers"],
]) {
  const { data, error } = await wh.client.from(table).select("id").limit(1);
  ok(`Warehouse reads ${name}`, error === null, error?.message ?? `${data?.length} rows`);
}

// ── 2) WAREHOUSE WRITES — pack finished goods, create shipment ──
const fg = (await admin.from("finished_goods").select("id, company_id").eq("company_id", COMPANY).limit(1)).data?.[0];
if (fg) {
  const pack = await wh.client
    .from("packing")
    .insert({
      company_id: COMPANY,
      finished_goods_id: fg.id,
      package_number: `PKG-${Date.now().toString().slice(-5)}`,
      quantity: 1,
      notes: "RLS warehouse test pack",
    })
    .select("id")
    .single();
  ok("Warehouse packs a finished goods batch", pack.error === null, pack.error?.message ?? "inserted");
  if (pack.error === null) track(pack.data.id, "packing");
} else {
  ok("Warehouse packs a finished goods batch", false, "no finished_goods row to pack against");
}

const ship = await wh.client
  .from("shipments")
  .insert({
    company_id: COMPANY,
    shipment_number: `RLS-SHP-${Date.now().toString().slice(-5)}`,
    carrier: "Test Carrier",
    tracking_number: `TRK-${Date.now().toString().slice(-6)}`,
    status: "dispatch_ready",
  })
  .select("id")
  .single();
ok("Warehouse creates a shipment", ship.error === null, ship.error?.message ?? "inserted");
if (ship.error === null) track(ship.data.id, "shipments");

// ── 3) WAREHOUSE CANNOT — fabricate finished goods, create POs/work orders ──
const fgInsert = await wh.client
  .from("finished_goods")
  .insert({ company_id: COMPANY, product: "Fake Entry", quantity: 1 })
  .select("id")
  .single();
ok(
  "Warehouse CANNOT fabricate a Finished Goods row (quality-pass only)",
  fgInsert.error !== null,
  fgInsert.error?.message ?? "inserted — LEAK",
);

const poInsert = await wh.client
  .from("purchase_orders")
  .insert({ company_id: COMPANY, po_number: `RLS-PO-${Date.now().toString().slice(-5)}`, status: "draft", total_amount: 10 })
  .select("id")
  .single();
ok(
  "Warehouse CANNOT create a Purchase Order (procurement exclusive)",
  poInsert.error !== null,
  poInsert.error?.message ?? "inserted — LEAK",
);

const woInsert = await wh.client
  .from("work_orders")
  .insert({ company_id: COMPANY, wo_number: `RLS-WO-${Date.now().toString().slice(-5)}`, operation: "cut", status: "pending" })
  .select("id")
  .single();
ok(
  "Warehouse CANNOT create a Work Order (production manager exclusive)",
  woInsert.error !== null,
  woInsert.error?.message ?? "inserted — LEAK",
);

// ── 4) CROSS-COMPANY ISOLATION — zero rows from the other company ──
for (const [table, name] of [
  ["inventory", "inventory"],
  ["shipments", "shipments"],
  ["finished_goods", "finished goods"],
  ["purchase_orders", "purchase orders"],
]) {
  const { data, error } = await wh.client.from(table).select("id").eq("company_id", OTHER_COMPANY);
  ok(`Warehouse sees 0 rows of other-company ${name}`, error === null && (data?.length ?? 0) === 0, `${data?.length ?? 0} rows`);
}

// ── 5) PROCUREMENT CANNOT EDIT STOCK (tightened this build) ──
const inv = (await admin.from("inventory").select("id, quantity").eq("company_id", COMPANY).limit(1)).data?.[0];
if (inv) {
  const invUpd = await proc.client
    .from("inventory")
    .update({ quantity: 999999 })
    .eq("id", inv.id)
    .select("id");
  ok(
    "Procurement CANNOT edit stock quantities (warehouse exclusive)",
    invUpd.error !== null || (invUpd.data?.length ?? 0) === 0,
    invUpd.error?.message ?? `${invUpd.data?.length ?? 0} updated — LEAK`,
  );
  const adj = await proc.client
    .from("inventory_adjustments")
    .insert({ company_id: COMPANY, product_id: inv.product_id ?? null, warehouse_id: null, old_quantity: 0, new_quantity: 999, delta: 999, reason: "RLS test", adjusted_by: proc.user.id })
    .select("id")
    .single();
  ok(
    "Procurement CANNOT log a stock adjustment",
    adj.error !== null,
    adj.error?.message ?? "inserted — LEAK",
  );
} else {
  ok("Procurement CANNOT edit stock quantities (warehouse exclusive)", false, "no inventory row found");
}

// ── 6) QUALITY-PASS → FINISHED GOODS (trigger, not manual warehouse write) ──
const wo = (await admin.from("work_orders").select("id, wo_number, production_order_id, quantity, company_id").eq("company_id", COMPANY).limit(1)).data?.[0];
if (wo) {
  const insp = await quality.client
    .from("quality_inspections")
    .insert({
      company_id: COMPANY,
      inspection_number: `RLS-QI-${Date.now().toString().slice(-5)}`,
      inspection_type: "final",
      production_order_id: wo.production_order_id ?? null,
      result: "pass",
      defects_found: 0,
      quantity_checked: wo.quantity ?? 1,
      notes: "RLS quality-pass test",
    })
    .select("id")
    .single();
  ok("Quality Inspector records a PASS inspection", insp.error === null, insp.error?.message ?? "inserted");
  if (insp.error === null) track(insp.data.id, "quality_inspections");
  const { data: fgCreated } = await admin
    .from("finished_goods")
    .select("id")
    .eq("company_id", COMPANY)
    .ilike("notes", "%RLS-QI%")
    .limit(5);
  ok("PASS auto-creates a Finished Goods row via DB trigger", (fgCreated?.length ?? 0) > 0, `${fgCreated?.length ?? 0} candidate rows`);
} else {
  ok("Quality Inspector records a PASS inspection", false, "no work order found");
}

// ── SUMMARY ──
const fails = results.filter((r) => !r.pass);
const passes = results.length - fails.length;
console.log(`\nWAREHOUSE: ${passes}/${results.length} passed, ${fails.length} failed`);
for (const f of fails) console.log("  FAIL:", f.name, "→", f.detail);
for (const r of results) console.log(`  ${r.pass ? "PASS" : "FAIL"} ${r.name} — ${r.detail}`);

// cleanup
for (const c of cleanup) {
  try {
    await admin.from(c.table).delete().eq("id", c.id);
  } catch {}
}
process.exit(fails.length ? 1 : 0);
