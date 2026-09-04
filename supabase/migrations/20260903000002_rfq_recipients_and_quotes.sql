-- ============================================================
-- RFQ Recipients & Quotes tables with RLS for supplier isolation
-- ============================================================

-- 1. rfq_recipients: tracks which suppliers were sent each RFQ
CREATE TABLE IF NOT EXISTS public.rfq_recipients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rfq_id UUID NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'viewed', 'quoted', 'declined')),
  sent_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(rfq_id, supplier_id)
);

-- 2. rfq_quotes: stores the actual quote data from suppliers
CREATE TABLE IF NOT EXISTS public.rfq_quotes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rfq_id UUID NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  quoted_unit_price NUMERIC NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  minimum_order_quantity NUMERIC,
  estimated_delivery_days INTEGER,
  notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(rfq_id, supplier_id)
);

-- 3. Add target_delivery_date to rfqs if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rfqs' AND column_name = 'target_delivery_date') THEN
    ALTER TABLE public.rfqs ADD COLUMN target_delivery_date DATE;
  END IF;
END $$;

-- 4. Enable RLS on both tables
ALTER TABLE public.rfq_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_quotes ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for rfq_recipients
-- Procurement Manager can see all recipients for their company's RFQs
DROP POLICY IF EXISTS "rfq_recipients_procurement_select" ON public.rfq_recipients;
CREATE POLICY "rfq_recipients_procurement_select" ON public.rfq_recipients
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rfqs r
      WHERE r.id = rfq_recipients.rfq_id
      AND r.company_id = (
        SELECT company_id FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role = 'procurement_manager'
        LIMIT 1
      )
    )
  );

-- Supplier can only see their own recipient record
DROP POLICY IF EXISTS "rfq_recipients_supplier_select" ON public.rfq_recipients;
CREATE POLICY "rfq_recipients_supplier_select" ON public.rfq_recipients
  FOR SELECT
  TO authenticated
  USING (
    supplier_id IN (
      SELECT id FROM public.suppliers
      WHERE user_id = auth.uid()
    )
  );

-- Procurement Manager can insert recipients for their company's RFQs
DROP POLICY IF EXISTS "rfq_recipients_procurement_insert" ON public.rfq_recipients;
CREATE POLICY "rfq_recipients_procurement_insert" ON public.rfq_recipients
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rfqs r
      WHERE r.id = rfq_recipients.rfq_id
      AND r.company_id = (
        SELECT company_id FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role = 'procurement_manager'
        LIMIT 1
      )
    )
  );

-- Supplier can update their own recipient status (e.g., mark as viewed)
DROP POLICY IF EXISTS "rfq_recipients_supplier_update" ON public.rfq_recipients;
CREATE POLICY "rfq_recipients_supplier_update" ON public.rfq_recipients
  FOR UPDATE
  TO authenticated
  USING (
    supplier_id IN (
      SELECT id FROM public.suppliers
      WHERE user_id = auth.uid()
    )
  );

-- 6. RLS Policies for rfq_quotes
-- Procurement Manager can see all quotes for their company's RFQs
DROP POLICY IF EXISTS "rfq_quotes_procurement_select" ON public.rfq_quotes;
CREATE POLICY "rfq_quotes_procurement_select" ON public.rfq_quotes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rfqs r
      WHERE r.id = rfq_quotes.rfq_id
      AND r.company_id = (
        SELECT company_id FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role = 'procurement_manager'
        LIMIT 1
      )
    )
  );

-- Supplier can only see their OWN quote (critical for competitive confidentiality)
DROP POLICY IF EXISTS "rfq_quotes_supplier_select" ON public.rfq_quotes;
CREATE POLICY "rfq_quotes_supplier_select" ON public.rfq_quotes
  FOR SELECT
  TO authenticated
  USING (
    supplier_id IN (
      SELECT id FROM public.suppliers
      WHERE user_id = auth.uid()
    )
  );

-- Supplier can only insert THEIR OWN quote
DROP POLICY IF EXISTS "rfq_quotes_supplier_insert" ON public.rfq_quotes;
CREATE POLICY "rfq_quotes_supplier_insert" ON public.rfq_quotes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    supplier_id IN (
      SELECT id FROM public.suppliers
      WHERE user_id = auth.uid()
    )
  );

-- Supplier can only update THEIR OWN quote
DROP POLICY IF EXISTS "rfq_quotes_supplier_update" ON public.rfq_quotes;
CREATE POLICY "rfq_quotes_supplier_update" ON public.rfq_quotes
  FOR UPDATE
  TO authenticated
  USING (
    supplier_id IN (
      SELECT id FROM public.suppliers
      WHERE user_id = auth.uid()
    )
  );

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rfq_recipients_rfq_id ON public.rfq_recipients(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_recipients_supplier_id ON public.rfq_recipients(supplier_id);
CREATE INDEX IF NOT EXISTS idx_rfq_quotes_rfq_id ON public.rfq_quotes(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_quotes_supplier_id ON public.rfq_quotes(supplier_id);

-- 8. Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.rfq_recipients TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.rfq_quotes TO authenticated;

-- 9. Create a view for Procurement to see quote comparison
CREATE OR REPLACE VIEW public.rfq_quote_comparison AS
SELECT
  r.id AS rfq_id,
  r.rfq_number,
  r.title AS material_name,
  r.quantity,
  r.status AS rfq_status,
  s.name AS supplier_name,
  s.id AS supplier_id,
  q.quoted_unit_price,
  q.currency,
  q.minimum_order_quantity,
  q.estimated_delivery_days,
  q.notes AS quote_notes,
  q.submitted_at,
  rr.status AS recipient_status
FROM public.rfqs r
JOIN public.rfq_recipients rr ON rr.rfq_id = r.id
JOIN public.suppliers s ON s.id = rr.supplier_id
LEFT JOIN public.rfq_quotes q ON q.rfq_id = r.id AND q.supplier_id = rr.supplier_id
WHERE r.company_id = (
  SELECT company_id FROM public.user_roles
  WHERE user_id = auth.uid()
  AND role = 'procurement_manager'
  LIMIT 1
);
