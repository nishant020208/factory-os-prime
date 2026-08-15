-- production_planning previously only referenced customer_orders (seeded
-- portal table). The live customer flow runs through sales_orders, so add a
-- nullable FK so Production Manager planning rows link the real order.
ALTER TABLE public.production_planning
  ADD COLUMN IF NOT EXISTS sales_order_id uuid REFERENCES public.sales_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS production_planning_sales_order_idx
  ON public.production_planning (sales_order_id);
