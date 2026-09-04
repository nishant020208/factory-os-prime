-- ────────────────────────────────────────────────────────────────────────
-- Plant Admin may whitelist SUPPLIER PORTAL accounts for their own plant.
-- Mirrors the customer_portal policy from 20260904000008 so a Plant Admin
-- can invite/see the external suppliers serving their plant. Company-level
-- roles (finance_manager, auditor), Root/Company Admin remain out of reach.
--
-- Existing demo supplier whitelist rows keep ALL their data — the backfill
-- only assigns the main plant so the demo supplier (supplier@abcmfg.demo)
-- is visible to the main plant's Plant Admin for confirmation.
-- ────────────────────────────────────────────────────────────────────────

-- 1. whitelist: Plant Admin may invite supplier_portal rows for their plant
DROP POLICY IF EXISTS whitelist_write_supplier_plant ON public.whitelist;
CREATE POLICY whitelist_write_supplier_plant ON public.whitelist
FOR ALL TO authenticated
USING (
  company_id = public.current_company_id()
  AND public.is_plant_admin()
  AND plant_id = public.current_user_plant_id()
  AND role = 'supplier_portal'::public.app_role
)
WITH CHECK (
  company_id = public.current_company_id()
  AND public.is_plant_admin()
  AND plant_id = public.current_user_plant_id()
  AND role = 'supplier_portal'::public.app_role
);

-- 2. Backfill: tag the existing demo-company supplier portal invites to the
--    main plant (data-preserving UPDATE — nothing is deleted or recreated).
UPDATE public.whitelist
SET plant_id = '22222222-2222-2222-2222-222222222222'
WHERE company_id = '11111111-1111-1111-1111-111111111111'
  AND plant_id IS NULL
  AND role = 'supplier_portal'::public.app_role;

-- Confirm
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'whitelist'
  AND policyname IN ('whitelist_write_supplier_plant', 'whitelist_write_customer_plant', 'whitelist_select_plant', 'whitelist_write')
ORDER BY policyname;

SELECT email, role, company_id, plant_id, status
FROM public.whitelist
WHERE company_id = '11111111-1111-1111-1111-111111111111'
  AND role = 'supplier_portal'
ORDER BY email;
