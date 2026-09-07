/**
 * plants.server.ts — Server-side functions for plant querying and location resolution.
 *
 * Provides anon-safe server endpoints for customer registration to fetch real active
 * plants under any selected company, backed by the admin service role to guarantee
 * consistent multi-tenant plant availability regardless of client RLS session state.
 */
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

export const getCompanyPlantsServerFn = createServerFn({ method: "GET" })
  .validator((d: { companyId: string }) => d)
  .handler(async ({ data }) => {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
    if (!url || !serviceKey || !data.companyId) return [];

    try {
      const admin = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data: plants, error } = await admin
        .from("plants")
        .select("id, name, code, city, address, latitude, longitude, status")
        .eq("company_id", data.companyId)
        .eq("status", "active")
        .order("name");

      if (error) {
        console.error("[plants.server] Query error:", error.message);
        return [];
      }

      return plants ?? [];
    } catch (err: any) {
      console.error("[plants.server] Unexpected error:", err?.message);
      return [];
    }
  });
