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
