import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

/**
 * Resolves the current user's supplier record with a multi-step fallback:
 * 1. Match by user_id on suppliers table
 * 2. Match by contact_email from profile
 * 3. Match by company_id (first supplier in the company)
 * 4. Match by name pattern from email prefix
 */
export function useSupplier() {
  const { user, companyId } = useAuth();

  const { data: supplier, isLoading } = useQuery({
    queryKey: ["my-supplier", user?.id, companyId],
    queryFn: async () => {
      if (!user) return null;

      // 1. Match by user_id
      const byUser = await supabase
        .from("suppliers")
        .select("id, name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (byUser.data?.id) {
        return { id: byUser.data.id as string, name: (byUser.data.name as string) ?? "Your company" };
      }

      // 2. Match by contact_email from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.email) {
        const byEmail = await supabase
          .from("suppliers")
          .select("id, name")
          .eq("contact_email", profile.email)
          .maybeSingle();
        if (byEmail.data?.id) {
          return { id: byEmail.data.id as string, name: (byEmail.data.name as string) ?? "Your company" };
        }
      }

      // 3. Match by company — get first supplier in the company
      if (companyId) {
        const byCompany = await supabase
          .from("suppliers")
          .select("id, name")
          .eq("company_id", companyId)
          .order("created_at", { ascending: true })
          .maybeSingle();
        if (byCompany.data?.id) {
          return { id: byCompany.data.id as string, name: (byCompany.data.name as string) ?? "Your company" };
        }
      }

      // 4. Match by name pattern from email prefix
      if (profile?.email) {
        const prefix = profile.email.split("@")[0];
        const byName = await supabase
          .from("suppliers")
          .select("id, name")
          .ilike("name", `%${prefix}%`)
          .maybeSingle();
        if (byName.data?.id) {
          return { id: byName.data.id as string, name: (byName.data.name as string) ?? "Your company" };
        }
      }

      return null;
    },
    staleTime: 5 * 60_000,
  });

  return { mySupplier: supplier ?? null, isLoading };
}
