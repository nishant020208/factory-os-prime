import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Load environment
const txt = readFileSync(".env.local", "utf8");
const get = (k) => {
  const m = new RegExp(`^${k}=(.*)$`, "m").exec(txt);
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
};
process.env.SUPABASE_URL = get("SUPABASE_URL");
process.env.SUPABASE_SERVICE_ROLE_KEY = get("SUPABASE_SERVICE_ROLE_KEY");

const { ingestCompanyKnowledge } = await import("../src/lib/rag/ingest.ts");

const COMPANY = "11111111-1111-1111-1111-111111111111"; // Artisan Furniture Works

async function run() {
  console.log("Starting real RAG ingestion for company:", COMPANY);
  const res = await ingestCompanyKnowledge(COMPANY);
  console.log("Ingestion finished successfully!", JSON.stringify(res, null, 2));

  // Verify chunks in DB
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: sample, error } = await admin
    .from("knowledge_chunks")
    .select("id, source_table, confidentiality_level, role_visibility, content")
    .eq("company_id", COMPANY)
    .limit(5);

  console.log("Sample live chunks from database:", sample);
  if (error) console.error("Error verifying chunks:", error);
}

run().catch(console.error);
