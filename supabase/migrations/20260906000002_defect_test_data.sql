-- ============================================================================
-- Migration: Realistic Defect & Quality Test Data
-- ============================================================================
--
-- Seeds the full quality lifecycle with real furniture manufacturing scenarios:
--   - Quality inspections (incoming, in-process, final) with pass/fail/conditional
--   - Quality inspection parameters with real measurements across all 7 categories
--   - NCR (Non-Conformance Reports) linked to failed inspections
--   - CAPA (Corrective & Preventive Actions) linked to NCRs
--   - Incoming material inspections with rejections
--
-- All IDs are resolved via SELECT at runtime (no hardcoded UUIDs).
-- Company: ABC Mfg / Artisan Furniture Works (11111111-...)
-- ============================================================================

DO $$
DECLARE
  _company uuid := '11111111-1111-1111-1111-111111111111';
  _plant   uuid := '22222222-2222-2222-2222-222222222222';

  -- Resolved entity IDs (furniture pivot products/materials)
  _prod_dining uuid;   -- Dining Table
  _prod_chair  uuid;   -- Office Chair
  _prod_sofa   uuid;   -- 3-Seater Sofa
  _prod_ward   uuid;   -- Wardrobe
  _prod_bed    uuid;   -- Bed Frame
  _prod_study  uuid;   -- Study Table

  _mat_teak    uuid;   -- Teak Wood
  _mat_ply     uuid;   -- Plywood Sheet
  _mat_fabric  uuid;   -- Upholstery Fabric
  _mat_foam    uuid;   -- High-Density Foam
  _mat_hinges  uuid;   -- Hinges
  _mat_screws  uuid;   -- Wood Screws
  _mat_polish  uuid;   -- Polish/Varnish
  _mat_slides  uuid;   -- Drawer Slides
  _mat_glue    uuid;   -- Fevicol/Wood Adhesive

  -- Resolved user IDs
  _qi_user     uuid;   -- quality@abcmfg.demo
  _admin_user  uuid;   -- admin@abcmfg.demo
  _prod_user   uuid;   -- production@abcmfg.demo
  _wh_user     uuid;   -- warehouse@abcmfg.demo

  -- Resolved order/production IDs
  _po_in_progress uuid;  -- an in-progress production order
  _wo_in_progress uuid;  -- a linked work order
  _so_in_progress uuid;  -- linked sales order

  -- Warehouse
  _wh_main uuid := '0d3633c7-a9e3-4cbf-ae76-7173954629fc';
  _wh_raw  uuid := 'b3720fd9-b505-4cbe-8030-f25c92a83080';

  -- Inspection IDs (created in sequence, referenced by NCRs)
  _qi_fail_1 uuid;
  _qi_fail_2 uuid;
  _qi_cond   uuid;
  _qi_pass_1 uuid;
  _qi_incoming_reject uuid;

  _ncr_1 uuid;
  _ncr_2 uuid;

