-- ============================================================
-- Workflow Links: hierarchical org-graph linking table
-- Supports drag-drop linking from the Workflow canvas.
-- Unlinked roles = no assignment / notifications / payroll flow.
-- ============================================================

-- 1. Table
CREATE TABLE IF NOT EXISTS public.workflow_links (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  from_user_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  from_role     public.app_role NOT NULL,
  to_role       public.app_role NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- prevent duplicate links
  UNIQUE (company_id, from_user_id, to_user_id)
);

-- prevent self-links
ALTER TABLE public.workflow_links
  ADD CONSTRAINT workflow_links_no_self_link
  CHECK (from_user_id <> to_user_id);

CREATE INDEX IF NOT EXISTS workflow_links_company_idx   ON public.workflow_links (company_id);
CREATE INDEX IF NOT EXISTS workflow_links_from_idx      ON public.workflow_links (from_user_id);
CREATE INDEX IF NOT EXISTS workflow_links_to_idx        ON public.workflow_links (to_user_id);

-- 2. RLS
ALTER TABLE public.workflow_links ENABLE ROW LEVEL SECURITY;

-- Company Admin: full CRUD within their company
CREATE POLICY workflow_links_company_admin_all
  ON public.workflow_links FOR ALL TO authenticated
  USING (
    company_id = current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'company_admin'
        AND company_id = current_company_id()
    )
  )
  WITH CHECK (
    company_id = current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'company_admin'
        AND company_id = current_company_id()
    )
  );

-- Plant Admin: CRUD for links where BOTH users are in their plant
CREATE POLICY workflow_links_plant_admin_scoped
  ON public.workflow_links FOR ALL TO authenticated
  USING (
    company_id = current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'plant_admin'
        AND company_id = current_company_id()
        AND plant_id IS NOT NULL
    )
    AND (
      -- from_user is in the same plant
      EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = workflow_links.from_user_id
          AND company_id = current_company_id()
          AND plant_id = (
            SELECT plant_id FROM public.user_roles
            WHERE user_id = auth.uid()
              AND role = 'plant_admin'
              AND company_id = current_company_id()
            LIMIT 1
          )
      )
      OR
      -- to_user is in the same plant
      EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = workflow_links.to_user_id
          AND company_id = current_company_id()
          AND plant_id = (
            SELECT plant_id FROM public.user_roles
            WHERE user_id = auth.uid()
              AND role = 'plant_admin'
              AND company_id = current_company_id()
            LIMIT 1
          )
      )
    )
  )
  WITH CHECK (
    company_id = current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'plant_admin'
        AND company_id = current_company_id()
        AND plant_id IS NOT NULL
    )
    AND (
      EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = workflow_links.from_user_id
          AND company_id = current_company_id()
          AND plant_id = (
            SELECT plant_id FROM public.user_roles
            WHERE user_id = auth.uid()
              AND role = 'plant_admin'
              AND company_id = current_company_id()
            LIMIT 1
          )
      )
      OR
      EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = workflow_links.to_user_id
          AND company_id = current_company_id()
          AND plant_id = (
            SELECT plant_id FROM public.user_roles
            WHERE user_id = auth.uid()
              AND role = 'plant_admin'
              AND company_id = current_company_id()
            LIMIT 1
          )
      )
    )
  );

-- Read-only for all authenticated users in the same company (for graph rendering)
CREATE POLICY workflow_links_select_in_company
  ON public.workflow_links FOR SELECT TO authenticated
  USING (company_id = current_company_id());

-- 3. Seed existing hierarchy from user_roles
-- Company Admin -> Plant Admin (per plant)
INSERT INTO public.workflow_links (company_id, from_user_id, to_user_id, from_role, to_role)
SELECT
  ur_ca.company_id,
  ur_ca.user_id AS from_user_id,
  ur_pa.user_id AS to_user_id,
  'company_admin'::public.app_role,
  'plant_admin'::public.app_role
FROM public.user_roles ur_ca
JOIN public.user_roles ur_pa
  ON ur_pa.company_id = ur_ca.company_id
  AND ur_pa.role = 'plant_admin'
  AND ur_pa.plant_id IS NOT NULL
WHERE ur_ca.role = 'company_admin'
  AND ur_ca.company_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT (company_id, from_user_id, to_user_id) DO NOTHING;

-- Plant Admin -> Plant Manager, Production Manager, Warehouse Manager, etc.
INSERT INTO public.workflow_links (company_id, from_user_id, to_user_id, from_role, to_role)
SELECT
  ur_pa.company_id,
  ur_pa.user_id AS from_user_id,
  ur_child.user_id AS to_user_id,
  'plant_admin'::public.app_role,
  ur_child.role
FROM public.user_roles ur_pa
JOIN public.user_roles ur_child
  ON ur_child.company_id = ur_pa.company_id
  AND ur_child.plant_id = ur_pa.plant_id
  AND ur_child.role IN (
    'plant_manager', 'production_manager', 'warehouse_manager',
    'procurement_manager', 'quality_inspector', 'maintenance_engineer',
    'production_operator'
  )
WHERE ur_pa.role = 'plant_admin'
  AND ur_pa.plant_id IS NOT NULL
  AND ur_pa.company_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT (company_id, from_user_id, to_user_id) DO NOTHING;

