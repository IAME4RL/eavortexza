import { describe, expect, it } from "vitest";
import { assistantBotContext, type AssistantBot } from "@/lib/assistantContext";

const bot: AssistantBot = {
  status: "stopped", strategy: "auto", trading_mode: "demo", risk_per_trade_pct: 1,
  max_daily_loss: 50, profit_goal: 100, goal_profit: 12,
  last_decision: "No setup", last_heartbeat: "2026-11-07T15:00:00Z",
  terminal_info: { balance: 600, equity: 610, currency: "ZAR", open: 2, password: "never-send", token: "private-connector", positions: [{ ticket: "private-ticket" }] },
};

describe("read-only bot AI context", () => {
  it("excludes terminal credentials and raw positions from model context", () => {
    const context = assistantBotContext(bot);
    expect(context).not.toHaveProperty("terminal_info");
    expect(JSON.stringify(context)).not.toContain("never-send");
    expect(JSON.stringify(context)).not.toContain("private-connector");
    expect(JSON.stringify(context)).not.toContain("private-ticket");
    expect(context.balance).toBe(600);
  });
  it("reports actual stopped state and heartbeat age without implying execution", () => {
    const context = assistantBotContext(bot, Date.parse("2026-11-07T15:03:00Z"));
    expect(context.status).toBe("stopped");
    expect(context.heartbeatAgeSeconds).toBe(180);
    expect(context.openPositions).toBe(2);
  });
});