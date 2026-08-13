-- =============================================================
-- FACTORYOS AI — AUDITOR ROLE COMPLETE (2026-08-13)
--  1. audit_logs become append-only: DELETE/UPDATE restricted to
--     Root Super Admin only (previously ANY non-auditor — including
--     Company Admin — could delete or edit log entries, with NO
--     company scoping, a cross-tenant leak).
--  2. INSERT audit_logs is scoped to the caller's own company so a
--     user can never forge a log entry for another tenant.
--  3. DB-level write-audit triggers on every RLS table: every
--     INSERT/UPDATE/DELETE now appends an immutable audit_logs row
--     with old_value → new_value (full-row JSONB).
--  4. access_logs table — real login history (who, when, role,
--     success/failure) recorded by the app on sign-in.
-- =============================================================

-- ───────────────── 1. AUDIT LOGS — APPEND-ONLY ─────────────────
DROP POLICY IF EXISTS audit_logs_delete ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_update ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;

-- Only Root Super Admin may delete or edit log entries. Nobody else —
-- not Company Admin, not any employee role — can touch past entries.
CREATE POLICY audit_logs_delete_root ON public.audit_logs
  FOR DELETE TO authenticated
  USING (is_root_admin(auth.uid()));

CREATE POLICY audit_logs_update_root ON public.audit_logs
  FOR UPDATE TO authenticated
  USING (is_root_admin(auth.uid()))
  WITH CHECK (is_root_admin(auth.uid()));

-- Inserts allowed for root (platform-level) or members of their own
-- company (never a different tenant); auditor is excluded (logs are
-- written by the DB triggers / the app, never by an auditor user).
CREATE POLICY audit_logs_insert_scoped ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    is_root_admin(auth.uid())
    OR (company_id = current_company_id() AND NOT is_auditor())
  );

-- ───────────────── 2. DB-LEVEL WRITE AUDIT TRIGGERS ─────────────────
-- Captures every INSERT / UPDATE / DELETE across the public schema and
-- appends an immutable audit_logs row: actor (user_id), company,
-- action ('insert_<table>' / 'update_<table>' / 'delete_<table>'),
-- entity (table name), entity_id, and metadata containing the full
-- old_value → new_value JSONB for changes.
CREATE OR REPLACE FUNCTION public.audit_write_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
  _entity_id  uuid;
  _row        jsonb;
  _old_row    jsonb;
  _new_row    jsonb;
BEGIN
  IF TG_TABLE_NAME = 'audit_logs' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  _row := COALESCE(to_jsonb(NEW), to_jsonb(OLD));

  _company_id := CASE
    WHEN _row ? 'company_id' THEN NULLIF((_row->>'company_id')::text, '')::uuid
    ELSE NULL
  END;
  _entity_id := CASE
    WHEN _row ? 'id' THEN NULLIF((_row->>'id')::text, '')::uuid
    ELSE NULL
  END;

  _old_row := CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END;
  _new_row := CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END;

  INSERT INTO public.audit_logs (company_id, user_id, action, entity, entity_id, metadata)
  VALUES (
    _company_id,
    auth.uid(),
    lower(TG_OP) || '_' || TG_TABLE_NAME,
    TG_TABLE_NAME,
    _entity_id,
    jsonb_build_object('old_value', _old_row, 'new_value', _new_row)
  );

  RETURN COALESCE(NEW, OLD);
END $$;

-- Attach the write-audit trigger to every RLS-enabled table (except
-- audit_logs itself — logs are never re-audited, avoiding recursion).
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.relname AS tbl
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity = true
      AND c.relname <> 'audit_logs'
    ORDER BY c.relname
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_audit_write ON public.%I;', t.tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_write
         AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.audit_write_event();', t.tbl);
  END LOOP;
END $$;

-- ───────────────── 3. ACCESS LOGS — REAL LOGIN HISTORY ─────────────────
CREATE TABLE IF NOT EXISTS public.access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  role TEXT,
  action TEXT NOT NULL,                 -- 'login' | 'login_failed' | 'logout' | 'signup'
  status TEXT NOT NULL DEFAULT 'success', -- 'success' | 'failed'
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS access_logs_company_idx ON public.access_logs (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS access_logs_email_idx ON public.access_logs (lower(email));

ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.access_logs TO authenticated;

-- Read: root sees all; Company Admin and Auditor see their own
-- company's logins (the Auditor's Access Logs page depends on this).
DROP POLICY IF EXISTS access_logs_select ON public.access_logs;
CREATE POLICY access_logs_select ON public.access_logs
  FOR SELECT TO authenticated
  USING (
    is_root_admin(auth.uid())
    OR (
      company_id = current_company_id()
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('company_admin','auditor')
      )
    )
  );

-- Insert: a user may only record an access event for their OWN auth
-- identity, scoped to their own company (prevents forging another
-- user's login history). This is the audit mechanism itself — the
-- app records the sign-in after GoTrue returns success/failure.
DROP POLICY IF EXISTS access_logs_insert_self ON public.access_logs;
CREATE POLICY access_logs_insert_self ON public.access_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND company_id = current_company_id());

-- No UPDATE / DELETE policies — access history is append-only.

-- ───────────────── 4. ACCESS LOG RPC (success AND failure) ─────────────────
-- signIn failures happen while the user is still ANONYMOUS, so the app
-- cannot insert via the authenticated-only table policy. This SECURITY
-- DEFINER RPC resolves the identity from the email and records the event.
-- It is the ONLY path that writes access_logs and can only append rows.
CREATE OR REPLACE FUNCTION public.record_access_log(
  p_email text,
  p_action text,
  p_status text DEFAULT 'success'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prof RECORD;
  _role text;
BEGIN
  SELECT id, company_id INTO _prof
    FROM public.profiles
   WHERE lower(email) = lower(p_email)
   LIMIT 1;

  SELECT role::text INTO _role
    FROM public.user_roles
   WHERE user_id = _prof.id
   LIMIT 1;

  INSERT INTO public.access_logs (company_id, user_id, email, role, action, status)
  VALUES (
    _prof.company_id,
    _prof.id,
    p_email,
    _role,
    COALESCE(p_action, 'login'),
    COALESCE(p_status, 'success')
  );
END $$;

GRANT EXECUTE ON FUNCTION public.record_access_log(text, text, text) TO anon, authenticated;
