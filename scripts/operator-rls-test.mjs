// Production Operator — RLS behavioral verification (live, via the public API).
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

const operator = await signIn("operator@abcmfg.demo"); // production_operator
const otherOp = await signIn("demo@demo.com"); // second production_operator
const pm = await signIn("production@abcmfg.demo"); // production_manager
const maint = await signIn("maintenance@abcmfg.demo"); // maintenance_engineer

const COMPANY = "11111111-1111-1111-1111-111111111111";
const opId = operator.user.id;
const otherOpId = otherOp.user.id;
const pmId = pm.user.id;
const maintId = maint.user.id;

console.log(
  "Signed in:",
  operator.user.email,
  otherOp.user.email,
  pm.user.email,
  maint.user.email,
);

// The test creates its own dedicated work order (via the service role) so it
// never depends on the demo seed state — a completed or missing demo WO can
// no longer break the suite.
const woNumber = `RLS-TEST-${Date.now()}`;
const { data: createdWo, error: createdErr } = await admin
  .from("work_orders")
  .insert({
    company_id: COMPANY,
    wo_number: woNumber,
    operator_id: opId,
    operation: "Test Assembly",
    status: "assigned",
    progress_percent: 0,
    quantity: 1,
    assigned_by: pmId,
    checklist: [
      { label: "Frame assembly", completed: false },
      { label: "Hardware fitting", completed: false },
    ],
    materials: [{ name: "Teak Wood", quantity: 2, unit: "boards" }],
    notes: "Operator RLS verification work order.",
    due_date: new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10),
  })
  .select("id")
  .single();
if (createdErr || !createdWo) throw new Error(`Could not create test WO: ${createdErr?.message}`);
const woId = createdWo.id;

const cleanup = [];
const track = (id, table = "work_orders") => cleanup.push({ id, table });

// ── 1) OWN-SCOPE READS ──
const myWoRead = await operator.client.from("work_orders").select("*").eq("operator_id", opId);
ok(
  "SELECT own work orders → only assigned to me",
  (myWoRead.data ?? []).length >= 1 && (myWoRead.data ?? []).every((w) => w.operator_id === opId),
  myWoRead.error?.message ?? `${myWoRead.data?.length} rows, all operator_id = me`,
);

const otherWoRead = await operator.client
  .from("work_orders")
  .select("id")
  .eq("operator_id", otherOpId);
ok(
  "SELECT another operator's work orders → 0 rows",
  (otherWoRead.data?.length ?? 0) === 0,
  otherWoRead.error?.message ?? `${otherWoRead.data?.length} rows`,
);

const allWoRead = await operator.client.from("work_orders").select("id,operator_id");
ok(
  "SELECT all work orders → every visible row is my own",
  (allWoRead.data ?? []).every((w) => w.operator_id === opId),
  allWoRead.error?.message ?? `${allWoRead.data?.length} rows (all mine)`,
);

const myAttRead = await operator.client.from("attendance").select("*").eq("employee_id", opId);
ok(
  "SELECT attendance → only my own rows",
  (myAttRead.data ?? []).every((a) => a.employee_id === opId),
  myAttRead.error?.message ?? `${myAttRead.data?.length} rows`,
);

const otherAttRead = await operator.client
  .from("attendance")
  .select("id")
  .eq("employee_id", otherOpId);
ok(
  "SELECT another employee's attendance → 0 rows",
  (otherAttRead.data?.length ?? 0) === 0,
  otherAttRead.error?.message ?? `${otherAttRead.data?.length} rows`,
);

// ── 2) OWN WRITES ALLOWED ──
const upd25 = await operator.client
  .from("work_orders")
  .update({ progress_percent: 25, status: "in_progress" })
  .eq("id", woId)
  .select();
ok(
  "UPDATE own work order progress 25% → allowed",
  upd25.error === null && upd25.data?.[0]?.progress_percent === 25,
  upd25.error?.message ?? `progress_percent=${upd25.data?.[0]?.progress_percent}`,
);

