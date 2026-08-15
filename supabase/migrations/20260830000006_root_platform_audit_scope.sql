-- =====================================================================
-- FACTORYOS AI — ROOT GLOBAL AUDIT: PLATFORM-SCOPED VIEW ONLY
-- (2026-08-30)
--
-- The old audit_logs SELECT policy (in_company) returned true for Root,
-- so Root could read EVERY tenant's internal audit feed — undermining
-- per-company isolation (a tenant Auditor's logs are that company's
-- business, not the platform owner's operational feed).
--
-- New rule: Root sees ONLY platform-scoped rows (company_id IS NULL —
-- company approvals, Company Admin whitelisting, Root's own actions).
-- A company Auditor / Company Admin still sees their own company's rows
-- via in_company(company_id).
-- =====================================================================

DROP POLICY IF EXISTS audit_logs_select_scoped ON public.audit_logs;
CREATE POLICY audit_logs_select_scoped ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    (is_root_admin(auth.uid()) AND company_id IS NULL)
    OR (NOT is_root_admin(auth.uid()) AND in_company(company_id))
  );
