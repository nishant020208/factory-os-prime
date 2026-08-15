// Production Manager — RLS behavioral verification (live, via the public API).
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

const pm = await signIn("production@abcmfg.demo"); // production_manager
const customer = await signIn("customer@abcmfg.demo"); // customer_portal

const COMPANY = "11111111-1111-1111-1111-111111111111";
const OTHER_COMPANY = "57fc4d31-a249-4fb8-ac9e-57ca0b37749a";

console.log("Signed in:", pm.user.email, customer.user.email);

const cleanup = [];
const track = (id, table) => cleanup.push({ id, table });

// ── 1) PRODUCTION MANAGER READS ──
for (const [table, name] of [
  ["sales_orders", "sales orders"],
  ["work_orders", "work orders"],
  ["production_orders", "production orders"],
  ["production_planning", "production planning"],
  ["bom", "BOM"],
  ["bom_items", "BOM items"],
  ["materials", "materials"],
  ["inventory", "inventory"],
  ["machines", "machines"],
]) {
  const { data, error } = await pm.client.from(table).select("id").limit(1);
  ok(`Production Manager reads ${name}`, error === null, error?.message ?? `${data?.length} rows`);
}

// ── 2) PRODUCTION MANAGER WRITES — the exclusive scheduling role ──
const wo = await pm.client
  .from("work_orders")
  .insert({
    company_id: COMPANY,
    wo_number: `RLS-PMWO-${Date.now().toString().slice(-5)}`,
    operation: "CNC cutting",
    quantity: 2,
    status: "pending",
  })
  .select("id")
  .single();
ok(
  "Production Manager creates a Work Order (exclusive, verified again)",
  wo.error === null,
  wo.error?.message ?? "inserted",
);
if (wo.error === null) track(wo.data.id, "work_orders");

const plan = await pm.client
  .from("production_planning")
  .insert({
    company_id: COMPANY,
    order_number: `RLS-PLAN-${Date.now().toString().slice(-5)}`,
    status: "material_reserved",
    priority: "medium",
    quantity: 2,
    start_date: new Date().toISOString().slice(0, 10),
    created_by: pm.user.id,
  })
  .select("id")
  .single();
ok(
  "Production Manager creates a production_planning row",
  plan.error === null,
  plan.error?.message ?? "inserted",
);
if (plan.error === null) track(plan.data.id, "production_planning");

const prod = await pm.client
  .from("production_orders")
  .insert({
    company_id: COMPANY,
    order_number: `RLS-PRD-${Date.now().toString().slice(-5)}`,
    quantity: 2,
    status: "in_production",
    priority: "medium",
    start_date: new Date().toISOString().slice(0, 10),
  })
  .select("id")
  .single();
ok("Production Manager creates a production order", prod.error === null, prod.error?.message ?? "inserted");
if (prod.error === null) track(prod.data.id, "production_orders");

// ── 3) CANNOT approve the original Customer order (Company Admin only) ──
const so = (await admin
  .from("sales_orders")
  .select("id, status")
  .eq("company_id", COMPANY)
  .neq("status", "approved")
  .limit(1)).data?.[0];
if (so) {
  const appr = await pm.client
    .from("sales_orders")
    .update({ status: "approved", approved_by: pm.user.id })
    .eq("id", so.id)
    .select("id");
  ok(
    "Production Manager CANNOT approve a customer order (Company Admin only)",
    appr.error !== null,
    appr.error?.message ?? `${appr.data?.length ?? 0} rows updated — LEAK`,
  );
  // Confirm the order was NOT actually approved.
  const after = (await admin.from("sales_orders").select("status").eq("id", so.id).single()).data;
  ok("Order status unchanged after blocked approval", after?.status !== "approved", `status=${after?.status}`);
} else {
  ok("Production Manager CANNOT approve a customer order (Company Admin only)", false, "no non-approved order found");
}

// ── 4) CANNOT — procurement, stock, quality, finance ──
const po = await pm.client
  .from("purchase_orders")
  .insert({ company_id: COMPANY, po_number: `RLS-PMPO-${Date.now().toString().slice(-5)}`, status: "draft", total_amount: 10 })
  .select("id")
  .single();
