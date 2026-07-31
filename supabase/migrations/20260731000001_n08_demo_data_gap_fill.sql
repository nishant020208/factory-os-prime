-- =============================================================
-- FACTORYOS AI — N-08 DEMO DATA GAP FILL
-- The main seeder (20260728000000) gated its work_orders,
-- quality_inspections, finished_goods and packing inserts on
-- production order numbers 'N-08-PO-001/004/006', but production
-- orders on the live DB were created under the 'N-08-PO-N-08-ORD-00X'
-- naming, so those downstream rows never inserted.
--
-- This migration fills the gap by dynamically looking up whichever
-- N-08 production orders actually exist (matched by prefix + status),
-- so it works regardless of the exact order-number naming. Idempotent.
-- Company: ABC Manufacturing (11111111-1111-1111-1111-111111111111)
-- =============================================================
DO $$
DECLARE
  _company uuid := '11111111-1111-1111-1111-111111111111';
  _po_completed uuid;
  _po_inprogress uuid;
  _po_planned uuid;
  _mach_a1 uuid;
  _mach_r7 uuid;
  _wo1 uuid;
  _fg_id uuid;
BEGIN
  -- Resolve the actual N-08 production orders by status (any naming)
  SELECT id INTO _po_completed FROM public.production_orders
    WHERE company_id = _company AND order_number LIKE 'N-08-PO-%' AND status = 'completed'
    ORDER BY created_at LIMIT 1;
  SELECT id INTO _po_inprogress FROM public.production_orders
    WHERE company_id = _company AND order_number LIKE 'N-08-PO-%' AND status = 'in_progress'
    ORDER BY created_at LIMIT 1;
  SELECT id INTO _po_planned FROM public.production_orders
    WHERE company_id = _company AND order_number LIKE 'N-08-PO-%' AND status IN ('planned','draft','scheduled')
    ORDER BY created_at LIMIT 1;

  -- Resolve machines by code (created by the original seeder)
  SELECT id INTO _mach_a1 FROM public.machines WHERE company_id = _company AND code = 'N-08-MC-A1' LIMIT 1;
  SELECT id INTO _mach_r7 FROM public.machines WHERE company_id = _company AND code = 'N-08-MC-R7' LIMIT 1;

  -- ================= WORK ORDERS (N-08) =======================
  -- N-08-WO-001 — CNC Machining, completed, on the completed PO
  IF _po_completed IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.work_orders WHERE company_id = _company AND wo_number = 'N-08-WO-001'
  ) THEN
    INSERT INTO public.work_orders (company_id, production_order_id, wo_number, operation, quantity, status, start_time, end_time, machine_id)
    VALUES (_company, _po_completed, 'N-08-WO-001', 'CNC Machining', 250, 'completed',
            now() - interval '14 days', now() - interval '10 days', _mach_a1);
  END IF;

  -- N-08-WO-002 — Quality Inspection, completed (no machine)
  IF _po_completed IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.work_orders WHERE company_id = _company AND wo_number = 'N-08-WO-002'
  ) THEN
    INSERT INTO public.work_orders (company_id, production_order_id, wo_number, operation, quantity, status, start_time, end_time, machine_id)
    VALUES (_company, _po_completed, 'N-08-WO-002', 'Quality Inspection', 250, 'completed',
            now() - interval '10 days', now() - interval '8 days', NULL);
  END IF;

  -- N-08-WO-003 — Assembly, in_progress, on the in-progress PO
  IF _po_inprogress IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.work_orders WHERE company_id = _company AND wo_number = 'N-08-WO-003'
  ) THEN
    INSERT INTO public.work_orders (company_id, production_order_id, wo_number, operation, quantity, status, start_time, end_time, machine_id)
    VALUES (_company, _po_inprogress, 'N-08-WO-003', 'Assembly', 500, 'in_progress',
            now() - interval '3 days', NULL, _mach_r7);
  END IF;

  -- N-08-WO-004 — Precision Assembly, pending, on the planned PO
  IF _po_planned IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.work_orders WHERE company_id = _company AND wo_number = 'N-08-WO-004'
  ) THEN
    INSERT INTO public.work_orders (company_id, production_order_id, wo_number, operation, quantity, status, machine_id)
    VALUES (_company, _po_planned, 'N-08-WO-004', 'Precision Assembly', 150, 'pending', _mach_r7);
  END IF;

  -- =============== QUALITY INSPECTIONS (N-08) =================
  IF _po_completed IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.quality_inspections WHERE company_id = _company AND inspection_number = 'N-08-QI-001'
  ) THEN
    INSERT INTO public.quality_inspections (company_id, inspection_number, production_order_id, inspection_type, result, defects_found, quantity_checked, created_at)
    VALUES (_company, 'N-08-QI-001', _po_completed, 'incoming', 'pass', 0, 250, now() - interval '12 days');
  END IF;

  IF _po_completed IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.quality_inspections WHERE company_id = _company AND inspection_number = 'N-08-QI-002'
  ) THEN
    INSERT INTO public.quality_inspections (company_id, inspection_number, production_order_id, inspection_type, result, defects_found, quantity_checked, created_at)
    VALUES (_company, 'N-08-QI-002', _po_completed, 'final', 'pass', 2, 250, now() - interval '7 days');
  END IF;

  IF _po_inprogress IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.quality_inspections WHERE company_id = _company AND inspection_number = 'N-08-QI-003'
  ) THEN
    INSERT INTO public.quality_inspections (company_id, inspection_number, production_order_id, inspection_type, result, defects_found, quantity_checked, created_at)
    VALUES (_company, 'N-08-QI-003', _po_inprogress, 'in_process', 'pass', 1, 250, now() - interval '2 days');
  END IF;

  -- ================== FINISHED GOODS (N-08) ===================
  SELECT id INTO _wo1 FROM public.work_orders
    WHERE company_id = _company AND wo_number = 'N-08-WO-001' LIMIT 1;

  IF _wo1 IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.finished_goods WHERE company_id = _company AND product = 'N-08 Titanium Bracket TB-500'
  ) THEN
    INSERT INTO public.finished_goods (company_id, work_order_id, product, quantity, notes, created_at)
    VALUES (_company, _wo1, 'N-08 Titanium Bracket TB-500', 248,
            'Inspected and approved — 2 defects scrapped', now() - interval '6 days')
    RETURNING id INTO _fg_id;

    -- ===================== PACKING (N-08) =====================
    IF _fg_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.packing WHERE company_id = _company AND package_number = 'N-08-PKG-001'
    ) THEN
      INSERT INTO public.packing (company_id, finished_goods_id, package_number, quantity, notes, created_at)
      VALUES (_company, _fg_id, 'N-08-PKG-001', 248, '4 crates, 62 units each', now() - interval '5 days');
    END IF;
  END IF;
END $$;
