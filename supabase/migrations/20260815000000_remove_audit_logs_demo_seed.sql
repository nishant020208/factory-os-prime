-- =====================================================================
-- 20260815000000_remove_audit_logs_demo_seed.sql
-- Removes the demo-seeded audit_logs rows (marked via metadata
-- demo_seed='true'). The audit trail must contain ONLY real write
-- events captured by the DB-level audit_write_event() triggers —
-- no hardcoded/demo entries.
--
-- =====================================================================

DELETE FROM public.audit_logs
WHERE metadata->>'demo_seed' = 'true';

-- Confirm what remains: only trigger-captured real events.
SELECT count(*) AS remaining_audit_events
FROM public.audit_logs
WHERE metadata->>'demo_seed' IS DISTINCT FROM 'true';
