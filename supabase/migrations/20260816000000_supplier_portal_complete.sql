-- =====================================================================
-- FACTORYOS AI — SUPPLIER PORTAL COMPLETE (2026-08-16)
--
--  1. RLS ISOLATION FIXES — supplier_portal is an EXTERNAL role and must
--     only ever see its OWN rows:
--       * purchase_orders  → only POs where supplier_id = own suppliers.id
--       * suppliers        → only own row
--       * notifications    → only own rows (to_user = self)
--     (payments/invoices/shipments are customer-facing tables; supplier
--      gets dedicated supplier_invoices / supplier_payments / messages.)
--  2. NEW TABLES:
--       * supplier_invoices  — invoices the supplier raised for fulfilled POs
--       * supplier_payments  — payments released to the supplier
--       * supplier_messages  — PO-scoped thread with the Procurement Manager
--       * supplier_deliveries — inbound shipment details for a PO
--  3. purchase_orders.created_by — tracks which procurement user created
--     the PO so supplier responses notify the right person.
--  4. Link the demo supplier to supplier@abcmfg.demo and seed demo POs
--     so the portal shows real data end-to-end.
-- =====================================================================

-- ─────────────── 0. HELPER: is_supplier_portal() ───────────────
CREATE OR REPLACE FUNCTION public.is_supplier_portal()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'supplier_portal'::public.app_role
  );
$function$;

-- Resolve the caller's own supplier id (fail-closed: NULL if not linked)
CREATE OR REPLACE FUNCTION public.current_supplier_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT s.id
  FROM public.suppliers s
  WHERE s.user_id = auth.uid()
  LIMIT 1;
$function$;

-- ─────────────── 1. PURCHASE ORDERS RLS ───────────────
-- Supplier can only see POs issued to them.
DROP POLICY IF EXISTS po_select_ops ON public.purchase_orders;
CREATE POLICY po_select_supplier_own ON public.purchase_orders
  FOR SELECT TO authenticated
  USING (
    is_root_admin(auth.uid())
    OR (company_id = current_company_id() AND NOT is_supplier_portal())
    OR (
      is_supplier_portal()
      AND supplier_id = current_supplier_id()
    )
  );

-- Supplier can only UPDATE their own POs (respond, dispatch) and only the
-- response/dispatch fields, never totals or supplier identity.
DROP POLICY IF EXISTS po_update_roles ON public.purchase_orders;
CREATE POLICY po_update_supplier_own ON public.purchase_orders
  FOR UPDATE TO authenticated
  USING (
    is_root_admin(auth.uid())
    OR (
      company_id = current_company_id()
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('procurement_manager','company_admin')
      )
    )
    OR (
      is_supplier_portal()
      AND supplier_id = current_supplier_id()
      AND status IN ('sent','pending','modification_requested','accepted','in_progress')
    )
  )
  WITH CHECK (
    is_root_admin(auth.uid())
    OR (
      company_id = current_company_id()
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('procurement_manager','company_admin')
      )
    )
    OR (
      is_supplier_portal()
      AND supplier_id = current_supplier_id()
    )
  );

-- Supplier can NEVER create a PO — procurement_manager / company_admin only.
DROP POLICY IF EXISTS po_insert_roles ON public.purchase_orders;
CREATE POLICY po_insert_roles ON public.purchase_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    is_root_admin(auth.uid())
    OR (
      company_id = current_company_id()
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('procurement_manager','company_admin')
      )
    )
  );

-- ─────────────── 2. SUPPLIERS RLS ───────────────
-- Supplier sees only their own row.
DROP POLICY IF EXISTS suppliers_select_ops ON public.suppliers;
CREATE POLICY suppliers_select_own_or_ops ON public.suppliers
  FOR SELECT TO authenticated
  USING (
    is_root_admin(auth.uid())
    OR (
      is_supplier_portal()
      AND id = current_supplier_id()
    )
    OR (
      NOT is_supplier_portal()
      AND in_company_ops(company_id)
    )
  );

