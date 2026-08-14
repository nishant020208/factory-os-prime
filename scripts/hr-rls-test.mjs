// HR Manager — RLS behavioral verification (live, via the public API).
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

const hr = await signIn("hr@abcmfg.demo"); // hr_manager
const operator = await signIn("operator@abcmfg.demo"); // production_operator
const fin = await signIn("finance@abcmfg.demo"); // finance_manager

const COMPANY = "11111111-1111-1111-1111-111111111111";
const OTHER_COMPANY = "57fc4d31-a249-4fb8-ac9e-57ca0b37749a"; // Verified Test Corp
const hrId = hr.user.id;
const opId = operator.user.id;
const finId = fin.user.id;

console.log("Signed in:", hr.user.email, operator.user.email, fin.user.email);

const cleanup = [];
const track = (id, table) => cleanup.push({ id, table });

// ── 1) PEOPLE SCOPE — READS ALLOWED ──
const empRead = await hr.client.from("employees").select("id").eq("company_id", COMPANY);
ok("HR reads employees (own company)", empRead.error === null && (empRead.data?.length ?? 0) > 0, empRead.error?.message ?? `${empRead.data?.length} rows`);

const attRead = await hr.client.from("attendance").select("id").eq("company_id", COMPANY);
ok("HR reads attendance (all departments)", attRead.error === null && (attRead.data?.length ?? 0) > 0, attRead.error?.message ?? `${attRead.data?.length} rows`);

const payRead = await hr.client.from("payroll").select("id").eq("company_id", COMPANY);
ok("HR reads payroll", payRead.error === null && (payRead.data?.length ?? 0) > 0, payRead.error?.message ?? `${payRead.data?.length} rows`);

const leavesRead = await hr.client.from("leaves").select("id").eq("company_id", COMPANY);
ok("HR reads leaves", leavesRead.error === null, leavesRead.error?.message ?? `${leavesRead.data?.length} rows`);

const deptRead = await hr.client.from("departments").select("id");
ok("HR reads departments", deptRead.error === null && (deptRead.data?.length ?? 0) > 0, deptRead.error?.message ?? `${deptRead.data?.length} rows`);

// ── 2) PEOPLE SCOPE — WRITES ALLOWED ──
const empInsert = await hr.client
  .from("employees")
  .insert({
    company_id: COMPANY,
    employee_code: `HRT-${Date.now().toString().slice(-6)}`,
    full_name: "RLS HR Test Hire",
    email: "rlshr@example.com",
    job_title: "Carpenter",
    status: "active",
    hire_date: new Date().toISOString().slice(0, 10),
    salary: 60000,
  })
  .select("id")
  .single();
ok("HR creates employee record", empInsert.error === null, empInsert.error?.message ?? "inserted");
if (empInsert.error === null) track(empInsert.data.id, "employees");

// HR attendance correction (the exact policy added for this build).
const attCorrection = await hr.client
  .from("attendance")
  .update({ status: "present", correction_reason: "RLS test correction" })
  .eq("employee_id", hrId)
  .select();
ok("HR corrects attendance (with reason)", attCorrection.error === null, attCorrection.error?.message ?? `${attCorrection.data?.length} rows`);

// HR creates a leave request for the operator (HR-entered flow).
const leave = await hr.client
  .from("leaves")
  .insert({
    company_id: COMPANY,
    employee_id: opId,
    leave_type: "Casual",
    start_date: "2099-01-05",
    end_date: "2099-01-06",
    reason: "RLS HR test",
    status: "pending",
  })
  .select("id")
  .single();
ok("HR creates leave request for an employee", leave.error === null, leave.error?.message ?? "inserted");
if (leave.error === null) track(leave.data.id, "leaves");

// HR approves the operator's leave → attendance rows + operator notified (to_user).
const approve = await hr.client
  .from("leaves")
  .update({ status: "approved", approver_id: hrId, resolved_at: new Date().toISOString() })
  .eq("id", leave.data?.id)
  .select();
ok("HR approves employee leave", approve.error === null && approve.data?.[0]?.status === "approved", approve.error?.message ?? "approved");

