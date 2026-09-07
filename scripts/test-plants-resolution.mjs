import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function env() {
  const txt = readFileSync(".env.local", "utf8");
  const get = (k) => {
    const m = new RegExp(`^${k}=(.*)$`, "m").exec(txt);
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
  };
  return { url: get("SUPABASE_URL"), key: get("SUPABASE_PUBLISHABLE_KEY"), serviceKey: get("SUPABASE_SERVICE_ROLE_KEY") };
}

const { url, key, serviceKey } = env();
const anon = createClient(url, key, { auth: { persistSession: false } });
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

async function verifyAllCompaniesHavePlants() {
  const { data: companies, error: cErr } = await admin.from("companies").select("id, name, status");
  if (cErr) throw cErr;

  console.log(`Checking ${companies.length} companies...`);
  let allPass = true;

  for (const c of companies) {
    // 1. Check direct admin query
    const { data: adminPlants } = await admin
      .from("plants")
      .select("id, name, code, status")
      .eq("company_id", c.id)
      .eq("status", "active");

    const count = adminPlants?.length || 0;
    const ok = count > 0;
    if (!ok) allPass = false;

    console.log(`Company "${c.name}" (${c.id}) [status=${c.status}]: ${ok ? "✅" : "❌"} ${count} active plant(s)`);
    if (adminPlants) {
      for (const p of adminPlants) {
        console.log(`   └─ Plant: "${p.name}" (${p.id}) [code: ${p.code}]`);
      }
    }
  }

  console.log("\nResult:", allPass ? "ALL COMPANIES HAVE ACTIVE PLANTS! 🎉" : "Some companies are missing plants ❌");
}

verifyAllCompaniesHavePlants();
