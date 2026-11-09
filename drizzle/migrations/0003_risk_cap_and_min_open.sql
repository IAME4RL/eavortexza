-- Raise the risk-per-trade cap from 5% to 50% (it is also the drawdown at which the bot closes its own trades),
-- and require room for 2 trades per signal (max_open_trades >= 2).

-- Drop any earlier CHECK constraints on these two columns, whatever they were named.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.bots'::regclass AND contype = 'c'
      AND (pg_get_constraintdef(oid) ILIKE '%risk_per_trade_pct%' OR pg_get_constraintdef(oid) ILIKE '%max_open_trades%')
  LOOP
    EXECUTE format('ALTER TABLE public.bots DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

-- Existing bots that allowed fewer than 2 open trades could never open a 2-trade signal; raise them to 2.
UPDATE public.bots SET max_open_trades = 2 WHERE max_open_trades < 2;
ALTER TABLE public.bots ALTER COLUMN max_open_trades SET DEFAULT 2;

ALTER TABLE public.bots ADD CONSTRAINT bots_risk_per_trade_pct_check CHECK (risk_per_trade_pct > 0 AND risk_per_trade_pct <= 50);
ALTER TABLE public.bots ADD CONSTRAINT bots_max_open_trades_check CHECK (max_open_trades >= 2);
