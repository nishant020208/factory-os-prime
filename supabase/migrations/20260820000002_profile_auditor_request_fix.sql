-- ============================================================================
-- Profile Portal — auditor change-request fix
--
-- Auditors may not write anywhere EXCEPT their own profile change requests
-- (their name/email fields are approval-gated, so the only path is a request).
-- The pre-existing trg_block_auditor_write on profile_change_requests blocked
-- even that. RLS already confines the table to own-insert (pcr_insert_own) and
-- approver-update (pcr_update_approver, with no self-approval) — there is no
-- DELETE policy at all — so dropping the blanket auditor block is safe.
-- ============================================================================

DROP TRIGGER IF EXISTS trg_block_auditor_write ON public.profile_change_requests;
