-- ============================================================
-- Backfill missing QR codes for invoices and supplier deliveries
-- ============================================================

-- 1. Backfill invoice QR codes for any existing invoice lacking one (e.g. INV-DEMO-003)
INSERT INTO public.qr_codes (
  company_id, entity_type, entity_id, type, status, qr_data, token, label, sub_label
)
SELECT
  inv.company_id,
  'invoice',
  inv.id,
  'invoice',
  'active',
  inv.id,
  CASE
    WHEN inv.invoice_number = 'INV-DEMO-003' THEN '11111111-2222-3333-4444-555555555507'::uuid
    ELSE gen_random_uuid()
  END,
  inv.invoice_number,
  'Invoice QR'
FROM public.invoices inv
WHERE NOT EXISTS (
  SELECT 1 FROM public.qr_codes qr
  WHERE qr.entity_id = inv.id
    AND qr.entity_type = 'invoice'
)
ON CONFLICT (token) DO NOTHING;

-- 2. Backfill inbound shipment QR codes for any existing supplier delivery / PO lacking one
INSERT INTO public.qr_codes (
  company_id, entity_type, entity_id, type, status, qr_data, token, label, sub_label
)
SELECT
  d.company_id,
  'purchase_order',
  d.po_id,
  'inbound_shipment',
  'active',
  d.po_id,
  CASE
    WHEN po.po_number = 'N-08-PO-TEAK-002' THEN '11111111-2222-3333-4444-555555555508'::uuid
    ELSE gen_random_uuid()
  END,
  COALESCE(po.po_number, 'PO'),
  'Inbound: ' || COALESCE(d.carrier, 'Carrier') || ' · ' || COALESCE(d.tracking_number, '—')
FROM public.supplier_deliveries d
LEFT JOIN public.purchase_orders po ON po.id = d.po_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.qr_codes qr
  WHERE qr.entity_id = d.po_id
    AND qr.type = 'inbound_shipment'
)
ON CONFLICT (token) DO NOTHING;
