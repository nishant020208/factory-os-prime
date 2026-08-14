-- Restore the merged leaves INSERT policy (single source of truth) after
-- debugging replaced it with a temporary permissive policy. Any internal
-- employee may submit a leave request for THEMSELVES; HR Manager / Company
-- Admin may create one on behalf of an employee. Auditor, customer and
-- supplier portals never write.
DROP POLICY IF EXISTS leaves_insert_perm ON public.leaves;
DROP POLICY IF EXISTS leaves_insert ON public.leaves;
CREATE POLICY leaves_insert ON public.leaves FOR INSERT TO authenticated
WITH CHECK (
  company_id = current_company_id()
  AND NOT is_supplier_portal()
  AND NOT is_customer_portal()
  AND NOT is_auditor()
  AND (
    employee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('company_admin', 'hr_manager')
    )
  )
);

-- Leaves SELECT: every internal employee may read THEIR OWN leave rows
-- (needed for self-submit read-back and the insert RETURNING clause), while
-- only HR Manager / Company Admin see company-wide leaves. Auditor keeps
-- cross-module read access. This replaces the previous policy that excluded
-- finance/maintenance entirely, which broke the INSERT ... RETURNING path
-- for employees self-submitting (the row was inserted but the read-back was
-- RLS-filtered, surfacing as a 42501 on the client's insert+select).
DROP POLICY IF EXISTS leaves_select_ops ON public.leaves;
CREATE POLICY leaves_select_ops ON public.leaves FOR SELECT TO authenticated
USING (
  (company_id = current_company_id() AND (
    employee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('company_admin', 'hr_manager')
    )
  ))
  OR (is_auditor() AND NOT is_customer_portal() AND NOT is_supplier_portal())
);