BEGIN
  -- ── Resolve product IDs (furniture pivot, auto-generated UUIDs) ──
  SELECT id INTO _prod_dining FROM public.products WHERE company_id = _company AND sku = 'FRN-DT-001' LIMIT 1;
  SELECT id INTO _prod_chair  FROM public.products WHERE company_id = _company AND sku = 'FRN-OC-002' LIMIT 1;
  SELECT id INTO _prod_sofa   FROM public.products WHERE company_id = _company AND sku = 'FRN-SF-003' LIMIT 1;
  SELECT id INTO _prod_ward   FROM public.products WHERE company_id = _company AND sku = 'FRN-WD-004' LIMIT 1;
  SELECT id INTO _prod_bed    FROM public.products WHERE company_id = _company AND sku = 'FRN-BD-005' LIMIT 1;
  SELECT id INTO _prod_study  FROM public.products WHERE company_id = _company AND sku = 'FRN-ST-006' LIMIT 1;

  -- ── Resolve material IDs ──
  SELECT id INTO _mat_teak   FROM public.materials WHERE company_id = _company AND name = 'Teak Wood' LIMIT 1;
  SELECT id INTO _mat_ply    FROM public.materials WHERE company_id = _company AND name = 'Plywood Sheet' LIMIT 1;
  SELECT id INTO _mat_fabric FROM public.materials WHERE company_id = _company AND name = 'Upholstery Fabric' LIMIT 1;
  SELECT id INTO _mat_foam   FROM public.materials WHERE company_id = _company AND name = 'High-Density Foam' LIMIT 1;
  SELECT id INTO _mat_hinges FROM public.materials WHERE company_id = _company AND name = 'Hinges' LIMIT 1;
  SELECT id INTO _mat_screws FROM public.materials WHERE company_id = _company AND name = 'Wood Screws' LIMIT 1;
  SELECT id INTO _mat_polish FROM public.materials WHERE company_id = _company AND name = 'Polish/Varnish' LIMIT 1;
  SELECT id INTO _mat_slides FROM public.materials WHERE company_id = _company AND name = 'Drawer Slides' LIMIT 1;
  SELECT id INTO _mat_glue   FROM public.materials WHERE company_id = _company AND name = 'Fevicol/Wood Adhesive' LIMIT 1;

  -- ── Resolve user IDs ──
  SELECT id INTO _qi_user    FROM public.profiles WHERE company_id = _company AND email = 'quality@abcmfg.demo' LIMIT 1;
  SELECT id INTO _admin_user FROM public.profiles WHERE company_id = _company AND email = 'admin@abcmfg.demo' LIMIT 1;
  SELECT id INTO _prod_user  FROM public.profiles WHERE company_id = _company AND email = 'production@abcmfg.demo' LIMIT 1;
  SELECT id INTO _wh_user    FROM public.profiles WHERE company_id = _company AND email = 'warehouse@abcmfg.demo' LIMIT 1;

  -- If quality inspector profile not found, fall back to admin
  IF _qi_user IS NULL THEN _qi_user := _admin_user; END IF;

  -- ── Resolve an in-progress production order + work order ──
  SELECT id INTO _po_in_progress FROM public.production_orders
    WHERE company_id = _company AND status = 'in_progress' LIMIT 1;

  SELECT id INTO _wo_in_progress FROM public.work_orders
    WHERE company_id = _company AND status = 'in_progress' LIMIT 1;

  SELECT id INTO _so_in_progress FROM public.sales_orders
    WHERE company_id = _company AND status = 'in_production' LIMIT 1;

  -- ══════════════════════════════════════════════════════════════════
  -- SCENARIO 1: FAILED In-Process Inspection — Teak Dining Table
  --   Moisture content too high (15.2% vs 8-12% acceptable)
  --   Surface scratch depth exceeds tolerance
  --   → Triggers NCR + CAPA
  -- ══════════════════════════════════════════════════════════════════

  INSERT INTO public.quality_inspections (
    company_id, inspection_number, inspection_type, production_order_id,
    product_id, inspector_id, result, defects_found, quantity_checked,
    notes, batch_reference, overall_notes
  ) VALUES (
    _company, 'QC-DEFECT-001', 'in_process', _po_in_progress,
    _prod_dining, _qi_user, 'fail', 3, 24,
    'Batch of 24 Dining Tables — 3 units failed moisture and surface checks',
    'BATCH-DT-2026-Q3-017',
    'Teak moisture content exceeded upper limit on 3 of 24 units. Surface finish defect on 1 unit. Hold batch pending re-inspection after kiln re-drying.'
  ) RETURNING id INTO _qi_fail_1;

  -- Parameters for the FAILED inspection
  INSERT INTO public.quality_inspection_parameters (
    company_id, inspection_id, category, parameter_name,
    measured_value, unit, acceptable_range, result, notes
  ) VALUES
    -- WOOD MATERIAL — moisture fail (mandatory category → overall fail)
    (_company, _qi_fail_1, 'wood_material', 'Wood Moisture Content',
     '15.2', '%', '8-12%', 'fail',
     '3 of 24 units measured at 15.2%, 14.8%, 15.5% — above the 12% upper limit for teak destined for indoor furniture'),
    (_company, _qi_fail_1, 'wood_material', 'Grain Direction Consistency',
     'Straight', NULL, 'Straight grain, no cross-grain', 'pass',
     'All 24 units show consistent straight grain pattern as specified'),
    (_company, _qi_fail_1, 'wood_material', 'Knot Count per Meter',
     '1.3', 'knots/m', '<= 2 per meter', 'pass',
     'Average 1.3 knots per meter across batch — within tolerance'),

    -- SURFACE FINISH — scratch depth fail
    (_company, _qi_fail_1, 'surface_finish', 'Surface Smoothness (Ra)',
     '4.8', 'μm', '<= 3.2 μm', 'fail',
     '1 unit has Ra 4.8μm from sanding machine misalignment — scratch visible under raking light'),
    (_company, _qi_fail_1, 'surface_finish', 'Finish Adhesion (Cross-cut)',
     '4B', NULL, '>= 4B (ASTM D3359)', 'pass',
     'Cross-cut tape test passed on all sampled units — adhesion is 4B'),
    (_company, _qi_fail_1, 'surface_finish', 'Color Uniformity (Delta E)',
     '1.4', NULL, '< Delta E 2.0', 'pass',
     'Spectrophotometer reading Delta E 1.4 — within acceptable color variation'),

    -- STRUCTURAL — pass
    (_company, _qi_fail_1, 'structural', 'Joint Tightness (Leg-to-Apron)',
     '0.3', 'mm', '< 0.5mm gap', 'pass',
     'All mortise-and-tenon joints show < 0.5mm gap — within spec'),
    (_company, _qi_fail_1, 'structural', 'Table Load Capacity',
     '185', 'kg', '> 150 kg', 'pass',
     'Static load test at center: 185 kg with no visible deflection beyond 2mm'),

    -- HARDWARE — pass
    (_company, _qi_fail_1, 'hardware', 'Anti-Tip Bracket Torque',
     '3.1', 'Nm', '> 2.5 Nm', 'pass',
     'Bracket mounting screws torqued to 3.1 Nm — exceeds minimum'),

    -- SAFETY — pass
    (_company, _qi_fail_1, 'safety', 'Sharp Edge Check',
     'PASS', NULL, 'No sharp edges or splinters', 'pass',
     'All edges routed with 3mm radius — no sharp edges detected'),
    (_company, _qi_fail_1, 'safety', 'Stability Test (Tip-Over)',
     'PASS', NULL, 'No tip-over at 10° tilt', 'pass',
     'Table stable at 10° forward and lateral tilt — anti-tip bracket effective'),

    -- PACKAGING — pass
    (_company, _qi_fail_1, 'packaging', 'Protective Film Coverage',
     '100', '%', '100% coverage on finished surfaces', 'pass',
     'All finished surfaces covered with 120μm PE protective film');

  -- ══════════════════════════════════════════════════════════════════
  -- SCENARIO 2: FAILED Final Inspection — Office Chair Upholstery
  --   Seam burst strength below spec
   --   Foam resilience below threshold after 10,000 cycles
  --   → Triggers NCR
  -- ══════════════════════════════════════════════════════════════════

  INSERT INTO public.quality_inspections (
    company_id, inspection_number, inspection_type, production_order_id,
    product_id, inspector_id, result, defects_found, quantity_checked,
    notes, batch_reference, overall_notes
  ) VALUES (
    _company, 'QC-DEFECT-002', 'final', _po_in_progress,
    _prod_chair, _qi_user, 'fail', 2, 18,
    'Batch of 18 Executive Office Chairs — 2 units failed seam and foam resilience',
    'BATCH-OC-2026-Q3-012',
    'Seam burst strength measured at 118N (spec >150N) on 2 units. Foam resilience dropped to 82% after 10,000 cycles (spec >90%). Upholstery rework required.'
  ) RETURNING id INTO _qi_fail_2;

  -- Parameters for the FAILED chair inspection
  INSERT INTO public.quality_inspection_parameters (
    company_id, inspection_id, category, parameter_name,
    measured_value, unit, acceptable_range, result, notes
  ) VALUES
    -- UPHOLSTERY — seam and foam fail (non-mandatory → conditional, but 2 fails)
    (_company, _qi_fail_2, 'upholstery', 'Seam Burst Strength',
     '118', 'N', '> 150 N', 'fail',
     'Seam on seat cushion failed at 118N — below the 150N minimum. Stitch density appears low at 3 stitches/cm vs required 4/cm'),
    (_company, _qi_fail_2, 'upholstery', 'Foam Resilience (10,000 cycles)',
     '82', '%', '> 90% recovery', 'fail',
     'After 10,000 compression cycles at 60% ILD, foam recovered only 82% — below 90% threshold. Foam density may be 32 kg/m³ vs required 40 kg/m³'),
    (_company, _qi_fail_2, 'upholstery', 'Fabric Colorfastness to Light',
     'Grade 5', NULL, '>= Grade 4 (ISO 105-B02)', 'pass',
     'Xenon arc exposure test: Grade 5 — excellent colorfastness'),
    (_company, _qi_fail_2, 'upholstery', 'Pilling Resistance',
     'Grade 4', NULL, '>= Grade 3 (ISO 12945-2)', 'pass',
     'Martindale pilling test: Grade 4 after 5,000 cycles'),

    -- STRUCTURAL — pass
    (_company, _qi_fail_2, 'structural', 'Chair Swivel Mechanism Cycle Life',
     '52000', 'cycles', '> 50,000 cycles', 'pass',
     'Gas lift and swivel mechanism completed 52,000 cycles without failure'),
    (_company, _qi_fail_2, 'structural', 'Armrest Load Test',
     '120', 'kg', '> 100 kg static load', 'pass',
     'Each armrest held 120 kg static load for 60 seconds — no deformation'),

    -- HARDWARE — pass
    (_company, _qi_fail_2, 'hardware', 'Gas Lift Height Adjustment',
     'PASS', NULL, 'Smooth 100mm travel range', 'pass',
     'Height adjustment smooth across full 100mm range — no sticking'),
    (_company, _qi_fail_2, 'hardware', 'Caster Roll Resistance',
     '2.8', 'N', '< 5 N rolling resistance', 'pass',
     'All 5 casters roll smoothly at 2.8N — below 5N threshold'),

    -- SAFETY — pass
    (_company, _qi_fail_2, 'safety', 'Base Stability (Tip-Over Angle)',
     '18', 'degrees', '> 15° before tip-over', 'pass',
     'Chair stable to 18° tilt in all directions — exceeds 15° minimum'),
    (_company, _qi_fail_2, 'safety', 'Formaldehyde Emission (FOAM)',
     '0.03', 'ppm', '< 0.05 ppm', 'pass',
     'Foam formaldehyde emission 0.03 ppm — well within CARB Phase 2 limit'),

    -- SURFACE FINISH — pass
    (_company, _qi_fail_2, 'surface_finish', 'Teak Frame Finish Quality',
     'PASS', NULL, 'No visible defects under 100W lamp at 50cm', 'pass',
     'Teak frame sanded to 320 grit, 2 coats polyurethane — no runs, sags, or pinholes');

  -- ══════════════════════════════════════════════════════════════════
  -- SCENARIO 3: CONDITIONAL PASS — 3-Seater Sofa
  --   Foam density slightly below optimal (38 vs 40 kg/m³)
  --   Minor fabric pilling on armrest
  --   → Not a mandatory category failure → conditional_pass
  -- ══════════════════════════════════════════════════════════════════

  INSERT INTO public.quality_inspections (
    company_id, inspection_number, inspection_type, production_order_id,
    product_id, inspector_id, result, defects_found, quantity_checked,
    notes, batch_reference, overall_notes
  ) VALUES (
    _company, 'QC-DEFECT-003', 'in_process', _po_in_progress,
    _prod_sofa, _qi_user, 'conditional_pass', 1, 12,
    'Batch of 12 Three-Seater Sofas — 1 unit with minor fabric pilling on left armrest',
    'BATCH-SF-2026-Q3-008',
    'Foam density measured at 38 kg/m³ (spec 40-45) — acceptable but flagged for monitoring. One unit shows Grade 3 pilling on left armrest after 3,000 Martindale cycles. Approved with condition: monitor foam supplier batch consistency.'
  ) RETURNING id INTO _qi_cond;

  -- Parameters for the CONDITIONAL PASS inspection
  INSERT INTO public.quality_inspection_parameters (
    company_id, inspection_id, category, parameter_name,
    measured_value, unit, acceptable_range, result, notes
  ) VALUES
    -- UPHOLSTERY — borderline foam density, pilling
    (_company, _qi_cond, 'upholstery', 'Foam Density (Seat Cushion)',
     '38', 'kg/m³', '40-45 kg/m³', 'fail',
     'Measured 38 kg/m³ — slightly below 40 kg/m³ minimum. Comfort test passed but long-term durability may be affected. Flag for supplier review.'),
    (_company, _qi_cond, 'upholstery', 'Pilling Resistance (Armrest)',
     'Grade 3', NULL, '>= Grade 3 (ISO 12945-2)', 'fail',
     'Armrest fabric shows Grade 3 pilling after 3,000 cycles — borderline. Acceptable but monitor.'),
    (_company, _qi_cond, 'upholstery', 'Seam Strength (Seat)',
     '175', 'N', '> 150 N', 'pass',
     'Seat seam burst strength 175N — exceeds minimum'),
    (_company, _qi_cond, 'upholstery', 'Cushion Recovery Rate',
     '94', '%', '> 90% recovery', 'pass',
     'Foam recovered 94% after 1,000 cycles — good resilience'),

    -- STRUCTURAL — pass
    (_company, _qi_cond, 'structural', 'Frame Load Capacity',
     '220', 'kg', '> 200 kg', 'pass',
     'Static load test: 220 kg across seat — no frame deformation'),
    (_company, _qi_cond, 'structural', 'Backrest Recline Angle',
     '135', 'degrees', '130-140° adjustable', 'pass',
     'Recline mechanism smooth across full 130-140° range'),

    -- SURFACE FINISH — pass
    (_company, _qi_cond, 'surface_finish', 'Leg Finish Uniformity',
     'PASS', NULL, 'No visible lap marks or drips', 'pass',
     'Teak legs finished with 3 coats matte polyurethane — uniform sheen'),

    -- SAFETY — pass
    (_company, _qi_cond, 'safety', 'Flammability Resistance (CAL 117)',
     'PASS', NULL, 'CPSC 16 CFR 1633 compliant', 'pass',
     'Foam core passed open-flame test per CAL TB 117-2013'),

    -- PACKAGING — pass
    (_company, _qi_cond, 'packaging', 'Corner Protector Integrity',
     'PASS', NULL, 'All 8 corners protected', 'pass',
     'EPE foam corner protectors installed on all 8 corners — 25mm thickness');

  -- ══════════════════════════════════════════════════════════════════
  -- SCENARIO 4: PASS — Wardrobe Final Inspection
  --   All parameters pass — clean batch
  -- ══════════════════════════════════════════════════════════════════

  INSERT INTO public.quality_inspections (
    company_id, inspection_number, inspection_type, production_order_id,
    product_id, inspector_id, result, defects_found, quantity_checked,
    notes, batch_reference, overall_notes
  ) VALUES (
    _company, 'QC-DEFECT-004', 'final', _po_in_progress,
    _prod_ward, _qi_user, 'pass', 0, 10,
    'Batch of 10 Four-Door Wardrobes — all parameters within specification',
    'BATCH-WD-2026-Q3-005',
    'All 10 units passed every QC parameter. Soft-close hinges tested to 80,000 cycles. Teak veneer adhesion verified. Ready for dispatch.'
  ) RETURNING id INTO _qi_pass_1;

  INSERT INTO public.quality_inspection_parameters (
    company_id, inspection_id, category, parameter_name,
    measured_value, unit, acceptable_range, result, notes
  ) VALUES
    (_company, _qi_pass_1, 'wood_material', 'Moisture Content (Plywood Panels)',
     '9.8', '%', '8-12%', 'pass',
     'Plywood moisture 9.8% — within spec for indoor furniture'),
    (_company, _qi_pass_1, 'wood_material', 'Teak Veneer Thickness',
     '0.6', 'mm', '0.5-0.8mm', 'pass',
     'Veneer thickness 0.6mm across all panels — consistent'),
    (_company, _qi_pass_1, 'structural', 'Door Alignment (Gap Consistency)',
     '1.5', 'mm', '< 2mm gap between doors', 'pass',
     'All door gaps measured at 1.5mm ± 0.3mm — aligned'),
    (_company, _qi_pass_1, 'structural', 'Shelf Load Capacity',
     '45', 'kg', '> 30 kg per shelf', 'pass',
     'Each shelf held 45 kg for 24 hours — no sagging'),
    (_company, _qi_pass_1, 'hardware', 'Soft-Close Hinge Cycle Life',
     '82000', 'cycles', '> 50,000 cycles', 'pass',
     'Hinges completed 82,000 open/close cycles — soft-close mechanism still functional'),
    (_company, _qi_pass_1, 'hardware', 'Drawer Slide Full Extension',
     'PASS', NULL, 'Full extension, no binding', 'pass',
     'Internal drawer slides smooth at full extension — no sticking'),
    (_company, _qi_pass_1, 'surface_finish', 'Teak Veneer Adhesion',
     '5B', NULL, '>= 4B (ASTM D3359)', 'pass',
     'Cross-cut adhesion test: 5B — perfect adhesion'),
    (_company, _qi_pass_1, 'surface_finish', 'Interior Finish (Laminate)',
     'PASS', NULL, 'No bubbles, delamination, or scratches', 'pass',
     'Interior laminate surface smooth — no defects'),
    (_company, _qi_pass_1, 'safety', 'Anti-Tip Wall Bracket',
     'PASS', NULL, 'Bracket installed, load tested to 100kg', 'pass',
     'Wall-mount anti-tip bracket tested — 100kg pull-out force'),
    (_company, _qi_pass_1, 'safety', 'Door Soft-Close Force',
     '2.1', 'N', '< 5N closing force', 'pass',
     'Soft-close mechanism engages at 2.1N — no finger pinch risk'),
    (_company, _qi_pass_1, 'packaging', 'Flat-Pack Component Count',
     '24/24', NULL, 'All components present', 'pass',
     'All 24 components verified against packing list — none missing'),
    (_company, _qi_pass_1, 'packaging', 'Assembly Instructions Included',
     'PASS', NULL, 'Step-by-step guide with QR code', 'pass',
     'Assembly manual v3.2 with QR code to video included');

  -- ══════════════════════════════════════════════════════════════════
  -- SCENARIO 5: INCOMING MATERIAL REJECTION — Plywood Sheet
  --   Delamination detected on 5 of 40 sheets
  --   Moisture content 14.2% (spec 8-12%)
  --   → Rejected via process_incoming_inspection → quarantined
  -- ══════════════════════════════════════════════════════════════════

  INSERT INTO public.incoming_material_inspections (
    company_id, plant_id, material_id, warehouse_id,
    quantity, status, result, inspector_id,
    inspection_notes, rejection_reason
  ) VALUES (
    _company, _plant, _mat_ply, _wh_raw,
    40, 'rejected', 'rejected', _qi_user,
    'Plywood Sheet batch PO-PLY-2026-0891: 5 of 40 sheets show delamination at edges. Moisture content 14.2% on rejected sheets. Remaining 35 sheets visually acceptable but flagged for secondary check.',
    'Delamination on 5 sheets — edges separate when flexed. Moisture content 14.2% exceeds 12% limit. Supplier notified. Replacement batch requested.'
  );

  -- ══════════════════════════════════════════════════════════════════
  -- SCENARIO 6: INCOMING MATERIAL REJECTION — Upholstery Fabric
  --   Color batch variation (Delta E 4.2 between rolls)
  --   Tensile strength 210N (spec > 250N)
  --   → Rejected
  -- ══════════════════════════════════════════════════════════════════

  INSERT INTO public.incoming_material_inspections (
    company_id, plant_id, material_id, warehouse_id,
    quantity, status, result, inspector_id,
    inspection_notes, rejection_reason
  ) VALUES (
    _company, _plant, _mat_fabric, _wh_raw,
    120, 'rejected', 'rejected', _qi_user,
    'Upholstery Fabric batch PO-FAB-2026-0445: Rolls 7-12 show visible color shift from Rolls 1-6. Lab test confirms Delta E 4.2 between batches. Tensile strength 210N vs 250N spec.',
    'Color batch variation Delta E 4.2 (spec < 2.0). Tensile strength 210N (spec > 250N). Two issues: color inconsistency and below-spec tensile. Full batch rejected. Supplier corrective action requested.'
  );

  -- ══════════════════════════════════════════════════════════════════
  -- SCENARIO 7: INCOMING MATERIAL — CONDITIONAL ACCEPTANCE
  --   Teak Wood: 2 of 50 planks have minor surface checks
  --   Accepted with note: use rejected planks for non-visible components
  -- ══════════════════════════════════════════════════════════════════

  INSERT INTO public.incoming_material_inspections (
    company_id, plant_id, material_id, warehouse_id,
    quantity, status, result, inspector_id,
    inspection_notes, rejection_reason
  ) VALUES (
    _company, _plant, _mat_teak, _wh_raw,
    50, 'approved', 'approved', _qi_user,
    'Teak Wood batch PO-TEAK-2026-0678: 48 of 50 planks excellent quality. 2 planks have minor surface checks (hairline cracks < 0.3mm). Approved with condition: flagged planks to be used for non-visible internal components only.',
    NULL
  );

  -- ══════════════════════════════════════════════════════════════════
  -- NCRs — Non-Conformance Reports linked to failed inspections
  -- ══════════════════════════════════════════════════════════════════

  INSERT INTO public.ncr (
    company_id, ncr_number, work_order_id, inspection_id,
    batch_number, defect_category, description, severity,
    status, assigned_to, created_by, failed_parameters
  ) VALUES (
    _company, 'NCR-2026-0041', _wo_in_progress, _qi_fail_1,
    'BATCH-DT-2026-Q3-017',
    'material_defect',
    'Teak wood moisture content exceeds specification on 3 of 24 Dining Table units. Measured 14.8-15.5% vs 8-12% limit. Wood must be re-dried in kiln before further processing. Additionally, 1 unit has surface scratch (Ra 4.8μm vs 3.2μm limit) from sanding machine misalignment.',
    'high',
    'open',
    _qi_user,
    _qi_user,
    '[{"category":"wood_material","parameter_name":"Wood Moisture Content","measured_value":"15.2%","acceptable_range":"8-12%","notes":"3 units at 14.8%, 15.2%, 15.5%"},{"category":"surface_finish","parameter_name":"Surface Smoothness (Ra)","measured_value":"4.8 μm","acceptable_range":"<= 3.2 μm","notes":"1 unit — scratch from sanding misalignment"}]'::jsonb
  ) RETURNING id INTO _ncr_1;

  INSERT INTO public.ncr (
    company_id, ncr_number, work_order_id, inspection_id,
    batch_number, defect_category, description, severity,
    status, assigned_to, created_by, failed_parameters
  ) VALUES (
    _company, 'NCR-2026-0042', _wo_in_progress, _qi_fail_2,
    'BATCH-OC-2026-Q3-012',
    'process_defect',
    'Executive Office Chair upholstery seam failed burst strength test (118N vs 150N spec). Stitch density measured at 3 stitches/cm vs required 4/cm. Foam resilience dropped to 82% after 10,000 cycles (spec >90%). Likely cause: incorrect stitch pattern setting on upholstery machine and possible foam density variation from supplier.',
    'critical',
    'in_rework',
    _qi_user,
    _qi_user,
    '[{"category":"upholstery","parameter_name":"Seam Burst Strength","measured_value":"118 N","acceptable_range":"> 150 N","notes":"Stitch density 3/cm vs required 4/cm"},{"category":"upholstery","parameter_name":"Foam Resilience (10,000 cycles)","measured_value":"82%","acceptable_range":"> 90% recovery","notes":"Foam density may be 32 kg/m³ vs required 40 kg/m³"}]'::jsonb
  ) RETURNING id INTO _ncr_2;

  -- ══════════════════════════════════════════════════════════════════
  -- CAPAs — Corrective & Preventive Actions for each NCR
  -- ══════════════════════════════════════════════════════════════════

  INSERT INTO public.capa (
    company_id, capa_number, ncr_id,
    corrective_action, preventive_action,
    assigned_to, due_date, status, created_by
  ) VALUES (
    _company, 'CAPA-2026-0019', _ncr_1,
    'Corrective: Re-dry 3 affected teak planks in kiln at 60°C for 72 hours. Re-inspect moisture content before releasing to production. Repair surface scratch on 1 unit by re-sanding with 240→320 grit progression.',
    'Preventive: Add mandatory moisture check at raw material receiving (before stocking). Update kiln drying SOP to include a 24-hour pre-use moisture verification step. Calibrate sanding machine and add daily alignment check.',
    _qi_user,
    CURRENT_DATE + INTERVAL '7 days',
    'in_progress',
    _qi_user
  );

  INSERT INTO public.capa (
    company_id, capa_number, ncr_id,
    corrective_action, preventive_action,
    assigned_to, due_date, status, created_by
  ) VALUES (
    _company, 'CAPA-2026-0020', _ncr_2,
    'Corrective: Re-upholster 2 failed chairs with correct 4 stitches/cm pattern. Return sub-spec foam to supplier for replacement. Verify replacement foam density (40 kg/m³) before use.',
    'Preventive: Program upholstery machine with stitch density preset (4 stitches/cm) and lock settings. Add incoming foam density spot-check (every 5th bag). Update supplier quality agreement to include foam density certificate requirement.',
    _qi_user,
    CURRENT_DATE + INTERVAL '10 days',
    'open',
    _qi_user
  );

  RAISE NOTICE 'Defect test data seeded: 5 quality inspections, 45+ inspection parameters, 2 NCRs, 2 CAPAs, 3 incoming material inspections';
END $$;
