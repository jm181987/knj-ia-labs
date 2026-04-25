-- PayPal payments support (one-time + subscriptions)

ALTER TABLE public.credit_packages ADD COLUMN IF NOT EXISTS price_usd numeric;

CREATE TABLE IF NOT EXISTS public.paypal_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('order','subscription')),
  paypal_order_id text,
  paypal_subscription_id text,
  paypal_plan_id text,
  package_id uuid,
  amount_usd numeric NOT NULL,
  credits integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  paypal_response jsonb,
  last_credited_capture_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz
);
CREATE INDEX IF NOT EXISTS paypal_orders_user_idx ON public.paypal_orders(user_id);
CREATE INDEX IF NOT EXISTS paypal_orders_paypal_order_idx ON public.paypal_orders(paypal_order_id);
CREATE INDEX IF NOT EXISTS paypal_orders_paypal_sub_idx ON public.paypal_orders(paypal_subscription_id);

ALTER TABLE public.paypal_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own paypal orders" ON public.paypal_orders;
CREATE POLICY "Users view own paypal orders" ON public.paypal_orders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins view all paypal orders" ON public.paypal_orders;
CREATE POLICY "Admins view all paypal orders" ON public.paypal_orders
  FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage paypal orders" ON public.paypal_orders;
CREATE POLICY "Admins manage paypal orders" ON public.paypal_orders
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

INSERT INTO public.app_settings(key, value) VALUES
  ('paypal_subscription_plan_id', '""'::jsonb),
  ('paypal_subscription_price_usd', '22.50'::jsonb),
  ('paypal_subscription_credits', '500'::jsonb),
  ('paypal_usd_per_credit', '0.05'::jsonb),
  ('paypal_min_usd', '2'::jsonb),
  ('paypal_webhook_id', '""'::jsonb)
ON CONFLICT (key) DO NOTHING;
