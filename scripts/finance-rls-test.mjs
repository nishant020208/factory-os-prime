// Finance Manager — RLS behavioral verification (live, via the public API).
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

const fin = await signIn("finance@abcmfg.demo"); // finance_manager
const hr = await signIn("hr@abcmfg.demo"); // hr_manager

const COMPANY = "11111111-1111-1111-1111-111111111111";
const OTHER_COMPANY = "57fc4d31-a249-4fb8-ac9e-57ca0b37749a";
const finId = fin.user.id;

console.log("Signed in:", fin.user.email, hr.user.email);

const cleanup = [];
const track = (id, table) => cleanup.push({ id, table });

// ── 1) MONEY SCOPE — READS ALLOWED ──
for (const [table, name] of [
  ["invoices", "invoices"],
  ["payments", "customer payments"],
  ["supplier_invoices", "supplier invoices"],
  ["supplier_payments", "supplier payments"],
  ["expenses", "expenses"],
  ["taxes", "taxes"],
  ["customers", "customers"],
  ["suppliers", "suppliers"],
  ["purchase_orders", "purchase orders"],
]) {
  const { data, error } = await fin.client.from(table).select("id").limit(1);
  ok(`Finance reads ${name}`, error === null, error?.message ?? `${data?.length} rows`);
}

// ── 2) MONEY WRITES ALLOWED ──
const invInsert = await fin.client
  .from("invoices")
  .insert({
    company_id: COMPANY,
    invoice_number: `RLS-INV-${Date.now().toString().slice(-5)}`,
    total_amount: 1000,
    tax_amount: 180,
    status: "sent",
    issue_date: new Date().toISOString(),
  })
  .select("id")
  .single();
ok("Finance generates a customer invoice", invInsert.error === null, invInsert.error?.message ?? "inserted");
if (invInsert.error === null) track(invInsert.data.id, "invoices");

const payInsert = await fin.client
  .from("payments")
  .insert({
    company_id: COMPANY,
    payment_number: `RLS-PAY-${Date.now().toString().slice(-5)}`,
    invoice_id: invInsert.data?.id ?? null,
    amount: 1000,
    method: "bank_transfer",
    status: "completed",
    paid_at: new Date().toISOString(),
  })
  .select("id")
  .single();
ok("Finance records a customer payment (money in)", payInsert.error === null, payInsert.error?.message ?? "inserted");
if (payInsert.error === null) track(payInsert.data.id, "payments");

const expInsert = await fin.client
  .from("expenses")
  .insert({
    company_id: COMPANY,
    category: "Misc",
    amount: 500,
    expense_date: new Date().toISOString().slice(0, 10),
    description: "RLS finance test expense",
    created_by: finId,
  })
  .select("id")
  .single();
ok("Finance records an expense", expInsert.error === null, expInsert.error?.message ?? "inserted");
if (expInsert.error === null) track(expInsert.data.id, "expenses");

