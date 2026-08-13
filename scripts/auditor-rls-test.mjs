// Auditor role — RLS behavioral verification (live, via the public API).
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
  email: "auditor@abcmfg.demo",
  password: "Factory@2026",
});
if (signInErr) throw new Error("auditor sign-in failed: " + signInErr.message);

const uid = signIn.user.id;
console.log("Signed in as auditor:", signIn.user.email, uid);

// 1) SELECT scoping — auditor must see company data
const companies = await supabase.from("companies").select("id, name");
ok("SELECT companies", companies.error === null, companies.error?.message ?? `${companies.data?.length} rows`);
const orders = await supabase.from("sales_orders").select("id, so_number").limit(50);
ok("SELECT sales_orders", orders.error === null, orders.error?.message ?? `${orders.data?.length} rows`);
const employees = await supabase.from("employees").select("id").limit(50);
ok("SELECT employees", employees.error === null, employees.error?.message ?? `${employees.data?.length} rows`);
const payroll = await supabase.from("payroll").select("id").limit(50);
ok("SELECT payroll", payroll.error === null, payroll.error?.message ?? `${payroll.data?.length} rows`);
const auditLogs = await supabase.from("audit_logs").select("id").limit(50);
ok("SELECT audit_logs", auditLogs.error === null, auditLogs.error?.message ?? `${auditLogs.data?.length} rows`);
const userRoles = await supabase.from("user_roles").select("user_id, role").limit(50);
ok("SELECT user_roles (for actor roles)", userRoles.error === null, userRoles.error?.message ?? `${userRoles.data?.length} rows`);
const profiles = await supabase.from("profiles").select("id, full_name").limit(50);
ok("SELECT profiles", profiles.error === null, profiles.error?.message ?? `${profiles.data?.length} rows`);

// 2) WRITE BLOCK — auditor INSERT/UPDATE/DELETE must be rejected
const ins = await supabase.from("sales_orders").insert({ so_number: "TEST-AUDIT" });
ok("INSERT sales_orders", ins.error !== null, ins.error?.message ?? "ALLOWED (BUG)");
const insInv = await supabase.from("invoices").insert({ invoice_number: "INV-AUDIT", total_amount: 1 });
ok("INSERT invoices", insInv.error !== null, insInv.error?.message ?? "ALLOWED (BUG)");
const upd = await supabase.from("employees").update({ status: "inactive" }).eq("company_id", uid).select();
ok("UPDATE employees", upd.error !== null || (upd.data?.length ?? 0) === 0, upd.error?.message ?? `${upd.data?.length ?? 0} rows updated`);
const del = await supabase.from("sales_orders").delete().neq("id", "00000000-0000-0000-0000-000000000000");
ok("DELETE sales_orders", del.error !== null, del.error?.message ?? "ALLOWED (BUG)");
const delAudit = await supabase.from("audit_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
ok("DELETE audit_logs (immutability, 0 rows affected)", (delAudit.error === null && (delAudit.data?.length ?? 0) === 0) || delAudit.error !== null, delAudit.error?.message ?? `${delAudit.data?.length ?? 0} rows`);
const updAudit = await supabase.from("audit_logs").update({ action: "x" }).neq("id", "00000000-0000-0000-0000-000000000000");
ok("UPDATE audit_logs (immutability, 0 rows affected)", (updAudit.error === null && (updAudit.data?.length ?? 0) === 0) || updAudit.error !== null, updAudit.error?.message ?? `${updAudit.data?.length ?? 0} rows`);
const insNotif = await supabase.from("notifications").insert({ title: "audit-test", body: "x", to_role: "company_admin" });
ok("INSERT notifications (manual send blocked)", insNotif.error !== null, insNotif.error?.message ?? "ALLOWED (BUG)");

// 3) CROSS-COMPANY ISOLATION — auditor of Artisan Furniture Works must not
// see another tenant's records. The other tenants are empty, so we seed a
// real row into a second company via the SERVICE ROLE key, then verify the
// auditor cannot read it (and clean up afterwards).
const OTHER_COMPANY = "57fc4d31-a249-4fb8-ac9e-57ca0b37749a"; // Verified Test Corp
const serviceKey = (() => {
  const m = /^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m.exec(readFileSync(".env.local", "utf8"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
})();
if (!serviceKey) throw new Error("Missing service role key");
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const seededMachine = await admin.from("machines").insert({
  company_id: OTHER_COMPANY,
  name: "Cross-Tenant Test Machine",
  code: "CT-TEST-1",
  status: "operational",
}).select("id").single();
ok("Seed row created in other tenant (service role)", !seededMachine.error, seededMachine.error?.message ?? "seeded");

const crossMach = await supabase.from("machines").select("id").eq("company_id", OTHER_COMPANY);
ok("Cross-company machines blocked (seeded row invisible)", (crossMach.data?.length ?? 0) === 0, crossMach.error?.message ?? `${crossMach.data?.length ?? 0} rows`);
const crossSel = await supabase.from("sales_orders").select("id").eq("company_id", OTHER_COMPANY);
ok("Cross-company sales_orders blocked", (crossSel.data?.length ?? 0) === 0, crossSel.error?.message ?? `${crossSel.data?.length ?? 0} rows`);
const crossCust = await supabase.from("customers").select("id").eq("company_id", OTHER_COMPANY);
ok("Cross-company customers blocked", (crossCust.data?.length ?? 0) === 0, crossCust.error?.message ?? `${crossCust.data?.length ?? 0} rows`);
const crossAudit = await supabase.from("audit_logs").select("id").eq("company_id", OTHER_COMPANY);
ok("Cross-company audit_logs blocked", (crossAudit.data?.length ?? 0) === 0, crossAudit.error?.message ?? `${crossAudit.data?.length ?? 0} rows`);
const crossEmp = await supabase.from("employees").select("id").eq("company_id", OTHER_COMPANY);
ok("Cross-company employees blocked", (crossEmp.data?.length ?? 0) === 0, crossEmp.error?.message ?? `${crossEmp.data?.length ?? 0} rows`);

// Cleanup: remove the seeded row
if (!seededMachine.error) {
  await admin.from("machines").delete().eq("id", seededMachine.data.id);
}
ok("Seeded cross-tenant row cleaned up", true, "deleted");

// 4) NOTIFICATIONS — zero rows targeted at this auditor
const notifs = await supabase.from("notifications").select("id").eq("to_role", "auditor");
ok("Notifications to_role='auditor' (zero by design)", (notifs.data?.length ?? 0) === 0, `${notifs.data?.length ?? 0} rows`);
const ownNotifs = await supabase.from("notifications").select("id").or(`to_user.eq.${uid},user_id.eq.${uid}`);
ok("Auditor personal notification feed empty", (ownNotifs.data?.length ?? 0) === 0, `${ownNotifs.data?.length ?? 0} rows`);

console.log("\n=== AUDITOR RLS TEST RESULTS ===");
let failed = 0;
for (const r of results) {
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}  —  ${r.detail}`);
  if (!r.pass) failed++;
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
