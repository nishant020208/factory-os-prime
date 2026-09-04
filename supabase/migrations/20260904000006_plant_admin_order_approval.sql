-- =====================================================================
-- FACTORYOS AI — PLANT ADMIN ORDER APPROVAL (2026-09-04)
--
-- Extends the order-approval guard so a Plant Admin may approve customer
-- orders assigned to THEIR OWN plant, exactly mirroring the Company Admin
-- path (Section 5 of the Plant Hierarchy Rework). Company Admin / Root
-- keep their existing company-wide approval power unchanged.
--
-- The guard is a BEFORE UPDATE trigger on sales_orders. It now admits:
--   • root_super_admin, company_admin            (unchanged, company-wide)
--   • plant_admin whose plant matches NEW.plant_id (new, plant-scoped)
-- Any other role still gets rejected.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.block_non_admin_order_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      public.has_role(auth.uid(), 'company_admin')
      OR public.is_root_admin(auth.uid())
      OR (
        public.is_plant_admin()
        AND NEW.plant_id IS NOT NULL
        AND NEW.plant_id = public.current_user_plant_id()
      )
    ) THEN
      RAISE EXCEPTION 'Only a Company Admin or the assigned Plant Admin can approve this order';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Recreate the trigger to pick up the new function body.
DROP TRIGGER IF EXISTS trg_sales_order_approval_guard ON public.sales_orders;
CREATE TRIGGER trg_sales_order_approval_guard
BEFORE UPDATE OF status ON public.sales_orders
FOR EACH ROW EXECUTE FUNCTION public.block_non_admin_order_approval();

-- Confirm
SELECT tgname
FROM pg_trigger
WHERE tgname = 'trg_sales_order_approval_guard'
  AND tgrelid = 'public.sales_orders'::regclass;