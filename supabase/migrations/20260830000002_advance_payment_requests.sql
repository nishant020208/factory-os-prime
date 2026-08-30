-- Advance payment requests tied to sales orders
CREATE TABLE IF NOT EXISTS public.advance_payment_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  percentage NUMERIC NOT NULL DEFAULT 30,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT, -- 'qr' or 'bank_transfer'
  payment_qr_url TEXT,
  bank_details TEXT,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'paid_pending_confirmation', 'confirmed', 'rejected')),
  requested_by UUID,
  requested_at TIMESTAMPTZ DEFAULT now(),
  confirmed_by UUID,
  confirmed_at TIMESTAMPTZ,
  customer_paid_at TIMESTAMPTZ,
  customer_payment_ref TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.advance_payment_requests ENABLE ROW LEVEL SECURITY;

-- Production Manager can view/edit advance payment requests for their company
CREATE POLICY "advance_payment_production_select" ON public.advance_payment_requests
  FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('production_manager', 'company_admin')
    )
  );

CREATE POLICY "advance_payment_production_insert" ON public.advance_payment_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('production_manager', 'company_admin')
    )
  );

CREATE POLICY "advance_payment_production_update" ON public.advance_payment_requests
  FOR UPDATE TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('production_manager', 'company_admin')
    )
  );

-- Customer can view their own order's advance payment requests
CREATE POLICY "advance_payment_customer_select" ON public.advance_payment_requests
  FOR SELECT TO authenticated
  USING (
    order_id IN (
      SELECT id FROM public.sales_orders
      WHERE customer_id IN (
        SELECT id FROM public.customers WHERE user_id = auth.uid()
      )
    )
  );

-- Customer can update status to paid_pending_confirmation
CREATE POLICY "advance_payment_customer_update" ON public.advance_payment_requests
  FOR UPDATE TO authenticated
  USING (
    order_id IN (
      SELECT id FROM public.sales_orders
      WHERE customer_id IN (
        SELECT id FROM public.customers WHERE user_id = auth.uid()
      )
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_advance_payment_order_id ON public.advance_payment_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_advance_payment_company_id ON public.advance_payment_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_advance_payment_status ON public.advance_payment_requests(status);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.advance_payment_requests TO authenticated;
