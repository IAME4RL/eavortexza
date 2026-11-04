import type { Decision } from "@/lib/strategy";

export interface CloudConfig {
  provider: "api2trade";
  accountId: string;
  accountType: "demo" | "live";
  instrument: string;
  brokerSymbol: string;
  timeframe: string;
  connectedAt?: string;
}

export interface Quote {
  bid: number;
  ask: number;
}

export interface CycleInput {
  status: string;
  connected: boolean;
  accountType: "demo" | "live";
  mode: "demo" | "live";
  liveConfirmed: boolean;
  demoOnly: boolean;
  defaultLot: number;
  maxLot: number;
  maxOpen: number;
  maxDailyLoss: number;
  openCount: number;
  floatingPL: number;
  closedTodayPL: number;
  decision: Decision | null;
  quote: Quote | null;
  feedLast: number;
  digits: number;
  brokerSymbol: string;
  /** Running profit target (0 = off), profit banked since the goal window opened, and what to do when it is hit. */
  profitGoal: number;
  profitSinceGoal: number;
  goalMode: "stop" | "again";
}

export type CyclePlan =
  | { kind: "hold"; reason: string }
  | { kind: "stop"; reason: string }
  | { kind: "goal"; mode: "stop" | "again"; reason: string }
  | {
      kind: "trade";
      trade: {
        side: "buy" | "sell";
        volume: number;
        entry: number;
        sl: number;
        tp: number;
        key: string;
        strategy: string;
        comment: string;
      };
      reason: string;
    };

export function utcDayStart(timestampMs: number): Date {
  const d = new Date(timestampMs);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function cloudConfigOf(terminalInfo: unknown): CloudConfig | null {
  if (!terminalInfo || typeof terminalInfo !== "object") return null;
  const raw = (terminalInfo as Record<string, unknown>)["cloud"];
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;

  if (c["provider"] !== "api2trade") return null;
  if (typeof c["accountId"] !== "string" || !c["accountId"].trim()) return null;
  if (c["accountType"] !== "demo" && c["accountType"] !== "live") return null;
  if (typeof c["instrument"] !== "string" || typeof c["brokerSymbol"] !== "string") return null;

  return {
    provider: "api2trade",
    accountId: c["accountId"],
    accountType: c["accountType"],
    instrument: c["instrument"],
    brokerSymbol: c["brokerSymbol"],
    timeframe: typeof c["timeframe"] === "string" ? c["timeframe"] : "H1",
    ...(typeof c["connectedAt"] === "string" ? { connectedAt: c["connectedAt"] } : {}),
  };
}

export function dailyLossBreached(closedTodayPL: number, floatingPL: number, maxDailyLoss: number): boolean {
  if (maxDailyLoss <= 0) return false;
  const netPL = closedTodayPL + floatingPL;
  return netPL <= -Math.abs(maxDailyLoss);
}

export function toBrokerLevels(
  side: "buy" | "sell",
  quote: Quote,
  idea: { entry: number; sl: number; tp: number },
  feedLast: number,
  digits: number
): { ok: true; entry: number; sl: number; tp: number } | { ok: false; reason: string } {
  if (!quote.bid || !quote.ask || quote.ask <= quote.bid) {
    return { ok: false, reason: "Invalid quote" };
  }

  const brokerMid = (quote.bid + quote.ask) / 2;
  const diffPct = Math.abs(feedLast - brokerMid) / brokerMid;
  if (diffPct > 0.02) {
    return { ok: false, reason: "Feed and broker prices deviate by more than 2%" };
  }

  const spread = quote.ask - quote.bid;
  const slDist = Math.abs(idea.entry - idea.sl);
  const tpDist = Math.abs(idea.entry - idea.tp);

  if (slDist < spread * 3) {
    return { ok: false, reason: "Stop loss is tighter than 3 spreads" };
  }
  if (slDist > brokerMid * 0.05 || tpDist > brokerMid * 0.1) {
    return { ok: false, reason: "Stop or target distance is excessively wide" };
  }

  const round = (val: number) => Number(val.toFixed(digits));

  if (side === "buy") {
    const entry = quote.ask;
    const sl = round(entry - slDist);
    const tp = round(entry + tpDist);
    return { ok: true, entry: round(entry), sl, tp };
  } else {
    const entry = quote.bid;
    const sl = round(entry + slDist);
    const tp = round(entry - tpDist);
    return { ok: true, entry: round(entry), sl, tp };
  }
}

export function planCloudCycle(input: CycleInput): CyclePlan {
  if (input.status !== "running") return { kind: "hold", reason: "Bot is stopped" };
  if (!input.connected) return { kind: "hold", reason: "Cloud broker disconnected" };

  if (dailyLossBreached(input.closedTodayPL, input.floatingPL, input.maxDailyLoss)) {
    return { kind: "stop", reason: "Daily loss limit reached" };
  }

  // The goal is a running total, not a daily quota: it keeps counting while the bot runs, all day.
  if (input.profitGoal > 0 && input.profitSinceGoal >= input.profitGoal) {
    return {
      kind: "goal",
      mode: input.goalMode,
      reason: `Profit goal reached: ${input.profitSinceGoal.toFixed(2)} of ${input.profitGoal.toFixed(2)}`,
    };
  }

  if (input.accountType === "live" && (!input.liveConfirmed || input.mode !== "live" || input.demoOnly)) {
    return { kind: "stop", reason: "Live trading not explicitly authorized" };
  }

  if (input.openCount >= input.maxOpen) {
    return { kind: "hold", reason: "Maximum open positions reached" };
  }

  if (!input.decision || !input.decision.trade || !input.quote) {
    return { kind: "hold", reason: input.decision && "reason" in input.decision ? input.decision.reason : "No active trade setup" };
  }

  const tradeIdea = input.decision.trade;
  const levels = toBrokerLevels(tradeIdea.side, input.quote, tradeIdea, input.feedLast, input.digits);
  if (!levels.ok) {
    return { kind: "hold", reason: `Levels check failed: ${levels.reason}` };
  }

  const volume = Math.min(Math.max(input.defaultLot, 0.01), input.maxLot);

  return {
    kind: "trade",
    trade: {
      side: tradeIdea.side,
      volume,
      entry: levels.entry,
      sl: levels.sl,
      tp: levels.tp,
      key: tradeIdea.key,
      strategy: tradeIdea.strategy,
      comment: `EA VORTEX ${tradeIdea.strategy}`.slice(0, 31),
    },
    reason: "explanation" in input.decision ? input.decision.explanation : `${tradeIdea.side.toUpperCase()} ${tradeIdea.strategy}`,
  };
}

export function cloudStartBlockers(params: {
  connected: boolean;
  accountType: "demo" | "live";
  mode: "demo" | "live";
  liveConfirmed: boolean;
  demoOnly: boolean;
  strategy: string;
  defaultLot: number;
  maxLot: number;
  maxOpen: number;
  riskPct: number;
  maxDailyLoss: number;
  instrument: string;
  brokerSymbol: string;
}): string[] {
  const blockers: string[] = [];

  if (!params.connected) {
    blockers.push("Cloud MT5 connection is offline.");
  }
  if (params.accountType === "live" && (!params.liveConfirmed || params.mode !== "live" || params.demoOnly)) {
    blockers.push("Live trading requires explicit confirmation.");
  }
  if (params.maxDailyLoss <= 0) {
    blockers.push("Max daily loss must be greater than 0.");
  }
  if (params.defaultLot <= 0 || params.defaultLot > params.maxLot) {
    blockers.push("Default lot must be positive and not exceed max lot.");
  }

  return blockers;
}