-- Company Admin -> Finance Manager (company-level, not under Plant Admin)
INSERT INTO public.workflow_links (company_id, from_user_id, to_user_id, from_role, to_role)
SELECT
  ur_ca.company_id,
  ur_ca.user_id AS from_user_id,
  ur_fm.user_id AS to_user_id,
  'company_admin'::public.app_role,
  'finance_manager'::public.app_role
FROM public.user_roles ur_ca
JOIN public.user_roles ur_fm
  ON ur_fm.company_id = ur_ca.company_id
  AND ur_fm.role = 'finance_manager'
WHERE ur_ca.role = 'company_admin'
  AND ur_ca.company_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT (company_id, from_user_id, to_user_id) DO NOTHING;

-- Company Admin -> HR Manager (company-level)
INSERT INTO public.workflow_links (company_id, from_user_id, to_user_id, from_role, to_role)
SELECT
  ur_ca.company_id,
  ur_ca.user_id AS from_user_id,
  ur_hr.user_id AS to_user_id,
  'company_admin'::public.app_role,
  'hr_manager'::public.app_role
FROM public.user_roles ur_ca
JOIN public.user_roles ur_hr
  ON ur_hr.company_id = ur_ca.company_id
  AND ur_hr.role = 'hr_manager'
WHERE ur_ca.role = 'company_admin'
  AND ur_ca.company_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT (company_id, from_user_id, to_user_id) DO NOTHING;

-- Company Admin -> Auditor (company-level)
INSERT INTO public.workflow_links (company_id, from_user_id, to_user_id, from_role, to_role)
SELECT
  ur_ca.company_id,
  ur_ca.user_id AS from_user_id,
  ur_au.user_id AS to_user_id,
  'company_admin'::public.app_role,
  'auditor'::public.app_role
FROM public.user_roles ur_ca
JOIN public.user_roles ur_au
  ON ur_au.company_id = ur_ca.company_id
  AND ur_au.role = 'auditor'
WHERE ur_ca.role = 'company_admin'
  AND ur_ca.company_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT (company_id, from_user_id, to_user_id) DO NOTHING;

-- Procurement Manager and HR Manager: link under Plant Admin if they have a plant,
-- otherwise under Company Admin (they currently have NULL plant_id in demo data)
-- For demo: link procurement_manager under company_admin (no plant)
-- Already handled above (Company Admin -> HR Manager)
-- Procurement Manager also under Company Admin:
INSERT INTO public.workflow_links (company_id, from_user_id, to_user_id, from_role, to_role)
SELECT
  ur_ca.company_id,
  ur_ca.user_id AS from_user_id,
  ur_pm.user_id AS to_user_id,
  'company_admin'::public.app_role,
  'procurement_manager'::public.app_role
FROM public.user_roles ur_ca
JOIN public.user_roles ur_pm
  ON ur_pm.company_id = ur_ca.company_id
  AND ur_pm.role = 'procurement_manager'
WHERE ur_ca.role = 'company_admin'
  AND ur_ca.company_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT (company_id, from_user_id, to_user_id) DO NOTHING;

-- 4. Function: auto-create workflow link when whitelist invite is accepted
-- When a new user signs up and gets a role via the handle_new_user trigger,
-- this function creates the appropriate workflow link.
CREATE OR REPLACE FUNCTION public.create_workflow_link_on_signup()
RETURNS TRIGGER AS $$
DECLARE
  v_company_id UUID := NEW.company_id;
  v_new_user_id UUID := NEW.user_id;
  v_new_role    public.app_role := NEW.role;
  v_new_plant_id UUID := NEW.plant_id;
  v_supervisor_id UUID;
  v_supervisor_role public.app_role;
BEGIN
  -- Determine who this user reports to based on their role and plant
  IF v_new_role IN ('plant_manager', 'production_manager', 'warehouse_manager',
                     'quality_inspector', 'maintenance_engineer', 'production_operator') THEN
    -- Reports to Plant Admin of their plant
    IF v_new_plant_id IS NOT NULL THEN
      SELECT user_id INTO v_supervisor_id
      FROM public.user_roles
      WHERE company_id = v_company_id
        AND plant_id = v_new_plant_id
        AND role = 'plant_admin'
      LIMIT 1;
      v_supervisor_role := 'plant_admin';
    END IF;
  ELSIF v_new_role = 'plant_admin' THEN
    -- Reports to Company Admin
    SELECT user_id INTO v_supervisor_id
    FROM public.user_roles
    WHERE company_id = v_company_id
      AND role = 'company_admin'
    LIMIT 1;
    v_supervisor_role := 'company_admin';
  ELSIF v_new_role IN ('finance_manager', 'hr_manager', 'auditor', 'procurement_manager') THEN
    -- Reports to Company Admin
    SELECT user_id INTO v_supervisor_id
    FROM public.user_roles
    WHERE company_id = v_company_id
      AND role = 'company_admin'
    LIMIT 1;
    v_supervisor_role := 'company_admin';
  END IF;

  -- Create the link if we found a supervisor
  IF v_supervisor_id IS NOT NULL THEN
    INSERT INTO public.workflow_links (company_id, from_user_id, to_user_id, from_role, to_role)
    VALUES (v_company_id, v_supervisor_id, v_new_user_id, v_supervisor_role, v_new_role)
    ON CONFLICT (company_id, from_user_id, to_user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on user_roles insert (fires after handle_new_user creates the role)
CREATE OR REPLACE TRIGGER trg_create_workflow_link_on_signup
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_workflow_link_on_signup();
