-- =============================================================
-- FACTORYOS AI — FIX MISSING FOREIGN KEY CONSTRAINTS
-- PostgREST's `!inner` join syntax requires explicit FK
-- relationships between tables. Without them, queries with
-- `customers!inner(...)` etc. return HTTP 400 errors.
-- =============================================================

-- Fix 1: sales_orders.customer_id → customers(id)
-- Used by: orders.tsx (customers!inner), dashboard.tsx (customers!inner)
ALTER TABLE public.sales_orders
  DROP CONSTRAINT IF EXISTS sales_orders_customer_id_fkey,
  ADD CONSTRAINT sales_orders_customer_id_fkey
    FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;

-- Fix 2: invoices.customer_id → customers(id)
-- Used by: invoices.tsx (customers!inner)
ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_customer_id_fkey,
  ADD CONSTRAINT invoices_customer_id_fkey
    FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;

-- Fix 3: invoices.sales_order_id → sales_orders(id)
ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_sales_order_id_fkey,
  ADD CONSTRAINT invoices_sales_order_id_fkey
    FOREIGN KEY (sales_order_id) REFERENCES public.sales_orders(id) ON DELETE SET NULL;

-- Fix 4: sales_order_items.product_id → products(id)
-- Prevents orphan line items if a product is deleted
ALTER TABLE public.sales_order_items
  DROP CONSTRAINT IF EXISTS sales_order_items_product_id_fkey,
  ADD CONSTRAINT sales_order_items_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;

-- Fix 5: inventory_adjustments.product_id → products(id)
-- Used by: inventory.tsx (products!inner for adjustment history)
ALTER TABLE public.inventory_adjustments
  DROP CONSTRAINT IF EXISTS inventory_adjustments_product_id_fkey,
  ADD CONSTRAINT inventory_adjustments_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;

-- Fix 6: inventory_adjustments.warehouse_id → warehouses(id)
ALTER TABLE public.inventory_adjustments
  DROP CONSTRAINT IF EXISTS inventory_adjustments_warehouse_id_fkey,
  ADD CONSTRAINT inventory_adjustments_warehouse_id_fkey
    FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE RESTRICT;

-- Fix 7: work_orders.machine_id → machines(id)
-- Used by: work-orders.tsx (machines!left)
ALTER TABLE public.work_orders
  DROP CONSTRAINT IF EXISTS work_orders_machine_id_fkey,
  ADD CONSTRAINT work_orders_machine_id_fkey
    FOREIGN KEY (machine_id) REFERENCES public.machines(id) ON DELETE SET NULL;

-- Fix 8: work_orders.operator_id → profiles(id)
-- Used by: work-orders.tsx (profiles!left)
ALTER TABLE public.work_orders
  DROP CONSTRAINT IF EXISTS work_orders_operator_id_fkey,
  ADD CONSTRAINT work_orders_operator_id_fkey
    FOREIGN KEY (operator_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Fix 9: work_orders.production_order_id → production_orders(id)
ALTER TABLE public.work_orders
  DROP CONSTRAINT IF EXISTS work_orders_production_order_id_fkey,
  ADD CONSTRAINT work_orders_production_order_id_fkey
    FOREIGN KEY (production_order_id) REFERENCES public.production_orders(id) ON DELETE SET NULL;

-- Fix 10: quality_inspections.production_order_id → production_orders(id)
ALTER TABLE public.quality_inspections
  DROP CONSTRAINT IF EXISTS quality_inspections_production_order_id_fkey,
  ADD CONSTRAINT quality_inspections_production_order_id_fkey
    FOREIGN KEY (production_order_id) REFERENCES public.production_orders(id) ON DELETE SET NULL;

-- Fix 11: quality_inspections.product_id → products(id)
ALTER TABLE public.quality_inspections
  DROP CONSTRAINT IF EXISTS quality_inspections_product_id_fkey,
  ADD CONSTRAINT quality_inspections_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

-- Fix 12: quality_inspections.inspector_id → profiles(id)
ALTER TABLE public.quality_inspections
  DROP CONSTRAINT IF EXISTS quality_inspections_inspector_id_fkey,
  ADD CONSTRAINT quality_inspections_inspector_id_fkey
    FOREIGN KEY (inspector_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Fix 13: shipments.sales_order_id → sales_orders(id)
ALTER TABLE public.shipments
  DROP CONSTRAINT IF EXISTS shipments_sales_order_id_fkey,
  ADD CONSTRAINT shipments_sales_order_id_fkey
    FOREIGN KEY (sales_order_id) REFERENCES public.sales_orders(id) ON DELETE SET NULL;

-- Fix 14: shipments.customer_id → customers(id)
ALTER TABLE public.shipments
  DROP CONSTRAINT IF EXISTS shipments_customer_id_fkey,
  ADD CONSTRAINT shipments_customer_id_fkey
    FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;

-- Fix 15: payments.invoice_id → invoices(id)
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_invoice_id_fkey,
  ADD CONSTRAINT payments_invoice_id_fkey
    FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;

-- Fix 16: payments.customer_id → customers(id)
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_customer_id_fkey,
  ADD CONSTRAINT payments_customer_id_fkey
    FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;

-- Fix 17: support_tickets.customer_id → customers(id)
ALTER TABLE public.support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_customer_id_fkey,
  ADD CONSTRAINT support_tickets_customer_id_fkey
    FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;

-- Fix 18: employees.plant_id → plants(id)
ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_plant_id_fkey,
  ADD CONSTRAINT employees_plant_id_fkey
    FOREIGN KEY (plant_id) REFERENCES public.plants(id) ON DELETE SET NULL;

-- Fix 19: employees.department_id → departments(id)
ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_department_id_fkey,
  ADD CONSTRAINT employees_department_id_fkey
    FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
