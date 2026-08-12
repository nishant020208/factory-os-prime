-- =====================================================================
-- QR CODE SYSTEM — Token-based public scan
-- Migration: 20260812000000_qr_token_public_scan.sql
-- =====================================================================

-- 1. Add token + extra columns to qr_codes
ALTER TABLE public.qr_codes
  ADD COLUMN IF NOT EXISTS token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'invoice',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS sub_label text,
  ADD COLUMN IF NOT EXISTS used_at timestamptz;

-- 2. Unique index on token for fast lookup
CREATE UNIQUE INDEX IF NOT EXISTS qr_codes_token_idx ON public.qr_codes (token);

-- 3. Backfill token for any existing rows that got gen_random_uuid() already
--    (no-op if already unique)
UPDATE public.qr_codes SET token = gen_random_uuid() WHERE token IS NULL;

-- 4. Public lookup RPC — safe for anon callers
--    Returns only: type, status, label, sub_label, entity_type
--    NEVER returns: company_id, full entity_id, prices, addresses, PII
CREATE OR REPLACE FUNCTION public.public_scan_qr(p_token uuid)
RETURNS TABLE (
  found       boolean,
  qr_type     text,
  qr_status   text,
  entity_type text,
  label       text,
  sub_label   text,
  scanned_at  timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.qr_codes%ROWTYPE;
BEGIN
  SELECT * INTO _row FROM public.qr_codes WHERE token = p_token LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, null::text, null::text, null::text, null::text, null::text, now();
    RETURN;
  END IF;

  -- Mark as used on first scan if active
  IF _row.status = 'active' THEN
    UPDATE public.qr_codes
    SET status = 'active', used_at = COALESCE(used_at, now())
    WHERE token = p_token;
  END IF;

  RETURN QUERY SELECT
    true,
    _row.type,
    _row.status,
    _row.entity_type,
    _row.label,
    _row.sub_label,
    now();
END;
$$;

-- 5. Grant execute to anon so public /scan page can call it
GRANT EXECUTE ON FUNCTION public.public_scan_qr(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.public_scan_qr(uuid) TO authenticated;

-- 6. Ensure anon can SELECT qr_codes only by token (no company filter needed — RPC handles it)
DROP POLICY IF EXISTS qr_anon_lookup ON public.qr_codes;
-- anon cannot SELECT directly; they must go through the SECURITY DEFINER RPC
-- (RLS stays enabled, anon has no SELECT policy — safety by default)

-- 7. Notify done
DO $$ BEGIN RAISE NOTICE 'QR token system migration complete'; END $$;
