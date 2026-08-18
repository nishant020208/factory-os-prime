-- ============================================================
-- Migration: Quality Inspection Parameters (Detailed Furniture QC)
-- Replaces flat percentage-only results with structured,
-- per-parameter inspection data across 7 categories.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. New table: quality_inspection_parameters
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quality_inspection_parameters (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  inspection_id     uuid NOT NULL REFERENCES public.quality_inspections(id) ON DELETE CASCADE,
  category          text NOT NULL,   -- wood_material | structural | surface_finish | upholstery | hardware | safety | packaging
  parameter_name    text NOT NULL,   -- e.g. 'Wood Moisture Content', 'Joint Tightness'
  measured_value    text,            -- numeric as string, or qualitative value
  unit              text,            -- '%', 'mm', 'kg', null for qualitative
  acceptable_range  text,            -- e.g. '8-12%', '< 2mm per 1000mm', 'Pass/Fail'
  result            text NOT NULL DEFAULT 'pending', -- pass | fail | not_applicable
  notes             text,
  photo_url         text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quality_inspection_parameters ENABLE ROW LEVEL SECURITY;

-- GRANT
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_inspection_parameters TO authenticated;
GRANT ALL ON public.quality_inspection_parameters TO service_role;

-- SELECT: same company, not external portals
DROP POLICY IF EXISTS qip_select ON public.quality_inspection_parameters;
CREATE POLICY qip_select ON public.quality_inspection_parameters
FOR SELECT TO authenticated
USING (
  company_id = current_company_id()
  AND NOT is_customer_portal()
  AND NOT is_supplier_portal()
);

-- INSERT: internal ops roles (quality inspector, company admin, plant admin, plant manager, production manager) + root admin
-- Uses the same exclusion pattern as quality_inspections_insert
DROP POLICY IF EXISTS qip_insert ON public.quality_inspection_parameters;
CREATE POLICY qip_insert ON public.quality_inspection_parameters
FOR INSERT TO authenticated
WITH CHECK (
  company_id = current_company_id()
  AND (
    (
      (NOT is_auditor()) AND (NOT is_customer_portal()) AND (NOT is_supplier_portal())
      AND (NOT is_production_operator()) AND (NOT is_maintenance_engineer())
      AND (NOT is_finance_manager()) AND (NOT is_hr_manager())
    )
    OR is_root_admin(auth.uid())
  )
);

-- UPDATE: same roles as insert
DROP POLICY IF EXISTS qip_update ON public.quality_inspection_parameters;
CREATE POLICY qip_update ON public.quality_inspection_parameters
FOR UPDATE TO authenticated
USING (
  company_id = current_company_id()
  AND (
    (
      (NOT is_auditor()) AND (NOT is_customer_portal()) AND (NOT is_supplier_portal())
      AND (NOT is_production_operator()) AND (NOT is_maintenance_engineer())
      AND (NOT is_finance_manager()) AND (NOT is_hr_manager())
    )
    OR is_root_admin(auth.uid())
  )
)
WITH CHECK (
  company_id = current_company_id()
);

-- DELETE: company admin, plant admin, root admin only
DROP POLICY IF EXISTS qip_delete ON public.quality_inspection_parameters;
CREATE POLICY qip_delete ON public.quality_inspection_parameters
FOR DELETE TO authenticated
USING (
  company_id = current_company_id()
  AND (
    is_tenant_admin()
    OR is_root_admin(auth.uid())
  )
);

-- ─────────────────────────────────────────────────────────────
-- 2. Add batch_reference and customer_order_id to quality_inspections
--    (batch_reference for linking to work orders / batches,
--     customer_order_id for downstream customer portal visibility)
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quality_inspections' AND column_name = 'batch_reference'
  ) THEN
    ALTER TABLE public.quality_inspections ADD COLUMN batch_reference text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quality_inspections' AND column_name = 'customer_order_id'
  ) THEN
    ALTER TABLE public.quality_inspections ADD COLUMN customer_order_id uuid
      REFERENCES public.customer_orders(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quality_inspections' AND column_name = 'overall_notes'
  ) THEN
    ALTER TABLE public.quality_inspections ADD COLUMN overall_notes text;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 3. Function: auto-compute overall_result from parameters
--    Logic: any parameter with result='fail' in a mandatory category
--           (wood_material, structural, safety) = overall FAIL
--           any fail in other categories = conditional_pass
--           all pass or not_applicable = pass
--           no parameters yet = keep current value (pending)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.compute_inspection_overall_result()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_params boolean;
  v_mandatory_fail boolean;
  v_any_fail boolean;
  v_pass_count integer;
