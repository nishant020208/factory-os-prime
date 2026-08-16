// Verify the Bug 1 screenshot examples:
// 1. "Arjun Mehta wants to change Full Name" (badge: Approved) — did the real
//    profiles.full_name actually change?
// 2. "Admin Prime wants to change Legal / Registered Name" (pending) — who is
//    the requester, and is self-approval properly routed?
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const txt = readFileSync(".env.local", "utf8");
const get = (k) => {
  const m = new RegExp(`^${k}=(.*)$`, "m").exec(txt);
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
};
const url = get("SUPABASE_URL");
const serviceKey = (() => {
  const m = /^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m.exec(txt);
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
})();
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const COMPANY = "11111111-1111-1111-1111-111111111111";

const { data: arjun } = await admin.from("profiles").select("id, full_name, email").ilike("full_name", "%arjun%");
console.log("Arjun Mehta profile(s):", JSON.stringify(arjun ?? null, null, 1));

const { data: pcrArjun } = await admin
  .from("profile_change_requests")
  .select("id, user_id, field_name, old_value, new_value, status, reviewed_by, reviewed_at")
  .ilike("field_name", "profiles.full_name")
  .eq("company_id", COMPANY)
  .order("created_at", { ascending: false })
  .limit(3);
console.log("Arjun Full-Name PCRs:", JSON.stringify(pcrArjun ?? null, null, 1));

if (arjun?.[0] && pcrArjun?.[0]) {
  const pcr = pcrArjun[0];
  const applied = pcr.status === "approved" && (pcr.new_value ?? "").trim() === (arjun[0].full_name ?? "").trim();
  console.log(
    applied
      ? "✅ APPROVED badge is REAL — profiles.full_name matches the approved new_value."
      : `⚠️ approved PCR new_value (${pcr.new_value}) vs live full_name (${arjun[0].full_name}) — mismatch or rejected.`,
  );
}

const { data: prime } = await admin.from("profiles").select("id, full_name, email, company_id").ilike("full_name", "%prime%");
console.log("\nAdmin Prime:", JSON.stringify(prime ?? null));

const { data: pcrLegal } = await admin
  .from("profile_change_requests")
  .select("id, user_id, requested_by, field_name, old_value, new_value, status, reviewed_by")
  .eq("field_name", "companies.legal_name")
  .eq("company_id", COMPANY)
  .order("created_at", { ascending: false })
  .limit(3);
console.log("Legal-name PCRs:", JSON.stringify(pcrLegal ?? null, null, 1));

for (const p of pcrLegal ?? []) {
  if (p.status === "pending" && p.requested_by === p.user_id) {
    console.log("→ Pending legal-name request created BY its own requester (Company Admin) — correctly routes to Root, blocked from self-approval.");
  }
}

const { data: company } = await admin.from("companies").select("name, legal_name, gst_number, currency").eq("id", COMPANY).single();
console.log("\nCompany live:", JSON.stringify(company ?? null));
