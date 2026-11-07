import type { Decision } from "@/lib/strategy";

export interface CloudConfig {
  provider: "api2trade";
  accountId: string;
  accountType: "demo" | "live";
  instrument: string;
  brokerSymbol: string;
  timeframe: string;
  connectedAt?: string;
  /** Optional per-trade money controls in USD (stored in terminal_info.cloud, no database change needed). */
  riskPerTrade?: number;
  targetPerTrade?: number;
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
  /** Optional per-trade money controls (USD). Both set = lot and take profit are sized from them. */
  riskAmount?: number | null;
  targetAmount?: number | null;
  accountCurrency?: string | null;
  instrument?: string;
}

export type CyclePlan =
  | { kind: "hold"; reason: string }
  | { kind: "stop"; reason: string }
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
    ...(isPos(c["riskPerTrade"]) && isPos(c["targetPerTrade"]) ? { riskPerTrade: c["riskPerTrade"], targetPerTrade: c["targetPerTrade"] } : {}),
  };
}

const isPos = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

/** Returns terminal_info with the per-trade loss/win amounts set (both) or cleared (null). */
export function withPerTrade(terminalInfo: unknown, risk: number | null, target: number | null): Record<string, unknown> {
  const ti = { ...((terminalInfo && typeof terminalInfo === "object" ? terminalInfo : {}) as Record<string, unknown>) };
  const cloud = { ...((ti["cloud"] && typeof ti["cloud"] === "object" ? ti["cloud"] : {}) as Record<string, unknown>) };
  delete cloud["riskPerTrade"];
  delete cloud["targetPerTrade"];
  if (risk !== null && target !== null) { cloud["riskPerTrade"] = risk; cloud["targetPerTrade"] = target; }
  ti["cloud"] = cloud;
  return ti;
}

/** "No daily loss limit" is saved as this large value, so no database change is needed. */
export const NO_DAILY_LIMIT = 1_000_000;
export const dailyLimitOff = (v: number) => !(v > 0) || v >= NO_DAILY_LIMIT;

export function dailyLossBreached(closedTodayPL: number, floatingPL: number, maxDailyLoss: number): boolean {
  if (dailyLimitOff(maxDailyLoss)) return false; // the client chose no daily limit
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

/**
 * USD profit/loss per 1.00 move in price for one standard lot, for instruments whose contract size is
 * the same at virtually every broker (gold = 100 oz, FX = 100,000 units). Assumes a USD account.
 * Returns null for anything else, so the bot never guesses a lot size.
 */
export function usdPerPriceUnitPerLot(instrument: string, price: number): number | null {
  const k = instrument.toUpperCase();
  if (k === "XAUUSD") return 100;
  if (k === "EURUSD" || k === "GBPUSD" || k === "AUDUSD") return 100_000;
  if ((k === "USDJPY" || k === "USDCHF" || k === "USDCAD") && price > 0) return 100_000 / price;
  return null;
}

/**
 * Lot size so that a stop-out loses at most `risk` dollars (rounded DOWN to the lot step), plus the take-profit
 * distance that would win about `target` dollars at that lot. Never rounds up, so the real loss never exceeds `risk`.
 */
export function sizeFromMoney(o: { risk: number; target: number; slDist: number; perUnit: number; maxLot: number; minLot?: number; step?: number }):
  { ok: true; volume: number; tpDist: number; riskAtStop: number } | { ok: false; reason: string } {
  const minLot = o.minLot ?? 0.01;
  const step = o.step ?? 0.01;
  const perLotRisk = o.slDist * o.perUnit;
  if (!(perLotRisk > 0) || !(o.risk > 0) || !(o.target > 0)) return { ok: false, reason: "Cannot size the trade from the loss/win amounts" };
  let volume = Math.floor(o.risk / perLotRisk / step + 1e-9) * step;
  volume = Number(Math.min(volume, o.maxLot).toFixed(2));
  if (volume < minLot) {
    return { ok: false, reason: `Smallest lot (${minLot}) would risk $${(minLot * perLotRisk).toFixed(2)} at this stop, more than your $${o.risk} limit. Trade skipped.` };
  }
  return { ok: true, volume, tpDist: o.target / (volume * o.perUnit), riskAtStop: volume * perLotRisk };
}

export function planCloudCycle(input: CycleInput): CyclePlan {
  if (input.status !== "running") return { kind: "hold", reason: "Bot is stopped" };
  if (!input.connected) return { kind: "hold", reason: "Cloud broker disconnected" };

  if (dailyLossBreached(input.closedTodayPL, input.floatingPL, input.maxDailyLoss)) {
    return { kind: "stop", reason: "Daily loss limit reached" };
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

  let volume = Math.min(Math.max(input.defaultLot, 0.01), input.maxLot);
  let tp = levels.tp;

  // Per-trade money controls: size the lot from "willing to lose" and place the take profit at "wants to win".
  if (input.riskAmount && input.targetAmount && input.riskAmount > 0 && input.targetAmount > 0) {
    if (!input.accountCurrency || input.accountCurrency.toUpperCase() !== "USD") {
      return { kind: "hold", reason: "Per-trade loss/win amounts need a USD account (could not confirm USD)" };
    }
    const perUnit = usdPerPriceUnitPerLot(input.instrument ?? "", levels.entry);
    if (perUnit === null) {
      return { kind: "hold", reason: `Per-trade loss/win amounts are not supported for ${input.instrument || input.brokerSymbol} yet` };
    }
    const sized = sizeFromMoney({ risk: input.riskAmount, target: input.targetAmount, slDist: Math.abs(levels.entry - levels.sl), perUnit, maxLot: input.maxLot });
    if (!sized.ok) return { kind: "hold", reason: sized.reason };
    const mid = (input.quote.bid + input.quote.ask) / 2;
    if (sized.tpDist > mid * 0.1) return { kind: "hold", reason: "Win amount is too far from price for this lot. Lower the win amount or raise the loss amount." };
    volume = sized.volume;
    tp = Number((tradeIdea.side === "buy" ? levels.entry + sized.tpDist : levels.entry - sized.tpDist).toFixed(input.digits));
  }

  return {
    kind: "trade",
    trade: {
      side: tradeIdea.side,
      volume,
      entry: levels.entry,
      sl: levels.sl,
      tp,
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
  riskAmount?: number | null;
  targetAmount?: number | null;
}): string[] {
  const blockers: string[] = [];

  const r = params.riskAmount ?? 0;
  const t = params.targetAmount ?? 0;
  if ((r > 0) !== (t > 0)) {
    blockers.push("Set both the amount you will lose and the amount you want to win per trade, or leave both empty.");
  } else if (r > 0 && (t / r < 0.25 || t / r > 10)) {
    blockers.push("Win amount should be between 0.25x and 10x the loss amount.");
  }

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
