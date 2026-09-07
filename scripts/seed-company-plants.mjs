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

const { url, serviceKey } = env();
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

async function seedPlantsForCompanies() {
  const { data: companies } = await admin.from("companies").select("*");
  console.log(`Found ${companies?.length} companies.`);

  for (const c of companies || []) {
    const { data: existingPlants } = await admin
      .from("plants")
      .select("id, name, status")
      .eq("company_id", c.id);

    console.log(`Company "${c.name}" (${c.id}) has ${existingPlants?.length || 0} plants.`);

    if (!existingPlants || existingPlants.length === 0) {
      console.log(`  Creating default primary plant for company "${c.name}"...`);
      const plantCode = (c.name || "PLT")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 4) + "-01";

      const { data: newPlant, error: pErr } = await admin
        .from("plants")
        .insert({
          company_id: c.id,
          name: `${c.name} — Main Plant`,
          code: plantCode,
          city: c.city || "Detroit",
          address: c.address || "100 Industrial Parkway",
          latitude: 42.3314,
          longitude: -83.0458,
          status: "active",
        })
        .select()
        .single();

      if (pErr) {
        console.error(`  Error creating plant for ${c.name}:`, pErr.message);
      } else {
        console.log(`  Created plant: ${newPlant.name} (${newPlant.id})`);
      }
    }
  }
}

seedPlantsForCompanies();
