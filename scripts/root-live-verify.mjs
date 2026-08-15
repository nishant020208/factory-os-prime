// Live Root Super Admin verification: seed a pending company registration,
// approve it through the app's exact API path as Root, confirm the new
// Company Admin can log in, and capture audit/notification evidence.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const txt = readFileSync(".env.local", "utf8");
const get = (k) => {
  const m = new RegExp(`^${k}=(.*)$`, "m").exec(txt);
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
};
const url = get("SUPABASE_URL");
const key = get("SUPABASE_PUBLISHABLE_KEY");
const serviceKey = get("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !key || !serviceKey) throw new Error("Missing env");

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

async function signIn(email, password = "Factory@2026") {
  const c = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`${email} sign-in failed: ${error.message}`);
  return { client: c, user: data.user };
}

const stamp = Date.now();
const EMAIL = `newco-${stamp}@factoryos.demo`;
const CO_NAME = `Live Root Verify Co ${stamp}`;

// ── 1) Seed a pending company registration (as a registrant would) ──
const { data: reg, error: regErr } = await admin
  .from("company_registrations")
  .insert({
    company_name: CO_NAME,
    legal_name: CO_NAME,
    email: EMAIL,
    phone: "+1 555-0101",
    country: "US",
    industry: "Custom Furniture Manufacturing",
    status: "pending",
  })
  .select()
  .single();
if (regErr) throw new Error(`seed registration: ${regErr.message}`);
console.log("SEEDED registration:", reg.id, reg.company_name, "->", reg.email);

// ── 2) Sign in as Root and approve through the app's exact path ──
const root = await signIn("root@factoryos.demo");
console.log("ROOT signed in as:", root.user.email, "id:", root.user.id);

// 2a. create company (active)
const { data: company, error: coErr } = await root.client
  .from("companies")
  .insert({
    name: CO_NAME,
    legal_name: CO_NAME,
    country: "US",
    industry: "Custom Furniture Manufacturing",
    status: "active",
  })
  .select()
  .single();
if (coErr) throw new Error(`create company: ${coErr.message}`);
console.log("COMPANY created:", company.id, company.name, "status:", company.status);

// 2b. mark registration approved
const { error: regUpdErr } = await root.client
  .from("company_registrations")
  .update({ status: "approved", reviewed_at: new Date().toISOString() })
  .eq("id", reg.id);
if (regUpdErr) throw new Error(`update registration: ${regUpdErr.message}`);

// 2c. whitelist the registrant's email as company_admin
const { data: wl, error: wlErr } = await root.client
  .from("whitelist")
  .insert({ email: EMAIL, role: "company_admin", company_id: company.id, status: "pending" })
  .select()
  .single();
if (wlErr) throw new Error(`whitelist insert: ${wlErr.message}`);
console.log("WHITELISTED company admin:", wl.id, EMAIL, "-> company", company.id);

// 2d. notify the new Company Admin (same helper call the UI makes)
const notifRes = await root.client
  .from("notifications")
  .insert({
    company_id: company.id,
    to_role: "company_admin",
    to_user: null,
    title: "✅ Company Activated",
    body: `"${CO_NAME}" has been approved and activated. Welcome to FactoryOS! Sign in with your whitelisted email to set up your workspace.`,
    severity: "success",
    related_entity_type: "companies",
    related_entity_id: company.id,
  })
  .select("id, company_id, to_role, to_user, title")
  .single();
if (notifRes.error) throw new Error(`notification insert: ${notifRes.error.message}`);
console.log("NOTIFICATION sent:", JSON.stringify(notifRes.data));

// 2e. platform-scoped audit row (company_id NULL -> tenant Auditors can't see)
const { data: audit, error: auditErr } = await root.client
  .from("audit_logs")
  .insert({
    company_id: null,
    user_id: root.user.id,
    action: "company_registration_approved",
    entity: "company_registrations",
    entity_id: reg.id,
    metadata: { company_name: CO_NAME, email: EMAIL, approved_by: root.user.email },
  })
  .select("id, company_id, user_id, action, entity, entity_id, metadata")
  .single();
if (auditErr) throw new Error(`audit insert: ${auditErr.message}`);
console.log("AUDIT row:", JSON.stringify(audit));

// ── 3) Registrant signs up (trigger fires: profile + user_roles + whitelist accepted) ──
const { data: authUser, error: createErr } = await admin.auth.admin.createUser({
  email: EMAIL,
  password: "Factory@2026",
  email_confirm: true,
});
if (createErr) throw new Error(`create auth user: ${createErr.message}`);
console.log("AUTH USER created:", authUser.user.id, EMAIL);

const { data: profile } = await admin
  .from("profiles")
  .select("id, company_id, plant_id, email, full_name")
  .eq("id", authUser.user.id)
  .single();
console.log("PROFILE (trigger):", JSON.stringify(profile));

const { data: role } = await admin
  .from("user_roles")
  .select("user_id, role, company_id, plant_id")
  .eq("user_id", authUser.user.id)
  .single();
console.log("USER_ROLE (trigger):", JSON.stringify(role));

const { data: wlAfter } = await admin
  .from("whitelist")
  .select("id, status, accepted_at")
  .eq("id", wl.id)
  .single();
console.log("WHITELIST after signup:", JSON.stringify(wlAfter));

// ── 4) New Company Admin logs in and sees their own company ──
const newAdmin = await signIn(EMAIL);
const { data: seenCompanies } = await newAdmin.client.from("companies").select("id, name, status");
console.log("NEW ADMIN sees companies:", JSON.stringify(seenCompanies));

const { data: seenNotifs } = await newAdmin.client
  .from("notifications")
  .select("id, title, to_role, to_user, company_id")
  .order("created_at", { ascending: false })
  .limit(3);
console.log("NEW ADMIN notifications:", JSON.stringify(seenNotifs));

// ── 5) Isolation probe: new admin must NOT see the demo tenant's data ──
const { data: otherOrders } = await newAdmin.client
  .from("sales_orders")
  .select("id")
  .eq("company_id", "11111111-1111-1111-1111-111111111111")
  .limit(1);
console.log(
  "NEW ADMIN sees demo-tenant orders:",
  otherOrders?.length ?? 0,
  otherOrders?.length ? "(LEAK!)" : "(isolated, correct)",
);

// ── CLEANUP (test artifacts only) ──
console.log("\nCLEANUP:");
await admin.auth.admin.deleteUser(authUser.user.id);
console.log("  deleted auth user", authUser.user.id);
await admin.from("whitelist").delete().eq("id", wl.id);
await admin.from("company_registrations").delete().eq("id", reg.id);
await admin.from("notifications").delete().eq("company_id", company.id);
await admin.from("audit_logs").delete().eq("id", audit.id);
await admin.from("companies").delete().eq("id", company.id);
console.log("  deleted test company/registration/whitelist/notification/audit rows");
console.log("\nLIVE ROOT VERIFICATION COMPLETE ✔");
