-- =====================================================================
-- FACTORYOS AI — purchase requisitions: allow the 'converted' status
--
-- The convert-to-PO flow marks a requisition 'converted' once its PO is
-- created, but the original status CHECK only allowed pending/approved/
-- ordered, so that final update always violated the constraint: the PO
-- was created while the requisition stayed pending and the UI reported
-- an error. Extend the allowed statuses (additive, no data change).
-- =====================================================================

ALTER TABLE public.purchase_requisitions
  DROP CONSTRAINT IF EXISTS purchase_requisitions_status_check;

ALTER TABLE public.purchase_requisitions
  ADD CONSTRAINT purchase_requisitions_status_check
  CHECK (status IN ('pending', 'approved', 'ordered', 'converted'));
