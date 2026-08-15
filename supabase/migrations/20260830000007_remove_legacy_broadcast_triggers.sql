-- =============================================================
-- Integration sweep fix: remove legacy BROADCAST notification
-- triggers (2026-08-16).
--
-- Found by the notification targeting re-audit: four legacy DB
-- triggers still inserted company-wide, untargeted notification
-- rows (no to_role / no to_user) via emit_notification() whenever
-- a machine went down, a PO was received, a production order
-- completed, or stock hit the reorder level. The modern app fires
-- correctly targeted notifications (fireNotification with
-- to_user/to_role) for every one of these events, so the triggers
-- are both redundant and a broadcast violation. Dropped here.
-- =============================================================

DROP TRIGGER IF EXISTS on_production_completed ON public.production_orders;
DROP FUNCTION IF EXISTS public.trg_production_completed();

DROP TRIGGER IF EXISTS on_machine_status ON public.machines;
DROP FUNCTION IF EXISTS public.trg_machine_status_change();

DROP TRIGGER IF EXISTS on_po_received ON public.purchase_orders;
DROP FUNCTION IF EXISTS public.trg_po_received();

DROP TRIGGER IF EXISTS on_inventory_low ON public.inventory;
DROP FUNCTION IF EXISTS public.trg_low_inventory();

-- emit_notification was the helper ONLY those triggers used; it is
-- revoked from API access already and now has no callers.
DROP FUNCTION IF EXISTS public.emit_notification(uuid, text, text, text);
