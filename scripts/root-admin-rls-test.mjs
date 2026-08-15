// Root Super Admin — RLS behavioral verification (live, via the public API).
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

const root = await signIn("root@factoryos.demo"); // root_super_admin

const COMPANY = "11111111-1111-1111-1111-111111111111";

console.log("Signed in:", root.user.email);

const cleanup = [];
const track = (id, table) => cleanup.push({ id, table });

// ── 1) ROOT READS — platform-wide visibility ──
for (const [table, name] of [
  ["companies", "all companies"],
  ["audit_logs", "audit logs"],
  ["whitelist", "whitelist"],
  ["user_roles", "user roles"],
  ["profiles", "profiles"],
  ["platform_settings", "platform settings"],
  ["company_registrations", "company registrations"],
]) {
  const { data, error } = await root.client.from(table).select("id").limit(1);
  ok(`Root reads ${name}`, error === null, error?.message ?? `${data?.length} rows`);
}

// Root also reads operational tables for oversight (SELECT only)
for (const [table, name] of [
  ["sales_orders", "sales orders"],
  ["work_orders", "work orders"],
  ["inventory", "inventory"],
  ["invoices", "invoices"],
  ["employees", "employees"],
  ["production_orders", "production orders"],
  ["purchase_orders", "purchase orders"],
  ["attendance", "attendance"],
  ["payroll", "payroll"],
  ["machines", "machines"],
  ["quality_inspections", "quality inspections"],
]) {
  const { data, error } = await root.client.from(table).select("id").limit(1);
  ok(`Root reads ${name} (oversight)`, error === null, error?.message ?? `${data?.length} rows`);
}

// ── 2) ROOT WRITES — platform-level actions only ──
// 2a. Create a company (platform record)
const co = await root.client
  .from("companies")
  .insert({
    name: `RLS Root Test Co ${Date.now()}`,
    legal_name: "RLS Root Test Co",
    country: "US",
    status: "active",
  })
  .select("id")
  .single();
ok("Root creates a company (platform record)", co.error === null && !!co.data?.id, co.error?.message ?? "inserted");
if (co.data?.id) track(co.data.id, "companies");

// 2b. Whitelist a Company Admin for it
const wl = await root.client
  .from("whitelist")
  .insert({
    email: `root-ca-${Date.now()}@rls.demo`,
    role: "company_admin",
    company_id: co.data?.id ?? null,
    status: "pending",
  })
  .select("id")
  .single();
ok("Root whitelists the initial Company Admin", wl.error === null && !!wl.data?.id, wl.error?.message ?? "inserted");
if (wl.data?.id) track(wl.data.id, "whitelist");

// 2c. CANNOT whitelist a non-Company-Admin role into another company
const wlOp = await root.client
  .from("whitelist")
  .insert({ email: "root-op@rls.demo", role: "production_operator", company_id: COMPANY, status: "pending" })
  .select("id");
ok(
  "Root CANNOT whitelist a non-Company-Admin role into an existing company",
  wlOp.error !== null,
  wlOp.error?.message ?? "ALLOWED (BUG)",
);

// ── 3) ROOT NO-OPERATIONAL-WRITE BOUNDARY (the highest-risk check) ──
const so = (await admin.from("sales_orders").select("id").eq("company_id", COMPANY).limit(1).maybeSingle()).data;
if (so) {
  const soUpd = await root.client.from("sales_orders").update({ progress: 99 }).eq("id", so.id).select("id");
  ok(
    "Root CANNOT update a tenant sales order",
    soUpd.error !== null || (soUpd.data?.length ?? 0) === 0,
    soUpd.error?.message ?? `${soUpd.data?.length ?? 0} rows updated — ALLOWED (BUG)`,
  );
} else {
  ok("Root CANNOT update a tenant sales order", true, "no sales order (skipped)");
}

const wo = (await admin.from("work_orders").select("id").eq("company_id", COMPANY).limit(1).maybeSingle()).data;
if (wo) {
  const woUpd = await root.client.from("work_orders").update({ status: "completed" }).eq("id", wo.id).select("id");
  ok(
    "Root CANNOT update a tenant work order",
    woUpd.error !== null || (woUpd.data?.length ?? 0) === 0,
    woUpd.error?.message ?? `${woUpd.data?.length ?? 0} rows updated — ALLOWED (BUG)`,
  );
} else {
  ok("Root CANNOT update a tenant work order", true, "no work order (skipped)");
}