BEGIN
  -- Only recalculate when we have parameters for this inspection
  SELECT EXISTS (
    SELECT 1 FROM public.quality_inspection_parameters WHERE inspection_id = NEW.inspection_id
  ) INTO v_has_params;

  IF NOT v_has_params THEN
    RETURN NEW;
  END IF;

  -- Check mandatory category failures (wood_material, structural, safety)
  SELECT EXISTS (
    SELECT 1 FROM public.quality_inspection_parameters
    WHERE inspection_id = NEW.inspection_id
      AND result = 'fail'
      AND category IN ('wood_material', 'structural', 'safety')
  ) INTO v_mandatory_fail;

  -- Check any failures
  SELECT EXISTS (
    SELECT 1 FROM public.quality_inspection_parameters
    WHERE inspection_id = NEW.inspection_id AND result = 'fail'
  ) INTO v_any_fail;

  -- Count passes
  SELECT COUNT(*) INTO v_pass_count
  FROM public.quality_inspection_parameters
  WHERE inspection_id = NEW.inspection_id AND result = 'pass';

  -- Determine overall result
  IF v_mandatory_fail THEN
    NEW.result := 'fail';
  ELSIF v_any_fail THEN
    NEW.result := 'conditional_pass';
  ELSIF v_pass_count > 0 THEN
    NEW.result := 'pass';
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to quality_inspections (fire on any parameter insert/update/delete via the inspection)
-- We use a deferred trigger on the parameters table to update the parent inspection
CREATE OR REPLACE FUNCTION public.trigger_compute_inspection_result()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inspection_id uuid;
  v_has_params boolean;
  v_mandatory_fail boolean;
  v_any_fail boolean;
  v_pass_count integer;
BEGIN
  -- Get the inspection_id from the parameter row
  IF TG_OP = 'DELETE' THEN
    v_inspection_id := OLD.inspection_id;
  ELSE
    v_inspection_id := NEW.inspection_id;
  END IF;

  -- Check if parameters exist
  SELECT EXISTS (
    SELECT 1 FROM public.quality_inspection_parameters WHERE inspection_id = v_inspection_id
  ) INTO v_has_params;

  IF NOT v_has_params THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Check mandatory category failures
  SELECT EXISTS (
    SELECT 1 FROM public.quality_inspection_parameters
    WHERE inspection_id = v_inspection_id
      AND result = 'fail'
      AND category IN ('wood_material', 'structural', 'safety')
  ) INTO v_mandatory_fail;

  -- Check any failures
  SELECT EXISTS (
    SELECT 1 FROM public.quality_inspection_parameters
    WHERE inspection_id = v_inspection_id AND result = 'fail'
  ) INTO v_any_fail;

  -- Count passes
  SELECT COUNT(*) INTO v_pass_count
  FROM public.quality_inspection_parameters
  WHERE inspection_id = v_inspection_id AND result = 'pass';

  -- Update the parent inspection's result
  IF v_mandatory_fail THEN
    UPDATE public.quality_inspections SET result = 'fail' WHERE id = v_inspection_id;
  ELSIF v_any_fail THEN
    UPDATE public.quality_inspections SET result = 'conditional_pass' WHERE id = v_inspection_id;
  ELSIF v_pass_count > 0 THEN
    UPDATE public.quality_inspections SET result = 'pass' WHERE id = v_inspection_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_inspection_result ON public.quality_inspection_parameters;
CREATE TRIGGER trg_compute_inspection_result
AFTER INSERT OR UPDATE OR DELETE ON public.quality_inspection_parameters
FOR EACH ROW
EXECUTE FUNCTION public.trigger_compute_inspection_result();

-- ─────────────────────────────────────────────────────────────
-- 4. Add RLS for quality_certificates (currently has none)
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'qc_select' AND tablename = 'quality_certificates'
  ) THEN
    ALTER TABLE public.quality_certificates ENABLE ROW LEVEL SECURITY;

    GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_certificates TO authenticated;
    GRANT ALL ON public.quality_certificates TO service_role;

    CREATE POLICY qc_select ON public.quality_certificates
    FOR SELECT TO authenticated
    USING (
      company_id = current_company_id()
    );

    CREATE POLICY qc_insert ON public.quality_certificates
    FOR INSERT TO authenticated
    WITH CHECK (
      company_id = current_company_id()
      AND (
        (
          (NOT is_auditor()) AND (NOT is_customer_portal()) AND (NOT is_supplier_portal())
          AND (NOT is_production_operator()) AND (NOT is_maintenance_engineer())
          AND (NOT is_finance_manager()) AND (NOT is_hr_manager())
        )
        OR is_root_admin(auth.uid())
      )
    );

    CREATE POLICY qc_update ON public.quality_certificates
    FOR UPDATE TO authenticated
    USING (
      company_id = current_company_id()
      AND (
        (
          (NOT is_auditor()) AND (NOT is_customer_portal()) AND (NOT is_supplier_portal())
          AND (NOT is_production_operator()) AND (NOT is_maintenance_engineer())
          AND (NOT is_finance_manager()) AND (NOT is_hr_manager())
        )
        OR is_root_admin(auth.uid())
      )
    );
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 5. Add parameter_failed_categories to NCR for specific failed parameter references
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ncr' AND column_name = 'failed_parameters'
  ) THEN
    ALTER TABLE public.ncr ADD COLUMN failed_parameters jsonb;
    -- Store as array of {category, parameter_name, measured_value, acceptable_range, notes}
  END IF;
END $$;
