import type { Database } from "@/integrations/supabase/types";

type Bot = Database["public"]["Tables"]["bots"]["Row"];
export type AssistantBot = Pick<Bot, "status" | "strategy" | "trading_mode" | "risk_per_trade_pct" | "max_daily_loss" | "profit_goal" | "goal_profit" | "last_decision" | "last_heartbeat" | "terminal_info">;

/** Explicit allowlist: never send connector credentials or raw terminal data to AI. */
export function assistantBotContext(bot: AssistantBot, now = Date.now()) {
  const terminal = bot.terminal_info;
  const info = terminal && typeof terminal === "object" && !Array.isArray(terminal) ? terminal : {};
  return {
    status: bot.status,
    strategy: bot.strategy,
    tradingMode: bot.trading_mode,
    riskPercent: bot.risk_per_trade_pct,
    dailyLossLimit: bot.max_daily_loss,
    profitGoal: bot.profit_goal,
    goalProfit: bot.goal_profit,
    lastDecision: bot.last_decision?.slice(0, 1200) ?? null,
    lastHeartbeat: bot.last_heartbeat,
    heartbeatAgeSeconds: bot.last_heartbeat ? Math.max(0, Math.round((now - Date.parse(bot.last_heartbeat)) / 1000)) : null,
    balance: typeof info.balance === "number" ? info.balance : null,
    equity: typeof info.equity === "number" ? info.equity : null,
    currency: typeof info.currency === "string" ? info.currency.slice(0, 8) : null,
    openPositions: typeof info.open === "number" ? info.open : null,
  };
}