ok(
  "Production Manager CANNOT create a Purchase Order (procurement exclusive)",
  po.error !== null,
  po.error?.message ?? "inserted — LEAK",
);

const inv = (await admin.from("inventory").select("id, quantity").eq("company_id", COMPANY).limit(1)).data?.[0];
if (inv) {
  const invUpd = await pm.client
    .from("inventory")
    .update({ quantity: 999999 })
    .eq("id", inv.id)
    .select("id");
  ok(
    "Production Manager CANNOT edit stock quantities (warehouse exclusive)",
    invUpd.error !== null || (invUpd.data?.length ?? 0) === 0,
    invUpd.error?.message ?? `${invUpd.data?.length ?? 0} rows updated — LEAK`,
  );
} else {
  ok("Production Manager CANNOT edit stock quantities (warehouse exclusive)", false, "no inventory row");
}

const insp = await pm.client
  .from("quality_inspections")
  .insert({
    company_id: COMPANY,
    inspection_number: `RLS-PMQI-${Date.now().toString().slice(-5)}`,
    result: "pass",
    quantity_checked: 1,
  })
  .select("id")
  .single();
ok(
  "Production Manager CANNOT record a quality inspection (Quality exclusive)",
  insp.error !== null,
  insp.error?.message ?? "inserted — LEAK",
);

const ncr = await pm.client
  .from("ncr")
  .insert({ company_id: COMPANY, defect_category: "surface scratch", description: "RLS test" })
  .select("id")
  .single();
ok(
  "Production Manager CANNOT raise an NCR (Quality exclusive)",
  ncr.error !== null,
  ncr.error?.message ?? "inserted — LEAK",
);

// ── 5) CROSS-COMPANY ISOLATION ──
for (const [table, name] of [
  ["sales_orders", "sales orders"],
  ["work_orders", "work orders"],
  ["production_planning", "production planning"],
  ["bom", "BOM"],
  ["production_orders", "production orders"],
]) {
  const { data, error } = await pm.client.from(table).select("id").eq("company_id", OTHER_COMPANY);
  ok(
    `Production Manager sees 0 rows of other-company ${name}`,
    error === null && (data?.length ?? 0) === 0,
    `${data?.length ?? 0} rows`,
  );
}

// ── 6) PORTAL LEAK — customer cannot read internal planning/schedule ──
const cpp = await customer.client.from("production_planning").select("id").limit(1);
ok(
  "Customer CANNOT read production_planning (leak fixed)",
  cpp.error === null && (cpp.data?.length ?? 0) === 0,
  cpp.error?.message ?? `${cpp.data?.length ?? 0} rows — LEAK`,
);
// production_orders_select_iso intentionally exposes only the customer's OWN
// production orders (via their sales orders) for order tracking.
const cpo = await customer.client.from("production_orders").select("id, sales_order_id");
const custRow = (await admin.from("customers").select("id").eq("user_id", customer.user.id).maybeSingle()).data;
const ownSales = custRow ? (await admin.from("sales_orders").select("id").eq("customer_id", custRow.id)).data ?? [] : [];
const ownSalesIds = ownSales.map((s) => s.id);
const cLeaked = (cpo.data ?? []).filter((r) => !ownSalesIds.includes(r.sales_order_id));
ok(
  "Customer reads ONLY their own production orders, never others'",
  cpo.error === null && cLeaked.length === 0,
  cpo.error?.message ?? `${cpo.data?.length ?? 0} rows, ${cLeaked.length} outside own scope — LEAK`,
);

// ── SUMMARY ──
const fails = results.filter((r) => !r.pass);
const passes = results.length - fails.length;
console.log(`\nPRODUCTION MANAGER: ${passes}/${results.length} passed, ${fails.length} failed`);
for (const f of fails) console.log("  FAIL:", f.name, "→", f.detail);
for (const r of results) console.log(`  ${r.pass ? "PASS" : "FAIL"} ${r.name} — ${r.detail}`);

for (const c of cleanup) {
  try {
    await admin.from(c.table).delete().eq("id", c.id);
  } catch {}
}
process.exit(fails.length ? 1 : 0);
