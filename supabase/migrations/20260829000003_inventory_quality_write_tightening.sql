-- Production Manager reads stock (material check) but never writes it;
-- Plant Manager is a read-only oversight layer. Quality inspections are
-- Quality Inspector / Company Admin only — Production Manager triggers
-- the need but does not record inspection results.
CREATE OR REPLACE FUNCTION public.is_production_manager()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'production_manager'::public.app_role
  );
$function$;

DROP POLICY IF EXISTS inventory_insert ON public.inventory;
DROP POLICY IF EXISTS inventory_update ON public.inventory;

CREATE POLICY inventory_insert ON public.inventory
FOR INSERT TO authenticated
WITH CHECK (
  (
    (NOT is_auditor()) AND (NOT is_customer_portal()) AND (NOT is_supplier_portal())
    AND (NOT is_production_operator()) AND (NOT is_maintenance_engineer())
    AND (NOT is_finance_manager()) AND (NOT is_hr_manager())
    AND (NOT is_production_manager()) AND (NOT is_plant_manager())
    AND (NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'procurement_manager'::public.app_role
    ))
  )
  OR is_root_admin(auth.uid())
);

CREATE POLICY inventory_update ON public.inventory
FOR UPDATE TO authenticated
USING (
  (
    (NOT is_auditor()) AND (NOT is_customer_portal()) AND (NOT is_supplier_portal())
    AND (NOT is_production_operator()) AND (NOT is_maintenance_engineer())
    AND (NOT is_finance_manager()) AND (NOT is_hr_manager())
    AND (NOT is_production_manager()) AND (NOT is_plant_manager())
    AND (NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'procurement_manager'::public.app_role
    ))
  )
  OR is_root_admin(auth.uid())
)
WITH CHECK (
  (
    (NOT is_auditor()) AND (NOT is_customer_portal()) AND (NOT is_supplier_portal())
    AND (NOT is_production_operator()) AND (NOT is_maintenance_engineer())
    AND (NOT is_finance_manager()) AND (NOT is_hr_manager())
    AND (NOT is_production_manager()) AND (NOT is_plant_manager())
    AND (NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'procurement_manager'::public.app_role
    ))
  )
  OR is_root_admin(auth.uid())
);

DROP POLICY IF EXISTS quality_inspections_insert ON public.quality_inspections;

CREATE POLICY quality_inspections_insert ON public.quality_inspections
FOR INSERT TO authenticated
WITH CHECK (
  (
    (NOT is_auditor()) AND (NOT is_customer_portal()) AND (NOT is_supplier_portal())
    AND (NOT is_production_operator()) AND (NOT is_maintenance_engineer())
    AND (NOT is_finance_manager()) AND (NOT is_hr_manager())
    AND (NOT is_production_manager())
  )
  OR is_root_admin(auth.uid())
);
