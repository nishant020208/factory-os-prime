-- =============================================================
-- NOTIFICATIONS: Ensure role-targeted columns exist
-- =============================================================
-- The old notifications table may have existed with just user_id.
-- This migration ensures it has the role-targeted columns needed
-- for the multi-role notification system.

-- Ensure the notifications table exists with the right structure
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  from_user uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  to_role text NOT NULL DEFAULT 'company_admin',
  to_user uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  severity text NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info','warning','success','error')),
  related_entity_type text,
  related_entity_id uuid,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Add missing columns if table already exists (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications' AND table_schema = 'public') THEN
    BEGIN
      ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS from_user uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS to_role text NOT NULL DEFAULT 'company_admin';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS to_user uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS related_entity_type text;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS related_entity_id uuid;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'info';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS body text NOT NULL DEFAULT '';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- Index for fast role-scoped queries
CREATE INDEX IF NOT EXISTS idx_notifications_role_access
  ON public.notifications (company_id, to_role, to_user, is_read, created_at DESC);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate cleanly
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_all" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_mark_read" ON public.notifications;

-- RLS: SELECT — user sees rows targeted to their role or directly to them
-- Cast role::text to compare text to_role with app_role enum
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (
    company_id = (
      SELECT company_id FROM public.user_roles
      WHERE user_id = auth.uid() LIMIT 1
    )
    AND (
      to_user = auth.uid()
      OR to_role = (
        SELECT role::text FROM public.user_roles
        WHERE user_id = auth.uid() LIMIT 1
      )
    )
  );

-- RLS: INSERT — any authenticated user can create notifications (server-triggered)
CREATE POLICY "notifications_insert_all" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- RLS: UPDATE — user can mark their own notifications as read
-- Cast role::text to compare text to_role with app_role enum
CREATE POLICY "notifications_update_mark_read" ON public.notifications
  FOR UPDATE USING (
    company_id = (
      SELECT company_id FROM public.user_roles
      WHERE user_id = auth.uid() LIMIT 1
    )
    AND (
      to_user = auth.uid()
      OR to_role = (
        SELECT role::text FROM public.user_roles
        WHERE user_id = auth.uid() LIMIT 1
      )
    )
  );

-- Seed some demo notifications if none exist
DO $$
DECLARE
  comp_id uuid;
  admin_role text;
BEGIN
  SELECT company_id INTO comp_id FROM public.user_roles LIMIT 1;
  IF comp_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.notifications WHERE company_id = comp_id LIMIT 1) THEN
    -- Get the company_admin role for this company
    SELECT role INTO admin_role FROM public.user_roles
      WHERE company_id = comp_id AND role = 'company_admin' LIMIT 1;
    IF admin_role IS NOT NULL THEN
      INSERT INTO public.notifications (company_id, to_role, title, body, severity, related_entity_type, created_at) VALUES
        (comp_id, 'company_admin', '📦 New Customer Order',
         'A new customer order (SO-N-08-001) has been placed and is pending your approval.',
         'info', 'sales_orders', now() - interval '2 hours'),
        (comp_id, 'company_admin', '✅ Customer Request Approved',
         'Customer "Test Corp" has been approved and their account is now active.',
         'success', 'customer_requests', now() - interval '4 hours'),
        (comp_id, 'production_manager', '📋 New Order to Plan',
         'Customer order SO-N-08-001 has been approved. Create a production order.',
         'info', 'sales_orders', now() - interval '1 hour'),
        (comp_id, 'warehouse_manager', '📦 Inventory Check Required',
         'Material reservation needed for production order PO-N-08-001.',
         'warning', 'production_orders', now() - interval '30 minutes'),
        (comp_id, 'quality_inspector', '🔍 Batch Ready for Inspection',
         'Work order WO-N-08-005 is 100% complete and awaiting inspection.',
         'info', 'work_orders', now() - interval '15 minutes'),
        (comp_id, 'customer_portal', '🚚 Order Shipped',
         'Your order SO-N-08-001 has been dispatched. Track your shipment.',
         'success', 'sales_orders', now() - interval '10 minutes');
    END IF;
  END IF;
END $$;
