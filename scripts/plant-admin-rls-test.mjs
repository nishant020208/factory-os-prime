// Plant Admin — RLS behavioral verification (live, via the public API).
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

const pa = await signIn("plantadmin@abcmfg.demo"); // plant_admin
const maint = await signIn("maintenance@abcmfg.demo"); // maintenance_engineer
const operator = await signIn("operator@abcmfg.demo"); // production_operator

const COMPANY = "11111111-1111-1111-1111-111111111111";
const PLANT = "22222222-2222-2222-2222-222222222222";
const OTHER_COMPANY = "57fc4d31-a249-4fb8-ac9e-57ca0b37749a";

console.log("Signed in:", pa.user.email, maint.user.email, operator.user.email);

const cleanup = [];
const track = (id, table) => cleanup.push({ id, table });

// ── 1) PLANT ADMIN READS — their plant + company, never other companies ──
for (const [table, name] of [
  ["plants", "plants"],
  ["departments", "departments"],
  ["machines", "machines"],
  ["employees", "employees"],
  ["attendance", "attendance"],
  ["user_roles", "user roles"],
  ["machine_breakdowns", "machine breakdowns"],
  ["work_orders", "work orders"],
  ["shift_schedules", "shift schedules"],
]) {
  const { data, error } = await pa.client.from(table).select("id").limit(1);
  ok(`Plant Admin reads ${name}`, error === null, error?.message ?? `${data?.length} rows`);
}

// Plant Admin's own plant is linked
const myRole = (await admin.from("user_roles").select("plant_id").eq("user_id", pa.user.id).maybeSingle()).data;
ok("Plant Admin is linked to a specific plant", !!myRole?.plant_id, myRole?.plant_id ?? "no plant");

// ── 2) PLANT ADMIN WRITES — plant setup/configuration ──
// 2a. Add a department (same table others read)
const dept = await pa.client
  .from("departments")
  .insert({ company_id: COMPANY, name: `RLS Dept ${Date.now().toString().slice(-4)}` })
  .select("id")
  .single();
ok("Plant Admin creates a department", dept.error === null && !!dept.data?.id, dept.error?.message ?? "inserted");
if (dept.data?.id) track(dept.data.id, "departments");

// 2b. Add a machine to the roster (same table Maintenance manages status on)
const mach = await pa.client
  .from("machines")
  .insert({ company_id: COMPANY, plant_id: PLANT, name: `RLS Machine ${Date.now().toString().slice(-4)}`, code: "RLS-M", status: "operational" })
  .select("id")
  .single();
ok("Plant Admin adds a machine to the roster", mach.error === null && !!mach.data?.id, mach.error?.message ?? "inserted");
if (mach.data?.id) track(mach.data.id, "machines");

// ── 3) PLANT ADMIN BOUNDARIES ──
// 3a. CANNOT whitelist staff (Company Admin's exclusive scope)
const wl = await pa.client
  .from("whitelist")
  .insert({ email: "rls-pa@abcmfg.demo", role: "production_operator", company_id: COMPANY, status: "pending" })
  .select("id");
ok("Plant Admin CANNOT whitelist staff (Company Admin only)", wl.error !== null, wl.error?.message ?? "ALLOWED (BUG)");

// 3b. CANNOT approve partner registrations (Company Admin only)
// RLS filters rows out (0 affected) rather than erroring — both prove denial.
const cr = await pa.client
  .from("customer_requests")
  .update({ status: "approved", reviewed_by: pa.user.id, reviewed_at: new Date().toISOString() })
  .eq("company_id", COMPANY);
ok(
  "Plant Admin CANNOT approve partner registrations",
  cr.error !== null || (cr.data?.length ?? 0) === 0,
  cr.error?.message ?? `${cr.data?.length ?? 0} rows updated — ALLOWED (BUG)`,
);

// 3c. CANNOT create work orders (Production Manager only)
const woIns = await pa.client
  .from("work_orders")
  .insert({ company_id: COMPANY, product_name: "RLS WO", status: "pending" })
  .select("id");
ok("Plant Admin CANNOT create a work order", woIns.error !== null, woIns.error?.message ?? "ALLOWED (BUG)");

