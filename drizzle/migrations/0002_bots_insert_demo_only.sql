DROP POLICY IF EXISTS "bots own insert" ON public.bots;
CREATE POLICY "bots own insert" ON public.bots FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND bridge_token_hash IS NULL AND last_heartbeat IS NULL
  AND trading_mode = 'demo' AND live_confirmed_at IS NULL AND status <> 'running'
  AND EXISTS (SELECT 1 FROM public.trading_accounts a WHERE a.id = bots.account_id AND a.user_id = auth.uid()));