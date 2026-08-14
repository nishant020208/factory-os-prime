-- FactoryOS AI: HR Manager, Finance Manager & Maintenance Engineer role support.
--
-- Live RLS mapping for the three role builds found these gaps:
--
--   1) attendance — HR/Company Admin could SELECT company attendance but not
--      UPDATE it (only the row owner could), so manual corrections ("forgot
--      to check in") were impossible. Adds an update policy + correction_reason.
--
--   2) leaves — the table exists but only HR/Admin can INSERT. Internal
--      employees should be able to submit their OWN leave request (own row
--      only), and NOBODY may approve/reject their own request (the RLS
--      update policy is role-wide for HR, so the app needs a hard DB guard).
--
--   3) recruitment — no job_postings / candidates tables existed. The old
--      /recruitment page was a hardcoded stub. Creates both with company-
--      scoped RLS and the standard audit triggers.
--
--   4) supplier_payments — a money-movement table with NO audit trigger.
--      Financial writes are the highest-stakes audit category in the app;
--      attaches the standard trg_audit_write / trg_block_auditor_write pair.
--
--   5) payroll — SELECT was granted via in_company_ops() to every internal
--      role INCLUDING finance_manager, but payroll is HR's scope (per the
--      Finance role spec: "payroll is HR's scope, not Finance's"). Hardens
--      the select policy to exclude finance_manager. Auditor keeps read
--      access (in_company_ops includes auditor).

-- ── 1) Finance Manager helper (used by payroll isolation) ────────────────────
CREATE OR REPLACE FUNCTION public.is_finance_manager()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'finance_manager'
  );
$$;

-- ── 2) Attendance: manual correction support ────────────────────────────────
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS correction_reason text;

-- HR Manager / Company Admin may correct any attendance row in their company.
DROP POLICY IF EXISTS attendance_update_manager ON public.attendance;
CREATE POLICY attendance_update_manager ON public.attendance FOR UPDATE TO authenticated
USING (
  company_id = current_company_id() AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('company_admin', 'hr_manager')
  )
)
WITH CHECK (
  company_id = current_company_id() AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('company_admin', 'hr_manager')
  )
);

-- ── 3) Leaves: own self-submit + hard no-self-approve guard ─────────────────
ALTER TABLE public.leaves ADD COLUMN IF NOT EXISTS rejection_reason text;

-- leaves.employee_id originally FK'd to employees(id), but the app keys
-- attendance/payroll/leaves by profiles.id (auth user id) — the empty table
-- is re-pointed to profiles so employee_id == auth.uid() like attendance.
ALTER TABLE public.leaves DROP CONSTRAINT IF EXISTS leaves_employee_id_fkey;
ALTER TABLE public.leaves ADD CONSTRAINT leaves_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
-- Leave requests: any internal employee may submit one for THEMSELVES
-- (own row only); HR Manager / Company Admin may additionally create one
-- on behalf of an employee (e.g. pre-approved planned leave). Auditor,
-- customer and supplier portals never write. One policy with the full OR
-- expression — Postgres ANDs multiple INSERT policies, so splitting self-
-- submit and HR-entry into two policies would silently block self-submit
-- for roles excluded from the HR policy (operator, finance, maintenance).
DROP POLICY IF EXISTS leaves_insert_self ON public.leaves;
DROP POLICY IF EXISTS leaves_insert ON public.leaves;
CREATE POLICY leaves_insert ON public.leaves FOR INSERT TO authenticated
WITH CHECK (
  company_id = current_company_id()
  AND NOT is_supplier_portal()
  AND NOT is_customer_portal()
  AND NOT is_auditor()
  AND (
    employee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('company_admin', 'hr_manager')
    )
  )
);

-- Nobody may approve/reject/cancel their own leave request, even with an
-- approver role — RLS policies are role-wide for HR, so this needs a trigger.
CREATE OR REPLACE FUNCTION public.block_leave_self_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status = 'pending'
     AND NEW.status IN ('approved', 'rejected', 'cancelled')
     AND OLD.employee_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot approve or reject your own leave request';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leave_no_self_approve ON public.leaves;
CREATE TRIGGER trg_leave_no_self_approve
  BEFORE UPDATE ON public.leaves
  FOR EACH ROW EXECUTE FUNCTION public.block_leave_self_approval();