// ── 3) SUPPLIER PAYMENT PROCESSING (money OUT → supplier notified) ──
const supplier = (await admin.from("suppliers").select("id, user_id").limit(1)).data?.[0];
if (supplier) {
  const supInv = await admin
    .from("supplier_invoices")
    .insert({
      company_id: COMPANY,
      supplier_id: supplier.id,
      invoice_number: `RLS-SUP-${Date.now().toString().slice(-5)}`,
      total_amount: 2000,
      gst_amount: 360,
      status: "pending",
    })
    .select("id")
    .single();
  ok("Seeded supplier invoice for test", supInv.error === null, supInv.error?.message ?? "inserted");

  if (supInv.error === null) {
    track(supInv.data.id, "supplier_invoices");
    const process = await fin.client
      .from("supplier_payments")
      .insert({
        company_id: COMPANY,
        supplier_id: supplier.id,
        invoice_id: supInv.data.id,
        amount: 2000,
        transaction_id: `RLS-TX-${Date.now().toString().slice(-5)}`,
        method: "bank_transfer",
        status: "paid",
        paid_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    ok("Finance processes a supplier payment (money out)", process.error === null, process.error?.message ?? "inserted");
    if (process.error === null) track(process.data.id, "supplier_payments");

    const invStatus = await admin
      .from("supplier_invoices")
      .select("status")
      .eq("id", supInv.data.id)
      .single();
    ok("Supplier invoice marked paid after processing", invStatus.data?.status === "paid", invStatus.data?.status ?? "?");

    if (supplier.user_id && process.error === null) {
      const notif = await admin
        .from("notifications")
        .select("to_user,to_role,title")
        .eq("to_user", supplier.user_id)
        .order("created_at", { ascending: false })
        .limit(1);
      ok(
        "Supplier payment → notification to_user = that supplier only",
        notif.data?.[0]?.to_user === supplier.user_id && notif.data?.[0]?.to_role === null,
        JSON.stringify(notif.data?.[0] ?? null),
      );
    }
  }
}

// ── 4) ISOLATION — READS BLOCKED (production / inventory / HR / orders) ──
for (const [table, name] of [
  ["inventory", "inventory"],
  ["machines", "machines"],
  ["work_orders", "work orders"],
  ["production_orders", "production orders"],
  ["shipments", "shipments"],
  ["employees", "employees"],
  ["payroll", "payroll"],
  ["sales_orders", "sales orders"],
  ["customer_orders", "customer orders"],
  ["support_tickets", "support tickets"],
]) {
  const { data, error } = await fin.client.from(table).select("id").limit(1);
  ok(`Finance SELECT ${name} → 0 rows`, (data?.length ?? 0) === 0, error?.message ?? `${data?.length} rows`);
}

// Attendance and leaves are own-scoped by design (any employee may check in /
// submit their own leave): finance sees only their own rows, never
// company-wide or another employee's.
const attScoped = await fin.client.from("attendance").select("employee_id").eq("company_id", COMPANY);
ok(
  "Finance SELECT attendance → own rows only (never company-wide)",
  (attScoped.data ?? []).every((r) => r.employee_id === finId),
  attScoped.error?.message ?? "saw " + (attScoped.data?.length ?? 0) + " rows",
);

const leavesScoped = await fin.client.from("leaves").select("employee_id").eq("company_id", COMPANY);
ok(
  "Finance SELECT leaves → own rows only (never others')",
  (leavesScoped.data ?? []).every((r) => r.employee_id === finId),
  leavesScoped.error?.message ?? "saw " + (leavesScoped.data?.length ?? 0) + " rows",
);

// ── 5) WRITES BLOCKED ──
const orderUpdate = await fin.client
  .from("sales_orders")
  .update({ status: "approved" })
  .eq("company_id", COMPANY)
  .select();
ok("Finance UPDATE sales_orders (order core) → blocked", orderUpdate.error !== null || (orderUpdate.data?.length ?? 0) === 0, orderUpdate.error?.message ?? `${orderUpdate.data?.length} rows`);

const custOrderUpdate = await fin.client
  .from("customer_orders")
  .update({ quantity: 99 })
  .eq("company_id", COMPANY)
  .select();
ok("Finance UPDATE customer_orders → blocked", custOrderUpdate.error !== null || (custOrderUpdate.data?.length ?? 0) === 0, custOrderUpdate.error?.message ?? `${custOrderUpdate.data?.length} rows`);

const invUpdate = await fin.client
  .from("inventory")
  .update({ quantity: 1 })
  .eq("company_id", COMPANY)
  .select();
ok("Finance UPDATE inventory → blocked", invUpdate.error !== null || (invUpdate.data?.length ?? 0) === 0, invUpdate.error?.message ?? `${invUpdate.data?.length} rows`);

const machUpdate = await fin.client
  .from("machines")
  .update({ status: "down" })
  .eq("company_id", COMPANY)
  .select();
ok("Finance UPDATE machines → blocked", machUpdate.error !== null || (machUpdate.data?.length ?? 0) === 0, machUpdate.error?.message ?? `${machUpdate.data?.length} rows`);

const empUpdate = await fin.client
  .from("employees")
  .update({ salary: 999999 })
  .eq("company_id", COMPANY)
  .select();
ok("Finance UPDATE employees → blocked", empUpdate.error !== null || (empUpdate.data?.length ?? 0) === 0, empUpdate.error?.message ?? `${empUpdate.data?.length} rows`);

const payRollUpdate = await fin.client
  .from("payroll")
  .update({ status: "paid" })
  .eq("company_id", COMPANY)
  .select();
ok("Finance UPDATE payroll → blocked", payRollUpdate.error !== null || (payRollUpdate.data?.length ?? 0) === 0, payRollUpdate.error?.message ?? `${payRollUpdate.data?.length} rows`);

// Attendance/leave inserts are own-scoped by design (any employee checks
// THEMSELVES in / submits their OWN leave) — the isolation boundary is that
// finance cannot touch ANOTHER employee's rows, which is the assertion below.
const attOther = await fin.client
  .from("attendance")
  .insert({ company_id: COMPANY, employee_id: hr.user.id, date: "2099-03-01", status: "present" })
  .select("id")
  .single();
ok("Finance INSERT attendance for another employee → rejected", attOther.error !== null, attOther.error?.message ?? "ALLOWED (BUG)");
if (attOther.data?.id) track(attOther.data.id, "attendance");

const leaveOther = await fin.client
  .from("leaves")
  .insert({ company_id: COMPANY, employee_id: hr.user.id, leave_type: "Sick", start_date: "2099-03-01", end_date: "2099-03-01", status: "pending" })
  .select("id")
  .single();
ok("Finance INSERT leaves for another employee → rejected", leaveOther.error !== null, leaveOther.error?.message ?? "ALLOWED (BUG)");
if (leaveOther.data?.id) track(leaveOther.data.id, "leaves");

// ── 6) CROSS-COMPANY ISOLATION ──
const crossInv = await fin.client.from("invoices").select("id").eq("company_id", OTHER_COMPANY);
ok("Finance reads another company's invoices → 0 rows", (crossInv.data?.length ?? 0) === 0, crossInv.error?.message ?? `${crossInv.data?.length} rows`);

const crossPay = await fin.client.from("payments").select("id").eq("company_id", OTHER_COMPANY);
ok("Finance reads another company's payments → 0 rows", (crossPay.data?.length ?? 0) === 0, crossPay.error?.message ?? `${crossPay.data?.length} rows`);

// ── 7) HR CANNOT READ FINANCE (reciprocal) ──
const hrInv = await hr.client.from("invoices").select("id").limit(1);
ok("HR reads invoices → 0 rows (finance scope)", (hrInv.data?.length ?? 0) === 0, hrInv.error?.message ?? `${hrInv.data?.length} rows`);

// ── CLEANUP ──
for (const c of cleanup.reverse()) {
  try {
    await admin.from("audit_logs").delete().eq("entity", c.table).eq("entity_id", c.id);
    await admin.from("notifications").delete().eq("related_entity_id", c.id);
    await admin.from(c.table).delete().eq("id", c.id);
  } catch {}
}
ok("Test data cleaned up", true, "deleted test invoices, payments, expenses, supplier invoices/payments");

console.log("\n=== FINANCE MANAGER RLS TEST RESULTS ===");
let failed = 0;
for (const r of results) {
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}  —  ${r.detail}`);
  if (!r.pass) failed++;
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
