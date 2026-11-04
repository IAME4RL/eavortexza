ALTER TABLE public.bots
  ADD COLUMN IF NOT EXISTS profit_goal numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profit_goal_mode text NOT NULL DEFAULT 'stop',
  ADD COLUMN IF NOT EXISTS goal_started_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS goal_reached_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS goal_close_requested_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS goal_close_ack_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS goal_profit numeric NOT NULL DEFAULT 0;

ALTER TABLE public.bots DROP CONSTRAINT IF EXISTS bots_profit_goal_mode_check;
ALTER TABLE public.bots ADD CONSTRAINT bots_profit_goal_mode_check CHECK (profit_goal_mode IN ('stop','again'));
ALTER TABLE public.bots DROP CONSTRAINT IF EXISTS bots_profit_goal_check;
ALTER TABLE public.bots ADD CONSTRAINT bots_profit_goal_check CHECK (profit_goal >= 0);