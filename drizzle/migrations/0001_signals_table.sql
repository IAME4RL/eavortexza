CREATE TABLE public.signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  symbol text NOT NULL,
  timeframe text NOT NULL,
  strategy text NOT NULL,
  side text NOT NULL CHECK (side IN ('buy','sell')),
  entry double precision NOT NULL,
  stop_loss double precision NOT NULL,
  take_profit double precision NOT NULL,
  risk_reward double precision NOT NULL,
  reason text NOT NULL,
  explanation text NOT NULL,
  signal_key text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
  data_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.signals TO authenticated;
GRANT ALL ON public.signals TO service_role;
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY signals_own_select ON public.signals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY signals_own_insert ON public.signals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY signals_own_update ON public.signals FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY signals_own_delete ON public.signals FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY signals_admin_read ON public.signals FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE UNIQUE INDEX signals_user_key_uq ON public.signals (user_id, signal_key);