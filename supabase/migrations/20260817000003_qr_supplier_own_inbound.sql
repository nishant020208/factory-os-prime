-- =====================================================================
-- FACTORYOS AI — SUPPLIER OWN INBOUND QR SELECT (2026-08-17)
--
-- qr_select_ops previously excluded supplier_portal entirely. That broke
-- the dispatch flow: the supplier INSERTs the Shipment-Inbound QR with
-- `.select("token")`, and PostgREST evaluates the RETURNING row against
-- the SELECT policy — so the whole insert was rejected with 403. The
-- "View QR" button on the PO list has the same problem.
--
-- Fix: a supplier may SELECT ONLY their own inbound_shipment QR rows
-- (type='inbound_shipment' on one of their own POs). Every other QR row
-- in the company — invoices, work orders, customer shipments — stays
-- invisible to the supplier.
-- =====================================================================

DROP POLICY IF EXISTS qr_select_ops ON public.qr_codes;
CREATE POLICY qr_select_ops ON public.qr_codes
  FOR SELECT TO authenticated
  USING (
    company_id = current_company_id()
    AND (
      NOT is_supplier_portal()
      OR (
        type = 'inbound_shipment'
        AND entity_id IN (
          SELECT id
          FROM public.purchase_orders
          WHERE supplier_id = current_supplier_id()
            AND company_id = current_supplier_company()
        )
      )
    )
  );

-- Confirm
SELECT policyname, qual::text
FROM pg_policies
WHERE tablename = 'qr_codes';
