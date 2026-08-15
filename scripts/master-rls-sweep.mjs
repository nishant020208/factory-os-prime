// Master RLS sweep: for every one of the 15 roles, attempt one illegal
// cross-role write and one illegal cross-company read, live against the API.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const txt = readFileSync(".env.local", "utf8");
const get = (k) => {
  const m = new RegExp(`^${k}=(.*)$`, "m").exec(txt);
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
};
const url = get("SUPABASE_URL");
const key = get("SUPABASE_PUBLISHABLE_KEY");
const admin = createClient(url, get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const COMPANY = "11111111-1111-1111-1111-111111111111"; // demo tenant (all demo roles belong here)
const OTHER = "57fc4d31-a249-4fb8-ac9e-57ca0b37749a"; // Verified Test Corp (active, separate tenant)

async function signIn(email) {
  const c = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: "Factory@2026" });
  if (error) throw new Error(`${email} sign-in failed: ${error.message}`);
  return { client: c, user: data.user };
}

// A write "succeeds" if it returns an error OR updates/inserts 0 rows (RLS filter).
const blocked = (res) => res.error !== null || (res.data?.length ?? 1) === 0;

const rows = [];
async function probe(role, email, writeName, writeFn, readTable) {
  const s = await signIn(email);
  const w = await writeFn(s);
  const wBlocked = blocked(w);
  const r = await s.client.from(readTable).select("id").eq("company_id", OTHER).limit(1);
  const rBlocked = (r.data?.length ?? 0) === 0;
  rows.push({ role, write: writeName, writeBlocked: wBlocked, writeDetail: w.error?.message ?? `${w.data?.length ?? 0} rows`, read: `cross-tenant ${readTable}`, readBlocked: rBlocked });
  return { wBlocked, rBlocked };
}

const ops = {
  root_super_admin: async (s) => s.client.from("work_orders").insert({ company_id: COMPANY, status: "pending" }).select("id"),
  company_admin: async (s) => s.client.from("work_orders").update({ progress: 100 }).eq("company_id", COMPANY).select("id"),
  plant_admin: async (s) => s.client.from("work_orders").insert({ company_id: COMPANY, status: "pending" }).select("id"),
  plant_manager: async (s) => s.client.from("work_orders").update({ progress: 99 }).eq("company_id", COMPANY).select("id"),
  production_manager: async (s) => s.client.from("inventory").update({ quantity: 1 }).eq("company_id", COMPANY).select("id"),
  warehouse_manager: async (s) => s.client.from("purchase_orders").insert({ company_id: COMPANY, status: "draft", supplier_id: null, expected_date: null }).select("id"),
  procurement_manager: async (s) => s.client.from("sales_orders").update({ status: "approved" }).eq("company_id", COMPANY).select("id"),
  quality_inspector: async (s) => s.client.from("inventory").insert({ company_id: COMPANY, name: "Q-PROBE", quantity: 1, unit: "u", reorder_threshold: 0 }).select("id"),
  maintenance_engineer: async (s) => s.client.from("work_orders").update({ progress: 50 }).eq("company_id", COMPANY).select("id"),
  finance_manager: async (s) => s.client.from("inventory").update({ quantity: 2 }).eq("company_id", COMPANY).select("id"),
  hr_manager: async (s) => s.client.from("work_orders").update({ progress: 10 }).eq("company_id", COMPANY).select("id"),
  production_operator: async (s) => s.client.from("work_orders").insert({ company_id: COMPANY, status: "pending" }).select("id"),
  customer: async (s) => s.client.from("work_orders").insert({ company_id: COMPANY, status: "pending" }).select("id"),
  supplier: async (s) => s.client.from("inventory").update({ quantity: 3 }).eq("company_id", COMPANY).select("id"),
  auditor: async (s) => s.client.from("inventory").update({ quantity: 4 }).eq("company_id", COMPANY).select("id"),
};

const readTables = {
  root_super_admin: "sales_orders",
  company_admin: "sales_orders",
  plant_admin: "departments",
  plant_manager: "work_orders",
  production_manager: "work_orders",
  warehouse_manager: "inventory",
  procurement_manager: "purchase_orders",
  quality_inspector: "quality_inspections",
  maintenance_engineer: "maintenance_tickets",
  finance_manager: "invoices",
  hr_manager: "employees",
  production_operator: "work_orders",
  customer: "sales_orders",
  supplier: "purchase_orders",
  auditor: "audit_logs",
};

const accounts = {
  root_super_admin: "root@factoryos.demo",
  company_admin: "admin@abcmfg.demo",
  plant_admin: "plantadmin@abcmfg.demo",
  plant_manager: "plantmanager@abcmfg.demo",
  production_manager: "production@abcmfg.demo",
  warehouse_manager: "warehouse@abcmfg.demo",
  procurement_manager: "procurement@abcmfg.demo",
  quality_inspector: "quality@abcmfg.demo",
  maintenance_engineer: "maintenance@abcmfg.demo",
  finance_manager: "finance@abcmfg.demo",
  hr_manager: "hr@abcmfg.demo",
  production_operator: "operator@abcmfg.demo",
  customer: "customer@abcmfg.demo",
  supplier: "supplier@abcmfg.demo",
  auditor: "auditor@abcmfg.demo",
};

for (const [role, email] of Object.entries(accounts)) {
  try {
    await probe(role, email, `illegal ${role} write`, ops[role], readTables[role]);
  } catch (e) {
    rows.push({ role, write: "sign-in/probe", writeBlocked: false, writeDetail: e.message, read: "-", readBlocked: false });
  }
}

console.log("\n===== MASTER RLS SWEEP — 15 ROLES =====");
console.log("ROLE".padEnd(22), "WRITE".padEnd(32), "W-BLOCK".padEnd(8), "READ(BLOCK)".padEnd(12));
for (const r of rows) {
  const w = r.writeBlocked ? "✔" : "✘";
  const rd = r.readBlocked ? "✔" : "✘";
  console.log(r.role.padEnd(22), (r.writeDetail || r.write).slice(0, 30).padEnd(32), w.padEnd(8), rd.padEnd(12), r.read);
}
const fails = rows.filter((r) => !r.writeBlocked || !r.readBlocked);
console.log(`\n${rows.length - fails.length}/${rows.length} roles fully isolated (${fails.length} failure${fails.length === 1 ? "" : "s"})`);
for (const f of fails) console.log("  FAIL:", f.role, f.write, f.writeDetail);
process.exit(fails.length > 0 ? 1 : 0);
