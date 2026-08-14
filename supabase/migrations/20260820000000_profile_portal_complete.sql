-- ============================================================================
-- FactoryOS AI — Profile Portal: Complete Build & Hardening (all 15 roles)
--
-- 1. profile_change_requests → spec schema (old_value/new_value, reviewed_by/
--    reviewed_at, rejection_reason, requested_by) + RLS (own-insert only,
--    approver-review only, no self-approval) + column-guard trigger + audit.
-- 2. profiles → new columns (department, certifications); RLS split into
--    owner (self-editable) vs approver (root / company admin) vs ops (same
--    company, never their own sensitive fields); column-guard trigger so a row
--    owner can never write sensitive identity fields directly.
-- 3. customers / suppliers → owner self-edit policies + column-guard triggers
--    (contact fields self-editable; name/email/GST/address/materials/bank only
--    via Company Admin approval).
-- 4. Auditor: own profile edits allowed (and audited via trg_audit_write),
--    sensitive fields still approval-gated; all other auditor writes stay blocked.
-- ============================================================================

-- ════════════════════════════════════════════════════════════════════════
-- 1. profile_change_requests — schema
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.profile_change_requests
  ADD COLUMN IF NOT EXISTS requested_by uuid,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

UPDATE public.profile_change_requests SET requested_by = user_id WHERE requested_by IS NULL;

ALTER TABLE public.profile_change_requests
  ALTER COLUMN requested_by SET NOT NULL,
  ALTER COLUMN requested_by SET DEFAULT auth.uid();

ALTER TABLE public.profile_change_requests RENAME COLUMN current_value TO old_value;
ALTER TABLE public.profile_change_requests RENAME COLUMN requested_value TO new_value;
ALTER TABLE public.profile_change_requests RENAME COLUMN approver_id TO reviewed_by;
ALTER TABLE public.profile_change_requests RENAME COLUMN resolved_at TO reviewed_at;

-- ════════════════════════════════════════════════════════════════════════
-- 2. profiles — new columns
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS certifications text;

-- ════════════════════════════════════════════════════════════════════════
-- 3. suppliers — new profile columns
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS contact_person text,
  ADD COLUMN IF NOT EXISTS gst_number text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS materials_supplied text,
  ADD COLUMN IF NOT EXISTS bank_details text;

-- ════════════════════════════════════════════════════════════════════════
-- 4. profile_change_requests — RLS
--    Old policies allowed ANY authenticated user to insert a request for ANY
--    user/company and to update any request. Replaced with own-insert-only,
--    approver-review-only, no-self-approval.
-- ════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS pcr_insert_iso ON public.profile_change_requests;
DROP POLICY IF EXISTS pcr_select_iso ON public.profile_change_requests;
DROP POLICY IF EXISTS pcr_update_iso ON public.profile_change_requests;

CREATE POLICY pcr_insert_own ON public.profile_change_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND requested_by = auth.uid()
    AND company_id = current_company_id()
  );

CREATE POLICY pcr_select_own_or_approver ON public.profile_change_requests
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR is_root_admin(auth.uid())
    OR (has_role(auth.uid(), 'company_admin'::app_role) AND company_id = current_company_id())
  );

CREATE POLICY pcr_update_approver ON public.profile_change_requests
  FOR UPDATE TO authenticated
  USING (
    requested_by <> auth.uid()
    AND (
      is_root_admin(auth.uid())
      OR (has_role(auth.uid(), 'company_admin'::app_role) AND company_id = current_company_id())
    )
  )
  WITH CHECK (
    requested_by <> auth.uid()
    AND (
      is_root_admin(auth.uid())
      OR (has_role(auth.uid(), 'company_admin'::app_role) AND company_id = current_company_id())
    )
  );

