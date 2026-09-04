import { supabase } from "@/integrations/supabase/client";

/**
 * Shared utility to look up a customer's user_id from their customer_id.
 * Used for targeted notifications to specific customers.
 *
 * Lookup chain:
 * 1. Try customers.user_id (direct link)
 * 2. Fallback: match customers.contact_email to profiles.email
 *
 * Returns null if no match found (notification will still fire but
 * won't be targeted to a specific user; the customer_portal role
 * filter will still catch it if the user is signed in with that role).
 */
export async function getCustomerUserId(customerId: string | null): Promise<string | null> {
  if (!customerId) return null;
  try {
    const { data } = await supabase
      .from("customers")
      .select("user_id, contact_email, email")
      .eq("id", customerId)
      .maybeSingle();
    // Try user_id first
    if (data?.user_id) return data.user_id;
    // Fallback to matching email in profiles
    const customerEmail = data?.email ?? data?.contact_email;
    if (customerEmail) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", customerEmail)
        .maybeSingle();
      return profile?.id ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve a specific user id holding a role within a company.
 * Used for to_user targeting (never to_role broadcast) — e.g. the single
 * Company Admin who should receive Daily Reports, or the Procurement
 * Manager who should be told about a stock shortage.
 *
 * Returns null if no holder exists (caller may fall back to role-wide
 * targeting for internal roles, which is safe and never a cross-tenant
 * broadcast).
 */
export async function getRoleUserId(
  companyId: string | null,
  role: string,
): Promise<string | null> {
  if (!companyId) return null;
  try {
    const { data } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("company_id", companyId)
      .eq("role", role as never)
      .limit(1)
      .maybeSingle();
    return data?.user_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve a specific user id holding a role within a company AND a specific
 * plant — used so an order approved by Plant Admin notifies the Production
 * Manager of that same plant (to_user targeting, never a role broadcast).
 */
export async function getRoleUserIdByPlant(
  companyId: string | null,
  role: string,
  plantId: string,
): Promise<string | null> {
  if (!companyId) return null;
  try {
    const { data } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("company_id", companyId)
      .eq("role", role as never)
      .eq("plant_id", plantId)
      .limit(1)
      .maybeSingle();
    return data?.user_id ?? null;
  } catch {
    return null;
  }
}
