import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const envTxt = readFileSync(".env.local", "utf8");
const get = (k) => { const m = new RegExp(`^${k}=(.*)$`, "m").exec(envTxt); return m ? m[1].trim().replace(/^["']|["']$/g, "") : null; };

const admin = createClient(get("SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const COMPANY = "11111111-1111-1111-1111-111111111111";

async function inspect(table, cols) {
  const { data, error } = await admin.from(table).select(cols || "*").eq("company_id", COMPANY).limit(2);
  console.log(`\n[${table}] rows:`, data?.length, error ? `ERROR: ${error.message}` : "");
  if (data?.[0]) console.log("  Sample keys:", Object.keys(data[0]).join(", "));
  if (data?.[0]) console.log("  Sample row:", JSON.stringify(data[0]).slice(0, 200));
}

await inspect("work_orders");
await inspect("inventory");
await inspect("sales_orders");
await inspect("invoices");
await inspect("employees");
await inspect("bom_items");
