-- =====================================================================
-- FACTORYOS AI — PLANT ADMIN CUSTOMER MANAGEMENT (2026-09-04)
--
-- Closes the gap where customers were purely Company-Admin territory:
--
-- 1. customer_requests.plant_id — the public registration form computes
--    the nearest plant (anon-safe RPC) and stores it on the request, so
--    every request is plant-tagged from submission.
-- 2. find_nearest_plant(cid, lat, lng) RPC — SECURITY DEFINER so an
--    anonymous registrant can resolve a company's nearest plant without
--    being able to read the plants table (falls back to the primary
--    plant when no coordinates resolve).
-- 3. RLS on customer_requests — Plant Admin may SELECT/UPDATE requests
--    tagged to their own plant (approve/reject); Company Admin keeps the
--    company-wide view; requesters see their own row by email.
-- 4. RLS on whitelist — Plant Admin may invite customer_portal rows for
--    their own plant (the approvev flow upserts that row).
-- 5. RLS on customers — Plant Admin sees only THEIR plant's customers,
--    and can create/update/delete only rows tagged to their plant.
--
-- All additive: no existing row, policy or account is removed.
-- =====================================================================

-- ── 1. customer_requests: nearest-plant at submission ─────────────────
ALTER TABLE public.customer_requests
  ADD COLUMN IF NOT EXISTS plant_id uuid REFERENCES public.plants(id);

-- ── 2. find_nearest_plant — anon-safe helper ───────────────────────────
CREATE OR REPLACE FUNCTION public.find_nearest_plant(
  p_company_id uuid,
  p_lat numeric,
  p_lng numeric
)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_plant uuid;
BEGIN
  IF p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
    SELECT id INTO v_plant
    FROM public.plants
    WHERE company_id = p_company_id
      AND status = 'active'
      AND latitude IS NOT NULL
      AND longitude IS NOT NULL
    ORDER BY (latitude - p_lat) * (latitude - p_lat)
           + (longitude - p_lng) * (longitude - p_lng)
    LIMIT 1;
    IF v_plant IS NOT NULL THEN RETURN v_plant; END IF;
  END IF;

  -- Fallback: the company's primary plant (most plant-level employees).
  SELECT p.id INTO v_plant
  FROM public.plants p
  LEFT JOIN public.user_roles ur
         ON ur.plant_id = p.id
        AND ur.company_id = p_company_id
        AND ur.role NOT IN ('finance_manager'::public.app_role, 'auditor'::public.app_role)
  WHERE p.company_id = p_company_id
    AND p.status = 'active'
  GROUP BY p.id
  ORDER BY COUNT(ur.id) DESC, p.created_at ASC
  LIMIT 1;
  RETURN v_plant;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.find_nearest_plant(uuid, numeric, numeric) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.find_nearest_plant(uuid, numeric, numeric) FROM PUBLIC;

-- ── 3. customer_requests RLS: Plant Admin plant-scoped ─────────────────
DROP POLICY IF EXISTS cr_select_plant_admin ON public.customer_requests;
CREATE POLICY cr_select_plant_admin ON public.customer_requests
FOR SELECT TO authenticated
USING (
  company_id = public.current_company_id()
  AND public.is_plant_admin()
  AND plant_id = public.current_user_plant_id()
);

DROP POLICY IF EXISTS cr_update_plant_admin ON public.customer_requests;
CREATE POLICY cr_update_plant_admin ON public.customer_requests
FOR UPDATE TO authenticated
USING (
  company_id = public.current_company_id()
  AND public.is_plant_admin()
  AND plant_id = public.current_user_plant_id()
)
WITH CHECK (
  company_id = public.current_company_id()
  AND public.is_plant_admin()
  AND plant_id = public.current_user_plant_id()
);

-- ── 4. whitelist: Plant Admin may invite customers for their plant ─────
DROP POLICY IF EXISTS whitelist_write_customer_plant ON public.whitelist;
CREATE POLICY whitelist_write_customer_plant ON public.whitelist
FOR ALL TO authenticated
USING (
  company_id = public.current_company_id()
  AND public.is_plant_admin()
  AND plant_id = public.current_user_plant_id()
  AND role = 'customer_portal'::public.app_role
)
WITH CHECK (
  company_id = public.current_company_id()
  AND public.is_plant_admin()
  AND plant_id = public.current_user_plant_id()
  AND role = 'customer_portal'::public.app_role
);

-- ── 5. customers RLS: Plant Admin − own plant only ─────────────────
DROP POLICY IF EXISTS customers_select_iso  ON public.customers;
DROP POLICY IF EXISTS customers_insert_iso  ON public.customers;
DROP POLICY IF EXISTS customers_update_iso  ON public.customers;
DROP POLICY IF EXISTS customers_delete_iso  ON public.customers;

CREATE POLICY customers_select_iso ON public.customers
FOR SELECT TO authenticated
USING (
  (public.is_customer_portal() AND user_id = auth.uid())
  OR (NOT public.is_customer_portal() AND NOT public.is_plant_admin() AND public.in_company_ops(company_id))
  OR (public.is_plant_admin() AND public.in_company_ops(company_id) AND plant_id = public.current_user_plant_id())
  OR (public.is_auditor() AND public.in_company_ops(company_id))
);

CREATE POLICY customers_insert_iso ON public.customers
FOR INSERT TO authenticated
WITH CHECK (
  (NOT public.is_customer_portal() AND NOT public.is_plant_admin() AND public.in_company_ops(company_id))
  OR (public.is_plant_admin() AND public.in_company_ops(company_id) AND plant_id = public.current_user_plant_id())
  OR public.is_root_admin(auth.uid())
);

CREATE POLICY customers_update_iso ON public.customers
FOR UPDATE TO authenticated
USING (
  (NOT public.is_customer_portal() AND NOT public.is_plant_admin() AND public.in_company_ops(company_id))
  OR (public.is_plant_admin() AND public.in_company_ops(company_id) AND plant_id = public.current_user_plant_id())
)
WITH CHECK (
  (NOT public.is_customer_portal() AND NOT public.is_plant_admin() AND public.in_company_ops(company_id))
  OR (public.is_plant_admin() AND public.in_company_ops(company_id) AND plant_id = public.current_user_plant_id())
);

CREATE POLICY customers_delete_iso ON public.customers
FOR DELETE TO authenticated
USING (
  (NOT public.is_customer_portal() AND NOT public.is_plant_admin() AND public.in_company_ops(company_id))
  OR (public.is_plant_admin() AND public.in_company_ops(company_id) AND plant_id = public.current_user_plant_id())
);

-- Confirm
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('customer_requests', 'whitelist', 'customers')
  AND policyname IN ('cr_select_plant_admin', 'cr_update_plant_admin', 'whitelist_write_customer_plant', 'customers_select_iso', 'customers_insert_iso', 'customers_update_iso', 'customers_delete_iso')
ORDER BY tablename, policyname;