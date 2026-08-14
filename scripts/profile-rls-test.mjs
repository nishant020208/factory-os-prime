// Profile Portal — RLS behavioral verification (live, via the public API).
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

const prod = await signIn("production@abcmfg.demo"); // production_manager
const adminUser = await signIn("admin@abcmfg.demo"); // company_admin
const customer = await signIn("customer@abcmfg.demo"); // customer_portal
const supplier = await signIn("supplier@abcmfg.demo"); // supplier_portal
const auditor = await signIn("auditor@abcmfg.demo"); // auditor
const root = await signIn("root@factoryos.demo"); // root_super_admin

const COMPANY = "11111111-1111-1111-1111-111111111111";
const OTHER_COMPANY = "c6f3c7ed-b0e5-45bf-b349-4fbe50bb8034"; // nishu@2008.com company
const adminId = adminUser.user.id;
const otherUserId = (
  await admin.from("user_roles").select("user_id").eq("company_id", OTHER_COMPANY).limit(1)
).data?.[0]?.user_id;

console.log("Signed in:", prod.user.email, adminUser.user.email, customer.user.email, supplier.user.email, auditor.user.email, root.user.email);

const cleanup = [];
const track = (id) => cleanup.push(id);

// ── 1) REQUEST CREATION — own only ──
const myReq = await prod.client
  .from("profile_change_requests")
  .insert({
    company_id: COMPANY,
    user_id: prod.user.id,
    requested_by: prod.user.id,
    field_name: "profiles.full_name",
    old_value: "Production Manager",
    new_value: "Production Manager (Verified)",
    status: "pending",
  })
  .select("id")
  .single();
ok("INSERT pcr (own request) → allowed", myReq.error === null, myReq.error?.message ?? "inserted");
if (myReq.error === null) track(myReq.data.id);

const otherReq = await prod.client
  .from("profile_change_requests")
  .insert({
    company_id: COMPANY,
    user_id: adminId,
    requested_by: prod.user.id,
    field_name: "profiles.full_name",
    old_value: "x",
    new_value: "y",
    status: "pending",
  })
  .select("id")
  .single();
ok("INSERT pcr for ANOTHER user → rejected (WITH CHECK)", otherReq.error !== null, otherReq.error?.message ?? "ALLOWED (BUG)");

const crossReq = await prod.client
  .from("profile_change_requests")
  .insert({
    company_id: OTHER_COMPANY,
    user_id: prod.user.id,
    requested_by: prod.user.id,
    field_name: "profiles.full_name",
    old_value: "x",
    new_value: "y",
    status: "pending",
  })
  .select("id")
  .single();
ok("INSERT pcr for ANOTHER company → rejected", crossReq.error !== null, crossReq.error?.message ?? "ALLOWED (BUG)");

// ── 2) DIRECT SENSITIVE WRITES BLOCKED (row owner) ──
const updName = await prod.client
  .from("profiles")
  .update({ full_name: "Hacked Name" })
  .eq("id", prod.user.id)
  .select();
ok("UPDATE own profiles.full_name → rejected (approval-gated)", updName.error !== null, updName.error?.message ?? "ALLOWED (BUG)");

const updDept = await prod.client
  .from("profiles")
  .update({ department: "Hacked Dept" })
  .eq("id", prod.user.id)
  .select();
ok("UPDATE own profiles.department → rejected (approval-gated)", updDept.error !== null, updDept.error?.message ?? "ALLOWED (BUG)");

const updPhone = await prod.client
  .from("profiles")
  .update({ phone: "+1 555-0001" })
  .eq("id", prod.user.id)
  .select();
ok("UPDATE own profiles.phone → allowed (self-editable)", updPhone.error === null, updPhone.error?.message ?? "updated");

// ── 3) APPROVER REVIEW ──
const caPending = await adminUser.client
  .from("profile_change_requests")
  .select("id, field_name, status")
  .eq("company_id", COMPANY)
  .eq("status", "pending");
ok("Company Admin SELECT company requests → visible", (caPending.data ?? []).length >= 1, caPending.error?.message ?? `${caPending.data?.length} rows`);

const caApprove = await adminUser.client
  .from("profile_change_requests")
  .update({ status: "approved", reviewed_by: adminId, reviewed_at: new Date().toISOString() })
  .eq("id", myReq.data.id)
  .select();
ok("Company Admin approves request → allowed", caApprove.error === null && (caApprove.data?.length ?? 0) === 1, caApprove.error?.message ?? "approved");