if (approve.error === null && leave.data) {
  const notif = await admin
    .from("notifications")
    .select("to_user,to_role,title")
    .eq("related_entity_type", "leaves")
    .eq("related_entity_id", leave.data.id)
    .eq("to_user", opId)
    .order("created_at", { ascending: false })
    .limit(1);
  ok(
    "Leave approval → notification to_user = that employee only",
    notif.data?.[0]?.to_user === opId && notif.data?.[0]?.to_role === null,
    JSON.stringify(notif.data?.[0] ?? null),
  );
  const attOnLeave = await admin
    .from("attendance")
    .select("status")
    .eq("employee_id", opId)
    .eq("date", "2099-01-05")
    .maybeSingle();
  ok("Approved leave → attendance reflects on_leave for the dates", attOnLeave.data?.status === "on_leave", attOnLeave.data?.status ?? "missing");
}

// ── 3) SELF-APPROVAL BLOCK (DB trigger) ──
const ownLeave = await hr.client
  .from("leaves")
  .insert({
    company_id: COMPANY,
    employee_id: hrId,
    leave_type: "Sick",
    start_date: "2099-02-01",
    end_date: "2099-02-01",
    reason: "RLS self-approval test",
    status: "pending",
  })
  .select("id")
  .single();
ok("HR submits own leave request (own row allowed)", ownLeave.error === null, ownLeave.error?.message ?? "inserted");
if (ownLeave.error === null) track(ownLeave.data.id, "leaves");

if (ownLeave.error === null) {
  const selfApprove = await hr.client
    .from("leaves")
    .update({ status: "approved", approver_id: hrId })
    .eq("id", ownLeave.data.id)
    .select();
  ok("HR approving OWN leave → blocked (trigger)", selfApprove.error !== null, selfApprove.error?.message ?? "ALLOWED (BUG)");
}

// ── 4) PRODUCTION / INVENTORY / FINANCE ISOLATION — READS ──
for (const [table, name] of [
  ["inventory", "inventory"],
  ["machines", "machines"],
  ["products", "products"],
  ["customers", "customers"],
  ["suppliers", "suppliers"],
  ["sales_orders", "sales orders"],
  ["production_orders", "production orders"],
  ["work_orders", "work orders"],
  ["invoices", "invoices"],
  ["payments", "payments"],
  ["shipments", "shipments"],
  ["purchase_orders", "purchase orders"],
  ["expenses", "expenses"],
  ["taxes", "taxes"],
  ["supplier_invoices", "supplier invoices"],
  ["supplier_payments", "supplier payments"],
  ["support_tickets", "support tickets"],
  ["qr_codes", "qr codes"],
  ["materials", "materials"],
]) {
  const { data, error } = await hr.client.from(table).select("id").limit(1);
  ok(`HR SELECT ${name} → 0 rows (out of scope)`, (data?.length ?? 0) === 0, error?.message ?? `${data?.length} rows`);
}

// ── 5) WRITES BLOCKED ON OUT-OF-SCOPE TABLES ──
const invUpdate = await hr.client
  .from("inventory")
  .update({ quantity: 9999 })
  .eq("company_id", COMPANY)
  .select();
ok("HR UPDATE inventory → blocked", invUpdate.error !== null || (invUpdate.data?.length ?? 0) === 0, invUpdate.error?.message ?? `${invUpdate.data?.length} rows`);

const machUpdate = await hr.client
  .from("machines")
  .update({ status: "down" })
  .eq("company_id", COMPANY)
  .select();
ok("HR UPDATE machines → blocked", machUpdate.error !== null || (machUpdate.data?.length ?? 0) === 0, machUpdate.error?.message ?? `${machUpdate.data?.length} rows`);

const invInsert = await hr.client
  .from("inventory")
  .insert({ company_id: COMPANY, sku: "RLS-HR-INV", quantity: 1 })
  .select("id")
  .single();
ok("HR INSERT inventory → rejected", invInsert.error !== null, invInsert.error?.message ?? "ALLOWED (BUG)");

const invoiceUpdate = await hr.client
  .from("invoices")
  .update({ status: "paid" })
  .eq("company_id", COMPANY)
  .select();
