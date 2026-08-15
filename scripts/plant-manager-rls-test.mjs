// Plant Manager — RLS behavioral verification (live, via the public API).
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

const pm = await signIn("plantmanager@abcmfg.demo"); // plant_manager
const customer = await signIn("customer@abcmfg.demo"); // customer_portal
const supplier = await signIn("supplier@abcmfg.demo"); // supplier_portal

const COMPANY = "11111111-1111-1111-1111-111111111111";
const OTHER_COMPANY = "57fc4d31-a249-4fb8-ac9e-57ca0b37749a";

console.log("Signed in:", pm.user.email, customer.user.email, supplier.user.email);

const cleanup = [];
const track = (id, table) => cleanup.push({ id, table });

// ── 1) PLANT MANAGER READS — oversight of the SAME tables others write ──
for (const [table, name] of [
  ["work_orders", "work orders"],
  ["machines", "machines"],
  ["attendance", "attendance"],
  ["departments", "departments"],
  ["production_planning", "production planning"],
  ["daily_reports", "daily reports"],
  ["employees", "employees"],
  ["shift_schedules", "shift schedules"],
  ["machine_breakdowns", "machine breakdowns"],
]) {
  const { data, error } = await pm.client.from(table).select("id").limit(1);
  ok(`Plant Manager reads ${name}`, error === null, error?.message ?? `${data?.length} rows`);
}

// ── 2) PLANT MANAGER WRITES — daily report + issue report are real ──
const today = new Date().toISOString().slice(0, 10);
const dr = await pm.client
  .from("daily_reports")
  .insert({
    company_id: COMPANY,
    submitted_by: pm.user.id,
    report_date: today,
    units_completed: 12,
    attendance_summary: "20 present, 2 absent",
    downtime_minutes: 45,
    issues: "RLS test — CNC down 45 min",
    notes: "live verification",
  })
  .select("id")
  .single();
ok("Plant Manager submits a Daily Report", dr.error === null, dr.error?.message ?? "inserted");
if (dr.error === null) track(dr.data.id, "daily_reports");

if (dr.error === null) {
  const drUpd = await pm.client
    .from("daily_reports")
    .update({ units_completed: 13 })
    .eq("id", dr.data.id)
    .select("id");
  ok(
    "Plant Manager can edit own submitted report",
    drUpd.error === null && (drUpd.data?.length ?? 0) === 1,
    drUpd.error?.message ?? `${drUpd.data?.length ?? 0} rows`,
  );
}

const machine = (await admin.from("machines").select("id, name").eq("company_id", COMPANY).limit(1)).data?.[0];
if (machine) {
  const bd = await pm.client
    .from("machine_breakdowns")
    .insert({
      company_id: COMPANY,
      machine_id: machine.id,
      downtime_start: new Date().toISOString(),
      cause: "RLS plant-manager issue report",
      reported_by: pm.user.id,
    })
    .select("id")
    .single();
  ok("Plant Manager reports a machine issue (→ Maintenance)", bd.error === null, bd.error?.message ?? "inserted");
  if (bd.error === null) track(bd.data.id, "machine_breakdowns");
} else {
  ok("Plant Manager reports a machine issue (→ Maintenance)", false, "no machine found");
}

// ── 3) PLANT MANAGER CANNOT — the read/oversight boundary ──
const woInsert = await pm.client
  .from("work_orders")
  .insert({ company_id: COMPANY, wo_number: `RLS-PMWO-${Date.now().toString().slice(-5)}`, operation: "cut", status: "pending" })
  .select("id")
  .single();
ok(
  "Plant Manager CANNOT create a Work Order (PM exclusive)",
  woInsert.error !== null,
  woInsert.error?.message ?? "inserted — LEAK",
);

const someWo = (await admin.from("work_orders").select("id").eq("company_id", COMPANY).limit(1)).data?.[0];
if (someWo) {
  const woUpd = await pm.client
    .from("work_orders")
    .update({ progress_percent: 99 })
    .eq("id", someWo.id)
    .select("id");
  ok(
    "Plant Manager CANNOT edit a Work Order (tightened this build)",
    woUpd.error !== null || (woUpd.data?.length ?? 0) === 0,
    woUpd.error?.message ?? `${woUpd.data?.length ?? 0} rows updated — LEAK`,
  );
} else {
  ok("Plant Manager CANNOT edit a Work Order (tightened this build)", false, "no work order found");
}

const someAtt = (await admin.from("attendance").select("id").eq("company_id", COMPANY).limit(1)).data?.[0];
if (someAtt) {
  const attUpd = await pm.client
    .from("attendance")
    .update({ status: "present" })
    .eq("id", someAtt.id)
    .select("id");
  ok(
    "Plant Manager CANNOT overwrite attendance (HR authoritative)",
    attUpd.error !== null || (attUpd.data?.length ?? 0) === 0,
    attUpd.error?.message ?? `${attUpd.data?.length ?? 0} rows updated — LEAK`,
  );
} else {
  ok("Plant Manager CANNOT overwrite attendance (HR authoritative)", false, "no attendance row found");
}

