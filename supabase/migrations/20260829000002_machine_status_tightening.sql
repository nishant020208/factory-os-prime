-- Plant Manager sees machine status read-only (oversight) and reports issues
-- via machine_breakdowns — it does not create machines or edit their status.
-- That stays Maintenance / Company Admin / Plant Admin territory.
CREATE OR REPLACE FUNCTION public.is_plant_manager()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'plant_manager'::public.app_role
  );
$function$;

DROP POLICY IF EXISTS machines_insert ON public.machines;
DROP POLICY IF EXISTS machines_update ON public.machines;

CREATE POLICY machines_insert ON public.machines
FOR INSERT TO authenticated
WITH CHECK (
  (
    (NOT is_auditor()) AND (NOT is_customer_portal()) AND (NOT is_supplier_portal())
    AND (NOT is_production_operator()) AND (NOT is_plant_manager())
    AND (NOT is_finance_manager()) AND (NOT is_hr_manager())
  )
  OR is_root_admin(auth.uid())
);

CREATE POLICY machines_update ON public.machines
FOR UPDATE TO authenticated
USING (
  (
    (NOT is_auditor()) AND (NOT is_customer_portal()) AND (NOT is_supplier_portal())
    AND (NOT is_production_operator()) AND (NOT is_plant_manager())
    AND (NOT is_finance_manager()) AND (NOT is_hr_manager())
  )
  OR is_root_admin(auth.uid())
)
WITH CHECK (
  (
    (NOT is_auditor()) AND (NOT is_customer_portal()) AND (NOT is_supplier_portal())
    AND (NOT is_production_operator()) AND (NOT is_plant_manager())
    AND (NOT is_finance_manager()) AND (NOT is_hr_manager())
  )
  OR is_root_admin(auth.uid())
);
