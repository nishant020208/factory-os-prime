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
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

async function run() {
  // Check plants in DB for all companies
  const { data: allPlants } = await admin.from("plants").select("*");
  console.log("Total plants in DB:", allPlants?.length);
  for (const p of allPlants || []) {
    console.log(`Plant: ${p.name} (${p.id}) | Company: ${p.company_id} | Status: ${p.status} | City: ${p.city} | Lat: ${p.latitude} | Lng: ${p.longitude}`);
  }
}

run();
