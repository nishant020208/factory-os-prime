// Company Admin — RLS behavioral verification (live, via the public API).
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

const ca = await signIn("admin@abcmfg.demo"); // company_admin
const pm = await signIn("production@abcmfg.demo"); // production_manager

const COMPANY = "11111111-1111-1111-1111-111111111111";
const OTHER_COMPANY = "f804c884-d04e-4e37-ba67-12cdc42d768c";

console.log("Signed in:", ca.user.email, pm.user.email);

const cleanup = [];
const track = (id, table) => cleanup.push({ id, table });

// ── 1) COMPANY ADMIN READS — legitimate cross-module view within own company ──
for (const [table, name] of [
  ["plants", "plants"],
  ["departments", "departments"],
  ["machines", "machines"],
  ["whitelist", "whitelist"],
  ["user_roles", "user roles"],
  ["profile_change_requests", "profile change requests"],
  ["sales_orders", "sales orders"],
  ["production_orders", "production orders"],
  ["work_orders", "work orders"],
  ["inventory", "inventory"],
  ["invoices", "invoices"],
  ["employees", "employees"],
  ["attendance", "attendance"],
  ["customer_requests", "customer requests"],
]) {
  const { data, error } = await ca.client.from(table).select("id").limit(1);
  ok(`Company Admin reads ${name}`, error === null, error?.message ?? `${data?.length} rows`);
}

// ── 2) COMPANY ADMIN WRITES — the real approval/management actions ──
// 2a. Create a plant (multi-plant support)
const plant = await ca.client
  .from("plants")
  .insert({
    company_id: COMPANY,
    name: "RLS Test Plant",
    code: `RLS-${Date.now().toString().slice(-4)}`,
    status: "active",
  })
  .select("id")
  .single();
ok(
  "Company Admin creates a plant (multi-plant)",
  plant.error === null && !!plant.data?.id,
  plant.error?.message ?? "inserted",
);
if (plant.data?.id) track(plant.data.id, "plants");

// 2b. Whitelist an internal staff invite
const wl = await ca.client
  .from("whitelist")
  .insert({
    email: `rls-staff-${Date.now()}@abcmfg.demo`,
    role: "production_operator",
    company_id: COMPANY,
    status: "pending",
  })
  .select("id")
  .single();
ok("Company Admin whitelists internal staff", wl.error === null && !!wl.data?.id, wl.error?.message ?? "inserted");
if (wl.data?.id) track(wl.data.id, "whitelist");

// 2c. Approve a pending customer request (partner approval)
const crReq = await admin
  .from("customer_requests")
  .select("id")
  .eq("company_id", COMPANY)
  .eq("status", "pending")
  .limit(1)
  .maybeSingle();
const crApprove = await ca.client
  .from("customer_requests")
  .update({ status: "approved", reviewed_by: ca.user.id, reviewed_at: new Date().toISOString() })
  .eq("id", crReq.data?.id ?? "00000000-0000-0000-0000-000000000000");
ok(
  "Company Admin approves a partner registration",
  crReq.data?.id ? crApprove.error === null : true,
  crReq.data?.id ? (crApprove.error?.message ?? "approved") : "no pending request in demo (skipped)",
);

// 2d. Approve a pending profile change request
const pcr = await admin
  .from("profile_change_requests")
  .select("id")
  .eq("company_id", COMPANY)
  .eq("status", "pending")
  .limit(1)
  .maybeSingle();
const pcrApprove = await ca.client
  .from("profile_change_requests")
  .update({ status: "approved", reviewed_by: ca.user.id, reviewed_at: new Date().toISOString() })
  .eq("id", pcr.data?.id ?? "00000000-0000-0000-0000-000000000000");
ok(
  "Company Admin approves a profile change request",
  pcr.data?.id ? pcrApprove.error === null : true,
  pcr.data?.id ? (pcrApprove.error?.message ?? "approved") : "no pending request in demo (skipped)",
);

// 2e. Deactivate / reactivate a staff account (real sign-in block)
const someStaff = (await admin.from("profiles").select("id, status").eq("company_id", COMPANY).neq("id", ca.user.id).limit(1).maybeSingle()).data;
if (someStaff) {
  const deact = await ca.client
    .from("profiles")
    .update({ status: "inactive" })
    .eq("id", someStaff.id)
    .select("id");
  ok("Company Admin deactivates a staff account", deact.error === null, deact.error?.message ?? "updated");
  if (deact.error === null) {
    await admin.from("profiles").update({ status: someStaff.status }).eq("id", someStaff.id);
  }
}

// ── 3) COMPANY ADMIN BOUNDARIES ──
// 3a. CANNOT whitelist another Company Admin for its own company (Root's exclusive)
const wlAdmin = await ca.client
  .from("whitelist")
  .insert({ email: "rls-ca2@abcmfg.demo", role: "company_admin", company_id: COMPANY, status: "pending" })
  .select("id");
