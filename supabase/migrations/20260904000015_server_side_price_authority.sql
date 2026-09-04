-- =====================================================================
-- FACTORYOS AI — purchase orders: server-side price authority
--
-- create_purchase_order_with_items previously trusted the client-supplied
-- unit_price on every line, so a procurement user could forge a price by
-- POSTing arbitrary JSON and the audit trail would record it as
-- legitimate — "auto-calculated, not manually entered" was only a UI
-- convention. This re-derives the authoritative price per line inside the
-- RPC and rejects the whole call when the supplied price matches neither
-- source:
--
--   1. the supplier's current ACTIVE supplier_materials catalog row for
--      that material (the Procurement New-PO dialog prices from here), or
--   2. when no catalog row exists, the latest status='quoted' RFQ response
--      from that supplier for the same material on a still-open RFQ
--      (RFQ and Purchase-Request convert flows price from here, so a quote
--      that predates — or differs from — a catalog row still works as long
--      as no catalog row exists yet).
--
-- Signature is unchanged: no schema change, no client type regeneration.
-- =====================================================================

DROP FUNCTION IF EXISTS public.create_purchase_order_with_items(uuid, text, uuid, text, jsonb);

CREATE FUNCTION public.create_purchase_order_with_items(
  p_company_id uuid,
  p_po_number text,
  p_supplier_id uuid,
  p_expected_date text,
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
  v_expected         date;
  v_qty              numeric;
  v_price            numeric;
  v_material         uuid;
  v_authoritative    numeric;
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

  SELECT company_id INTO v_supplier_company
  FROM public.suppliers WHERE id = p_supplier_id;
  IF v_supplier_company IS DISTINCT FROM p_company_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Supplier does not belong to this company');
  END IF;

  v_expected := NULLIF(nullif(trim(p_expected_date), ''), 'null')::date;

  -- Validate every line BEFORE writing anything. The authoritative unit
  -- price is resolved server-side (catalog first, open quote second) and
  -- the supplied price must equal it exactly — the caller never decides
  -- what a line costs.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_material := (v_item.value->>'material_id')::uuid;
    IF v_material IS NULL THEN
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

    -- (1) The supplier's current active catalog price for this material.
    SELECT unit_price INTO v_authoritative
    FROM public.supplier_materials
    WHERE supplier_id = p_supplier_id
      AND material_id = v_material
      AND company_id = p_company_id
      AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1;

    -- (2) No catalog row yet — fall back to the latest quoted RFQ response
    -- for this supplier + material on an RFQ that is still open.
    IF v_authoritative IS NULL THEN
      SELECT q.unit_price INTO v_authoritative
      FROM public.rfq_responses q
      JOIN public.rfqs r ON r.id = q.rfq_id
      WHERE q.supplier_id = p_supplier_id
        AND q.status = 'quoted'
        AND r.company_id = p_company_id
        AND r.material_id = v_material
        AND r.status = 'sent'
      ORDER BY q.created_at DESC
      LIMIT 1;
    END IF;

    IF v_authoritative IS NULL THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'No active catalog price or open quote on file for this supplier and material — the price cannot be auto-derived'
      );
    END IF;

    IF round(v_price, 2) <> round(v_authoritative, 2) THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'Unit price does not match the supplier catalog or latest open quote (authoritative ' || v_authoritative || '). Prices are auto-calculated, not manually entered'
      );
    END IF;
  END LOOP;

  INSERT INTO public.purchase_orders (
    company_id, po_number, supplier_id, status, total_amount, expected_date
  ) VALUES (
    p_company_id, trim(p_po_number), p_supplier_id, 'sent', 0, v_expected
  )
  RETURNING id INTO v_po_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_material := (v_item.value->>'material_id')::uuid;
    v_qty := (v_item.value->>'quantity')::numeric;
    v_price := (v_item.value->>'unit_price')::numeric;
    v_line_total := round(v_qty * v_price, 2);
    v_total := v_total + v_line_total;
    INSERT INTO public.purchase_order_items (
      company_id, purchase_order_id, material_id, quantity, unit_price, line_total
    ) VALUES (
      p_company_id, v_po_id, v_material, v_qty, v_price, v_line_total
    );
  END LOOP;

  UPDATE public.purchase_orders
  SET total_amount = round(v_total, 2)
  WHERE id = v_po_id;

  RETURN jsonb_build_object(
    'ok', true,
    'po_id', v_po_id,
    'po_number', trim(p_po_number),
    'total', round(v_total, 2)
  );
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', false, 'error', 'A purchase order with this number already exists');
WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_purchase_order_with_items(uuid, text, uuid, text, jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_purchase_order_with_items(uuid, text, uuid, text, jsonb) FROM anon;