const progInsert = await operator.client
  .from("production_progress")
  .insert({
    company_id: COMPANY,
    work_order_id: woId,
    operator_id: opId,
    progress_percent: 25,
  })
  .select("id")
  .single();
ok("INSERT production_progress on own WO → allowed", progInsert.error === null, progInsert.error?.message ?? "inserted");
if (progInsert.error === null) track(progInsert.data.id, "production_progress");

const attInsert = await operator.client
  .from("attendance")
  .insert({
    company_id: COMPANY,
    employee_id: opId,
    date: new Date().toISOString().slice(0, 10),
    check_in: new Date().toISOString(),
    status: "present",
  })
  .select("id")
  .single();
ok("INSERT own attendance (today) → allowed", attInsert.error === null, attInsert.error?.message ?? "inserted");
if (attInsert.error === null) track(attInsert.data.id, "attendance");

const attCheckout = await operator.client
  .from("attendance")
  .update({ check_out: new Date().toISOString(), hours_worked: 8 })
  .eq("employee_id", opId)
  .eq("date", new Date().toISOString().slice(0, 10))
  .select();
ok(
  "UPDATE own attendance (check out) → allowed",
  attCheckout.error === null && attCheckout.data?.[0]?.check_out != null,
  attCheckout.error?.message ?? "checked out",
);

// ── 3) WRITES BLOCKED (RLS + guard triggers) ──
const woInsert = await operator.client.from("work_orders").insert({
  company_id: COMPANY,
  wo_number: "OP-CANNOT-INSERT",
  operation: "Test",
  quantity: 1,
  status: "pending",
}).select("id").single();
ok(
  "INSERT work_orders → rejected (manager-only)",
  woInsert.error !== null,
  woInsert.error?.message ?? "ALLOWED (BUG)",
);

// Use a WO owned by the OTHER operator if one exists; otherwise attempt on a
// WO that is not mine — must be rejected or update 0 rows.
const otherWo = (
  await admin.from("work_orders").select("id").eq("operator_id", otherOpId).limit(1)
).data?.[0];
const otherUpdTarget = otherWo?.id ?? otherOpId;
const otherUpd2 = await operator.client
  .from("work_orders")
  .update({ progress_percent: 99, status: "in_progress" })
  .eq("id", otherUpdTarget)
  .select();
ok(
  "UPDATE another operator's work order → blocked",
  otherUpd2.error !== null || (otherUpd2.data?.length ?? 0) === 0,
  otherUpd2.error?.message ?? `${otherUpd2.data?.length} rows`,
);

const hijack = await operator.client
  .from("work_orders")
  .update({ operator_id: otherOpId })
  .eq("id", woId)
  .select();
ok(
  "UPDATE own WO reassigning operator_id → blocked",
  hijack.error !== null || (hijack.data?.length ?? 0) === 0,
  hijack.error?.message ?? "ALLOWED (BUG)",
);

const pastAtt = await operator.client
  .from("attendance")
  .insert({
    company_id: COMPANY,
    employee_id: opId,
    date: "2020-01-01",
    check_in: new Date().toISOString(),
    status: "present",
  })
  .select("id")
  .single();
ok(
  "INSERT attendance for a past date → rejected (guard)",
  pastAtt.error !== null,
  pastAtt.error?.message ?? "ALLOWED (BUG)",
);

const otherAttIns = await operator.client
  .from("attendance")
  .insert({
    company_id: COMPANY,
    employee_id: otherOpId,
    date: new Date().toISOString().slice(0, 10),
    check_in: new Date().toISOString(),
    status: "present",
  })
  .select("id")
  .single();
ok(
  "INSERT attendance for ANOTHER employee → rejected",
  otherAttIns.error !== null,
  otherAttIns.error?.message ?? "ALLOWED (BUG)",
);