const inv = (await admin.from("inventory").select("id").eq("company_id", COMPANY).limit(1).maybeSingle()).data;
if (inv) {
  const invUpd = await root.client.from("inventory").update({ quantity: 9999 }).eq("id", inv.id).select("id");
  ok(
    "Root CANNOT edit tenant inventory",
    invUpd.error !== null || (invUpd.data?.length ?? 0) === 0,
    invUpd.error?.message ?? `${invUpd.data?.length ?? 0} rows updated — ALLOWED (BUG)`,
  );
} else {
  ok("Root CANNOT edit tenant inventory", true, "no inventory (skipped)");
}

const emp = (await admin.from("employees").select("id").eq("company_id", COMPANY).limit(1).maybeSingle()).data;
if (emp) {
  const empUpd = await root.client.from("employees").update({ salary: 1 }).eq("id", emp.id).select("id");
  ok(
    "Root CANNOT edit tenant employee records",
    empUpd.error !== null || (empUpd.data?.length ?? 0) === 0,
    empUpd.error?.message ?? `${empUpd.data?.length ?? 0} rows updated — ALLOWED (BUG)`,
  );
} else {
  ok("Root CANNOT edit tenant employee records", true, "no employee (skipped)");
}

const invc = (await admin.from("invoices").select("id").eq("company_id", COMPANY).limit(1).maybeSingle()).data;
if (invc) {
  const invcUpd = await root.client.from("invoices").update({ status: "paid" }).eq("id", invc.id).select("id");
  ok(
    "Root CANNOT edit tenant invoices",
    invcUpd.error !== null || (invcUpd.data?.length ?? 0) === 0,
    invcUpd.error?.message ?? `${invcUpd.data?.length ?? 0} rows updated — ALLOWED (BUG)`,
  );
} else {
  ok("Root CANNOT edit tenant invoices", true, "no invoice (skipped)");
}

// Direct INSERT attempts into operational tables must fail
const insWO = await root.client.from("work_orders").insert({ company_id: COMPANY, status: "pending" }).select("id");
ok("Root CANNOT insert a work order", insWO.error !== null, insWO.error?.message ?? "ALLOWED (BUG)");
const insMach = await root.client.from("machines").insert({ company_id: COMPANY, name: "ROOT M", code: "R1" }).select("id");
ok("Root CANNOT insert a machine into a tenant", insMach.error !== null, insMach.error?.message ?? "ALLOWED (BUG)");

// ── 4) ROOT PROFILE — self-edit allowed (no approver above) AND audited ──
const rootProfile = (await admin.from("profiles").select("id, full_name, phone").eq("id", root.user.id).maybeSingle()).data;
if (rootProfile) {
  const before = rootProfile.phone;
  const upd = await root.client
    .from("profiles")
    .update({ phone: before === "555-ROOT-TEST" ? null : "555-ROOT-TEST" })
    .eq("id", root.user.id)
    .select("id, phone");
  ok("Root self-edits own profile (no approver above)", upd.error === null, upd.error?.message ?? "updated");
  if (upd.error === null) {
    const { data: audit } = await admin
      .from("audit_logs")
      .select("id, user_id, action, metadata")
      .eq("user_id", root.user.id)
      .eq("entity", "profiles")
      .order("created_at", { ascending: false })
      .limit(1);
    ok(
      "Root's own profile write is captured in audit_logs (gap closed)",
      (audit?.length ?? 0) > 0,
      audit?.length ? `audit id=${audit[0].id} action=${audit[0].action}` : "NO AUDIT ROW (BUG)",
    );
    // restore
    await admin.from("profiles").update({ phone: before }).eq("id", root.user.id);
  }
} else {
  ok("Root self-edits own profile (no approver above)", true, "no root profile (skipped)");
  ok("Root's own profile write is captured in audit_logs (gap closed)", true, "skipped");
}

// ── 5) NOTIFICATIONS — Root receives ONLY company-registration events ──
const { data: rootNotifs } = await admin
  .from("notifications")
  .select("id, to_role, to_user, title, related_entity_type")
  .eq("to_role", "root_super_admin")
  .order("created_at", { ascending: false })
  .limit(50);
const nonRegistration = (rootNotifs ?? []).filter(
  (n) => n.related_entity_type !== "company_registrations" && !n.title?.includes("Registration") && !n.title?.includes("Company"),
);
ok(
  "Root's role-targeted notifications are company-registration events only",
  nonRegistration.length === 0,
  nonRegistration.length ? `found ${nonRegistration.length} other type(s)` : `${rootNotifs?.length ?? 0} notifications, all registration-related`,
);

// ── SUMMARY ──
const fails = results.filter((r) => !r.pass);
console.log(`\nROOT ADMIN: ${results.length - fails.length}/${results.length} passed, ${fails.length} failed`);
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
