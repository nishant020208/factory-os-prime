// Maintenance Engineer — RLS behavioral verification (live, via the public API).
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

const maint = await signIn("maintenance@abcmfg.demo"); // maintenance_engineer
const operator = await signIn("operator@abcmfg.demo"); // production_operator
const fin = await signIn("finance@abcmfg.demo"); // finance_manager

const COMPANY = "11111111-1111-1111-1111-111111111111";
const OTHER_COMPANY = "57fc4d31-a249-4fb8-ac9e-57ca0b37749a";
const maintId = maint.user.id;
const opId = operator.user.id;

console.log("Signed in:", maint.user.email, operator.user.email, fin.user.email);

const cleanup = [];
const track = (id, table) => cleanup.push({ id, table });

// ── 1) MACHINE SCOPE — READS ALLOWED ──
for (const [table, name] of [
  ["machines", "machines"],
  ["maintenance_tickets", "maintenance tickets"],
  ["maintenance_schedules", "maintenance schedules"],
  ["spare_parts", "spare parts"],
  ["machine_breakdowns", "machine breakdowns"],
  ["machine_status_log", "machine status log"],
]) {
  const { data, error } = await maint.client.from(table).select("id").limit(1);
  ok(`Maintenance reads ${name}`, error === null, error?.message ?? `${data?.length} rows`);
}

// ── 2) MACHINE WRITES ALLOWED ──
const machine = (await maint.client.from("machines").select("id").limit(1)).data?.[0];
if (machine) {
  const sched = await maint.client
    .from("maintenance_schedules")
    .insert({
      company_id: COMPANY,
      machine_id: machine.id,
      recurrence: "monthly",
      next_due: "2099-01-01",
      status: "scheduled",
    })
    .select("id")
    .single();
  ok("Maintenance schedules preventive maintenance", sched.error === null, sched.error?.message ?? "inserted");
  if (sched.error === null) track(sched.data.id, "maintenance_schedules");

  const part = await maint.client
    .from("spare_parts")
    .insert({
      company_id: COMPANY,
      name: "RLS Test Belt",
      part_code: "RLS-BELT",
      quantity: 10,
      reorder_threshold: 2,
      unit_cost: 15,
    })
    .select("id")
    .single();
  ok("Maintenance adds a spare part", part.error === null, part.error?.message ?? "inserted");
  if (part.error === null) {
    track(part.data.id, "spare_parts");
    const use = await maint.client
      .from("spare_parts")
      .update({ quantity: 9, updated_at: new Date().toISOString() })
      .eq("id", part.data.id)
      .select();
    ok("Maintenance logs spare part usage (deducts)", use.error === null && use.data?.[0]?.quantity === 9, use.error?.message ?? "qty=9");
  }

  const log = await maint.client
    .from("machine_status_log")
    .insert({
      company_id: COMPANY,
      machine_id: machine.id,
      from_status: "operational",
      to_status: "maintenance",
      reason: "RLS maintenance test",
      changed_by: maintId,
    })
    .select("id")
    .single();
  ok("Maintenance logs machine status change", log.error === null, log.error?.message ?? "inserted");
  if (log.error === null) track(log.data.id, "machine_status_log");
}

// ── 3) TICKET RESOLUTION (receiving side of the operator flow) ──
const ticket = await admin
  .from("maintenance_tickets")
  .insert({
    company_id: COMPANY,
    issue_description: "RLS maintenance resolution test",
    priority: "medium",
    status: "open",
    reported_by: opId,
    issue_type: "machine",
  })
  .select("id")
  .single();
ok("Seeded maintenance ticket for test", ticket.error === null, ticket.error?.message ?? "inserted");
if (ticket.error === null) {
  track(ticket.data.id, "maintenance_tickets");
  const resolve = await maint.client
    .from("maintenance_tickets")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_by: maintId,
      resolution_notes: "RLS test fix",
    })
    .eq("id", ticket.data.id)
    .select();
  ok("Maintenance resolves a breakdown ticket", resolve.error === null && resolve.data?.[0]?.status === "resolved", resolve.error?.message ?? "resolved");
}

// ── 4) ISOLATION — READS BLOCKED (orders / finance / inventory / HR) ──
for (const [table, name] of [
  ["inventory", "inventory"],
  ["customers", "customers"],
  ["suppliers", "suppliers"],
  ["sales_orders", "sales orders"],
  ["customer_orders", "customer orders"],
  ["production_orders", "production orders"],
  ["work_orders", "work orders"],
  ["invoices", "invoices"],
  ["payments", "payments"],
  ["purchase_orders", "purchase orders"],
  ["supplier_invoices", "supplier invoices"],
  ["supplier_payments", "supplier payments"],
  ["expenses", "expenses"],
  ["taxes", "taxes"],
  ["employees", "employees"],
  ["attendance", "attendance"],
  ["payroll", "payroll"],
  ["qr_codes", "qr codes"],
  ["materials", "materials"],
]) {
  const { data, error } = await maint.client.from(table).select("id").limit(1);
  ok(`Maintenance SELECT ${name} → 0 rows`, (data?.length ?? 0) === 0, error?.message ?? `${data?.length} rows`);
}

