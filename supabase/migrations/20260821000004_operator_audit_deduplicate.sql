-- work_orders already has the platform write-audit trigger. Keep one canonical
-- old→new record there; the operator-specific trigger remains necessary for
-- attendance and maintenance-ticket actions.
DROP TRIGGER IF EXISTS trg_operator_work_order_audit ON public.work_orders;
