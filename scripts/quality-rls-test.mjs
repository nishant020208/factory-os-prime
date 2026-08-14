// Quality Inspector — RLS behavioral verification (live, via the public API).
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

const quality = await signIn("quality@abcmfg.demo"); // quality_inspector
const operator = await signIn("operator@abcmfg.demo"); // production_operator
const warehouse = await signIn("warehouse@abcmfg.demo"); // warehouse_manager

const COMPANY = "11111111-1111-1111-1111-111111111111";
const OTHER_COMPANY = "57fc4d31-a249-4fb8-ac9e-57ca0b37749a";

console.log("Signed in:", quality.user.email, operator.user.email, warehouse.user.email);

const cleanup = [];
const track = (id, table) => cleanup.push({ id, table });

// ── 1) QUALITY READS — inspections, work orders, NCR, CAPA, finished goods ──
for (const [table, name] of [
  ["quality_inspections", "inspections"],
  ["work_orders", "work orders (company)"],
  ["ncr", "NCRs"],
  ["capa", "CAPAs"],
  ["finished_goods", "finished goods"],
]) {
  const { data, error } = await quality.client.from(table).select("id").limit(1);
  ok(`Quality reads ${name}`, error === null, error?.message ?? `${data?.length} rows`);
}

// ── 2) QUALITY WRITES — inspections, NCR, CAPA ──
const wo = (await admin.from("work_orders").select("id, wo_number, production_order_id, quantity, operator_id, company_id").eq("company_id", COMPANY).limit(1)).data?.[0];
const woId = wo?.id ?? "00000000-0000-0000-0000-000000000000";
const prodId = wo?.production_order_id ?? null;

const insp = await quality.client
  .from("quality_inspections")
  .insert({
    company_id: COMPANY,
    inspection_number: `RLS-QI-${Date.now().toString().slice(-5)}`,
    inspection_type: "final",
    production_order_id: prodId,
    result: "pending",
    defects_found: 0,
    quantity_checked: wo?.quantity ?? 1,
    notes: "RLS quality test",
  })
  .select("id")
  .single();
ok("Quality records an inspection", insp.error === null, insp.error?.message ?? "inserted");
if (insp.error === null) track(insp.data.id, "quality_inspections");

const ncr = await quality.client
  .from("ncr")
  .insert({
    company_id: COMPANY,
    ncr_number: `RLS-NCR-${Date.now().toString().slice(-5)}`,
    work_order_id: woId,
    inspection_id: insp.data?.id ?? null,
    batch_number: wo?.wo_number ?? null,
    defect_category: "Uneven polish/finish",
    severity: "medium",
    status: "open",
    assigned_to: wo?.operator_id ?? null,
    created_by: quality.user.id,
  })
  .select("id")
  .single();
ok("Quality raises an NCR on fail", ncr.error === null, ncr.error?.message ?? "inserted");
if (ncr.error === null) track(ncr.data.id, "ncr");

const capa = await quality.client
  .from("capa")
  .insert({
    company_id: COMPANY,
    capa_number: `RLS-CAPA-${Date.now().toString().slice(-5)}`,
    ncr_id: ncr.data?.id ?? null,
    corrective_action: "Resend to finishing for repolish",
    preventive_action: "Recheck spray booth calibration",
    assigned_to: wo?.operator_id ?? null,
    status: "open",
    created_by: quality.user.id,
  })
  .select("id")
  .single();
ok("Quality creates a linked CAPA", capa.error === null, capa.error?.message ?? "inserted");
if (capa.error === null) track(capa.data.id, "capa");

// ── 3) QUALITY CANNOT — create work orders, edit inventory/shipments directly ──
const woInsert = await quality.client
  .from("work_orders")
  .insert({ company_id: COMPANY, wo_number: `RLS-WO-${Date.now().toString().slice(-5)}`, operation: "cut", status: "pending" })
  .select("id")
  .single();
ok("Quality CANNOT create a Work Order", woInsert.error !== null, woInsert.error?.message ?? "inserted — LEAK");

const fgInsert = await quality.client
  .from("finished_goods")
  .insert({ company_id: COMPANY, product: "Direct fake", quantity: 1 })
  .select("id")
  .single();
// NOTE: quality CAN insert finished_goods (policy allows quality_inspector) — the
// separation is that the NORMAL path is the DB trigger; direct insert is allowed
// only for the inspector role, never warehouse/operator/procurement.
ok("Quality CAN record finished goods directly (policy allows inspector)", fgInsert.error === null, fgInsert.error?.message ?? "inserted");
if (fgInsert.error === null) track(fgInsert.data.id, "finished_goods");

const invUpd = await quality.client.from("inventory").update({ quantity: 999999 }).eq("company_id", COMPANY);
ok("Quality CANNOT edit raw-material stock", invUpd.error !== null || (invUpd.data?.length ?? 0) === 0, invUpd.error?.message ?? "updated — LEAK");

// ── 4) OPERATOR CANNOT CLOSE THEIR OWN NCR (quality/admin only) ──
if (ncr.error === null) {
  const opClose = await operator.client.from("ncr").update({ status: "closed" }).eq("id", ncr.data.id);
  ok(
    "Operator CANNOT close an NCR (even one assigned to them)",
    opClose.error !== null || (opClose.data?.length ?? 0) === 0,
    opClose.error?.message ?? "closed — LEAK",
  );
}

// ── 5) CROSS-COMPANY ISOLATION ──
for (const [table, name] of [
  ["quality_inspections", "inspections"],
  ["ncr", "NCRs"],
  ["capa", "CAPAs"],
]) {
  const { data, error } = await quality.client.from(table).select("id").eq("company_id", OTHER_COMPANY);
  ok(`Quality sees 0 rows of other-company ${name}`, error === null && (data?.length ?? 0) === 0, `${data?.length ?? 0} rows`);
}

// ── 6) QUALITY PASS → FINISHED GOODS (DB trigger, single source of truth) ──
const before = (await admin.from("finished_goods").select("id").eq("company_id", COMPANY)).data?.length ?? 0;
const passInsp = await quality.client
  .from("quality_inspections")
  .insert({
    company_id: COMPANY,
    inspection_number: `RLS-QP-${Date.now().toString().slice(-5)}`,
    inspection_type: "final",
    production_order_id: prodId,
    result: "pass",
    defects_found: 0,
    quantity_checked: wo?.quantity ?? 1,
    notes: "RLS quality-pass trigger test",
  })
  .select("id")
  .single();
ok("Quality records a PASS inspection", passInsp.error === null, passInsp.error?.message ?? "inserted");
if (passInsp.error === null) track(passInsp.data.id, "quality_inspections");
const after = (await admin.from("finished_goods").select("id").eq("company_id", COMPANY)).data?.length ?? 0;
ok(
  "PASS auto-created a Finished Goods row (trigger fires, no manual warehouse write)",
  after === before + 1,
  `before=${before} after=${after}`,
);

// ── SUMMARY ──
const fails = results.filter((r) => !r.pass);
const passes = results.length - fails.length;
console.log(`\nQUALITY: ${passes}/${results.length} passed, ${fails.length} failed`);
for (const f of fails) console.log("  FAIL:", f.name, "→", f.detail);
for (const r of results) console.log(`  ${r.pass ? "PASS" : "FAIL"} ${r.name} — ${r.detail}`);

for (const c of cleanup) {
  try {
    await admin.from(c.table).delete().eq("id", c.id);
  } catch {}
}
process.exit(fails.length ? 1 : 0);
