-- ============================================================
-- Canvas positions + workflow_links rebuild
-- ============================================================

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

-- 2. Rebuild workflow_links: use whitelist IDs, add position/status fields
-- Drop old FK constraints first
ALTER TABLE public.workflow_links DROP CONSTRAINT IF EXISTS workflow_links_from_user_id_fkey;
ALTER TABLE public.workflow_links DROP CONSTRAINT IF EXISTS workflow_links_to_user_id_fkey;
ALTER TABLE public.workflow_links DROP CONSTRAINT IF EXISTS workflow_links_no_self_link;

-- Rename columns to be ID-agnostic
ALTER TABLE public.workflow_links DROP COLUMN IF EXISTS from_user_id;
ALTER TABLE public.workflow_links DROP COLUMN IF EXISTS to_user_id;
ALTER TABLE public.workflow_links ADD COLUMN parent_id UUID NOT NULL REFERENCES public.whitelist(id) ON DELETE CASCADE;
ALTER TABLE public.workflow_links ADD COLUMN child_id UUID NOT NULL REFERENCES public.whitelist(id) ON DELETE CASCADE;
ALTER TABLE public.workflow_links ADD COLUMN plant_id UUID REFERENCES public.plants(id) ON DELETE SET NULL;
ALTER TABLE public.workflow_links ADD COLUMN linked_by UUID REFERENCES auth.users(id);
ALTER TABLE public.workflow_links ADD COLUMN linked_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.workflow_links ADD COLUMN status TEXT NOT NULL DEFAULT 'active';

-- Fix unique constraint
ALTER TABLE public.workflow_links DROP CONSTRAINT IF EXISTS workflow_links_company_id_from_user_id_to_user_id_key;
ALTER TABLE public.workflow_links ADD CONSTRAINT workflow_links_no_self_link CHECK (parent_id <> child_id);
ALTER TABLE public.workflow_links ADD CONSTRAINT workflow_links_unique_link UNIQUE (company_id, parent_id, child_id);

CREATE INDEX IF NOT EXISTS workflow_links_parent_idx ON public.workflow_links (parent_id);
CREATE INDEX IF NOT EXISTS workflow_links_child_idx ON public.workflow_links (child_id);
CREATE INDEX IF NOT EXISTS workflow_links_plant_idx ON public.workflow_links (plant_id);

-- 3. Backfill workflow_links from existing whitelist hierarchy
-- Clear old seeded data
DELETE FROM public.workflow_links WHERE company_id = '11111111-1111-1111-1111-111111111111';

-- Company Admin → Plant Admin
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
  AND wl_ca.company_id = '11111111-1111-1111-1111-111111111111'
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
  AND wl_pa.company_id = '11111111-1111-1111-1111-111111111111'
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
  AND wl_ca.company_id = '11111111-1111-1111-1111-111111111111'
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
  AND wl_ca.company_id = '11111111-1111-1111-1111-111111111111'
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
  AND wl_ca.company_id = '11111111-1111-1111-1111-111111111111'
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
  AND wl_ca.company_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT (company_id, parent_id, child_id) DO NOTHING;

-- Procurement Manager: link under Plant Admin if they have a plant, else Company Admin
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
  AND wl_pa.company_id = '11111111-1111-1111-1111-111111111111'
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
  AND wl_ca.company_id = '11111111-1111-1111-1111-111111111111'
  AND NOT EXISTS (
    SELECT 1 FROM public.workflow_links wl
    WHERE wl.company_id = wl_ca.company_id AND wl.child_id = wl_pm.id
  )
ON CONFLICT (company_id, parent_id, child_id) DO NOTHING;
