import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const txt = readFileSync(".env.local", "utf8");
const get = (k) => {
  const m = new RegExp(`^${k}=(.*)$`, "m").exec(txt);
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
};

const client = createClient(get("SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false }
});

async function main() {
  const { data: companies, error: compErr } = await client.from("companies").select("id, name");
  console.log("Companies:", companies, compErr);

  // Check if knowledge_chunks table exists
  const { data: kc, error: kcErr } = await client.from("knowledge_chunks").select("id").limit(1);
  console.log("knowledge_chunks check:", kc, kcErr);
}

main().catch(console.error);