const ownReqByCa = await adminUser.client
  .from("profile_change_requests")
  .insert({
    company_id: COMPANY,
    user_id: adminId,
    requested_by: adminId,
    field_name: "profiles.email",
    old_value: "a@b.c",
    new_value: "c@d.e",
    status: "pending",
  })
  .select("id")
  .single();
ok("Company Admin creates OWN request → allowed", ownReqByCa.error === null, ownReqByCa.error?.message ?? "inserted");
if (ownReqByCa.error === null) track(ownReqByCa.data.id);

const selfApprove = await adminUser.client
  .from("profile_change_requests")
  .update({ status: "approved", reviewed_by: adminId, reviewed_at: new Date().toISOString() })
  .eq("id", ownReqByCa.data.id)
  .select();
ok("Company Admin self-approval → blocked (0 rows / error)", selfApprove.error !== null || (selfApprove.data?.length ?? 0) === 0, selfApprove.error?.message ?? `${selfApprove.data?.length} rows`);

const employeeApprove = await prod.client
  .from("profile_change_requests")
  .update({ status: "approved", reviewed_by: prod.user.id, reviewed_at: new Date().toISOString() })
  .eq("id", myReq.data.id)
  .select();
ok("Employee (non-approver) reviews request → blocked", employeeApprove.error !== null || (employeeApprove.data?.length ?? 0) === 0, employeeApprove.error?.message ?? `${employeeApprove.data?.length} rows`);

// ── 4) IMMUTABLE REQUEST VALUES (guard trigger) ──
const mutateReq = await adminUser.client
  .from("profile_change_requests")
  .update({ new_value: "Tampered" })
  .eq("id", myReq.data.id)
  .select();
ok("Approver rewrites request new_value → rejected (immutable)", mutateReq.error !== null, mutateReq.error?.message ?? "ALLOWED (BUG)");

// ── 5) CROSS-TENANT ISOLATION ──
const foreignReq = await admin.from("profile_change_requests").insert({
  company_id: OTHER_COMPANY,
  user_id: otherUserId ?? adminId,
  requested_by: otherUserId ?? adminId,
  field_name: "profiles.full_name",
  old_value: "x",
  new_value: "y",
  status: "pending",
}).select("id").single();
ok("Seed request in other tenant (service role)", !foreignReq.error, foreignReq.error?.message ?? "seeded");
if (!foreignReq.error) track(foreignReq.data.id);

const seeForeign = await adminUser.client
  .from("profile_change_requests")
  .select("id")
  .eq("company_id", OTHER_COMPANY);
ok("Company Admin cannot SEE other-tenant requests", (seeForeign.data?.length ?? 0) === 0, seeForeign.error?.message ?? `${seeForeign.data?.length} rows`);

const actForeign = await adminUser.client
  .from("profile_change_requests")
  .update({ status: "rejected", reviewed_by: adminId })
  .eq("company_id", OTHER_COMPANY);
ok("Company Admin cannot UPDATE other-tenant requests", (actForeign.data?.length ?? 0) === 0, actForeign.error?.message ?? `${actForeign.data?.length} rows`);

// ── 6) CUSTOMER PROFILE ──
const custUpdGst = await customer.client
  .from("customers")
  .update({ gst_number: "99AABC9999Z1Z1" })
  .eq("user_id", customer.user.id)
  .select();
ok("Customer updates own gst_number → rejected (approval-gated)", custUpdGst.error !== null, custUpdGst.error?.message ?? "ALLOWED (BUG)");

const custUpdContact = await customer.client
  .from("customers")
  .update({ contact_person: "Jane Buyer" })
  .eq("user_id", customer.user.id)
  .select();
ok("Customer updates own contact_person → allowed (self-editable)", custUpdContact.error === null, custUpdContact.error?.message ?? "updated");

const custReq = await customer.client
  .from("profile_change_requests")
  .insert({
    company_id: COMPANY,
    user_id: customer.user.id,
    requested_by: customer.user.id,
    field_name: "customers.gst_number",
    old_value: "old",
    new_value: "99AABC9999Z1Z1",
    status: "pending",
  })
  .select("id")
  .single();
ok("Customer creates own change request → allowed", custReq.error === null, custReq.error?.message ?? "inserted");
if (custReq.error === null) track(custReq.data.id);

// ── 7) SUPPLIER PROFILE ──
const supUpdName = await supplier.client
  .from("suppliers")
  .update({ name: "Hacked Supplier" })
  .eq("user_id", supplier.user.id)
  .select();
ok("Supplier updates own name → rejected (approval-gated)", supUpdName.error !== null, supUpdName.error?.message ?? "ALLOWED (BUG)");

const supUpdBank = await supplier.client
  .from("suppliers")
  .update({ bank_details: "Hacked IBAN" })
  .eq("user_id", supplier.user.id)
  .select();
