REVOKE EXECUTE ON FUNCTION public.emit_notification(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_production_completed() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_machine_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_po_received() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_low_inventory() FROM PUBLIC, anon, authenticated;