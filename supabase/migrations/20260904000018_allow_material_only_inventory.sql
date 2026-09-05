-- =====================================================================
-- FACTORYOS AI — allow material-only inventory rows (live schema fix)
--
-- Migration 20260811000001 dropped the NOT NULL on inventory.product_id
-- so raw materials could be stocked independently of products, but the
-- live database still enforces product_id NOT NULL — material receipts
-- therefore cannot create their own inventory rows and a goods receipt
-- of a raw material could never increase material stock. This completes
-- that drop on the live schema (additive, no data change) and ensures the
-- product-or-material CHECK exists so a row must still reference one.
-- =====================================================================

ALTER TABLE public.inventory
  ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE public.inventory
  DROP CONSTRAINT IF EXISTS inventory_product_or_material;

ALTER TABLE public.inventory
  ADD CONSTRAINT inventory_product_or_material
  CHECK (product_id IS NOT NULL OR material_id IS NOT NULL);