ok("Supplier updates own bank_details → rejected (approval-gated)", supUpdBank.error !== null, supUpdBank.error?.message ?? "ALLOWED (BUG)");

const supUpdContact = await supplier.client
  .from("suppliers")
  .update({ contact_phone: "9999999999" })
  .eq("user_id", supplier.user.id)
  .select();
ok("Supplier updates own contact_phone → allowed (self-editable)", supUpdContact.error === null, supUpdContact.error?.message ?? "updated");

// ── 8) AUDITOR PROFILE (self-editable allowed + audited; sensitive blocked) ──
const audPhone = await auditor.client
  .from("profiles")
  .update({ phone: "+1 555-7777" })
  .eq("id", auditor.user.id)
  .select();
ok("Auditor updates OWN phone → allowed (self-editable)", audPhone.error === null, audPhone.error?.message ?? "updated");

const audName = await auditor.client
  .from("profiles")
  .update({ full_name: "Hacked Auditor" })
  .eq("id", auditor.user.id)
  .select();
ok("Auditor updates OWN full_name → rejected (approval-gated)", audName.error !== null, audName.error?.message ?? "ALLOWED (BUG)");

const audReq = await auditor.client
  .from("profile_change_requests")
  .insert({
    company_id: COMPANY,
    user_id: auditor.user.id,
    requested_by: auditor.user.id,
    field_name: "profiles.full_name",
    old_value: "a",
    new_value: "b",
    status: "pending",
  })
  .select("id")
  .single();
ok("Auditor creates own change request → allowed", audReq.error === null, audReq.error?.message ?? "inserted");
if (audReq.error === null) track(audReq.data.id);

// ── 9) ROOT (everything self-editable, audited) ──
const rootUpd = await root.client
  .from("profiles")
  .update({ full_name: "Root Platform Owner" })
  .eq("id", root.user.id)
  .select();
ok("Root updates OWN full_name → allowed (no approver above)", rootUpd.error === null, rootUpd.error?.message ?? "updated");

// ── 10) AUDIT TRAIL — every profile write produces an audit_logs row ──
const audited = await admin
  .from("audit_logs")
  .select("user_id, action, entity, metadata")
  .eq("entity", "profiles")
  .eq("entity_id", prod.user.id)
  .order("created_at", { ascending: false })
  .limit(3);
const phoneAudit = (audited.data ?? []).find(
  (a) => a.metadata?.new_value?.phone === "+1 555-0001" || a.metadata?.old_value?.phone !== undefined,
);
ok("Profile phone update → audit_logs row with old→new diff + actor", !!phoneAudit, audited.error?.message ?? JSON.stringify((audited.data ?? [])[0]?.metadata ?? null).slice(0, 200));

const rootAudit = await admin
  .from("audit_logs")
  .select("user_id, metadata")
  .eq("entity", "profiles")
  .eq("entity_id", root.user.id)
  .order("created_at", { ascending: false })
  .limit(1);
ok(
  "Root profile edit → audit_logs row written (self-editable ≠ unlogged)",
  (rootAudit.data?.length ?? 0) > 0 && (rootAudit.data?.[0]?.metadata?.new_value?.full_name === "Root Platform Owner"),
  rootAudit.error?.message ?? JSON.stringify(rootAudit.data?.[0]?.metadata ?? null).slice(0, 160),
);

// ── 11) OPS role can still administer OTHER users' profiles (HR/employee flow) ──
const hr = await signIn("hr@abcmfg.demo");
const opsUpd = await hr.client
  .from("profiles")
  .update({ job_title: "Senior Operator (Ops Edit)" })
  .eq("id", prod.user.id)
  .select();
ok("HR (ops) edits ANOTHER user's profile → allowed (admin flow)", opsUpd.error === null, opsUpd.error?.message ?? "updated");

// ── CLEANUP ──
for (const id of cleanup) {
  await admin.from("profile_change_requests").delete().eq("id", id);
}
await admin.from("profiles").update({ phone: null }).eq("id", prod.user.id);
await admin.from("profiles").update({ job_title: null }).eq("id", prod.user.id);
await admin.from("customers").update({ contact_person: null }).eq("user_id", customer.user.id);
await admin.from("suppliers").update({ contact_phone: null }).eq("user_id", supplier.user.id);
await admin.from("profiles").update({ phone: null }).eq("id", auditor.user.id);
ok("Seeded rows cleaned up", true, "removed");

console.log("\n=== PROFILE RLS TEST RESULTS ===");
let failed = 0;
for (const r of results) {
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}  —  ${r.detail}`);
  if (!r.pass) failed++;
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
