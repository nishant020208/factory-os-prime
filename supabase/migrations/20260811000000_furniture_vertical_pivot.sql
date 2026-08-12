-- =============================================================
-- FACTORYOS AI — FURNITURE MANUFACTURING VERTICAL PIVOT SEED MIGRATION
-- Company: Artisan Furniture Works (11111111-1111-1111-1111-111111111111)
-- Rebrands tenant and seeds custom furniture manufacturing demo data.
-- =============================================================

DO $$
DECLARE
  _company uuid := '11111111-1111-1111-1111-111111111111';
  _wh_main uuid;
  _wh_raw uuid;
  _wh_fg uuid;
  
  _dept_carp uuid;
  _dept_uph uuid;
  _dept_fin uuid;
  _dept_assm uuid;
  _dept_qc uuid;
  _dept_pack uuid;

  _prod_dt uuid;
  _prod_oc uuid;
  _prod_sf uuid;
  _prod_wd uuid;
  _prod_bd uuid;
  _prod_st uuid;

  _mat_teak uuid;
  _mat_ply uuid;
  _mat_fab uuid;
  _mat_foam uuid;
  _mat_hng uuid;
  _mat_scrw uuid;
  _mat_pol uuid;
  _mat_sld uuid;
  _mat_adh uuid;

  _cust_urban uuid;
  _cust_decor uuid;
  _cust_indiv uuid;

  _sup_kerala uuid;

