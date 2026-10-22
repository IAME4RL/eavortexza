ALTER TABLE public.bots
  ADD COLUMN IF NOT EXISTS trading_mode text NOT NULL DEFAULT 'demo' CHECK (trading_mode IN ('demo','live')),
  ADD COLUMN IF NOT EXISTS live_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS strategy text NOT NULL DEFAULT 'auto' CHECK (strategy IN ('auto','ema_trend','breakout','manual')),
  ADD COLUMN IF NOT EXISTS risk_per_trade_pct numeric NOT NULL DEFAULT 1 CHECK (risk_per_trade_pct > 0 AND risk_per_trade_pct <= 5),
  ADD COLUMN IF NOT EXISTS max_daily_loss numeric NOT NULL DEFAULT 50 CHECK (max_daily_loss > 0),
  ADD COLUMN IF NOT EXISTS stop_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS stop_ack_at timestamptz,
  ADD COLUMN IF NOT EXISTS emergency_close_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS emergency_close_ack_at timestamptz,
  ADD COLUMN IF NOT EXISTS emergency_close_result text,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS last_decision text;

ALTER TABLE public.trade_signals
  ADD COLUMN IF NOT EXISTS strategy text,
  ADD COLUMN IF NOT EXISTS signal_key text;
CREATE UNIQUE INDEX IF NOT EXISTS trade_signals_bot_signal_key ON public.trade_signals(bot_id, signal_key) WHERE signal_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.bots_protect_fields()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'authenticated' OR auth.role() = 'authenticated' THEN
    NEW.bridge_token_hash := OLD.bridge_token_hash;
    NEW.last_heartbeat := OLD.last_heartbeat;
    NEW.terminal_info := OLD.terminal_info;
    NEW.account_id := OLD.account_id;
    NEW.user_id := OLD.user_id;
    NEW.trading_mode := OLD.trading_mode;
    NEW.live_confirmed_at := OLD.live_confirmed_at;
    NEW.stop_requested_at := OLD.stop_requested_at;
    NEW.stop_ack_at := OLD.stop_ack_at;
    NEW.emergency_close_requested_at := OLD.emergency_close_requested_at;
    NEW.emergency_close_ack_at := OLD.emergency_close_ack_at;
    NEW.emergency_close_result := OLD.emergency_close_result;
    NEW.last_error := OLD.last_error;
    NEW.last_decision := OLD.last_decision;
    -- START is only possible through the verified server action.
    IF NEW.status = 'running' AND OLD.status <> 'running' THEN NEW.status := OLD.status; END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $function$;