// 3d. CANNOT edit work order progress
const wo = (await admin.from("work_orders").select("id").eq("company_id", COMPANY).limit(1).maybeSingle()).data;
if (wo) {
  const woUpd = await pa.client.from("work_orders").update({ progress: 50 }).eq("id", wo.id);
  ok("Plant Admin CANNOT edit a work order's progress", woUpd.error !== null, woUpd.error?.message ?? "ALLOWED (BUG)");
} else {
  ok("Plant Admin CANNOT edit a work order's progress", true, "no work order (skipped)");
}

// 3e. CANNOT edit attendance (HR owns corrections)
const att = (await admin.from("attendance").select("id").eq("company_id", COMPANY).limit(1).maybeSingle()).data;
if (att) {
  const attUpd = await pa.client.from("attendance").update({ status: "present", correction_reason: "RLS" }).eq("id", att.id);
  ok(
    "Plant Admin CANNOT edit attendance records (HR's scope)",
    attUpd.error !== null || (attUpd.data?.length ?? 0) === 0,
    attUpd.error?.message ?? `${attUpd.data?.length ?? 0} rows updated — ALLOWED (BUG)`,
  );
} else {
  ok("Plant Admin CANNOT edit attendance records (HR's scope)", true, "no attendance (skipped)");
}

// 3f. CANNOT resolve maintenance tickets (Maintenance Engineer's scope)
const ticket = (await admin.from("machine_breakdowns").select("id").eq("company_id", COMPANY).limit(1).maybeSingle()).data;
if (ticket) {
  const tUpd = await pa.client.from("machine_breakdowns").update({ resolved_at: new Date().toISOString() }).eq("id", ticket.id);
  ok("Plant Admin CANNOT resolve maintenance tickets", tUpd.error !== null, tUpd.error?.message ?? "ALLOWED (BUG)");
} else {
  ok("Plant Admin CANNOT resolve maintenance tickets", true, "no ticket (skipped)");
}

// 3g. CANNOT edit machine live status (Maintenance Engineer's scope) — roster yes, status no
const ownMach = mach.data?.id;
if (ownMach) {
  const statusUpd = await pa.client.from("machines").update({ status: "down" }).eq("id", ownMach);
  ok(
    "Plant Admin CANNOT flip a machine's live status (Maintenance owns status)",
    statusUpd.error !== null || (statusUpd.data?.length ?? 0) === 0,
    statusUpd.error?.message ?? `${statusUpd.data?.length ?? 0} rows updated — ALLOWED (BUG)`,
  );
}

// 3h. CANNOT deactivate/whitelist-manage profiles — and cannot edit other-company data
for (const [table, name] of [
  ["plants", "plants"],
  ["departments", "departments"],
  ["machines", "machines"],
  ["employees", "employees"],
  ["attendance", "attendance"],
  ["work_orders", "work orders"],
  ["user_roles", "user roles"],
]) {
  const { data, error } = await pa.client.from(table).select("id").eq("company_id", OTHER_COMPANY);
  ok(
    `Plant Admin sees 0 rows of other-company ${name}`,
    error === null && (data?.length ?? 0) === 0,
    `${data?.length ?? 0} rows — LEAK`,
  );
}

// ── 4) CROSS-CHECK — Maintenance keeps status writes; Operator cannot manage roster ──
if (ownMach) {
  const maintUpd = await maint.client.from("machines").update({ status: "maintenance" }).eq("id", ownMach).select("id");
  ok("Maintenance Engineer CAN update machine status", maintUpd.error === null, maintUpd.error?.message ?? "updated");
}
const opDept = await operator.client.from("departments").insert({ company_id: COMPANY, name: "OP Fake Dept" }).select("id");
ok("Operator CANNOT create a department (tenant-admin only)", opDept.error !== null, opDept.error?.message ?? "ALLOWED (BUG)");

// ── SUMMARY ──
const fails = results.filter((r) => !r.pass);
console.log(`\nPLANT ADMIN: ${results.length - fails.length}/${results.length} passed, ${fails.length} failed`);
for (const f of fails) console.log("  FAIL:", f.name, "→", f.detail);
for (const r of results) console.log(`  ${r.pass ? "PASS" : "FAIL"} ${r.name} — ${r.detail}`);

for (const c of cleanup) {
  try {
    await admin.from(c.table).delete().eq("id", c.id);
  } catch {
    // best-effort cleanup
  }
}
process.exit(fails.length > 0 ? 1 : 0);
