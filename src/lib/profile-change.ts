// Shared helpers for profile change requests (used by the Profile page for
// every role and by the approver review views — Company Admin and Root).
import { supabase } from "@/integrations/supabase/client";

export interface ProfileChangeRequestRow {
  id: string;
  user_id: string;
  company_id: string;
  requested_by: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  status: string;
  rejection_reason?: string | null;
}

/** Human label for a dotted field key like "profiles.full_name". */
export function profileFieldLabel(key: string): string {
  const map: Record<string, string> = {
    "profiles.full_name": "Full Name",
    "profiles.email": "Email",
    "profiles.phone": "Phone",
    "profiles.job_title": "Job Title",
    "profiles.avatar_url": "Profile Photo",
    "profiles.department": "Department Assignment",
    "profiles.certifications": "Certification Details",
    "user_roles.role": "Role / Designation",
    "companies.name": "Company Name",
    "companies.legal_name": "Legal / Registered Name",
    "companies.gst_number": "GST Number",
    "customers.contact_person": "Contact Person",
    "customers.contact_phone": "Phone",
    "customers.business_name": "Company Name",
    "customers.email": "Email",
    "customers.gst_number": "GST Number",
    "customers.billing_address": "Billing Address",
    "customers.shipping_address": "Shipping Address",
    "suppliers.contact_person": "Contact Person",
    "suppliers.contact_phone": "Phone",
    "suppliers.name": "Company Name",
    "suppliers.contact_email": "Email",
    "suppliers.gst_number": "GST Number",
    "suppliers.address": "Address",
    "suppliers.materials_supplied": "Materials Supplied",
    "suppliers.bank_details": "Bank / Payment Details",
  };
  return map[key] ?? key.replace(/_/g, " ");
}

/**
 * Apply an approved change request to its real target table.
 * Returns an error message on failure, or null on success.
 * Runs as the approver (Company Admin / Root) — RLS + guard triggers allow the
 * approver to write sensitive fields of OTHER users, never their own.
 */
export async function applyApprovedProfileChange(
  req: Pick<ProfileChangeRequestRow, "field_name" | "new_value" | "user_id" | "company_id">,
): Promise<string | null> {
  const [table, column] = String(req.field_name).split(".");
  const value = String(req.new_value ?? "").trim();

  if (table === "profiles") {
    const { error } = await supabase
      .from("profiles")
      .update({ [column]: value || null } as never)
      .eq("id", req.user_id);
    return error?.message ?? null;
  }
  if (table === "user_roles") {
    const { error } = await supabase
      .from("user_roles")
      .update({ role: value } as never)
      .eq("user_id", req.user_id)
      .eq("company_id", req.company_id);
    return error?.message ?? null;
  }
  if (table === "customers") {
    const { error } = await supabase
      .from("customers")
      .update({ [column]: value || null } as never)
      .eq("user_id", req.user_id);
    return error?.message ?? null;
  }
  if (table === "suppliers") {
    const { error } = await supabase
      .from("suppliers")
      .update({ [column]: value || null } as never)
      .eq("user_id", req.user_id);
    return error?.message ?? null;
  }
  if (table === "companies") {
    const { error } = await supabase
      .from("companies")
      .update({ [column]: value || null } as never)
      .eq("id", req.company_id);
    return error?.message ?? null;
  }
  return `Unknown field target: ${req.field_name}`;
}