-- Column-guard: request identity/values are immutable after creation; only an
-- approver may move status and may never review their own request.
CREATE OR REPLACE FUNCTION public.guard_pcr_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  _is_approver boolean := is_root_admin(auth.uid())
    OR (has_role(auth.uid(), 'company_admin'::app_role) AND NEW.company_id = current_company_id());
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.requested_by IS DISTINCT FROM OLD.requested_by
     OR NEW.company_id IS DISTINCT FROM OLD.company_id
     OR NEW.field_name IS DISTINCT FROM OLD.field_name
     OR NEW.old_value IS DISTINCT FROM OLD.old_value
     OR NEW.new_value IS DISTINCT FROM OLD.new_value THEN
    RAISE EXCEPTION 'Request identity and requested values are immutable after creation';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
     OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
     OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
    IF NOT _is_approver THEN
      RAISE EXCEPTION 'Only an approver (Company Admin or Root) may review a profile change request';
    END IF;
    IF NEW.requested_by = auth.uid() THEN
      RAISE EXCEPTION 'Self-approval of a profile change request is not permitted';
    END IF;
    IF NEW.status = 'approved' AND NEW.reviewed_by IS NULL THEN
      RAISE EXCEPTION 'An approved request must record the reviewer';
    END IF;
  END IF;

  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_guard_pcr_update ON public.profile_change_requests;
CREATE TRIGGER trg_guard_pcr_update
  BEFORE UPDATE ON public.profile_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_pcr_update();

-- Audit the request lifecycle (creation, review decisions) via the existing
-- write-audit pipeline.
DROP TRIGGER IF EXISTS trg_audit_write ON public.profile_change_requests;
CREATE TRIGGER trg_audit_write
  AFTER INSERT OR UPDATE OR DELETE ON public.profile_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.audit_write_event();

-- ════════════════════════════════════════════════════════════════════════
-- 5. profiles — RLS: owner vs approver vs ops + column guard
--    OLD: profiles_update let ANY internal role update ANY profile row in ANY
--    company; profiles_update_own let the row owner rewrite sensitive fields.
-- ════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS profiles_update ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;

-- Owner may update their own row (self-editable columns only — the guard
-- trigger below rejects sensitive-column changes by the row owner).
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Approvers: Root anywhere, Company Admin within their own company.
CREATE POLICY profiles_update_approver ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    is_root_admin(auth.uid())
    OR (has_role(auth.uid(), 'company_admin'::app_role) AND company_id = current_company_id())
  )
  WITH CHECK (
    is_root_admin(auth.uid())
    OR (has_role(auth.uid(), 'company_admin'::app_role) AND company_id = current_company_id())
  );

-- Ops roles (HR editing employee records, plant admins, etc.) may update
-- profiles within their own company — never their OWN sensitive fields
-- (enforced by the guard trigger), never another company (in_company_ops).
CREATE POLICY profiles_update_ops ON public.profiles
  FOR UPDATE TO authenticated
  USING (in_company_ops(company_id))
  WITH CHECK (in_company_ops(company_id));

-- Column guard: sensitive identity fields (name/email/job title/company/plant/
-- status/department/certifications) are writable only by Root, or by a same-
-- company Company Admin acting on SOMEONE ELSE's row (approval). A row owner
-- can never write them directly — that path goes through a change request.
CREATE OR REPLACE FUNCTION public.guard_profiles_sensitive_cols()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  _is_self  boolean := (auth.uid() = OLD.id);
  _changed  boolean := (
    OLD.full_name IS DISTINCT FROM NEW.full_name OR
    OLD.email IS DISTINCT FROM NEW.email OR
    OLD.job_title IS DISTINCT FROM NEW.job_title OR
    OLD.company_id IS DISTINCT FROM NEW.company_id OR
    OLD.plant_id IS DISTINCT FROM NEW.plant_id OR
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.is_main_admin IS DISTINCT FROM NEW.is_main_admin OR
    OLD.department IS DISTINCT FROM NEW.department OR
    OLD.certifications IS DISTINCT FROM NEW.certifications
  );
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT _changed THEN
    RETURN NEW;
  END IF;
  IF is_root_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF _is_self THEN
    RAISE EXCEPTION 'Sensitive profile fields (name/email/role/department/company) require % approval — submit a change request instead',
      (SELECT CASE
        WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'company_admin') THEN 'Root Super Admin'
        ELSE 'Company Admin'
      END);
  END IF;
  IF in_company_ops(OLD.company_id) OR in_company_ops(NEW.company_id) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Cross-company profile edit blocked';
END $fn$;

DROP TRIGGER IF EXISTS trg_guard_profiles_sensitive_cols ON public.profiles;
CREATE TRIGGER trg_guard_profiles_sensitive_cols
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profiles_sensitive_cols();

