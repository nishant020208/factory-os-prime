-- ─────────────────────────────────────────────────────────────
-- 20260819000001 — Restore supplier inbound-shipment QR insert
--
-- The 20260819000000 hardening excluded supplier_portal from
-- qr_codes INSERT. But a supplier legitimately generates the
-- Shipment-Inbound QR when it marks a PO dispatched. Re-add a
-- supplier branch scoped to their OWN purchase orders only.
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS qr_insert ON public.qr_codes;
CREATE POLICY qr_insert ON public.qr_codes
  FOR INSERT TO authenticated
  WITH CHECK (
    is_root_admin(auth.uid())
    OR (
      company_id = current_company_id()
      AND NOT is_auditor()
      AND NOT is_customer_portal()
      AND (
        NOT is_supplier_portal()
        OR (
          entity_type = 'purchase_order'
          AND type = 'inbound_shipment'
          AND EXISTS (
            SELECT 1
            FROM public.purchase_orders po
            WHERE po.id = entity_id
              AND po.supplier_id = current_supplier_id()
              AND po.company_id = current_supplier_company()
          )
        )
      )
    )
  );

-- Confirm
SELECT policyname, cmd, with_check
FROM pg_policies
WHERE tablename = 'qr_codes' AND cmd = 'INSERT';
