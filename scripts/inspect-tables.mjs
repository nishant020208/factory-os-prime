import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const txt = readFileSync(".env.local", "utf8");
const get = (k) => {
  const m = new RegExp(`^${k}=(.*)$`, "m").exec(txt);
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
};

const admin = createClient(get("SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false }
});

const tables = [
  "companies", "plants", "departments", "machines",
  "products", "boms", "bom_items", "sales_orders", "work_orders",
  "inventory", "warehouses", "quality_inspections", "maintenance_tickets",
  "invoices", "payments", "supplier_invoices", "supplier_payments",
  "employees", "leaves", "customers", "suppliers", "purchase_orders"
];

async function inspect() {
  const counts = {};
  for (const t of tables) {
    try {
      const { data, count, error } = await admin.from(t).select("*", { count: "exact", head: true });
      counts[t] = error ? `Error: ${error.message}` : count;
    } catch (e) {
      counts[t] = `Exception: ${e.message}`;
    }
  }
  console.log("Table row counts:", JSON.stringify(counts, null, 2));

  // Inspect sample company
  const { data: c } = await admin.from("companies").select("*").limit(2);
  console.log("Sample companies:", c?.map(x => ({ id: x.id, name: x.name })));
}

inspect().catch(console.error);