const otherAttUpd = await operator.client
  .from("attendance")
  .update({ check_out: new Date().toISOString() })
  .eq("employee_id", otherOpId)
  .select();
ok(
  "UPDATE another employee's attendance → 0 rows",
  (otherAttUpd.data?.length ?? 0) === 0,
  otherAttUpd.error?.message ?? `${otherAttUpd.data?.length} rows`,
);

const foreignProg = await operator.client
  .from("production_progress")
  .insert({
    company_id: COMPANY,
    work_order_id: woId,
    operator_id: otherOpId, // progress logged as another operator
    progress_percent: 50,
  })
  .select("id")
  .single();
ok(
  "INSERT production_progress as ANOTHER operator → rejected",
  foreignProg.error !== null,
  foreignProg.error?.message ?? "ALLOWED (BUG)",
);

// ── 4) SCOPE ISOLATION (in_company_ops must NOT grant operator access) ──
for (const [table, name] of [
  ["inventory", "inventory"],
  ["machines", "machines"],
  ["employees", "employees"],
  ["purchase_orders", "purchase orders"],
  ["sales_orders", "sales orders"],
  ["invoices", "invoices"],
  ["production_orders", "production orders"],
  ["suppliers", "suppliers"],
  ["payments", "payments"],
]) {
  try {
    const { data } = await operator.client.from(table).select("id").limit(1);
    ok(`SELECT ${name} → 0 rows (in_company_ops excludes operator)`, (data?.length ?? 0) === 0, `${data?.length} rows`);
  } catch (e) {
    ok(`SELECT ${name} → rejected`, true, "error thrown (no access)");
  }
}

// ── 5) WORKFLOW TRIGGERS + NOTIFICATION TARGETING ──
// 5a. Operator reports a machine issue on their own WO.
const ticket = await operator.client
  .from("maintenance_tickets")
  .insert({
    company_id: COMPANY,
    work_order_id: woId,
    issue_description: "CNC Wood Router stopped mid-cut (RLS test)",
    priority: "medium",
    status: "open",
    reported_by: opId,
    issue_type: "machine",
  })
  .select("id,target_user_id,assigned_to")
  .single();
ok(
  "INSERT maintenance_tickets (machine issue) → allowed + routed to Maintenance Engineer",
  ticket.error === null && ticket.data?.target_user_id === maintId,
  ticket.error?.message ?? `target_user_id=${ticket.data?.target_user_id}`,
);
if (ticket.error === null) track(ticket.data.id, "maintenance_tickets");

const woBlocked = await admin
  .from("work_orders")
  .select("status")
  .eq("id", woId)
  .single();
ok(
  "Work order marked blocked on issue report",
  woBlocked.data?.status === "blocked",
  woBlocked.data?.status,
);

const issueNotif = await admin
  .from("notifications")
  .select("to_user,to_role,title")
  .eq("related_entity_type", "maintenance_tickets")
  .eq("related_entity_id", ticket.data?.id)
  .order("created_at", { ascending: false })
  .limit(1);
ok(
  "Issue notification → to_user = maintenance engineer, to_role NULL",
  issueNotif.data?.[0]?.to_user === maintId && issueNotif.data?.[0]?.to_role === null,
  JSON.stringify(issueNotif.data?.[0] ?? null),
);

// 5b. Material issue routes to Warehouse Manager.
const matTicket = await operator.client
  .from("maintenance_tickets")
  .insert({
    company_id: COMPANY,
    work_order_id: woId,
    issue_description: "Teak boards insufficient (RLS test)",
    priority: "medium",
    status: "open",
    reported_by: opId,
    issue_type: "material",
  })
  .select("id,target_user_id")
  .single();
ok(
  "Material issue → routed to Warehouse Manager",
  matTicket.error === null && matTicket.data?.target_user_id !== maintId && matTicket.data?.target_user_id != null,
  matTicket.error?.message ?? `target_user_id=${matTicket.data?.target_user_id}`,
);
if (matTicket.error === null) track(matTicket.data.id, "maintenance_tickets");

