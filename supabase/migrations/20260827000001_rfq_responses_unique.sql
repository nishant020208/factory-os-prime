-- A supplier may only hold ONE quote per RFQ — enables the upsert path in
-- the RFQ page (submit / update quote).
ALTER TABLE public.rfq_responses
  DROP CONSTRAINT IF EXISTS rfq_responses_rfq_supplier_unique;
ALTER TABLE public.rfq_responses
  ADD CONSTRAINT rfq_responses_rfq_supplier_unique UNIQUE (rfq_id, supplier_id);
