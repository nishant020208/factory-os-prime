-- =====================================================================
-- FACTORYOS AI — let suppliers read only the RFQs actually sent to them
--
-- Discovered during the auto-RFQ end-to-end verification: rfqs had SELECT
-- policies for internal ops and procurement only — no policy for the
-- supplier portal. The app filters supplier RFQs with
-- .contains("supplier_ids", [mySupplier.id]) but RLS returned 0 rows
-- before that filter could apply, so the supplier's RFQ list was always
-- empty and quotes could never be submitted.
--
-- This policy scopes suppliers to RFQs where their own supplier_id is in
-- supplier_ids (i.e. the RFQ was explicitly sent to them) — they never see
-- drafts, other suppliers' RFQs, or anything sent only to someone else.
-- =====================================================================

CREATE POLICY rfqs_select_supplier_own
  ON public.rfqs
  FOR SELECT
  TO authenticated
  USING (
    is_supplier_portal()
    AND company_id = current_company_id()
    AND supplier_ids IS NOT NULL
    AND current_supplier_id() = ANY (supplier_ids)
  );