-- =====================================================================
-- FACTORYOS AI — CUSTOMER PLANT BACKFILL (2026-09-04)
--
-- Existing customers of the demo company get the main plant so that any
-- order they place going forward inherits a plant (and is therefore
-- visible/approvable by the main plant's Plant Admin). Additive update
-- only — no rows deleted or recreated.
-- =====================================================================

UPDATE public.customers
SET plant_id = '22222222-2222-2222-2222-222222222222'
WHERE company_id = '11111111-1111-1111-1111-111111111111'
  AND plant_id IS NULL;

-- Confirm
SELECT count(*) AS total, count(plant_id) AS with_plant
FROM public.customers
WHERE company_id = '11111111-1111-1111-1111-111111111111';