-- =====================================================================
-- FACTORYOS AI — SUPPLIERS ADD RAW MATERIALS TO THE COMPANY MASTER (2026-09-05)
--
-- The Supplier Portal Raw Materials tab must let a supplier ADD raw
-- materials it supplies: either by linking one of the buyer's existing
-- materials, or by proposing a brand-new material that does not exist in
-- the company master yet. Once created, the material is normal company
-- master data — visible to every internal role and reusable in BOM /
-- Production Planning / Procurement exactly like the seeded materials.
--
--  1. mat_select_supplier_own_company: relax back to the supplier's own
--     company scope so the add dialog can browse the buyer's material
--     master. (Their own Raw Materials LIST view still filters to their
--     supplier_materials links, so each supplier only *sees supplied*
--     items on the page; the broader master is only needed to pick new
--     ones.) Row-level isolation between suppliers' catalogs is
--     unaffected — supplier_materials policies stay own-row scoped.
--
--  2. mat_write_supplier_own_company (NEW, INSERT only): a supplier may
--     propose a NEW material row scoped to its own company
--     (company_id = current_supplier_company()). UPDATE/DELETE on the
--     master stay company_admin-only — suppliers can never rename a
--     material, change its unit, or edit the official unit cost.
--
-- DATA-SAFETY: policy changes only — the existing 9 materials and all
-- supplier_materials links are untouched.
-- =====================================================================

-- Supplier may browse their company's material master (to add/link items).
DROP POLICY IF EXISTS mat_select_supplier_own_company ON public.materials;
CREATE POLICY mat_select_supplier_own_company ON public.materials
  FOR SELECT TO authenticated
  USING (
    is_supplier_portal()
    AND company_id = current_supplier_company()
  );

-- Supplier may insert a brand-new material into its own company's master.
-- No UPDATE / DELETE: the master's name/unit/unit_cost stay admin-owned.
DROP POLICY IF EXISTS mat_write_supplier_own_company ON public.materials;
CREATE POLICY mat_write_supplier_own_company ON public.materials
  FOR INSERT TO authenticated
  WITH CHECK (
    is_supplier_portal()
    AND company_id = current_supplier_company()
  );

-- ─────────────── 3. REALTIME — new master rows propagate everywhere ───────────────
-- Supplier-added materials and the product/BOM data they feed must invalidate
-- open pages live (Production Planning, Procurement, catalogs). materials /
-- supplier_materials are already published; add the remaining linked tables.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bom;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bom_items;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.purchase_requisitions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;