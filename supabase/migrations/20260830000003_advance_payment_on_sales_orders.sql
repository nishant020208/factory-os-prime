-- Add advance payment tracking columns to sales_orders
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS advance_payment_percent numeric;
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS advance_payment_status text;
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS advance_qr_url text;
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS balance_due numeric;
