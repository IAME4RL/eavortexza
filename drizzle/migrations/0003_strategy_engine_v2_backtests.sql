ALTER TABLE public.bots DROP CONSTRAINT bots_strategy_check;
ALTER TABLE public.bots ADD CONSTRAINT bots_strategy_check CHECK (strategy = ANY (ARRAY['auto','manual','ema_trend','breakout','bb_reversion','rsi_divergence','macd_cross','stoch_pullback','engulfing','pin_bar','inside_bar','liquidity_sweep','fvg','bos','choch','double_pattern','ichimoku']));

CREATE TABLE public.backtest_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  symbol text NOT NULL,
  timeframe text NOT NULL,
  strategy text NOT NULL,
  bar_count integer NOT NULL,
  first_bar timestamptz,
  last_bar timestamptz,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.backtest_runs TO authenticated;
GRANT ALL ON public.backtest_runs TO service_role;
ALTER TABLE public.backtest_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own backtests read" ON public.backtest_runs FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own backtests insert" ON public.backtest_runs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own backtests delete" ON public.backtest_runs FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX backtest_runs_user_idx ON public.backtest_runs(user_id, created_at DESC);