BEGIN

  -- 1. UPDATE COMPANY NAME & INDUSTRY
  UPDATE public.companies
  SET name = 'Artisan Furniture Works',
      legal_name = 'Artisan Furniture Works Pvt Ltd',
      industry = 'Custom Furniture Manufacturing'
  WHERE id = _company;

  -- Get default warehouses
  SELECT id INTO _wh_main FROM public.warehouses WHERE company_id = _company LIMIT 1;
  SELECT id INTO _wh_raw FROM public.warehouses WHERE company_id = _company AND (name ILIKE '%raw%' OR name ILIKE '%material%') LIMIT 1;
  SELECT id INTO _wh_fg FROM public.warehouses WHERE company_id = _company AND (name ILIKE '%finished%' OR name ILIKE '%fg%') LIMIT 1;

  IF _wh_main IS NULL THEN
    INSERT INTO public.warehouses (company_id, name, code)
    VALUES (_company, 'Main Furniture Warehouse', 'WH-FRN-MAIN')
    RETURNING id INTO _wh_main;
  END IF;
  IF _wh_raw IS NULL THEN _wh_raw := _wh_main; END IF;
  IF _wh_fg IS NULL THEN _wh_fg := _wh_main; END IF;

  -- 2. DEPARTMENTS (Carpentry, Upholstery, Finishing & Polishing, Assembly, Quality Check, Packing & Dispatch)
  DELETE FROM public.departments WHERE company_id = _company;

  INSERT INTO public.departments (company_id, name, code)
  VALUES (_company, 'Carpentry', 'DEPT-CARP') RETURNING id INTO _dept_carp;

  INSERT INTO public.departments (company_id, name, code)
  VALUES (_company, 'Upholstery', 'DEPT-UPH') RETURNING id INTO _dept_uph;

  INSERT INTO public.departments (company_id, name, code)
  VALUES (_company, 'Finishing & Polishing', 'DEPT-FIN') RETURNING id INTO _dept_fin;

  INSERT INTO public.departments (company_id, name, code)
  VALUES (_company, 'Assembly', 'DEPT-ASSM') RETURNING id INTO _dept_assm;

  INSERT INTO public.departments (company_id, name, code)
  VALUES (_company, 'Quality Check', 'DEPT-QC') RETURNING id INTO _dept_qc;

  INSERT INTO public.departments (company_id, name, code)
  VALUES (_company, 'Packing & Dispatch', 'DEPT-PACK') RETURNING id INTO _dept_pack;

  -- 3. MACHINES
  DELETE FROM public.machines WHERE company_id = _company;

  INSERT INTO public.machines (company_id, name, code, type, status, utilization) VALUES
  (_company, 'CNC Wood Router', 'MC-CNC-01', 'Wood Router', 'operational', 88.5),
  (_company, 'Panel Cutting Saw', 'MC-SAW-01', 'Panel Saw', 'operational', 92.0),
  (_company, 'Edge Banding Machine', 'MC-EDGE-01', 'Edge Bander', 'operational', 75.4),
  (_company, 'Spray Paint Booth', 'MC-SPRY-01', 'Finishing Booth', 'operational', 81.0),
  (_company, 'Sanding Machine', 'MC-SND-01', 'Sander', 'operational', 79.2),
  (_company, 'Upholstery Stitching Machine', 'MC-STCH-01', 'Stitching Machine', 'operational', 84.0);

  -- 4. PRODUCTS
  DELETE FROM public.products WHERE company_id = _company;

  INSERT INTO public.products (company_id, sku, name, description, unit, unit_cost, unit_price, reorder_level, status)
  VALUES (_company, 'FRN-DT-001', 'Dining Table — Teak', 'Solid Teak Wood 6-seater dining table with natural varnish finish', 'pcs', 15000, 25000, 10, 'active')
  RETURNING id INTO _prod_dt;

  INSERT INTO public.products (company_id, sku, name, description, unit, unit_cost, unit_price, reorder_level, status)
  VALUES (_company, 'FRN-OC-002', 'Executive Office Chair', 'Ergonomic cushioned office chair with teak frame and leatherette upholstery', 'pcs', 7000, 12000, 15, 'active')
  RETURNING id INTO _prod_oc;

  INSERT INTO public.products (company_id, sku, name, description, unit, unit_cost, unit_price, reorder_level, status)
  VALUES (_company, 'FRN-SF-003', '3-Seater Fabric Sofa', 'Premium high-density foam 3-seater sofa with stain-resistant upholstery fabric', 'pcs', 21000, 35000, 8, 'active')
  RETURNING id INTO _prod_sf;

  INSERT INTO public.products (company_id, sku, name, description, unit, unit_cost, unit_price, reorder_level, status)
  VALUES (_company, 'FRN-WD-004', '4-Door Wardrobe', 'Spacious 4-door plywood wardrobe with teak veneer and soft-close hinges', 'pcs', 27000, 45000, 5, 'active')
  RETURNING id INTO _prod_wd;

  INSERT INTO public.products (company_id, sku, name, description, unit, unit_cost, unit_price, reorder_level, status)
  VALUES (_company, 'FRN-BD-005', 'Queen Size Bed Frame', 'Sturdy teak wood queen size bed frame with upholstered headboard', 'pcs', 22000, 38000, 6, 'active')
  RETURNING id INTO _prod_bd;

  INSERT INTO public.products (company_id, sku, name, description, unit, unit_cost, unit_price, reorder_level, status)
  VALUES (_company, 'FRN-ST-006', 'Study Table with Drawer', 'Compact study desk with soft-slide drawers and cable management', 'pcs', 8500, 15000, 12, 'active')
  RETURNING id INTO _prod_st;

  -- 5. MATERIALS
  DELETE FROM public.materials WHERE company_id = _company;

  INSERT INTO public.materials (company_id, name, unit, unit_cost, description)
  VALUES (_company, 'Teak Wood', 'cubic feet', 1200, 'Grade A Malabar Teak Wood timber')
  RETURNING id INTO _mat_teak;

  INSERT INTO public.materials (company_id, name, unit, unit_cost, description)
  VALUES (_company, 'Plywood Sheet', 'pcs', 450, '18mm Commercial Hardwood Plywood 8x4 ft')
  RETURNING id INTO _mat_ply;

  INSERT INTO public.materials (company_id, name, unit, unit_cost, description)
  VALUES (_company, 'Upholstery Fabric', 'meters', 350, 'High durability velvet upholstery fabric')
  RETURNING id INTO _mat_fab;

  INSERT INTO public.materials (company_id, name, unit, unit_cost, description)
  VALUES (_company, 'High-Density Foam', 'sq ft', 180, '40-density cushion foam for seating')
  RETURNING id INTO _mat_foam;

  INSERT INTO public.materials (company_id, name, unit, unit_cost, description)
  VALUES (_company, 'Hinges', 'pcs', 25, '3D adjustable soft-close cabinet hinges')
  RETURNING id INTO _mat_hng;

  INSERT INTO public.materials (company_id, name, unit, unit_cost, description)
  VALUES (_company, 'Wood Screws', 'box', 150, 'Zinc-plated counter-sunk wood screws 500/box')
  RETURNING id INTO _mat_scrw;

  INSERT INTO public.materials (company_id, name, unit, unit_cost, description)
  VALUES (_company, 'Polish/Varnish', 'liters', 500, 'Clear polyurethane wood polish & varnish')
  RETURNING id INTO _mat_pol;

  INSERT INTO public.materials (company_id, name, unit, unit_cost, description)
  VALUES (_company, 'Drawer Slides', 'pairs', 220, 'Full extension ball-bearing drawer slides 18 inch')
  RETURNING id INTO _mat_sld;

  INSERT INTO public.materials (company_id, name, unit, unit_cost, description)
  VALUES (_company, 'Fevicol/Wood Adhesive', 'liters', 280, 'High strength synthetic resin wood adhesive')
  RETURNING id INTO _mat_adh;

  -- 6. CUSTOMERS
  DELETE FROM public.customers WHERE company_id = _company;

  INSERT INTO public.customers (company_id, name, contact_email, contact_phone, segment, status)
  VALUES (_company, 'Urban Living Furniture Retail', 'procurement@urbanliving.com', '+91 98765 43210', 'Bulk Furniture Retail', 'active')
  RETURNING id INTO _cust_urban;

  INSERT INTO public.customers (company_id, name, contact_email, contact_phone, segment, status)
  VALUES (_company, 'Home Decor Interiors Pvt Ltd', 'orders@homedecorinteriors.com', '+91 98765 43211', 'Interior Design Firm', 'active')
  RETURNING id INTO _cust_decor;

  INSERT INTO public.customers (company_id, name, contact_email, contact_phone, segment, status)
  VALUES (_company, 'Ananya Sharma (Individual Customer)', 'ananya.sharma@gmail.com', '+91 98765 43212', 'Individual Customer', 'active')
  RETURNING id INTO _cust_indiv;

  -- 7. SUPPLIER
  DELETE FROM public.suppliers WHERE company_id = _company;

  INSERT INTO public.suppliers (company_id, name, category, contact_email, contact_phone, rating, status)
  VALUES (_company, 'Kerala Teak Suppliers Pvt Ltd', 'Hardwood & Timber', 'sales@keralateak.com', '+91 484 2345678', 4.9, 'active')
  RETURNING id INTO _sup_kerala;

  -- 8. INVENTORY STOCK (Teak Wood set LOW on purpose so Procurement branch triggers)
  DELETE FROM public.inventory WHERE company_id = _company;

  -- Material Inventory:
  -- Teak Wood: 5 cubic feet (LOW STOCK on purpose! Order of 20 Dining Tables needs 40 cu ft)
  INSERT INTO public.inventory (company_id, warehouse_id, material_id, quantity)
  VALUES (_company, _wh_raw, _mat_teak, 5);

  -- Other materials stocked sufficiently
  INSERT INTO public.inventory (company_id, warehouse_id, material_id, quantity) VALUES
  (_company, _wh_raw, _mat_ply, 200),
  (_company, _wh_raw, _mat_fab, 350),
  (_company, _wh_raw, _mat_foam, 800),
  (_company, _wh_raw, _mat_hng, 1500),
  (_company, _wh_raw, _mat_scrw, 100),
  (_company, _wh_raw, _mat_pol, 150),
  (_company, _wh_raw, _mat_sld, 300),
  (_company, _wh_raw, _mat_adh, 120);

  -- Product Inventory:
  INSERT INTO public.inventory (company_id, warehouse_id, product_id, quantity) VALUES
  (_company, _wh_fg, _prod_dt, 2),
  (_company, _wh_fg, _prod_oc, 12),
  (_company, _wh_fg, _prod_sf, 6);

END $$;
