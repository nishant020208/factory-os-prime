-- Warehouse Manager / Procurement Manager / Quality Inspector build.
-- Adds the NCR (Non-Conformance Report) and CAPA (Corrective & Preventive
-- Action) tables for the Quality Inspector, plus an RFQ (Request for
-- Quotation) module for Procurement. Adds a Finished Goods insert policy and
-- an automatic Finished Goods creation when a Quality inspection passes.

-- ─────────────────────────────────────────────────────────────────────
-- 1. NCR — Non-Conformance Reports
--    Quality Inspector records a Fail against a work order/batch here.
--    Operators see NCRs raised against THEIR OWN work orders only.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ncr (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  ncr_number     text NOT NULL,
  work_order_id  uuid,
  inspection_id  uuid,
  batch_number   text,
  defect_category text NOT NULL,
  description    text,
  severity       text NOT NULL DEFAULT 'medium',
  status         text NOT NULL DEFAULT 'open',       -- open | in_rework | closed
  assigned_to    uuid,
  created_by     uuid NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ncr ENABLE ROW LEVEL SECURITY;

-- SELECT: internal ops roles within the company (not maintenance/finance/hr,
-- never external portals), auditors, plus the assigned party and the operator
-- of the NCR'd work order (so rework operators see their own rejections).
DROP POLICY IF EXISTS ncr_select_ops ON public.ncr;
CREATE POLICY ncr_select_ops ON public.ncr FOR SELECT TO authenticated
USING (
  company_id = current_company_id()
  AND NOT is_customer_portal()
  AND NOT is_supplier_portal()
  AND (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.work_orders wo
      WHERE wo.id = ncr.work_order_id AND wo.operator_id = auth.uid()
    )
    OR (
      NOT is_maintenance_engineer()
      AND NOT is_finance_manager()
      AND NOT is_hr_manager()
      AND (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role IN (
              'company_admin','plant_admin','plant_manager',
              'production_manager','quality_inspector',
              'warehouse_manager','procurement_manager','production_operator'
            )
        )
        OR is_auditor()
      )
    )
  )
);

-- INSERT: only Quality Inspector / Company Admin may raise an NCR.
DROP POLICY IF EXISTS ncr_insert_quality ON public.ncr;
CREATE POLICY ncr_insert_quality ON public.ncr FOR INSERT TO authenticated
WITH CHECK (
  company_id = current_company_id()
  AND NOT is_auditor()
  AND NOT is_customer_portal()
  AND NOT is_supplier_portal()
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('quality_inspector', 'company_admin')
  )
);

-- UPDATE: Quality Inspector / Company Admin manage status + assignment.
-- Operators may NOT close their own NCR (only the receiving quality/admin can).
DROP POLICY IF EXISTS ncr_update_quality ON public.ncr;
CREATE POLICY ncr_update_quality ON public.ncr FOR UPDATE TO authenticated
USING (
  company_id = current_company_id()
  AND NOT is_auditor()
  AND NOT is_customer_portal()
  AND NOT is_supplier_portal()
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('quality_inspector', 'company_admin')
  )
)
WITH CHECK (
  company_id = current_company_id()
  AND NOT is_auditor()
  AND NOT is_customer_portal()
  AND NOT is_supplier_portal()
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('quality_inspector', 'company_admin')
  )
);

-- ─────────────────────────────────────────────────────────────────────
-- 2. CAPA — Corrective & Preventive Actions (linked to an NCR)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.capa (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id             uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  capa_number            text NOT NULL,
  ncr_id                 uuid,
  corrective_action      text,
  preventive_action      text,
  assigned_to            uuid,
  due_date               date,
  status                 text NOT NULL DEFAULT 'open',  -- open | in_progress | closed
  resolved_inspection_id uuid,
  created_by             uuid NOT NULL,
  created_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.capa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS capa_select_ops ON public.capa;
CREATE POLICY capa_select_ops ON public.capa FOR SELECT TO authenticated
USING (
  company_id = current_company_id()
  AND NOT is_customer_portal()
  AND NOT is_supplier_portal()
  AND (
    assigned_to = auth.uid()
    OR (
      NOT is_maintenance_engineer()
      AND NOT is_finance_manager()
      AND NOT is_hr_manager()
      AND (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role IN (
              'company_admin','plant_admin','plant_manager',
              'production_manager','quality_inspector','warehouse_manager'
            )
        )
        OR is_auditor()
      )
    )
  )
);

DROP POLICY IF EXISTS capa_insert_quality ON public.capa;
CREATE POLICY capa_insert_quality ON public.capa FOR INSERT TO authenticated
WITH CHECK (
  company_id = current_company_id()
  AND NOT is_auditor()
  AND NOT is_customer_portal()
  AND NOT is_supplier_portal()
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('quality_inspector', 'company_admin')
  )
);

DROP POLICY IF EXISTS capa_update_quality ON public.capa;
CREATE POLICY capa_update_quality ON public.capa FOR UPDATE TO authenticated
USING (
  company_id = current_company_id()
  AND NOT is_auditor()
  AND NOT is_customer_portal()
  AND NOT is_supplier_portal()
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('quality_inspector', 'company_admin')
  )
)
WITH CHECK (
  company_id = current_company_id()
  AND NOT is_auditor()
  AND NOT is_customer_portal()
  AND NOT is_supplier_portal()
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('quality_inspector', 'company_admin')
  )
);

