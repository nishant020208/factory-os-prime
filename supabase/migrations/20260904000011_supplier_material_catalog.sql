-- =====================================================================
-- FACTORYOS AI — SUPPLIER MATERIAL CATALOG (2026-09-04)
--
--  1. supplier_materials: which raw materials a supplier supplies and at
--     what unit price. This is the buyer's record of the supplier's
--     agreed/offered price and the ONLY source that auto-prices material
--     lines on a Purchase Order (the PO total is never typed).
--
--     The supplier portal account maintains its own rows (matched via
--     suppliers.user_id → auth.uid()); company ops roles may read the
--     catalog company-wide.
--
--  2. materials: supplier portal accounts are granted SELECT on their own
--     company's material master so they can add catalog entries for real
--     materials. Customer portal stays closed (customers order PRODUCTS).
--
--  3. create_purchase_order_with_items(...): a single atomic SECURITY
--     DEFINER RPC that creates the PO (status = 'sent' — sent to the
--     supplier) together with all of its material line rows, computing
--     every line_total and the PO total_amount server-side from the
--     submitted unit prices. No half-created PO is possible.
-- =====================================================================

-- ─────────────── 1. SUPPLIER_MATERIALS TABLE ───────────────
CREATE TABLE IF NOT EXISTS public.supplier_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_materials_unique_supplier_material UNIQUE (supplier_id, material_id)
);