ok(
  "Company Admin CANNOT whitelist another Company Admin (Root only)",
  wlAdmin.error !== null,
  wlAdmin.error?.message ?? "ALLOWED (BUG)",
);

// 3b. CANNOT edit operational records directly (approval ≠ override)
// Work Order progress update is Production Manager / Quality / Operator territory.
const wo = (await admin.from("work_orders").select("id, operator_id").eq("company_id", COMPANY).limit(1).maybeSingle()).data;
if (wo) {
  const woUpd = await ca.client.from("work_orders").update({ progress: 99 }).eq("id", wo.id);
  ok(
    "Company Admin CANNOT directly edit a work order (no operational override)",
    woUpd.error !== null,
    woUpd.error?.message ?? "ALLOWED (BUG)",
  );
} else {
  ok("Company Admin CANNOT directly edit a work order (no operational override)", true, "no work order in demo (skipped)");
}

// 3c. CANNOT self-approve own profile change request (approver ≠ requester)
const selfPcr = await ca.client
  .from("profile_change_requests")
  .insert({
    company_id: COMPANY,
    user_id: ca.user.id,
    requested_by: ca.user.id,
    field_name: "profiles.full_name",
    old_value: "Admin Prime",
    new_value: "Admin Prime RLS",
    status: "pending",
  })
  .select("id")
  .single();
const selfApprove = await ca.client
  .from("profile_change_requests")
  .update({ status: "approved", reviewed_by: ca.user.id, reviewed_at: new Date().toISOString() })
  .eq("id", selfPcr.data?.id ?? "00000000-0000-0000-0000-000000000000")
  .select("id, status, reviewed_by");
ok(
  "Company Admin CANNOT self-approve their own profile request",
  selfApprove.error !== null || (selfApprove.data?.length ?? 0) === 0 || selfApprove.data?.[0]?.reviewed_by !== ca.user.id,
  selfApprove.error?.message ?? `${selfApprove.data?.length ?? 0} rows reviewed_by=${selfApprove.data?.[0]?.reviewed_by}`,
);
if (selfPcr.data?.id) track(selfPcr.data.id, "profile_change_requests");

// 3d. Strict company isolation — other company's data invisible
for (const [table, name] of [
  ["plants", "plants"],
  ["whitelist", "whitelist"],
  ["user_roles", "user roles"],
  ["profile_change_requests", "profile change requests"],
  ["sales_orders", "sales orders"],
  ["production_orders", "production orders"],
  ["work_orders", "work orders"],
  ["inventory", "inventory"],
  ["invoices", "invoices"],
  ["employees", "employees"],
  ["attendance", "attendance"],
  ["customer_requests", "customer requests"],
]) {
  const { data, error } = await ca.client.from(table).select("id").eq("company_id", OTHER_COMPANY);
  ok(
    `Company Admin sees 0 rows of other-company ${name}`,
    error === null && (data?.length ?? 0) === 0,
    `${data?.length ?? 0} rows — LEAK`,
  );
}

// 3e. This company's admin cannot touch the other company's plants (isolation)
const crossPlant = (await admin.from("plants").select("id").eq("company_id", OTHER_COMPANY).limit(1).maybeSingle()).data;
if (crossPlant) {
  const cross = await ca.client.from("plants").update({ name: "HACKED" }).eq("id", crossPlant.id);
  ok(
    "Company Admin CANNOT edit another company's plant",
    cross.error !== null && (cross.data?.length ?? 0) === 0,
    cross.error?.message ?? `${cross.data?.length ?? 0} rows — LEAK`,
  );
}

// ── 4) CROSS-CHECK — the tightened boundaries from this build's migration ──
// Production Manager can no longer create departments (tenant-admin only)
const deptByPm = await pm.client
  .from("departments")
  .insert({ company_id: COMPANY, name: "PM Fake Dept" })
  .select("id");
ok("Production Manager CANNOT create a department (tenant-admin only)", deptByPm.error !== null, deptByPm.error?.message ?? "ALLOWED (BUG)");

// Production Manager can no longer create machines
const machByPm = await pm.client
  .from("machines")
  .insert({ company_id: COMPANY, name: "PM Fake Machine", code: "PM-X" })
  .select("id");
ok("Production Manager CANNOT create a machine (tenant-admin only)", machByPm.error !== null, machByPm.error?.message ?? "ALLOWED (BUG)");

// ── SUMMARY ──
const fails = results.filter((r) => !r.pass);
console.log(`\nCOMPANY ADMIN: ${results.length - fails.length}/${results.length} passed, ${fails.length} failed`);
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
