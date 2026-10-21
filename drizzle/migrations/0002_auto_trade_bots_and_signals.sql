CREATE TABLE public.bots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'stopped' CHECK (status IN ('running','paused','stopped')),
  default_lot numeric(10,2) NOT NULL DEFAULT 0.01 CHECK (default_lot > 0 AND default_lot <= 100),
  max_lot numeric(10,2) NOT NULL DEFAULT 0.10 CHECK (max_lot > 0 AND max_lot <= 100),
  max_open_trades integer NOT NULL DEFAULT 3 CHECK (max_open_trades BETWEEN 1 AND 50),
  demo_only boolean NOT NULL DEFAULT true,
  bridge_token_hash text,
  last_heartbeat timestamptz,
  terminal_info jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bots TO authenticated;
GRANT ALL ON public.bots TO service_role;
ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bots own read" ON public.bots FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "bots own insert" ON public.bots FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND bridge_token_hash IS NULL AND last_heartbeat IS NULL AND EXISTS (SELECT 1 FROM public.trading_accounts a WHERE a.id = account_id AND a.user_id = auth.uid()));
CREATE POLICY "bots own update" ON public.bots FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "bots own delete" ON public.bots FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Users may not set bridge/heartbeat fields from the browser; only server code (service role) can.
CREATE OR REPLACE FUNCTION public.bots_protect_fields() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'authenticated' OR auth.role() = 'authenticated' THEN
    NEW.bridge_token_hash := OLD.bridge_token_hash;
    NEW.last_heartbeat := OLD.last_heartbeat;
    NEW.terminal_info := OLD.terminal_info;
    NEW.account_id := OLD.account_id;
    NEW.user_id := OLD.user_id;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER bots_protect BEFORE UPDATE ON public.bots FOR EACH ROW EXECUTE FUNCTION public.bots_protect_fields();

CREATE TABLE public.trade_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  bot_id uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  symbol text NOT NULL CHECK (char_length(symbol) BETWEEN 2 AND 20),
  side text NOT NULL CHECK (side IN ('buy','sell')),
  volume numeric(10,2) NOT NULL CHECK (volume > 0 AND volume <= 100),
  stop_loss numeric(18,5),
  take_profit numeric(18,5),
  comment text CHECK (comment IS NULL OR char_length(comment) <= 60),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','filled','rejected','closed','cancelled')),
  ticket text,
  fill_price numeric(18,5),
  close_price numeric(18,5),
  profit numeric(18,2),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  filled_at timestamptz,
  closed_at timestamptz
);
CREATE INDEX trade_signals_bot_status ON public.trade_signals(bot_id, status);
GRANT SELECT, INSERT, UPDATE ON public.trade_signals TO authenticated;
GRANT ALL ON public.trade_signals TO service_role;
ALTER TABLE public.trade_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signals own read" ON public.trade_signals FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_mentor_of(auth.uid(), user_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "signals own insert" ON public.trade_signals FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'queued' AND ticket IS NULL AND EXISTS (SELECT 1 FROM public.bots b WHERE b.id = bot_id AND b.user_id = auth.uid()));
-- Users can only cancel their own still-queued signals.
CREATE POLICY "signals own cancel" ON public.trade_signals FOR UPDATE TO authenticated USING (user_id = auth.uid() AND status = 'queued') WITH CHECK (user_id = auth.uid() AND status = 'cancelled');