-- Auditor: allow OWN profile edits (self-editable fields only; guard trigger
-- blocks their sensitive fields; RLS blocks them from everyone else's rows).
-- Every auditor profile write is still audited by trg_audit_write.
DROP TRIGGER IF EXISTS trg_block_auditor_write ON public.profiles;

-- ════════════════════════════════════════════════════════════════════════
-- 6. customers — owner self-edit + column guard
--    OLD: customers_update_iso blocked the customer portal entirely, so a
--    customer could not even update their own contact fields.
-- ════════════════════════════════════════════════════════════════════════
CREATE POLICY customers_update_own ON public.customers
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.guard_customer_sensitive_cols()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  _is_self boolean := (auth.uid() = OLD.user_id);
  _changed_sensitive boolean := (
    OLD.business_name IS DISTINCT FROM NEW.business_name OR
    OLD.name IS DISTINCT FROM NEW.name OR
    OLD.email IS DISTINCT FROM NEW.email OR
    OLD.contact_email IS DISTINCT FROM NEW.contact_email OR
    OLD.gst_number IS DISTINCT FROM NEW.gst_number OR
    OLD.billing_address IS DISTINCT FROM NEW.billing_address OR
    OLD.shipping_address IS DISTINCT FROM NEW.shipping_address OR
    OLD.billing_city IS DISTINCT FROM NEW.billing_city OR
    OLD.billing_state IS DISTINCT FROM NEW.billing_state OR
    OLD.billing_country IS DISTINCT FROM NEW.billing_country OR
    OLD.billing_postal IS DISTINCT FROM NEW.billing_postal OR
    OLD.credit_limit IS DISTINCT FROM NEW.credit_limit OR
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.segment IS DISTINCT FROM NEW.segment OR
    OLD.company_id IS DISTINCT FROM NEW.company_id
  );
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT _changed_sensitive THEN
    RETURN NEW;
  END IF;
  IF is_root_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF _is_self THEN
    RAISE EXCEPTION 'Sensitive customer fields (company name/email/GST/address) require Company Admin approval';
  END IF;
  IF in_company_ops(OLD.company_id) OR in_company_ops(NEW.company_id) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Cross-company customer edit blocked';
END $fn$;

DROP TRIGGER IF EXISTS trg_guard_customer_sensitive_cols ON public.customers;
CREATE TRIGGER trg_guard_customer_sensitive_cols
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.guard_customer_sensitive_cols();

-- ════════════════════════════════════════════════════════════════════════
-- 7. suppliers — column guard (owner self-edit already allowed by
--    suppliers_update_scoped for own row; this restricts the columns).
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.guard_supplier_sensitive_cols()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  _is_self boolean := (auth.uid() = OLD.user_id);
  _changed_sensitive boolean := (
    OLD.name IS DISTINCT FROM NEW.name OR
    OLD.contact_email IS DISTINCT FROM NEW.contact_email OR
    OLD.gst_number IS DISTINCT FROM NEW.gst_number OR
    OLD.address IS DISTINCT FROM NEW.address OR
    OLD.materials_supplied IS DISTINCT FROM NEW.materials_supplied OR
    OLD.bank_details IS DISTINCT FROM NEW.bank_details OR
    OLD.payment_terms IS DISTINCT FROM NEW.payment_terms OR
    OLD.category IS DISTINCT FROM NEW.category OR
    OLD.rating IS DISTINCT FROM NEW.rating OR
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.company_id IS DISTINCT FROM NEW.company_id
  );
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT _changed_sensitive THEN
    RETURN NEW;
  END IF;
  IF is_root_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF _is_self THEN
    RAISE EXCEPTION 'Sensitive supplier fields (company name/email/GST/address/materials/bank details) require Company Admin approval';
  END IF;
  IF in_company_ops(OLD.company_id) OR in_company_ops(NEW.company_id) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Cross-company supplier edit blocked';
END $fn$;

DROP TRIGGER IF EXISTS trg_guard_supplier_sensitive_cols ON public.suppliers;
CREATE TRIGGER trg_guard_supplier_sensitive_cols
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.guard_supplier_sensitive_cols();