if (machine) {
  const mUpd = await pm.client
    .from("machines")
    .update({ status: "operational" })
    .eq("id", machine.id)
    .select("id");
  ok(
    "Plant Manager CANNOT edit machine status (Maintenance exclusive)",
    mUpd.error !== null || (mUpd.data?.length ?? 0) === 0,
    mUpd.error?.message ?? `${mUpd.data?.length ?? 0} rows updated — LEAK`,
  );
  const mIns = await pm.client
    .from("machines")
    .insert({ company_id: COMPANY, name: "RLS Fake Machine", code: "RLS-1", type: "CNC", status: "operational" })
    .select("id")
    .single();
  ok(
    "Plant Manager CANNOT create a machine",
    mIns.error !== null,
    mIns.error?.message ?? "inserted — LEAK",
  );
}

// ── 4) CROSS-COMPANY ISOLATION ──
for (const [table, name] of [
  ["work_orders", "work orders"],
  ["machines", "machines"],
  ["attendance", "attendance"],
  ["daily_reports", "daily reports"],
  ["production_planning", "production planning"],
]) {
  const { data, error } = await pm.client.from(table).select("id").eq("company_id", OTHER_COMPANY);
  ok(
    `Plant Manager sees 0 rows of other-company ${name}`,
    error === null && (data?.length ?? 0) === 0,
    `${data?.length ?? 0} rows`,
  );
}

// ── 5) PORTAL LEAK FIX — customers/suppliers must NOT read internal planning ──
for (const [who, name] of [[customer, "Customer"], [supplier, "Supplier"]]) {
  const pp = await who.client.from("production_planning").select("id").limit(1);
  ok(
    `${name} CANNOT read production_planning (internal schedule)`,
    pp.error === null && (pp.data?.length ?? 0) === 0,
    pp.error?.message ?? `${pp.data?.length ?? 0} rows — LEAK`,
  );
  const dr = await who.client.from("daily_reports").select("id").limit(1);
  ok(
    `${name} CANNOT read daily_reports`,
    dr.error === null && (dr.data?.length ?? 0) === 0,
    dr.error?.message ?? `${dr.data?.length ?? 0} rows — LEAK`,
  );
}

// ── 6) NOTIFICATION — daily report reaches the specific Company Admin ──
// The UI fires notifyDailyReportSubmitted(→ to_user = the specific admin).
// Verify that exact write path works from the Plant Manager identity:
// the notification lands with to_user = admin id and to_role = null.
const adminId = (await admin.from("user_roles").select("user_id").eq("company_id", COMPANY).eq("role", "company_admin").limit(1)).data?.[0]?.user_id;
// Bare insert — the .select() read-back is invisible to non-admin roles via
// the notifications SELECT policy (same class as the leaves fix), so insert
// without RETURNING and confirm the row with the service role.
const nIns = await pm.client
  .from("notifications")
  .insert({
    company_id: COMPANY,
    to_role: null,
    to_user: adminId,
    title: "📋 Daily Report Submitted",
    body: "RLS test — plant report submitted",
    severity: "info",
    related_entity_type: "daily_reports",
    related_entity_id: dr.error === null ? dr.data.id : null,
  });
ok(
  "Plant Manager identity can send a to_user daily-report notification",
  nIns.error === null,
  nIns.error?.message ?? "inserted",
);

const { data: notif } = await admin
  .from("notifications")
  .select("id, to_user, to_role")
  .eq("company_id", COMPANY)
  .eq("related_entity_type", "daily_reports")
  .eq("to_user", adminId)
  .order("created_at", { ascending: false })
  .limit(1);
ok(
  "Daily Report notification targeted to the specific Company Admin (to_user, no to_role)",
  (notif?.length ?? 0) > 0 && notif[0].to_user === adminId && notif[0].to_role === null,
  notif?.length ? `to_user=${notif[0].to_user} to_role=${notif[0].to_role} (admin=${adminId})` : "no notification row",
);

// ── SUMMARY ──
const fails = results.filter((r) => !r.pass);
const passes = results.length - fails.length;
console.log(`\nPLANT MANAGER: ${passes}/${results.length} passed, ${fails.length} failed`);
for (const f of fails) console.log("  FAIL:", f.name, "→", f.detail);
for (const r of results) console.log(`  ${r.pass ? "PASS" : "FAIL"} ${r.name} — ${r.detail}`);

for (const c of cleanup) {
  try {
    await admin.from(c.table).delete().eq("id", c.id);
  } catch {}
}
process.exit(fails.length ? 1 : 0);
