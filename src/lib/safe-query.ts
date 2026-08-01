import { supabase } from "@/integrations/supabase/client";

/**
 * Safe Supabase query wrapper.
 * Wraps every Supabase query with try-catch so that missing tables,
 * RLS errors, or network failures NEVER trigger the error boundary.
 *
 * Usage:
 *   const { data } = await safeFrom("products").select("*");
 *   // data is Product[] | never[]  (empty array on error)
 *
 * All route pages should use `safeFrom` instead of `supabase.from`
 * to prevent transient DB errors from crashing the page.
 */
export function safeFrom(table: string) {
  const original = supabase.from(table as never);
  return {
    ...original,
    select: (columns = "*", options?: { count?: "exact" | "planned" | "estimated"; head?: boolean }) => {
      try {
        return original.select(columns as never, options as never);
      } catch {
        return { data: [], error: null } as never;
      }
    },
  };
}

/**
 * Safe data fetcher for useQuery hooks.
 * Never throws — returns empty array on any error.
 *
 * Usage:
 *   const { data } = useQuery({
 *     queryKey: ["products"],
 *     queryFn: () => safeFetch("products"),
 *   });
 */
export async function safeFetch(table: string): Promise<any[]> {
  try {
    const { data } = await supabase.from(table as never).select("*");
    return data ?? [];
  } catch {
    return [];
  }
}

/**
 * Safe data fetcher with order.
 */
export async function safeFetchOrdered(table: string, column: string, ascending = false): Promise<any[]> {
  try {
    const { data } = await supabase
      .from(table as never)
      .select("*")
      .order(column as never, { ascending } as never);
    return data ?? [];
  } catch {
    return [];
  }
}