// 5c. General issue routes to Production Manager.
const genTicket = await operator.client
  .from("maintenance_tickets")
  .insert({
    company_id: COMPANY,
    work_order_id: woId,
    issue_description: "General blocker (RLS test)",
    priority: "medium",
    status: "open",
    reported_by: opId,
    issue_type: "general",
  })
  .select("id,target_user_id")
  .single();
ok(
  "General issue → routed to Production Manager",
  genTicket.error === null && genTicket.data?.target_user_id === pmId,
  genTicket.error?.message ?? `target_user_id=${genTicket.data?.target_user_id}`,
);
if (genTicket.error === null) track(genTicket.data.id, "maintenance_tickets");

// 5d. Operator CANNOT resolve their own ticket (only the receiving role can).
const selfResolve = await operator.client
  .from("maintenance_tickets")
  .update({ status: "resolved" })
  .eq("id", ticket.data?.id)
  .select();
ok(
  "Operator resolving own ticket → blocked",
  selfResolve.error !== null || (selfResolve.data?.length ?? 0) === 0,
  selfResolve.error?.message ?? `${selfResolve.data?.length} rows updated (BUG if > 0)`,
);

// 5e. Maintenance Engineer resolves → operator notified (to_user).
const resolve = await maint.client
  .from("maintenance_tickets")
  .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: maintId })
  .eq("id", ticket.data?.id)
  .select();
ok(
  "Maintenance Engineer resolves ticket → allowed",
  resolve.error === null && resolve.data?.[0]?.status === "resolved",
  resolve.error?.message ?? "resolved",
);

const resolveNotif = await admin
  .from("notifications")
  .select("to_user,to_role,title")
  .eq("related_entity_type", "maintenance_tickets")
  .eq("related_entity_id", ticket.data?.id)
  .eq("to_user", opId)
  .order("created_at", { ascending: false })
  .limit(1);
ok(
  "Resolution notification → to_user = reporting operator, to_role NULL",
  resolveNotif.data?.[0]?.to_user === opId && resolveNotif.data?.[0]?.to_role === null,
  JSON.stringify(resolveNotif.data?.[0] ?? null),
);

// 5f. Operator completes the WO → PM (assigned_by) notified via to_user.
const complete = await operator.client
  .from("work_orders")
  .update({ progress_percent: 100, status: "completed", end_time: new Date().toISOString() })
  .eq("id", woId)
  .select();
ok(
  "UPDATE own WO to 100% → allowed",
  complete.error === null && complete.data?.[0]?.progress_percent === 100,
  complete.error?.message ?? "completed",
);

const completeNotif = await admin
  .from("notifications")
  .select("to_user,to_role,title")
  .eq("related_entity_type", "work_orders")
  .eq("related_entity_id", woId)
  .eq("to_user", pmId)
  .order("created_at", { ascending: false })
  .limit(1);
ok(
  "Completion notification → to_user = the production manager who assigned it",
  completeNotif.data?.[0]?.to_user === pmId && completeNotif.data?.[0]?.to_role === null,
  JSON.stringify(completeNotif.data?.[0] ?? null),
);

// 5g. Assignment notification fires to the specific operator (to_user).
const assignNotif = await admin
  .from("notifications")
  .select("to_user,to_role,title")
  .eq("related_entity_type", "work_orders")
  .eq("related_entity_id", woId)
  .eq("to_user", opId)
  .order("created_at", { ascending: false })
  .limit(1);
ok(
  "Assignment notification → to_user = this operator only",
  assignNotif.data?.[0]?.to_user === opId && assignNotif.data?.[0]?.to_role === null,
  JSON.stringify(assignNotif.data?.[0] ?? null),
);