-- Suppliers cannot modify their own record except profile fields they own;
-- internal ops roles keep full write.
DROP POLICY IF EXISTS suppliers_update ON public.suppliers;
CREATE POLICY suppliers_update_scoped ON public.suppliers
  FOR UPDATE TO authenticated
  USING (
    is_root_admin(auth.uid())
    OR (
      is_supplier_portal()
      AND id = current_supplier_id()
    )
    OR (
      NOT is_supplier_portal()
      AND NOT is_auditor()
      AND in_company_ops(company_id)
    )
  )
  WITH CHECK (
    is_root_admin(auth.uid())
    OR (
      is_supplier_portal()
      AND id = current_supplier_id()
    )
    OR (
      NOT is_supplier_portal()
      AND NOT is_auditor()
      AND in_company_ops(company_id)
    )
  );

DROP POLICY IF EXISTS suppliers_insert ON public.suppliers;
CREATE POLICY suppliers_insert_ops ON public.suppliers
  FOR INSERT TO authenticated
  WITH CHECK (
    is_root_admin(auth.uid())
    OR (
      NOT is_supplier_portal()
      AND NOT is_auditor()
      AND in_company_ops(company_id)
    )
  );

DROP POLICY IF EXISTS suppliers_delete ON public.suppliers;
CREATE POLICY suppliers_delete_ops ON public.suppliers
  FOR DELETE TO authenticated
  USING (
    is_root_admin(auth.uid())
    OR (
      NOT is_supplier_portal()
      AND NOT is_auditor()
      AND in_company_ops(company_id)
    )
  );

-- ─────────────── 3. NOTIFICATIONS RLS ───────────────
-- Supplier may read ONLY notifications addressed to them personally.
DROP POLICY IF EXISTS notifications_select ON public.notifications;
CREATE POLICY notifications_select_scoped ON public.notifications
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      is_supplier_portal()
      AND to_user = auth.uid()
    )
    OR (
      NOT is_supplier_portal()
      AND (company_id = current_company_id() AND has_role(auth.uid(), 'company_admin'))
    )
    OR is_root_admin(auth.uid())
  );

-- ─────────────── 4. NEW TABLES ───────────────
-- 4a. supplier_invoices — invoice the supplier raises against a PO
CREATE TABLE IF NOT EXISTS public.supplier_invoices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  supplier_id    uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  po_id          uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  invoice_number text NOT NULL,
  gst_amount     numeric(14,2) DEFAULT 0,
  total_amount   numeric(14,2) DEFAULT 0,
  status         text NOT NULL DEFAULT 'pending',
  file_url       text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY supplier_invoices_select ON public.supplier_invoices
  FOR SELECT TO authenticated
  USING (
    is_root_admin(auth.uid())
    OR (is_supplier_portal() AND supplier_id = current_supplier_id())
    OR (NOT is_supplier_portal() AND in_company_ops(company_id))
  );

CREATE POLICY supplier_invoices_insert ON public.supplier_invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    is_root_admin(auth.uid())
    OR (is_supplier_portal() AND supplier_id = current_supplier_id())
    OR (NOT is_supplier_portal() AND NOT is_auditor() AND in_company_ops(company_id))
  );

CREATE POLICY supplier_invoices_update ON public.supplier_invoices
  FOR UPDATE TO authenticated
  USING (
    is_root_admin(auth.uid())
    OR (NOT is_supplier_portal() AND NOT is_auditor() AND in_company_ops(company_id))
  )
  WITH CHECK (
    is_root_admin(auth.uid())
    OR (NOT is_supplier_portal() AND NOT is_auditor() AND in_company_ops(company_id))
  );

CREATE POLICY supplier_invoices_delete ON public.supplier_invoices
  FOR DELETE TO authenticated
  USING (
    is_root_admin(auth.uid())
    OR (NOT is_supplier_portal() AND NOT is_auditor() AND in_company_ops(company_id))
  );