-- ── 4) Recruitment: job_postings + candidates ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  department text,
  location text,
  status text NOT NULL DEFAULT 'open',           -- open | interviewing | closed
  openings integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  job_posting_id uuid REFERENCES public.job_postings(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text,
  phone text,
  position text,
  status text NOT NULL DEFAULT 'applied',        -- applied | interview | offered | rejected | hired
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS job_postings_select ON public.job_postings;
CREATE POLICY job_postings_select ON public.job_postings FOR SELECT TO authenticated
USING (
  in_company_ops(company_id)
  OR (is_auditor() AND NOT is_customer_portal() AND NOT is_supplier_portal())
);

DROP POLICY IF EXISTS job_postings_write ON public.job_postings;
CREATE POLICY job_postings_write ON public.job_postings FOR INSERT TO authenticated
WITH CHECK (
  in_company_ops(company_id)
  AND NOT is_auditor()
  AND NOT is_customer_portal()
  AND NOT is_supplier_portal()
  AND NOT is_production_operator()
);

DROP POLICY IF EXISTS job_postings_update ON public.job_postings;
CREATE POLICY job_postings_update ON public.job_postings FOR UPDATE TO authenticated
USING (
  in_company_ops(company_id)
  AND NOT is_auditor()
  AND NOT is_customer_portal()
  AND NOT is_supplier_portal()
  AND NOT is_production_operator()
)
WITH CHECK (
  in_company_ops(company_id)
  AND NOT is_auditor()
  AND NOT is_customer_portal()
  AND NOT is_supplier_portal()
  AND NOT is_production_operator()
);

DROP POLICY IF EXISTS job_postings_delete ON public.job_postings;
CREATE POLICY job_postings_delete ON public.job_postings FOR DELETE TO authenticated
USING (
  in_company_ops(company_id)
  AND NOT is_auditor()
  AND NOT is_customer_portal()
  AND NOT is_supplier_portal()
  AND NOT is_production_operator()
);

DROP POLICY IF EXISTS candidates_select ON public.candidates;
CREATE POLICY candidates_select ON public.candidates FOR SELECT TO authenticated
USING (
  in_company_ops(company_id)
  OR (is_auditor() AND NOT is_customer_portal() AND NOT is_supplier_portal())
);

DROP POLICY IF EXISTS candidates_write ON public.candidates;
CREATE POLICY candidates_write ON public.candidates FOR INSERT TO authenticated
WITH CHECK (
  in_company_ops(company_id)
  AND NOT is_auditor()
  AND NOT is_customer_portal()
  AND NOT is_supplier_portal()
  AND NOT is_production_operator()
);

DROP POLICY IF EXISTS candidates_update ON public.candidates;
CREATE POLICY candidates_update ON public.candidates FOR UPDATE TO authenticated
USING (
  in_company_ops(company_id)
  AND NOT is_auditor()
  AND NOT is_customer_portal()
  AND NOT is_supplier_portal()
  AND NOT is_production_operator()
)
WITH CHECK (
  in_company_ops(company_id)
  AND NOT is_auditor()
  AND NOT is_customer_portal()
  AND NOT is_supplier_portal()
  AND NOT is_production_operator()
);

DROP POLICY IF EXISTS candidates_delete ON public.candidates;
CREATE POLICY candidates_delete ON public.candidates FOR DELETE TO authenticated
USING (
  in_company_ops(company_id)
  AND NOT is_auditor()
  AND NOT is_customer_portal()
  AND NOT is_supplier_portal()
  AND NOT is_production_operator()
);

DROP TRIGGER IF EXISTS trg_audit_write ON public.job_postings;
CREATE TRIGGER trg_audit_write AFTER INSERT OR DELETE OR UPDATE ON public.job_postings
  FOR EACH ROW EXECUTE FUNCTION audit_write_event();
DROP TRIGGER IF EXISTS trg_block_auditor_write ON public.job_postings;
CREATE TRIGGER trg_block_auditor_write BEFORE INSERT OR DELETE OR UPDATE ON public.job_postings
  FOR EACH ROW EXECUTE FUNCTION block_auditor_writes();
DROP TRIGGER IF EXISTS trg_audit_write ON public.candidates;
CREATE TRIGGER trg_audit_write AFTER INSERT OR DELETE OR UPDATE ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION audit_write_event();
DROP TRIGGER IF EXISTS trg_block_auditor_write ON public.candidates;
CREATE TRIGGER trg_block_auditor_write BEFORE INSERT OR DELETE OR UPDATE ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION block_auditor_writes();

-- ── 5) supplier_payments: attach the standard audit pair ────────────────────
DROP TRIGGER IF EXISTS trg_audit_write ON public.supplier_payments;
CREATE TRIGGER trg_audit_write AFTER INSERT OR DELETE OR UPDATE ON public.supplier_payments
  FOR EACH ROW EXECUTE FUNCTION audit_write_event();
DROP TRIGGER IF EXISTS trg_block_auditor_write ON public.supplier_payments;
CREATE TRIGGER trg_block_auditor_write BEFORE INSERT OR DELETE OR UPDATE ON public.supplier_payments
  FOR EACH ROW EXECUTE FUNCTION block_auditor_writes();

-- Supplier payment processing is single-source-of-truth in the DB: inserting
-- a payment flips the linked supplier_invoice to 'paid' (so the Supplier
-- Portal's own Payments Received tab reflects it live) and notifies that
-- specific supplier (to_user = suppliers.user_id, never to_role).
CREATE OR REPLACE FUNCTION public.supplier_payment_effects()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE supplier_user uuid; po_no text;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'paid' THEN
    IF NEW.invoice_id IS NOT NULL THEN
      UPDATE public.supplier_invoices SET status = 'paid' WHERE id = NEW.invoice_id;
    END IF;
    SELECT user_id INTO supplier_user FROM public.suppliers WHERE id = NEW.supplier_id;
    SELECT po_number INTO po_no FROM public.purchase_orders WHERE id = NEW.po_id;
    IF supplier_user IS NOT NULL THEN
      INSERT INTO public.notifications (company_id, title, body, to_user, related_entity_id, related_entity_type, severity)
      VALUES (NEW.company_id, '💰 Payment Released',
        'Payment of $' || round(NEW.amount)::text || ' for PO ' || COALESCE(po_no, NEW.transaction_id) || ' has been released.',
        supplier_user, NEW.id, 'supplier_payments', 'success');
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_supplier_payment_effects ON public.supplier_payments;
CREATE TRIGGER trg_supplier_payment_effects
  AFTER INSERT ON public.supplier_payments
  FOR EACH ROW EXECUTE FUNCTION public.supplier_payment_effects();

-- ── 6) payroll: HR-scope only (finance, maintenance, operator excluded) ─────
DROP POLICY IF EXISTS payroll_select_ops ON public.payroll;
CREATE POLICY payroll_select_ops ON public.payroll FOR SELECT TO authenticated
USING (
  company_id = current_company_id() AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('company_admin', 'hr_manager')
  )
  OR (is_auditor() AND NOT is_customer_portal() AND NOT is_supplier_portal())
  OR is_root_admin(auth.uid())
);

GRANT USAGE ON SCHEMA public TO authenticated;