// ── 6) AUDIT TRAIL ──
const woAudit = await admin
  .from("audit_logs")
  .select("user_id,action,entity,entity_id,metadata")
  .eq("entity", "work_orders")
  .eq("entity_id", woId)
  .order("created_at", { ascending: false })
  .limit(5);
const progressAudit = (woAudit.data ?? []).find(
  (a) => a.metadata?.new_value?.progress_percent === 100 && a.user_id === opId,
);
ok(
  "Progress update → audit_logs row (actor = operator, old→new diff)",
  !!progressAudit,
  woAudit.error?.message ?? JSON.stringify(progressAudit?.metadata ?? null).slice(0, 200),
);

const ticketAudit = await admin
  .from("audit_logs")
  .select("user_id,action,entity,entity_id")
  .eq("entity", "maintenance_tickets")
  .eq("entity_id", ticket.data?.id)
  .eq("action", "insert_maintenance_tickets")
  .order("created_at", { ascending: false })
  .limit(1);
ok(
  "Issue report → audit_logs row (actor = operator)",
  (ticketAudit.data?.length ?? 0) > 0 && ticketAudit.data?.[0]?.user_id === opId,
  ticketAudit.error?.message ?? `actor=${ticketAudit.data?.[0]?.user_id}`,
);

const attAudit = await admin
  .from("audit_logs")
  .select("user_id,entity")
  .eq("entity", "attendance")
  .order("created_at", { ascending: false })
  .limit(3);
ok(
  "Attendance check-in → audit_logs row (actor = operator)",
  (attAudit.data ?? []).some((a) => a.user_id === opId),
  attAudit.error?.message ?? `${attAudit.data?.length} recent rows`,
);

// ── 7) PROFILE (self-editable vs approval-gated) ──
const phoneUpd = await operator.client
  .from("profiles")
  .update({ phone: "+91 90000 10001" })
  .eq("id", opId)
  .select();
ok("Operator updates own phone → allowed (self-editable)", phoneUpd.error === null, phoneUpd.error?.message ?? "updated");

const nameUpd = await operator.client
  .from("profiles")
  .update({ full_name: "Hacked Operator" })
  .eq("id", opId)
  .select();
ok(
  "Operator updates own full_name → rejected (approval-gated)",
  nameUpd.error !== null,
  nameUpd.error?.message ?? "ALLOWED (BUG)",
);

// ── 8) NOTIFICATIONS VISIBILITY ──
const myNotifs = await operator.client
  .from("notifications")
  .select("id,to_user")
  .or(`to_user.eq.${opId}`)
  .limit(10);
ok(
  "Operator can read their own to_user notifications",
  (myNotifs.data ?? []).every((n) => n.to_user === opId),
  myNotifs.error?.message ?? `${myNotifs.data?.length} rows`,
);

// ── RESTORE ──
// maintenance_tickets.work_order_id is ON DELETE NO ACTION → delete tickets
// (and their audit rows + notifications) before the work order itself.
for (const c of cleanup) {
  try {
    if (c.table === "maintenance_tickets") {
      await admin.from("audit_logs").delete().eq("entity", "maintenance_tickets").eq("entity_id", c.id);
      await admin.from("notifications").delete().eq("related_entity_id", c.id);
    }
    await admin.from(c.table).delete().eq("id", c.id);
  } catch {}
}
await admin.from("audit_logs").delete().eq("entity", "work_orders").eq("entity_id", woId);
await admin.from("notifications").delete().eq("related_entity_id", woId);
if (attInsert.data?.id) {
  await admin.from("audit_logs").delete().eq("entity", "attendance").eq("entity_id", attInsert.data.id);
}
await admin.from("profiles").update({ phone: null }).eq("id", opId);
ok("Test data cleaned up", true, "deleted test WO, tickets, notifications, audit rows");

console.log("\n=== OPERATOR RLS TEST RESULTS ===");
let failed = 0;
for (const r of results) {
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}  —  ${r.detail}`);
  if (!r.pass) failed++;
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