-- 4b. supplier_payments — payments released to the supplier
CREATE TABLE IF NOT EXISTS public.supplier_payments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  supplier_id    uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  invoice_id     uuid REFERENCES public.supplier_invoices(id) ON DELETE SET NULL,
  po_id          uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  amount         numeric(14,2) DEFAULT 0,
  transaction_id text,
  method         text,
  status         text NOT NULL DEFAULT 'pending',
  receipt_url    text,
  paid_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY supplier_payments_select ON public.supplier_payments
  FOR SELECT TO authenticated
  USING (
    is_root_admin(auth.uid())
    OR (is_supplier_portal() AND supplier_id = current_supplier_id())
    OR (NOT is_supplier_portal() AND in_company_ops(company_id))
  );

CREATE POLICY supplier_payments_insert ON public.supplier_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    is_root_admin(auth.uid())
    OR (NOT is_supplier_portal() AND NOT is_auditor() AND in_company_ops(company_id))
  );

CREATE POLICY supplier_payments_update ON public.supplier_payments
  FOR UPDATE TO authenticated
  USING (
    is_root_admin(auth.uid())
    OR (NOT is_supplier_portal() AND NOT is_auditor() AND in_company_ops(company_id))
  )
  WITH CHECK (
    is_root_admin(auth.uid())
    OR (NOT is_supplier_portal() AND NOT is_auditor() AND in_company_ops(company_id))
  );

-- 4c. supplier_messages — PO-scoped thread with the Procurement Manager
CREATE TABLE IF NOT EXISTS public.supplier_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  po_id       uuid REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  sender_role text NOT NULL,
  sender_id   uuid,
  message     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.supplier_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY supplier_messages_select ON public.supplier_messages
  FOR SELECT TO authenticated
  USING (
    is_root_admin(auth.uid())
    OR (
      is_supplier_portal()
      AND (supplier_id = current_supplier_id() OR po_id IN (
        SELECT id FROM public.purchase_orders WHERE supplier_id = current_supplier_id()
      ))
    )
    OR (
      NOT is_supplier_portal()
      AND in_company_ops(company_id)
    )
  );

CREATE POLICY supplier_messages_insert ON public.supplier_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    is_root_admin(auth.uid())
    OR (
      is_supplier_portal()
      AND supplier_id = current_supplier_id()
    )
    OR (
      NOT is_supplier_portal()
      AND NOT is_auditor()
      AND in_company_ops(company_id)
    )
  );

-- 4d. supplier_deliveries — inbound shipment details for a PO
CREATE TABLE IF NOT EXISTS public.supplier_deliveries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  po_id             uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  supplier_id       uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  dispatch_date     date,
  carrier           text,
  vehicle_number    text,
  expected_arrival  date,
  tracking_number   text,
  status            text NOT NULL DEFAULT 'dispatched',
  created_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.supplier_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY supplier_deliveries_select ON public.supplier_deliveries
  FOR SELECT TO authenticated
  USING (
    is_root_admin(auth.uid())
    OR (is_supplier_portal() AND supplier_id = current_supplier_id())
    OR (NOT is_supplier_portal() AND in_company_ops(company_id))
  );

CREATE POLICY supplier_deliveries_insert ON public.supplier_deliveries
  FOR INSERT TO authenticated
  WITH CHECK (
    is_root_admin(auth.uid())
    OR (is_supplier_portal() AND supplier_id = current_supplier_id())
    OR (NOT is_supplier_portal() AND NOT is_auditor() AND in_company_ops(company_id))
  );

