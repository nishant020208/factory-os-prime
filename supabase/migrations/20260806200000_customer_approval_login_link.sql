-- =============================================================================
-- CUSTOMER APPROVAL → LOGIN LINK
-- Fixes two related gaps in the customer-request approval flow:
--
-- 1. Approving a request must whitelist the customer's email so they can
--    actually sign in (the app's account pattern is: whitelist row → signup →
--    handle_new_user trigger creates profile + user_roles).
--
-- 2. When that customer signs up, link the `customers` row (created at
--    approval time) to their auth uid via customers.user_id, so RLS scoping,
--    order placement and targeted notifications all resolve for them.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. handle_new_user: link customers.user_id for customer_portal signups
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  wl RECORD;
BEGIN
  SELECT * INTO wl FROM public.whitelist
   WHERE lower(email) = lower(NEW.email)
     AND status = 'pending'
     AND (expires_at IS NULL OR expires_at > now())
   ORDER BY created_at DESC
   LIMIT 1;

  IF wl.id IS NULL THEN
    RAISE EXCEPTION 'Email % is not whitelisted for FactoryOS registration', NEW.email;
  END IF;

  INSERT INTO public.profiles (id, company_id, plant_id, email, full_name)
  VALUES (NEW.id, wl.company_id, wl.plant_id, NEW.email,
          COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)));

  INSERT INTO public.user_roles (user_id, role, company_id, plant_id)
  VALUES (NEW.id, wl.role, wl.company_id, wl.plant_id);

  -- Customer portal accounts: bind the customers row (created when the Company
  -- Admin approved the request) to this auth uid. Matches by email on either
  -- the modern `email` column or the legacy `contact_email` column.
  IF wl.role = 'customer_portal'::public.app_role THEN
    UPDATE public.customers
       SET user_id = NEW.id
     WHERE company_id = wl.company_id
       AND (lower(COALESCE(email, '')) = lower(NEW.email)
            OR lower(COALESCE(contact_email, '')) = lower(NEW.email))
       AND (user_id IS NULL OR user_id = NEW.id);
  END IF;

  UPDATE public.whitelist SET status='accepted', accepted_at=now() WHERE id = wl.id;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. RLS: allow Company Admin to whitelist the customer's email on approval
-- ---------------------------------------------------------------------------
-- whitelist RLS already lets company admins of a company insert rows for that
-- company (used by the employee whitelist page). Ensure grants cover the
-- INSERT path used by the customer-request approval flow.
GRANT INSERT, SELECT, UPDATE ON public.whitelist TO authenticated;