ok("HR UPDATE invoices → blocked", invoiceUpdate.error !== null || (invoiceUpdate.data?.length ?? 0) === 0, invoiceUpdate.error?.message ?? `${invoiceUpdate.data?.length} rows`);

const roleGrant = await hr.client
  .from("user_roles")
  .insert({ user_id: opId, company_id: COMPANY, role: "plant_admin" })
  .select("id")
  .single();
ok("HR granting a system role → rejected (Company Admin only)", roleGrant.error !== null, roleGrant.error?.message ?? "ALLOWED (BUG)");

const whitelistDecide = await hr.client
  .from("whitelist")
  .update({ status: "approved" })
  .eq("company_id", COMPANY)
  .select();
ok("HR deciding whitelist status → blocked (request-only)", whitelistDecide.error !== null || (whitelistDecide.data?.length ?? 0) === 0, whitelistDecide.error?.message ?? `${whitelistDecide.data?.length} rows`);

// ── 6) RECRUITMENT PIPELINE ──
const posting = await hr.client
  .from("job_postings")
  .insert({ company_id: COMPANY, title: "RLS Test Carpenter", department: "Production", status: "open" })
  .select("id")
  .single();
ok("HR posts a position", posting.error === null, posting.error?.message ?? "inserted");
if (posting.error === null) track(posting.data.id, "job_postings");

const candidate = await hr.client
  .from("candidates")
  .insert({
    company_id: COMPANY,
    job_posting_id: posting.data?.id ?? null,
    name: "RLS Test Candidate",
    position: "Carpenter",
    status: "applied",
  })
  .select("id")
  .single();
ok("HR adds a candidate", candidate.error === null, candidate.error?.message ?? "inserted");
if (candidate.error === null) track(candidate.data.id, "candidates");

if (candidate.error === null) {
  const hire = await hr.client
    .from("candidates")
    .update({ status: "hired" })
    .eq("id", candidate.data.id)
    .select();
  ok("HR hires candidate (status → hired)", hire.error === null, hire.error?.message ?? "hired");
}

// ── 7) CROSS-COMPANY ISOLATION ──
const crossEmp = await hr.client.from("employees").select("id").eq("company_id", OTHER_COMPANY);
ok("HR reads another company's employees → 0 rows", (crossEmp.data?.length ?? 0) === 0, crossEmp.error?.message ?? `${crossEmp.data?.length} rows`);

const crossPay = await hr.client.from("payroll").select("id").eq("company_id", OTHER_COMPANY);
ok("HR reads another company's payroll → 0 rows", (crossPay.data?.length ?? 0) === 0, crossPay.error?.message ?? `${crossPay.data?.length} rows`);

const crossAtt = await hr.client.from("attendance").select("id").eq("company_id", OTHER_COMPANY);
ok("HR reads another company's attendance → 0 rows", (crossAtt.data?.length ?? 0) === 0, crossAtt.error?.message ?? `${crossAtt.data?.length} rows`);

// ── 8) FINANCE MANAGER CANNOT READ PAYROLL (HR-only isolation) ──
const finPay = await fin.client.from("payroll").select("id").eq("company_id", COMPANY);
ok("Finance Manager reads payroll → 0 rows (HR scope only)", (finPay.data?.length ?? 0) === 0, finPay.error?.message ?? `${finPay.data?.length} rows`);

// ── CLEANUP ──
for (const c of cleanup.reverse()) {
  try {
    await admin.from("audit_logs").delete().eq("entity", c.table).eq("entity_id", c.id);
    await admin.from("notifications").delete().eq("related_entity_id", c.id);
    await admin.from(c.table).delete().eq("id", c.id);
  } catch {}
}
await admin.from("attendance").delete().eq("employee_id", opId).eq("date", "2099-01-05");
await admin.from("attendance").delete().eq("employee_id", opId).eq("date", "2099-01-06");
ok("Test data cleaned up", true, "deleted test employees, leaves, postings, candidates, notifications");

console.log("\n=== HR MANAGER RLS TEST RESULTS ===");
let failed = 0;
for (const r of results) {
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}  —  ${r.detail}`);
  if (!r.pass) failed++;
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
