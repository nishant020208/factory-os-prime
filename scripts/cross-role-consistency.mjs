// Cross-role data consistency: for every "two roles read the SAME table" pairing
// specified across the role builds, query both sides live and compare.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const txt = readFileSync(".env.local", "utf8");
const get = (k) => {
  const m = new RegExp(`^${k}=(.*)$`, "m").exec(txt);
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
};
const url = get("SUPABASE_URL");
const key = get("SUPABASE_PUBLISHABLE_KEY");
const admin = createClient(url, get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function signIn(email) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    await sleep(900);
    const c = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await c.auth.signInWithPassword({ email, password: "Factory@2026" });
    if (!error) return c;
    if (attempt === 4) throw new Error(`${email}: ${error.message}`);
    await sleep(2500 * attempt);
  }
}

const COMPANY = "11111111-1111-1111-1111-111111111111";
const TODAY = new Date().toISOString().slice(0, 10);

const checks = [];
const add = (name, a, b, ok) => checks.push({ name, a, b, ok });

// 1) Attendance: Plant Manager vs HR Manager (same attendance table)
{
  const pm = await signIn("plantmanager@abcmfg.demo");
  const hr = await signIn("hr@abcmfg.demo");
  const pa = (await pm.from("attendance").select("id").eq("company_id", COMPANY)).data?.length ?? 0;
  const ha = (await hr.from("attendance").select("id").eq("company_id", COMPANY)).data?.length ?? 0;
  add("Attendance (Plant Manager vs HR) — same table, identical row counts", `${pa} rows`, `${ha} rows`, pa === ha && pa > 0);
}
// 2) Departments: Plant Admin vs Plant Manager vs HR
{
  const pad = await signIn("plantadmin@abcmfg.demo");
  const pm = await signIn("plantmanager@abcmfg.demo");
  const hr = await signIn("hr@abcmfg.demo");
  const d1 = (await pad.from("departments").select("id,name").eq("company_id", COMPANY).order("name")).data ?? [];
  const d2 = (await pm.from("departments").select("id,name").eq("company_id", COMPANY).order("name")).data ?? [];
  const d3 = (await hr.from("departments").select("id,name").eq("company_id", COMPANY).order("name")).data ?? [];
  add("Departments (Plant Admin vs PM vs HR)", `${d1.length} depts`, `${d2.length}/${d3.length}`, d1.length === d2.length && d2.length === d3.length && d1.length > 0);
}
// 3) Machines: Plant Admin vs Maintenance vs Plant Manager
{
  const pad = await signIn("plantadmin@abcmfg.demo");
  const mt = await signIn("maintenance@abcmfg.demo");
  const pm = await signIn("plantmanager@abcmfg.demo");
  const m1 = (await pad.from("machines").select("id").eq("company_id", COMPANY)).data?.length ?? 0;
  const m2 = (await mt.from("machines").select("id").eq("company_id", COMPANY)).data?.length ?? 0;
  const m3 = (await pm.from("machines").select("id").eq("company_id", COMPANY)).data?.length ?? 0;
  add("Machines (Plant Admin vs Maintenance vs Plant Manager)", `${m1}`, `${m2}/${m3}`, m1 === m2 && m2 === m3 && m1 > 0);
}
// 4) Schedule: Production Manager's production_planning = Plant Manager's schedule view
{
  const pm = await signIn("production@abcmfg.demo");
  const pman = await signIn("plantmanager@abcmfg.demo");
  const p1 = (await pm.from("production_planning").select("id").eq("company_id", COMPANY)).data?.length ?? 0;
  const p2 = (await pman.from("production_planning").select("id").eq("company_id", COMPANY)).data?.length ?? 0;
  add("Production schedule (PM writes, Plant Manager reads same table)", `${p1} rows`, `${p2} rows`, p1 === p2);
}
// 5) Work Orders: Production Manager vs Plant Manager vs Operator
{
  const pm = await signIn("production@abcmfg.demo");
  const pman = await signIn("plantmanager@abcmfg.demo");
  const op = await signIn("operator@abcmfg.demo");
  const w1 = (await pm.from("work_orders").select("id").eq("company_id", COMPANY)).data?.length ?? 0;
  const w2 = (await pman.from("work_orders").select("id").eq("company_id", COMPANY)).data?.length ?? 0;
  // Operator only sees OWN assigned work orders — a subset, by design
  const w3 = (await op.from("work_orders").select("id").eq("company_id", COMPANY)).data?.length ?? 0;
  add("Work Orders (PM vs Plant Manager full view; Operator own-only subset)", `${w1}`, `${w2}/${w3} (subset ok)`, w1 === w2 && w1 > 0 && w3 <= w1);
}
// 6) Inventory: Warehouse (owns) vs Production Manager (read for stock check)
{
  const wh = await signIn("warehouse@abcmfg.demo");
  const pm = await signIn("production@abcmfg.demo");
  const i1 = (await wh.from("inventory").select("id,quantity").eq("company_id", COMPANY).order("id")).data ?? [];
  const i2 = (await pm.from("inventory").select("id,quantity").eq("company_id", COMPANY).order("id")).data ?? [];
  const same = i1.length === i2.length && i1.every((r, idx) => r.quantity === i2[idx]?.quantity);
  add("Inventory (Warehouse owns, PM stock-check reads identical quantities)", `${i1.length} items`, `${i2.length} items`, same && i1.length > 0);
}
// 7) Attendance (Operator generates, HR + Plant Manager read same rows)
{
  const op = await signIn("operator@abcmfg.demo");
  const hr = await signIn("hr@abcmfg.demo");
  const pm = await signIn("plantmanager@abcmfg.demo");
  const ot = (await op.from("attendance").select("id").eq("company_id", COMPANY)).data?.length ?? 0;
  const ht = (await hr.from("attendance").select("id").eq("company_id", COMPANY)).data?.length ?? 0;
  const pt = (await pm.from("attendance").select("id").eq("company_id", COMPANY)).data?.length ?? 0;
  add("Attendance (Operator reads own, HR + Plant Manager read all — same rows)", `${ot}`, `${ht}/${pt}`, ht === pt && ot <= ht);
}
// 8) Quality Pass → Finished Goods: live trigger test (Quality writes, Warehouse reads)
{
  const ql = await signIn("quality@abcmfg.demo");
  const wh = await signIn("warehouse@abcmfg.demo");
  const before = (await wh.from("finished_goods").select("id").eq("company_id", COMPANY)).data?.length ?? 0;
  const insp = await ql
    .from("quality_inspections")
    .insert({
      company_id: COMPANY,
      inspection_number: `LIVE-CONS-${Date.now().toString().slice(-5)}`,
      inspection_type: "final",
      production_order_id: null,
      result: "pass",
      defects_found: 0,
      quantity_checked: 1,
      notes: "live cross-role consistency check",
    })
    .select("id, inspection_number")
    .single();
  if (insp.error) {
    add("Quality Pass → Finished Goods (live trigger)", "insert failed", insp.error.message, false);
  } else {
    await new Promise((r) => setTimeout(r, 1200));
    const after = (await wh.from("finished_goods").select("id, notes").eq("company_id", COMPANY)).data ?? [];
    const hit = after.find((f) => f.notes?.includes(insp.data.inspection_number));
    add(
      "Quality Pass → Finished Goods (live trigger: Quality writes, Warehouse reads)",
      `insp ${insp.data.inspection_number}`,
      hit ? `FG row auto-created (${hit.id})` : "NO FG ROW (BUG)",
      !!hit,
    );
    // cleanup
    if (hit) await admin.from("finished_goods").delete().eq("id", hit.id);
    await admin.from("quality_inspections").delete().eq("id", insp.data.id);
  }
}

console.log("\n===== CROSS-ROLE DATA CONSISTENCY =====");
console.log("CHECK".padEnd(78), "A".padEnd(22), "B".padEnd(16), "RESULT");
for (const c of checks) {
  console.log(c.name.padEnd(78), c.a.padEnd(22), c.b.padEnd(16), c.ok ? "✔ MATCH" : "✘ MISMATCH");
}
const fails = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - fails.length}/${checks.length} consistency checks passed`);
process.exit(fails.length > 0 ? 1 : 0);
