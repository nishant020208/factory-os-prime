// One-off helper: inspect real Supabase table structure via service-role REST.
import fs from "node:fs";

const env = fs.readFileSync(".env", "utf8");
const urlRaw = env.match(/^SUPABASE_URL=(.+)$/m)?.[1]?.trim();
const url = (urlRaw || "").replace(/\r$/, "").replace(/"/g, "");
const key =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0YXdtZWl5bGtyemp6bWF1dmhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTA4OTc0MCwiZXhwIjoyMTAwNjY1NzQwfQ.Vya5r_x-J3e3_hxHSSYDYmYuRfk0ep07NKjSeq1hsxU";

const table = process.argv[2] || "suppliers";
fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
})
  .then((r) => r.json())
  .then((d) => {
    console.log(`${table}:`, JSON.stringify(d[0] || d, null, 1).slice(0, 1500));
  })
  .catch((e) => console.log("ERR", e.message));
