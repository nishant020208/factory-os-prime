-- ============================================================================
-- Profile Portal — auditor self-edit audit fix
--
-- An Auditor's own profile edits must still be recorded in audit_logs (the
-- "self-referential" case). The trg_audit_write pipeline was blocked because
-- audit_logs itself carries trg_block_auditor_write, which raised on the audit
-- INSERT (actor = auditor) and rolled back the whole profile write.
--
-- Fix:
--   1. block_auditor_writes() now exempts audit_logs — the audit pipeline must
--      be able to log the auditor's activity (append-only, SECURITY DEFINER).
--   2. audit_logs INSERT RLS no longer permits the auditor role directly, so
--      an auditor cannot forge audit rows through the API.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.block_auditor_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- The write-audit pipeline must be able to record auditor activity; without
  -- this exemption the AFTER-trigger INSERT into audit_logs would roll back the
  -- very write we are supposed to log. Direct auditor inserts remain blocked by
  -- RLS (audit_logs_insert_scoped below).
  IF TG_TABLE_NAME = 'audit_logs' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'auditor'
  ) THEN
    RAISE EXCEPTION 'Auditor role is read-only: writes are not permitted (table: %)', TG_TABLE_NAME;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $function$;

DROP POLICY IF EXISTS audit_logs_insert_scoped ON public.audit_logs;
CREATE POLICY audit_logs_insert_scoped ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (NOT is_auditor());