CREATE INDEX IF NOT EXISTS supplier_materials_supplier_idx ON public.supplier_materials (supplier_id);
CREATE INDEX IF NOT EXISTS supplier_materials_material_idx ON public.supplier_materials (material_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_materials TO authenticated;
GRANT ALL ON public.supplier_materials TO service_role;

ALTER TABLE public.supplier_materials ENABLE ROW LEVEL SECURITY;

-- Company ops roles (incl. auditor for read-only review) see the whole catalog.
DROP POLICY IF EXISTS supplier_materials_select_ops ON public.supplier_materials;
CREATE POLICY supplier_materials_select_ops ON public.supplier_materials
  FOR SELECT TO authenticated
  USING (is_root_admin(auth.uid()) OR in_company_ops(company_id));

-- A supplier portal account manages ONLY its own supplier's catalog rows.
DROP POLICY IF EXISTS supplier_materials_select_supplier_own ON public.supplier_materials;
CREATE POLICY supplier_materials_select_supplier_own ON public.supplier_materials
  FOR SELECT TO authenticated
  USING (
    is_supplier_portal()
    AND supplier_id = current_supplier_id()
    AND company_id = current_supplier_company()
  );

DROP POLICY IF EXISTS supplier_materials_write_supplier_own ON public.supplier_materials;
CREATE POLICY supplier_materials_write_supplier_own ON public.supplier_materials
  FOR INSERT TO authenticated
  WITH CHECK (
    is_supplier_portal()
    AND supplier_id = current_supplier_id()
    AND company_id = current_supplier_company()
  );

DROP POLICY IF EXISTS supplier_materials_update_supplier_own ON public.supplier_materials;
CREATE POLICY supplier_materials_update_supplier_own ON public.supplier_materials
  FOR UPDATE TO authenticated
  USING (
    is_supplier_portal()
    AND supplier_id = current_supplier_id()
    AND company_id = current_supplier_company()
  )
  WITH CHECK (
    is_supplier_portal()
    AND supplier_id = current_supplier_id()
    AND company_id = current_supplier_company()
  );

DROP POLICY IF EXISTS supplier_materials_delete_supplier_own ON public.supplier_materials;
CREATE POLICY supplier_materials_delete_supplier_own ON public.supplier_materials
  FOR DELETE TO authenticated
  USING (
    is_supplier_portal()
    AND supplier_id = current_supplier_id()
    AND company_id = current_supplier_company()
  );

DROP TRIGGER IF EXISTS supplier_materials_set_updated_at ON public.supplier_materials;
CREATE TRIGGER supplier_materials_set_updated_at
  BEFORE UPDATE ON public.supplier_materials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Realtime: the supplier portal catalog reflects changes live.
ALTER TABLE public.supplier_materials REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.supplier_materials;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ─────────────── 2. MATERIALS — SUPPLIER PORTAL READS OWN COMPANY ───────────────
-- The existing mat_select_company policy keeps customer_portal and supplier_portal
-- out; this ADDITIONAL permissive policy opens the material master only to a
-- supplier portal account, and only for the company that supplier belongs to.
DROP POLICY IF EXISTS mat_select_supplier_own_company ON public.materials;
CREATE POLICY mat_select_supplier_own_company ON public.materials
  FOR SELECT TO authenticated
  USING (
    is_supplier_portal()
    AND company_id = current_supplier_company()
  );

-- ─────────────── 3. ATOMIC PO + LINE-ITEMS RPC ───────────────
CREATE OR REPLACE FUNCTION public.create_purchase_order_with_items(
  p_company_id uuid,
  p_po_number text,
  p_supplier_id uuid,
  p_expected_date date,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_supplier_company uuid;
  v_item             record;
  v_line_total       numeric;
  v_total            numeric := 0;
  v_po_id            uuid;
  v_po_number        text;
  v_qty              numeric;
  v_price            numeric;
  v_role_ok          boolean;
  v_auditor          boolean;
BEGIN
  -- Only procurement managers and company admins may raise a PO.
  SELECT
    EXISTS (SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role IN ('procurement_manager'::public.app_role, 'company_admin'::public.app_role)
              AND ur.company_id = p_company_id),
    EXISTS (SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'auditor'::public.app_role)
  INTO v_role_ok, v_auditor;

  IF NOT v_role_ok OR v_auditor THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only a Procurement Manager or Company Admin can create a purchase order');
  END IF;

  IF p_supplier_id IS NULL OR p_po_number IS NULL OR trim(p_po_number) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Supplier and PO number are required');
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Add at least one material line to the purchase order');
  END IF;

  -- The supplier must belong to this same company.
  SELECT company_id INTO v_supplier_company
  FROM public.suppliers WHERE id = p_supplier_id;
  IF v_supplier_company IS DISTINCT FROM p_company_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Supplier does not belong to this company');
  END IF;

  v_po_number := nullif(trim(p_po_number), '');

  -- Validate every line BEFORE writing anything (unit price must be supplied by
  -- the caller, which is the supplier's catalog price resolved on the client).
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF (v_item.value->>'material_id') IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Every line needs a material');
    END IF;
    v_qty := coalesce((v_item.value->>'quantity')::numeric, 0);
    v_price := coalesce((v_item.value->>'unit_price')::numeric, -1);
    IF v_qty <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Every line needs a quantity greater than zero');
    END IF;
    IF v_price < 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Every line needs a unit price');
    END IF;
  END LOOP;

  INSERT INTO public.purchase_orders (
    company_id, po_number, supplier_id, status, total_amount, expected_date
  ) VALUES (
    p_company_id, v_po_number, p_supplier_id, 'sent', 0, p_expected_date
  )
  RETURNING id INTO v_po_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item.value->>'quantity')::numeric;
    v_price := (v_item.value->>'unit_price')::numeric;
    v_line_total := round(v_qty * v_price, 2);
    v_total := v_total + v_line_total;
    INSERT INTO public.purchase_order_items (
      company_id, purchase_order_id, material_id, quantity, unit_price, line_total
    ) VALUES (
      p_company_id, v_po_id, (v_item.value->>'material_id')::uuid, v_qty, v_price, v_line_total
    );
  END LOOP;

  UPDATE public.purchase_orders
  SET total_amount = round(v_total, 2)
  WHERE id = v_po_id;

  RETURN jsonb_build_object(
    'ok', true,
    'po_id', v_po_id,
    'po_number', v_po_number,
    'total', round(v_total, 2)
  );
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', false, 'error', 'A purchase order with this number already exists');
WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_purchase_order_with_items(uuid, text, uuid, date, jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_purchase_order_with_items(uuid, text, uuid, date, jsonb) FROM anon;

-- ─────────────── 4. DEMO SEED (existing suppliers/materials only) ───────────────
-- Gives the two live demo suppliers an initial catalog so Purchase Orders can
-- be raised immediately. Nothing here is deleted or recreated.
DO $$
DECLARE
  _company  uuid := '11111111-1111-1111-1111-111111111111';
  _kerala   uuid;
  _banga    uuid;
  _teak     uuid;
  _ply      uuid;
  _polish   uuid;
  _screws   uuid;
BEGIN
  SELECT id INTO _kerala FROM public.suppliers WHERE name = 'Kerala Teak Suppliers Pvt Ltd' AND company_id = _company LIMIT 1;
  SELECT id INTO _banga  FROM public.suppliers WHERE name = 'Bangalore Wood Traders' AND company_id = _company LIMIT 1;
  SELECT id INTO _teak   FROM public.materials WHERE name = 'Teak Wood' AND company_id = _company LIMIT 1;
  SELECT id INTO _ply    FROM public.materials WHERE name = 'Plywood Sheet' AND company_id = _company LIMIT 1;
  SELECT id INTO _polish FROM public.materials WHERE name = 'Polish/Varnish' AND company_id = _company LIMIT 1;
  SELECT id INTO _screws FROM public.materials WHERE name = 'Wood Screws' AND company_id = _company LIMIT 1;

  IF _kerala IS NOT NULL THEN
    IF _teak IS NOT NULL THEN
      INSERT INTO public.supplier_materials (company_id, supplier_id, material_id, unit_price)
      VALUES (_company, _kerala, _teak, 850.00)
      ON CONFLICT (supplier_id, material_id) DO NOTHING;
    END IF;
    IF _ply IS NOT NULL THEN
      INSERT INTO public.supplier_materials (company_id, supplier_id, material_id, unit_price)
      VALUES (_company, _kerala, _ply, 430.00)
      ON CONFLICT (supplier_id, material_id) DO NOTHING;
    END IF;
    IF _polish IS NOT NULL THEN
      INSERT INTO public.supplier_materials (company_id, supplier_id, material_id, unit_price)
      VALUES (_company, _kerala, _polish, 460.00)
      ON CONFLICT (supplier_id, material_id) DO NOTHING;
    END IF;
  END IF;

  IF _banga IS NOT NULL THEN
    IF _teak IS NOT NULL THEN
      INSERT INTO public.supplier_materials (company_id, supplier_id, material_id, unit_price)
      VALUES (_company, _banga, _teak, 880.00)
      ON CONFLICT (supplier_id, material_id) DO NOTHING;
    END IF;
    IF _screws IS NOT NULL THEN
      INSERT INTO public.supplier_materials (company_id, supplier_id, material_id, unit_price)
      VALUES (_company, _banga, _screws, 140.00)
      ON CONFLICT (supplier_id, material_id) DO NOTHING;
    END IF;
  END IF;
END $$;
