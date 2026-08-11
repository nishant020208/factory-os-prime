-- =============================================================
-- MIGRATION: Allow inventory to track raw materials (material_id)
-- independently of products. Drops NOT NULL on product_id,
-- adds CHECK constraint so one of product_id or material_id must exist.
-- Also adds a unique constraint for material-based inventory rows.
-- =============================================================
ALTER TABLE public.inventory
  ALTER COLUMN product_id DROP NOT NULL;

-- Add CHECK: at least one of product_id or material_id must be set
ALTER TABLE public.inventory
  DROP CONSTRAINT IF EXISTS inventory_product_or_material;

ALTER TABLE public.inventory
  ADD CONSTRAINT inventory_product_or_material
  CHECK (product_id IS NOT NULL OR material_id IS NOT NULL);

-- Add unique constraint for material-only rows (no product)
ALTER TABLE public.inventory
  DROP CONSTRAINT IF EXISTS inventory_warehouse_material_unique;

ALTER TABLE public.inventory
  ADD CONSTRAINT inventory_warehouse_material_unique
  UNIQUE NULLS NOT DISTINCT (warehouse_id, material_id);
