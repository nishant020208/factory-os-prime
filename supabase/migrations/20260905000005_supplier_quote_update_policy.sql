-- =====================================================================
-- FACTORYOS AI — allow suppliers to update ONLY their own pending quotes
--
-- Discovered during the auto-RFQ end-to-end verification: the supplier
-- portal's "Submit Quote" / "Decline" actions update rfq_responses
-- (pending -> quoted / declined), but the only UPDATE policy on
-- rfq_responses targets procurement_manager/company_admin. A supplier's
-- upsert silently affected 0 rows, so quotes could never actually be
-- submitted on an RFQ that was sent to them.
--
-- This policy lets a supplier update ONLY their own response rows, and
-- only the pending -> quoted/declined transition. It cannot touch other
-- suppliers' rows (SELECT remains scoped by supplier_id) and cannot
-- overwrite procurement decisions (accepted/declined/converted rows).
-- =====================================================================

CREATE POLICY rfq_responses_update_supplier_own
  ON public.rfq_responses
  FOR UPDATE
  TO authenticated
  USING (
    is_supplier_portal()
    AND supplier_id = current_supplier_id()
    AND status = 'pending'
  )
  WITH CHECK (
    is_supplier_portal()
    AND supplier_id = current_supplier_id()
    AND status IN ('quoted', 'declined')
  );