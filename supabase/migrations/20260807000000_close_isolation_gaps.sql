-- =============================================================================
-- CLOSE CUSTOMER-ISOLATION GAPS
-- -----------------------------------------------------------------------------
-- The isolation migration (20260806220000) rewrote SELECT/INSERT/UPDATE/DELETE
-- policies on customer-facing tables, but a few permissive policies survived:
--
--  * customer_documents used cd_* names — the loop dropped
--    "customer_documents_*" (non-existent) so cd_select_ops / cd_insert /
--    cd_delete stayed live. cd_select_ops (company-scoped) still let any
--    customer read ALL customer documents in the company — the exact leak
--    the isolation pass was meant to close.
--
--  * customers still had cust_insert_company / cust_update_company
--    (company-scoped, no customer guard) — customers could INSERT fake
--    customer rows or UPDATE any customer row in their company.
--
--  * finished_goods.fg_insert_company, profile_change_requests.pcr_update,
--    order_status_history.osh_insert remained company-permissive for writes.
-- =============================================================================

-- ───────────── 1. customer_documents: drop legacy cd_* policies ─────────────
DROP POLICY IF EXISTS cd_select_ops ON public.customer_documents;
DROP POLICY IF EXISTS cd_insert ON public.customer_documents;
DROP POLICY IF EXISTS cd_delete ON public.customer_documents;

-- ───────────── 2. customers: drop company-permissive write policies ─────────
DROP POLICY IF EXISTS cust_insert_company ON public.customers;
DROP POLICY IF EXISTS cust_update_company ON public.customers;

-- ───────────── 3. finished_goods: drop permissive insert ────────────────────
DROP POLICY IF EXISTS fg_insert_company ON public.finished_goods;

-- ───────────── 4. profile_change_requests: drop permissive update ───────────
-- Recreate with the customer guard: only internal roles (or root) may update;
-- customers may never touch others' change requests.
DROP POLICY IF EXISTS pcr_update ON public.profile_change_requests;
CREATE POLICY pcr_update_iso ON public.profile_change_requests
  FOR UPDATE TO authenticated
  USING (NOT public.is_customer_portal() AND public.in_company_ops(company_id))
  WITH CHECK (NOT public.is_customer_portal() AND public.in_company_ops(company_id));

-- pcr_all / pcr_insert legacy INSERT policies: scope to internal roles.
DROP POLICY IF EXISTS pcr_all ON public.profile_change_requests;
DROP POLICY IF EXISTS pcr_insert ON public.profile_change_requests;
CREATE POLICY pcr_insert_iso ON public.profile_change_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    (NOT public.is_customer_portal() AND public.in_company_ops(company_id))
    OR (public.is_customer_portal() AND user_id = auth.uid()
        AND company_id = public.current_company_id())
  );

-- ───────────── 5. order_status_history: scope INSERT to internal roles ──────
DROP POLICY IF EXISTS osh_insert ON public.order_status_history;
CREATE POLICY osh_insert_iso ON public.order_status_history
  FOR INSERT TO authenticated
  WITH CHECK (
    (NOT public.is_customer_portal() AND public.in_company_ops(company_id))
    OR public.is_root_admin(auth.uid())
  );

-- ───────────── 6. documents: customers see own uploads + public docs ────────
-- Shared company documents (visibility 'company') stay internal-only; a
-- customer may read their own uploads or anything marked public.
DROP POLICY IF EXISTS documents_select_iso ON public.documents;
CREATE POLICY documents_select_iso ON public.documents
  FOR SELECT TO authenticated
  USING (
    (public.is_customer_portal() AND
      (uploaded_by = auth.uid() OR visibility = 'public'))
    OR (NOT public.is_customer_portal() AND public.in_company_ops(company_id))
    OR (public.is_auditor() AND public.in_company_ops(company_id))
  );