CREATE POLICY supplier_deliveries_update ON public.supplier_deliveries
  FOR UPDATE TO authenticated
  USING (
    is_root_admin(auth.uid())
    OR (NOT is_supplier_portal() AND NOT is_auditor() AND in_company_ops(company_id))
  )
  WITH CHECK (
    is_root_admin(auth.uid())
    OR (NOT is_supplier_portal() AND NOT is_auditor() AND in_company_ops(company_id))
  );

-- 4e. purchase_orders.created_by — which procurement user created the PO
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- ─────────────── 5. GRANTS ───────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_deliveries TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- ─────────────── 6. DEMO DATA ───────────────
-- Link the demo supplier to supplier@abcmfg.demo (4a4fec23-07cf-4aa3-8ccc-001a37eac179)
UPDATE public.suppliers
SET user_id = '4a4fec23-07cf-4aa3-8ccc-001a37eac179',
    status  = 'active'
WHERE id = 'ce7e6ae8-bc5f-4dce-a75c-9f9da1d99656';

-- Seed demo POs issued to Kerala Teak Suppliers
INSERT INTO public.purchase_orders (
  id, company_id, po_number, supplier_id, status, total_amount, expected_date,
  created_by, supplier_note, created_at
) VALUES
  ('d0800111-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','N-08-PO-TEAK-001','ce7e6ae8-bc5f-4dce-a75c-9f9da1d99656','sent',42500.00, now() + interval '10 days',
   '29d8d3ef-1606-4d47-b578-eb6bdd515ec0','2000 kg Teak Wood grade A — for showroom launch', now() - interval '3 days'),
  ('d0800111-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','N-08-PO-TEAK-002','ce7e6ae8-bc5f-4dce-a75c-9f9da1d99656','accepted',18750.00, now() + interval '5 days',
   '29d8d3ef-1606-4d47-b578-eb6bdd515ec0','500 kg Teak Wood grade B', now() - interval '6 days'),
  ('d0800111-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','N-08-PO-TEAK-003','ce7e6ae8-bc5f-4dce-a75c-9f9da1d99656','received',35400.00, now() - interval '2 days',
   '29d8d3ef-1606-4d47-b578-eb6bdd515ec0','1200 kg Teak Wood grade A — delivered', now() - interval '20 days')
ON CONFLICT (id) DO NOTHING;

-- A dispatched delivery for the accepted PO
INSERT INTO public.supplier_deliveries (
  company_id, po_id, supplier_id, dispatch_date, carrier, vehicle_number,
  expected_arrival, tracking_number, status, created_at
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'd0800111-0000-0000-0000-000000000002',
  'ce7e6ae8-bc5f-4dce-a75c-9f9da1d99656',
  now()::date, 'TransIndia Logistics', 'KL-01-AB-2345',
  (now() + interval '4 days')::date, 'TRK-TEAK-002', 'dispatched', now() - interval '2 days'
);

-- Demo supplier invoice + payment for the received PO
INSERT INTO public.supplier_invoices (
  company_id, supplier_id, po_id, invoice_number, gst_amount, total_amount, status, created_at
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'ce7e6ae8-bc5f-4dce-a75c-9f9da1d99656',
  'd0800111-0000-0000-0000-000000000003',
  'N-08-INV-TEAK-001', 6372.00, 35400.00, 'paid', now() - interval '10 days'
);

INSERT INTO public.supplier_payments (
  company_id, supplier_id, invoice_id, po_id, amount, transaction_id, method, status, paid_at, created_at
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'ce7e6ae8-bc5f-4dce-a75c-9f9da1d99656',
  (SELECT id FROM public.supplier_invoices WHERE invoice_number = 'N-08-INV-TEAK-001'),
  'd0800111-0000-0000-0000-000000000003',
  35400.00, 'TXN-TEAK-001', 'bank_transfer', 'paid', now() - interval '8 days', now() - interval '8 days'
);

-- Confirm seeding
SELECT count(*) AS supplier_pos
FROM public.purchase_orders
WHERE supplier_id = 'ce7e6ae8-bc5f-4dce-a75c-9f9da1d99656';
