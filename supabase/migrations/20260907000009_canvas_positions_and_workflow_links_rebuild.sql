-- ============================================================
-- Canvas positions + workflow_links rebuild
-- This migration drops and recreates workflow_links with the
-- correct schema (parent_id/child_id → whitelist instead of
-- from_user_id/to_user_id → profiles).
-- ============================================================

-- 0. Drop ALL existing policies on workflow_links first
DROP POLICY IF EXISTS workflow_links_company_admin_all ON public.workflow_links;
DROP POLICY IF EXISTS workflow_links_plant_admin_scoped ON public.workflow_links;
DROP POLICY IF EXISTS workflow_links_select_in_company ON public.workflow_links;

-- 1. Canvas positions: persist node layout per company/plant
CREATE TABLE IF NOT EXISTS public.canvas_positions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  whitelist_id  UUID NOT NULL REFERENCES public.whitelist(id) ON DELETE CASCADE,
  plant_id      UUID REFERENCES public.plants(id) ON DELETE SET NULL,
  position_x    DOUBLE PRECISION NOT NULL DEFAULT 0,
  position_y    DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, whitelist_id)
);

CREATE INDEX IF NOT EXISTS canvas_positions_company_idx ON public.canvas_positions (company_id);
CREATE INDEX IF NOT EXISTS canvas_positions_plant_idx ON public.canvas_positions (plant_id);

ALTER TABLE public.canvas_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY canvas_positions_company_admin_all
  ON public.canvas_positions FOR ALL TO authenticated
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

CREATE POLICY canvas_positions_plant_admin_scoped
  ON public.canvas_positions FOR ALL TO authenticated
  USING (
    company_id = current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'plant_admin'
        AND company_id = current_company_id()
    )
    AND (
      plant_id IS NULL
      OR plant_id = (
        SELECT plant_id FROM public.user_roles
        WHERE user_id = auth.uid()
          AND role = 'plant_admin'
          AND company_id = current_company_id()
        LIMIT 1
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
    )
  );

CREATE POLICY canvas_positions_select_in_company
  ON public.canvas_positions FOR SELECT TO authenticated
  USING (company_id = current_company_id());

-- 2. Drop and recreate workflow_links with correct schema
DROP TABLE IF EXISTS public.workflow_links CASCADE;

CREATE TABLE public.workflow_links (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  parent_id     UUID NOT NULL REFERENCES public.whitelist(id) ON DELETE CASCADE,
  child_id      UUID NOT NULL REFERENCES public.whitelist(id) ON DELETE CASCADE,
  from_role     public.app_role NOT NULL,
  to_role       public.app_role NOT NULL,
  plant_id      UUID REFERENCES public.plants(id) ON DELETE SET NULL,
  linked_by     UUID REFERENCES auth.users(id),
  linked_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  status        TEXT NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT workflow_links_no_self_link CHECK (parent_id <> child_id),
  CONSTRAINT workflow_links_unique_link UNIQUE (company_id, parent_id, child_id)
);

CREATE INDEX IF NOT EXISTS workflow_links_company_idx ON public.workflow_links (company_id);
CREATE INDEX IF NOT EXISTS workflow_links_parent_idx ON public.workflow_links (parent_id);
CREATE INDEX IF NOT EXISTS workflow_links_child_idx ON public.workflow_links (child_id);
CREATE INDEX IF NOT EXISTS workflow_links_plant_idx ON public.workflow_links (plant_id);