-- ─────────────────────────────────────────────────────────────────────
-- 3. RFQs + RFQ responses (Procurement)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rfqs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  rfq_number        text,
  title             text NOT NULL,
  material_id       uuid,
  quantity          numeric NOT NULL DEFAULT 1,
  supplier_ids      text,
  response_deadline date,
  status            text NOT NULL DEFAULT 'draft',   -- draft | sent | closed
  notes             text,
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rfq_responses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id        uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  supplier_id   uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  unit_price    numeric NOT NULL DEFAULT 0,
  delivery_days integer,
  notes         text,
  status        text NOT NULL DEFAULT 'pending',  -- pending | accepted | declined
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_responses ENABLE ROW LEVEL SECURITY;

-- RFQs: Procurement / Company Admin / plant roles see and manage their
-- company's RFQs. Auditors may read. External portals never see RFQs.
DROP POLICY IF EXISTS rfqs_select_procurement ON public.rfqs;
CREATE POLICY rfqs_select_procurement ON public.rfqs FOR SELECT TO authenticated
USING (
  company_id = current_company_id()
  AND NOT is_customer_portal()
  AND NOT is_supplier_portal()
  AND (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('procurement_manager','company_admin','plant_admin','plant_manager')
    )
    OR is_auditor()
  )
);

DROP POLICY IF EXISTS rfqs_insert_procurement ON public.rfqs;
CREATE POLICY rfqs_insert_procurement ON public.rfqs FOR INSERT TO authenticated
WITH CHECK (
  company_id = current_company_id()
  AND NOT is_auditor()
  AND NOT is_customer_portal()
  AND NOT is_supplier_portal()
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('procurement_manager', 'company_admin')
  )
);

DROP POLICY IF EXISTS rfqs_update_procurement ON public.rfqs;
CREATE POLICY rfqs_update_procurement ON public.rfqs FOR UPDATE TO authenticated
USING (
  company_id = current_company_id()
  AND NOT is_auditor()
  AND NOT is_customer_portal()
  AND NOT is_supplier_portal()
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('procurement_manager', 'company_admin')
  )
)
WITH CHECK (
  company_id = current_company_id()
  AND NOT is_auditor()
  AND NOT is_customer_portal()
  AND NOT is_supplier_portal()
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('procurement_manager', 'company_admin')
  )
);

-- RFQ responses: a Supplier may respond to RFQs addressed to them (own
-- supplier row only); Procurement may read all and accept/decline.
DROP POLICY IF EXISTS rfq_responses_select ON public.rfq_responses;
CREATE POLICY rfq_responses_select ON public.rfq_responses FOR SELECT TO authenticated
USING (
  is_supplier_portal() AND supplier_id = current_supplier_id()
  OR (
    NOT is_customer_portal()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('procurement_manager', 'company_admin')
    )
    OR is_auditor()
  )
);

DROP POLICY IF EXISTS rfq_responses_insert_supplier ON public.rfq_responses;
CREATE POLICY rfq_responses_insert_supplier ON public.rfq_responses FOR INSERT TO authenticated
WITH CHECK (
  (is_supplier_portal() AND supplier_id = current_supplier_id())
  OR (
    NOT is_customer_portal()
    AND NOT is_auditor()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('procurement_manager', 'company_admin')
    )
  )
);

DROP POLICY IF EXISTS rfq_responses_update_procurement ON public.rfq_responses;
CREATE POLICY rfq_responses_update_procurement ON public.rfq_responses FOR UPDATE TO authenticated
USING (
  NOT is_customer_portal()
  AND NOT is_auditor()
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('procurement_manager', 'company_admin')
  )
)
WITH CHECK (
  NOT is_customer_portal()
  AND NOT is_auditor()
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('procurement_manager', 'company_admin')
  )
);

-- ─────────────────────────────────────────────────────────────────────
-- 4. Finished Goods — write policy + auto-creation on Quality pass
--    Quality Inspector / Warehouse / Company Admin may record finished
--    goods; the ONLY automated path is the trigger below, which fires
--    when a Quality inspection result flips to 'pass'.
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS finished_goods_insert_ops ON public.finished_goods;
CREATE POLICY finished_goods_insert_ops ON public.finished_goods FOR INSERT TO authenticated
WITH CHECK (
  company_id = current_company_id()
  AND NOT is_auditor()
  AND NOT is_customer_portal()
  AND NOT is_supplier_portal()
  AND NOT is_maintenance_engineer()
  AND NOT is_finance_manager()
  AND NOT is_hr_manager()
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('quality_inspector', 'warehouse_manager', 'company_admin')
  )
);

-- Auto-create the Finished Goods entry when a Quality inspection passes.
-- SECURITY DEFINER so the warehouse row lands even though the trigger fires
-- inside the Quality Inspector's write context (RLS applies to the invoking
-- user, not to the trigger's table writes).
CREATE OR REPLACE FUNCTION public.trg_quality_pass_finished_goods()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product text := 'Finished Unit';
BEGIN
  IF NEW.result = 'pass' AND (OLD.result IS DISTINCT FROM 'pass') THEN
    IF NEW.product_id IS NOT NULL THEN
      SELECT name INTO v_product FROM public.products WHERE id = NEW.product_id;
      IF v_product IS NULL THEN
        v_product := 'Finished Unit';
      END IF;
    END IF;
    INSERT INTO public.finished_goods (
      company_id,
      product,
      quantity,
      notes
    ) VALUES (
      NEW.company_id,
      v_product,
      COALESCE(NEW.quantity_checked, 1),
      'Auto-generated from inspection ' || COALESCE(NEW.inspection_number, NEW.id::text)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quality_pass_finished_goods ON public.quality_inspections;
CREATE TRIGGER trg_quality_pass_finished_goods
BEFORE INSERT OR UPDATE OF result ON public.quality_inspections
FOR EACH ROW
EXECUTE FUNCTION public.trg_quality_pass_finished_goods();
