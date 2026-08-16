// Probe: live state of Bug 1 (profile change request approval) + Bug 5 (currency).
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
const serviceKey = (() => {
  const m = /^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m.exec(readFileSync(".env.local", "utf8"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
})();
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

async function signIn(email, password = "Factory@2026") {
  const c = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`${email} sign-in failed: ${error.message}`);
  return { client: c, user: data.user };
}

const COMPANY = "11111111-1111-1111-1111-111111111111";

// 1. Who is "Admin Prime"?
const { data: prime } = await admin
  .from("profiles")
  .select("id, full_name, email, company_id")
  .ilike("full_name", "%prime%");
console.log("Admin Prime profiles:", JSON.stringify(prime ?? null));

// 2. Pending / recent profile change requests for the demo company
const { data: pcrs } = await admin
  .from("profile_change_requests")
  .select("id, user_id, requested_by, company_id, field_name, old_value, new_value, status, reviewed_by, created_at")
  .eq("company_id", COMPANY)
  .order("created_at", { ascending: false })
  .limit(10);
console.log("PCRs:", JSON.stringify(pcrs ?? null, null, 1));

// 3. Companies row + currency
const { data: company } = await admin.from("companies").select("*").eq("id", COMPANY).single();
console.log("Company currency/legal_name:", company?.currency, "|", company?.legal_name, "|", company?.name);

// 4. THE KEY TEST — can Company Admin UPDATE the companies table?
const ca = await signIn("admin@abcmfg.demo");
const upd = await ca.client
  .from("companies")
  .update({ legal_name: company?.legal_name ?? "SAME" })
  .eq("id", COMPANY)
  .select("id, legal_name, currency");
console.log("Company Admin UPDATE companies →", "err:", upd.error?.message ?? "(none)", "| rows:", upd.data?.length ?? 0, "| data:", JSON.stringify(upd.data ?? null));

// 5. Currency formatting check — where does the app show currency?
const { data: invoices } = await admin.from("invoices").select("invoice_number, total_amount, currency, status").limit(5);
console.log("Invoices sample:", JSON.stringify(invoices ?? null));
const { data: orders } = await admin.from("customer_orders").select("order_number, order_total, status").limit(3);
console.log("Orders sample:", JSON.stringify(orders ?? null));