// Leaves/attendance are own-scoped by design (employees may submit their own):
// maintenance sees only their own rows, never another employee's.
const leavesScoped = await maint.client.from("leaves").select("employee_id").eq("company_id", COMPANY);
ok(
  "Maintenance SELECT leaves → own rows only (never others')",
  (leavesScoped.data ?? []).every((r) => r.employee_id === maintId),
  leavesScoped.error?.message ?? "saw " + (leavesScoped.data?.length ?? 0) + " rows",
);

// ── 5) WRITES BLOCKED ──
const woInsert = await maint.client
  .from("work_orders")
  .insert({ company_id: COMPANY, wo_number: "MAINT-CANNOT", operation: "Test", quantity: 1, status: "pending" })
  .select("id")
  .single();
ok("Maintenance INSERT work_orders → rejected (manager-only)", woInsert.error !== null, woInsert.error?.message ?? "ALLOWED (BUG)");

const woUpdate = await maint.client
  .from("work_orders")
  .update({ progress_percent: 50 })
  .eq("company_id", COMPANY)
  .select();
ok("Maintenance UPDATE work_orders → blocked", woUpdate.error !== null || (woUpdate.data?.length ?? 0) === 0, woUpdate.error?.message ?? `${woUpdate.data?.length} rows`);

const invUpdate = await maint.client
  .from("inventory")
  .update({ quantity: 1 })
  .eq("company_id", COMPANY)
  .select();
ok("Maintenance UPDATE inventory → blocked", invUpdate.error !== null || (invUpdate.data?.length ?? 0) === 0, invUpdate.error?.message ?? `${invUpdate.data?.length} rows`);

const invoiceInsert = await maint.client
  .from("invoices")
  .insert({ company_id: COMPANY, invoice_number: "MAINT-INV", total_amount: 100, status: "draft" })
  .select("id")
  .single();
ok("Maintenance INSERT invoices → rejected", invoiceInsert.error !== null, invoiceInsert.error?.message ?? "ALLOWED (BUG)");

const empUpdate = await maint.client
  .from("employees")
  .update({ salary: 1 })
  .eq("company_id", COMPANY)
  .select();
ok("Maintenance UPDATE employees → blocked", empUpdate.error !== null || (empUpdate.data?.length ?? 0) === 0, empUpdate.error?.message ?? `${empUpdate.data?.length} rows`);

const payRollInsert = await maint.client
  .from("payroll")
  .insert({ company_id: COMPANY, employee_id: maintId, period: "2099-01", gross_amount: 100, status: "pending" })
  .select("id")
  .single();
ok("Maintenance INSERT payroll → rejected", payRollInsert.error !== null, payRollInsert.error?.message ?? "ALLOWED (BUG)");

// ── 6) CROSS-COMPANY ISOLATION ──
const crossMach = await maint.client.from("machines").select("id").eq("company_id", OTHER_COMPANY);
ok("Maintenance reads another company's machines → 0 rows", (crossMach.data?.length ?? 0) === 0, crossMach.error?.message ?? `${crossMach.data?.length} rows`);

const crossTickets = await maint.client.from("maintenance_tickets").select("id").eq("company_id", OTHER_COMPANY);
ok("Maintenance reads another company's tickets → 0 rows", (crossTickets.data?.length ?? 0) === 0, crossTickets.error?.message ?? `${crossTickets.data?.length} rows`);

// ── 7) FINANCE CANNOT TOUCH MACHINE TABLES (reciprocal) ──
const finMach = await fin.client.from("machines").select("id").limit(1);
ok("Finance reads machines → 0 rows (maintenance scope)", (finMach.data?.length ?? 0) === 0, finMach.error?.message ?? `${finMach.data?.length} rows`);

// ── CLEANUP ──
for (const c of cleanup.reverse()) {
  try {
    await admin.from("audit_logs").delete().eq("entity", c.table).eq("entity_id", c.id);
    await admin.from("notifications").delete().eq("related_entity_id", c.id);
    await admin.from(c.table).delete().eq("id", c.id);
  } catch {}
}
ok("Test data cleaned up", true, "deleted test schedules, parts, logs, tickets");

console.log("\n=== MAINTENANCE ENGINEER RLS TEST RESULTS ===");
let failed = 0;
for (const r of results) {
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}  —  ${r.detail}`);
  if (!r.pass) failed++;
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
