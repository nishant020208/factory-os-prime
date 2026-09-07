-- ============================================================================
-- Migration: Ensure warehouses are visible across all internal & portal roles
-- ============================================================================

DROP POLICY IF EXISTS warehouses_select_ops ON public.warehouses;
CREATE POLICY warehouses_select_ops ON public.warehouses
  FOR SELECT TO authenticated
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR in_company_ops(company_id)
    OR is_root_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.company_id = warehouses.company_id
    )
  );

-- Ensure all warehouses of company 11111111-1111-1111-1111-111111111111 are active
UPDATE public.warehouses
SET status = 'active'
WHERE company_id = '11111111-1111-1111-1111-111111111111';
