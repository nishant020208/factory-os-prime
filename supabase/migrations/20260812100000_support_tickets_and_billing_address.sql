-- ============================================================
-- Support Tickets — Customer ↔ Company Admin Q&A
-- (additive: support_tickets already exists with an older schema)
-- ============================================================

-- The support_tickets table already exists (2026-07-25) with columns
-- ticket_number, description, priority... but WITHOUT the portal columns
-- user_id / message / updated_at. Add them idempotently.
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS message     text,
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz NOT NULL DEFAULT now();

-- ticket_number is NOT NULL with no default, but the portal never sets it.
ALTER TABLE public.support_tickets ALTER COLUMN ticket_number DROP NOT NULL;

-- Replies to tickets (new table)
CREATE TABLE IF NOT EXISTS public.support_ticket_replies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  message     text NOT NULL,
  is_admin    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_ticket_replies_ticket_id_idx ON public.support_ticket_replies(ticket_id);

ALTER TABLE public.support_ticket_replies ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.support_ticket_replies TO authenticated;
GRANT ALL ON public.support_ticket_replies TO service_role;

-- Replies RLS — customers only see replies on their OWN tickets;
-- company staff see replies on their company's tickets.
-- Mirrors the *_iso policies already live on support_tickets.
CREATE POLICY support_ticket_replies_select_iso ON public.support_ticket_replies
  FOR SELECT TO authenticated
  USING (
    ticket_id IN (
      SELECT id FROM public.support_tickets
      WHERE (public.is_customer_portal() AND customer_id IN (
        SELECT id FROM public.customers WHERE user_id = auth.uid()
      ))
      OR (NOT public.is_customer_portal() AND public.in_company_ops(company_id))
    )
  );

CREATE POLICY support_ticket_replies_insert_iso ON public.support_ticket_replies
  FOR INSERT TO authenticated
  WITH CHECK (
    ticket_id IN (
      SELECT id FROM public.support_tickets
      WHERE (public.is_customer_portal() AND customer_id IN (
        SELECT id FROM public.customers WHERE user_id = auth.uid()
      ))
      OR (NOT public.is_customer_portal() AND public.in_company_ops(company_id))
    )
  );

-- ============================================================
-- Billing Address columns for customers
-- ============================================================
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS billing_address  text,
  ADD COLUMN IF NOT EXISTS billing_city     text,
  ADD COLUMN IF NOT EXISTS billing_state    text,
  ADD COLUMN IF NOT EXISTS billing_country  text,
  ADD COLUMN IF NOT EXISTS billing_postal   text;