ALTER TABLE public.workflow_links ENABLE ROW LEVEL SECURITY;

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
      EXISTS (
        SELECT 1 FROM public.whitelist wl
        WHERE wl.id = workflow_links.parent_id
          AND wl.company_id = current_company_id()
          AND wl.plant_id = (
            SELECT ur.plant_id FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role = 'plant_admin'
              AND ur.company_id = current_company_id()
            LIMIT 1
          )
      )
      OR EXISTS (
        SELECT 1 FROM public.whitelist wl
        WHERE wl.id = workflow_links.child_id
          AND wl.company_id = current_company_id()
          AND wl.plant_id = (
            SELECT ur.plant_id FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role = 'plant_admin'
              AND ur.company_id = current_company_id()
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
  );

CREATE POLICY workflow_links_select_in_company
  ON public.workflow_links FOR SELECT TO authenticated
  USING (company_id = current_company_id());

-- 3. Backfill workflow_links from existing whitelist hierarchy
-- Company Admin → Plant Admin (per plant)
INSERT INTO public.workflow_links (company_id, from_role, to_role, parent_id, child_id, plant_id, status)
SELECT
  wl_ca.company_id,
  'company_admin'::public.app_role,
  'plant_admin'::public.app_role,
  wl_ca.id,
  wl_pa.id,
  wl_pa.plant_id,
  'active'
FROM public.whitelist wl_ca
JOIN public.whitelist wl_pa
  ON wl_pa.company_id = wl_ca.company_id
  AND wl_pa.role = 'plant_admin'
  AND wl_pa.plant_id IS NOT NULL
WHERE wl_ca.role = 'company_admin'
ON CONFLICT (company_id, parent_id, child_id) DO NOTHING;

-- Plant Admin → plant-level roles
INSERT INTO public.workflow_links (company_id, from_role, to_role, parent_id, child_id, plant_id, status)
SELECT
  wl_pa.company_id,
  'plant_admin'::public.app_role,
  wl_child.role,
  wl_pa.id,
  wl_child.id,
  wl_child.plant_id,
  'active'
FROM public.whitelist wl_pa
JOIN public.whitelist wl_child
  ON wl_child.company_id = wl_pa.company_id
  AND wl_child.plant_id = wl_pa.plant_id
  AND wl_child.role IN (
    'plant_manager', 'production_manager', 'warehouse_manager',
    'procurement_manager', 'quality_inspector', 'maintenance_engineer',
    'production_operator', 'hr_manager'
  )
WHERE wl_pa.role = 'plant_admin'
  AND wl_pa.plant_id IS NOT NULL
ON CONFLICT (company_id, parent_id, child_id) DO NOTHING;

-- Company Admin → Finance Manager (company-level)
INSERT INTO public.workflow_links (company_id, from_role, to_role, parent_id, child_id, status)
SELECT
  wl_ca.company_id,
  'company_admin'::public.app_role,
  'finance_manager'::public.app_role,
  wl_ca.id,
  wl_fm.id,
  'active'
FROM public.whitelist wl_ca
JOIN public.whitelist wl_fm
  ON wl_fm.company_id = wl_ca.company_id
  AND wl_fm.role = 'finance_manager'
WHERE wl_ca.role = 'company_admin'
ON CONFLICT (company_id, parent_id, child_id) DO NOTHING;

-- Company Admin → Auditor (company-level)
INSERT INTO public.workflow_links (company_id, from_role, to_role, parent_id, child_id, status)
SELECT
  wl_ca.company_id,
  'company_admin'::public.app_role,
  'auditor'::public.app_role,
  wl_ca.id,
  wl_au.id,
  'active'
FROM public.whitelist wl_ca
JOIN public.whitelist wl_au
  ON wl_au.company_id = wl_ca.company_id
  AND wl_au.role = 'auditor'
WHERE wl_ca.role = 'company_admin'
ON CONFLICT (company_id, parent_id, child_id) DO NOTHING;

-- Company Admin → Customer Portal
INSERT INTO public.workflow_links (company_id, from_role, to_role, parent_id, child_id, plant_id, status)
SELECT
  wl_ca.company_id,
  'company_admin'::public.app_role,
  'customer_portal'::public.app_role,
  wl_ca.id,
  wl_cp.id,
  wl_cp.plant_id,
  'active'
FROM public.whitelist wl_ca
JOIN public.whitelist wl_cp
  ON wl_cp.company_id = wl_ca.company_id
  AND wl_cp.role = 'customer_portal'
WHERE wl_ca.role = 'company_admin'
ON CONFLICT (company_id, parent_id, child_id) DO NOTHING;

-- Company Admin → Supplier Portal
INSERT INTO public.workflow_links (company_id, from_role, to_role, parent_id, child_id, plant_id, status)
SELECT
  wl_ca.company_id,
  'company_admin'::public.app_role,
  'supplier_portal'::public.app_role,
  wl_ca.id,
  wl_sp.id,
  wl_sp.plant_id,
  'active'
FROM public.whitelist wl_ca
JOIN public.whitelist wl_sp
  ON wl_sp.company_id = wl_ca.company_id
  AND wl_sp.role = 'supplier_portal'
WHERE wl_ca.role = 'company_admin'
ON CONFLICT (company_id, parent_id, child_id) DO NOTHING;

-- Procurement Manager: link under Plant Admin if they have a plant
INSERT INTO public.workflow_links (company_id, from_role, to_role, parent_id, child_id, plant_id, status)
SELECT
  wl_pa.company_id,
  'plant_admin'::public.app_role,
  'procurement_manager'::public.app_role,
  wl_pa.id,
  wl_pm.id,
  wl_pm.plant_id,
  'active'
FROM public.whitelist wl_pa
JOIN public.whitelist wl_pm
  ON wl_pm.company_id = wl_pa.company_id
  AND wl_pm.role = 'procurement_manager'
  AND wl_pm.plant_id = wl_pa.plant_id
WHERE wl_pa.role = 'plant_admin'
  AND wl_pa.plant_id IS NOT NULL
ON CONFLICT (company_id, parent_id, child_id) DO NOTHING;

-- If procurement has no plant, link under company_admin
INSERT INTO public.workflow_links (company_id, from_role, to_role, parent_id, child_id, status)
SELECT
  wl_ca.company_id,
  'company_admin'::public.app_role,
  'procurement_manager'::public.app_role,
  wl_ca.id,
  wl_pm.id,
  'active'
FROM public.whitelist wl_ca
JOIN public.whitelist wl_pm
  ON wl_pm.company_id = wl_ca.company_id
  AND wl_pm.role = 'procurement_manager'
  AND wl_pm.plant_id IS NULL
WHERE wl_ca.role = 'company_admin'
  AND NOT EXISTS (
    SELECT 1 FROM public.workflow_links wl
    WHERE wl.company_id = wl_ca.company_id AND wl.child_id = wl_pm.id
  )
ON CONFLICT (company_id, parent_id, child_id) DO NOTHING;

-- HR Manager: link under Plant Admin if they have a plant, else company_admin
INSERT INTO public.workflow_links (company_id, from_role, to_role, parent_id, child_id, plant_id, status)
SELECT
  wl_pa.company_id,
  'plant_admin'::public.app_role,
  'hr_manager'::public.app_role,
  wl_pa.id,
  wl_hr.id,
  wl_hr.plant_id,
  'active'
FROM public.whitelist wl_pa
JOIN public.whitelist wl_hr
  ON wl_hr.company_id = wl_pa.company_id
  AND wl_hr.role = 'hr_manager'
  AND wl_hr.plant_id = wl_pa.plant_id
WHERE wl_pa.role = 'plant_admin'
  AND wl_pa.plant_id IS NOT NULL
ON CONFLICT (company_id, parent_id, child_id) DO NOTHING;

INSERT INTO public.workflow_links (company_id, from_role, to_role, parent_id, child_id, status)
SELECT
  wl_ca.company_id,
  'company_admin'::public.app_role,
  'hr_manager'::public.app_role,
  wl_ca.id,
  wl_hr.id,
  'active'
FROM public.whitelist wl_ca
JOIN public.whitelist wl_hr
  ON wl_hr.company_id = wl_ca.company_id
  AND wl_hr.role = 'hr_manager'
  AND wl_hr.plant_id IS NULL
WHERE wl_ca.role = 'company_admin'
  AND NOT EXISTS (
    SELECT 1 FROM public.workflow_links wl
    WHERE wl.company_id = wl_ca.company_id AND wl.child_id = wl_hr.id
  )
ON CONFLICT (company_id, parent_id, child_id) DO NOTHING;
