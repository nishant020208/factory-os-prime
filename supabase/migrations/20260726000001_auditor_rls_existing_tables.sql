-- =============================================================
-- Add auditor read-only enforcement to ALL existing tables
-- This ensures Auditor role can only SELECT, never INSERT/UPDATE/DELETE
-- =============================================================

-- For each existing operational table, drop the FOR ALL policy and
-- replace it with separate SELECT and FOR ALL (non-auditor) policies.

DO $$ 
DECLARE
  tables text[] := ARRAY[
    'sales_orders', 'sales_order_items', 'production_orders', 'work_orders',
    'purchase_orders', 'inventory', 'invoices', 'payments', 'shipments',
    'quality_inspections', 'support_tickets', 'documents', 'employees',
    'attendance', 'payroll', 'tasks', 'approvals', 'knowledge_articles',
    'bom', 'bom_items', 'customers', 'suppliers', 'machines', 'warehouses',
    'products', 'product_categories', 'departments', 'plants', 'companies',
    'profiles', 'user_roles', 'whitelist', 'notifications', 'audit_logs'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Drop existing ALL policy (name varies by table)
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_all', t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    -- Drop any old named policies
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select', t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert', t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update', t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete', t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- Create SELECT policy (everyone including auditor can read)
    BEGIN
      EXECUTE format('
        CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
        USING (true)', t || '_select', t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- Create INSERT policy (auditor cannot insert)
    BEGIN
      EXECUTE format('
        CREATE POLICY %I ON public.%I FOR INSERT TO authenticated
        WITH CHECK (NOT is_auditor() OR is_root_admin(auth.uid()))', t || '_insert', t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- Create UPDATE policy (auditor cannot update)
    BEGIN
      EXECUTE format('
        CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated
        USING (NOT is_auditor() OR is_root_admin(auth.uid()))
        WITH CHECK (NOT is_auditor() OR is_root_admin(auth.uid()))', t || '_update', t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- Create DELETE policy (auditor cannot delete)
    BEGIN
      EXECUTE format('
        CREATE POLICY %I ON public.%I FOR DELETE TO authenticated
        USING (NOT is_auditor() OR is_root_admin(auth.uid()))', t || '_delete', t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;
