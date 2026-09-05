-- =====================================================================
-- FACTORYOS AI — auto-RFQ on material shortage + realtime RFQ sync
--
-- Part 2 of the Auto-RFQ prompt: when Production Planning detects a
-- material shortfall, the Production Manager's "Trigger Procurement"
-- action now ALSO creates a real RFQ row in Procurement's RFQ tab
-- (quantity = shortfall, not the full requirement), flagged as
-- auto-generated and linked back to the originating sales order so
-- Procurement can review it, pick suppliers, and run the existing
-- RFQ -> quote -> comparison -> PO chain.
--
-- The rfqs INSERT policy (rfqs_insert, in_company_ops) already lets the
-- Production Manager create RFQ rows for their own company, so no RLS
-- change is needed — only the two new columns and realtime publishing so
-- Procurement's open RFQ tab refreshes live when the RFQ appears.
-- =====================================================================

ALTER TABLE public.rfqs
  ADD COLUMN IF NOT EXISTS auto_generated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_order_id uuid REFERENCES public.sales_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rfqs_source_order ON public.rfqs (company_id, source_order_id)
  WHERE source_order_id IS NOT NULL;

-- Live-sync RFQs (and their responses) so Procurement sees an auto-created
-- RFQ the moment the Production Manager raises the shortfall.
ALTER PUBLICATION supabase_realtime ADD TABLE public.rfqs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rfq_responses;