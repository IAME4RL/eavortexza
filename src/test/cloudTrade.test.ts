import { describe, expect, it } from "vitest";
import { NO_DAILY_LIMIT, cloudConfigOf, cloudStartBlockers, dailyLossBreached, planCloudCycle, sizeFromMoney, toBrokerLevels, usdPerPriceUnitPerLot, withPerTrade, type CycleInput } from "@/lib/cloudTrade";

const quote = { bid: 2330.1, ask: 2330.4 };
const idea = { entry: 2300, sl: 2290, tp: 2320 }; // feed prices differ from the broker's
const decision = { trade: { strategy: "ema", side: "buy" as const, entry: 2300, sl: 2290, tp: 2320, key: "ema:XAUUSD:H1:1", reason: "pullback" }, explanation: "x" };
const base: CycleInput = {
  status: "running", connected: true, accountType: "demo", mode: "demo", liveConfirmed: false, demoOnly: true,
  defaultLot: 0.02, maxLot: 0.1, maxOpen: 2, maxDailyLoss: 50, openCount: 0, floatingPL: 0, closedTodayPL: 0,
  decision, quote, feedLast: 2329, digits: 2, brokerSymbol: "XAUUSDm",
};

describe("toBrokerLevels", () => {
  it("keeps the strategy's distances but anchors them to the broker's price", () => {
    const r = toBrokerLevels("buy", quote, idea, 2329, 2);
    expect(r).toEqual({ ok: true, entry: 2330.4, sl: 2320.4, tp: 2350.4 });
  });
  it("sells from the bid", () => {
    const r = toBrokerLevels("sell", quote, { entry: 2300, sl: 2310, tp: 2280 }, 2329, 2);
    expect(r).toEqual({ ok: true, entry: 2330.1, sl: 2340.1, tp: 2310.1 });
  });
  it("refuses when the feed and broker prices disagree by more than 2%", () => {
    const r = toBrokerLevels("buy", quote, idea, 2100, 2);
    expect(r.ok).toBe(false);
  });
  it("refuses a stop tighter than 3 spreads or absurdly wide", () => {
    expect(toBrokerLevels("buy", quote, { entry: 2300, sl: 2299.9, tp: 2320 }, 2329, 2).ok).toBe(false);
    expect(toBrokerLevels("buy", quote, { entry: 2300, sl: 2100, tp: 2500 }, 2329, 2).ok).toBe(false);
  });
});

describe("dailyLossBreached", () => {
  it("counts closed plus floating P/L", () => {
    expect(dailyLossBreached(-30, -25, 50)).toBe(true);
    expect(dailyLossBreached(-30, -10, 50)).toBe(false);
    expect(dailyLossBreached(100, -120, 50)).toBe(false);
    expect(dailyLossBreached(-500, -500, NO_DAILY_LIMIT)).toBe(false); // no daily limit
    expect(dailyLossBreached(-500, -500, 0)).toBe(false);
  });
});

describe("planCloudCycle", () => {
  it("places a trade with broker-anchored levels and the capped volume", () => {
    const p = planCloudCycle(base);
    expect(p.kind).toBe("trade");
    if (p.kind === "trade") {
      expect(p.trade.volume).toBe(0.02);
      expect(p.trade.sl).toBeLessThan(quote.ask);
      expect(p.trade.tp).toBeGreaterThan(quote.ask);
      expect(p.trade.key).toBe("ema:XAUUSD:H1:1");
    }
  });
  it("never trades when stopped, disconnected, at max open, or with no idea", () => {
    expect(planCloudCycle({ ...base, status: "stopped" }).kind).toBe("hold");
    expect(planCloudCycle({ ...base, connected: false }).kind).toBe("hold");
    expect(planCloudCycle({ ...base, openCount: 2 }).kind).toBe("hold");
    expect(planCloudCycle({ ...base, decision: { trade: null, reason: "NO TRADE: flat" } }).kind).toBe("hold");
    expect(planCloudCycle({ ...base, decision: null }).kind).toBe("hold");
    expect(planCloudCycle({ ...base, quote: null }).kind).toBe("hold");
  });
  it("stops the bot on the daily loss limit", () => {
    expect(planCloudCycle({ ...base, closedTodayPL: -40, floatingPL: -15 }).kind).toBe("stop");
  });
  it("stops a live account that lacks live-mode confirmation", () => {
    expect(planCloudCycle({ ...base, accountType: "live" }).kind).toBe("stop");
    expect(planCloudCycle({ ...base, accountType: "live", mode: "live", liveConfirmed: true, demoOnly: false }).kind).toBe("trade");
  });
  it("skips (does not trade) when levels cannot be placed safely", () => {
    expect(planCloudCycle({ ...base, feedLast: 1000 }).kind).toBe("hold");
  });
});

describe("cloudStartBlockers", () => {
  const ok = { connected: true, accountType: "demo" as const, mode: "demo" as const, liveConfirmed: false, demoOnly: true, strategy: "auto", defaultLot: 0.01, maxLot: 0.1, maxOpen: 1, riskPct: 1, maxDailyLoss: 20, instrument: "XAUUSD", brokerSymbol: "XAUUSD" };
  it("passes for a valid demo setup", () => expect(cloudStartBlockers(ok)).toEqual([]));
  it("blocks when not connected, live without confirmation, or bad limits", () => {
    expect(cloudStartBlockers({ ...ok, connected: false }).length).toBe(1);
    expect(cloudStartBlockers({ ...ok, accountType: "live" }).length).toBeGreaterThanOrEqual(1);
    expect(cloudStartBlockers({ ...ok, accountType: "live", mode: "live", liveConfirmed: true, demoOnly: false })).toEqual([]);
    expect(cloudStartBlockers({ ...ok, maxDailyLoss: -5, defaultLot: 1 }).length).toBe(2);
    expect(cloudStartBlockers({ ...ok, maxDailyLoss: NO_DAILY_LIMIT })).toEqual([]); // "no daily limit" passes
  });
});

describe("cloudConfigOf", () => {
  it("reads a valid config and rejects junk", () => {
    const cloud = { provider: "api2trade", accountId: "abc-123", accountType: "demo", instrument: "XAUUSD", brokerSymbol: "XAUUSD", timeframe: "H1" };
    expect(cloudConfigOf({ cloud })?.accountId).toBe("abc-123");
    expect(cloudConfigOf(null)).toBeNull();
    expect(cloudConfigOf({ cloud: { ...cloud, provider: "other" } })).toBeNull();
    expect(cloudConfigOf({ cloud: { ...cloud, accountType: "x" } })).toBeNull();
  });
});

describe("per-trade money controls", () => {
  it("sizes gold so a stop-out loses at most the loss amount and the target wins about the win amount", () => {
    // SL distance 10, gold = $100 per 1.00 per lot -> $1000 per lot at the stop. $10 risk -> 0.01 lot.
    const r = sizeFromMoney({ risk: 10, target: 20, slDist: 10, perUnit: 100, maxLot: 1 });
    expect(r).toEqual({ ok: true, volume: 0.01, tpDist: 20, riskAtStop: 10 });
  });
  it("rounds the lot down, never up", () => {
    const r = sizeFromMoney({ risk: 25, target: 50, slDist: 10, perUnit: 100, maxLot: 1 });
    expect(r.ok && r.volume).toBe(0.02);
    expect(r.ok && r.riskAtStop).toBeLessThanOrEqual(25);
  });
  it("skips the trade when the smallest lot would risk more than allowed", () => {
    const r = sizeFromMoney({ risk: 3, target: 6, slDist: 10, perUnit: 100, maxLot: 1 });
    expect(r.ok).toBe(false);
  });
  it("only knows contract sizes it can trust", () => {
    expect(usdPerPriceUnitPerLot("XAUUSD", 2330)).toBe(100);
    expect(usdPerPriceUnitPerLot("EURUSD", 1.1)).toBe(100_000);
    expect(usdPerPriceUnitPerLot("USDJPY", 150)).toBeCloseTo(666.67, 1);
    expect(usdPerPriceUnitPerLot("NAS100", 18000)).toBeNull();
  });
  it("planCloudCycle uses the money amounts for lot and take profit", () => {
    const p = planCloudCycle({ ...base, maxLot: 1, riskAmount: 20, targetAmount: 40, accountCurrency: "USD", instrument: "XAUUSD" });
    expect(p.kind).toBe("trade");
    if (p.kind === "trade") {
      expect(p.trade.volume).toBe(0.02); // $20 / ($1000 per lot at a 10-point stop)
      expect(p.trade.tp).toBeCloseTo(p.trade.entry + 20, 1); // $40 / (0.02 lot * $100) = 20 points
    }
  });
  it("holds when the account is not USD or the instrument is unsupported", () => {
    expect(planCloudCycle({ ...base, riskAmount: 20, targetAmount: 40, accountCurrency: "ZAR", instrument: "XAUUSD" }).kind).toBe("hold");
    expect(planCloudCycle({ ...base, riskAmount: 20, targetAmount: 40, accountCurrency: "USD", instrument: "NAS100" }).kind).toBe("hold");
  });
  it("start blockers require both amounts and a sane win/loss ratio", () => {
    const params = { connected: true, accountType: "demo" as const, mode: "demo" as const, liveConfirmed: false, demoOnly: true, strategy: "auto", defaultLot: 0.01, maxLot: 0.1, maxOpen: 1, riskPct: 1, maxDailyLoss: 50, instrument: "XAUUSD", brokerSymbol: "XAUUSD" };
    expect(cloudStartBlockers({ ...params, riskAmount: 10, targetAmount: null }).length).toBe(1);
    expect(cloudStartBlockers({ ...params, riskAmount: 10, targetAmount: 500 }).length).toBe(1);
    expect(cloudStartBlockers({ ...params, riskAmount: 10, targetAmount: 20 })).toEqual([]);
  });
});

describe("per-trade amounts stored in the cloud config (no database change)", () => {
  const ti = { balance: 100, cloud: { provider: "api2trade", accountId: "a1", accountType: "demo", instrument: "XAUUSD", brokerSymbol: "XAUUSD", timeframe: "H1" } };
  it("round-trips through withPerTrade and cloudConfigOf, keeping the rest of terminal_info", () => {
    const saved = withPerTrade(ti, 10, 20);
    expect(saved["balance"]).toBe(100);
    expect(cloudConfigOf(saved)).toMatchObject({ riskPerTrade: 10, targetPerTrade: 20, accountId: "a1" });
  });
  it("clears the amounts when set to null", () => {
    expect(cloudConfigOf(withPerTrade(withPerTrade(ti, 10, 20), null, null))).not.toHaveProperty("riskPerTrade");
  });
  it("ignores bad or half-set amounts", () => {
    const bad = { ...ti, cloud: { ...ti.cloud, riskPerTrade: 10 } };
    expect(cloudConfigOf(bad)).not.toHaveProperty("riskPerTrade");
    expect(cloudConfigOf({ ...ti, cloud: { ...ti.cloud, riskPerTrade: -1, targetPerTrade: "x" } })).not.toHaveProperty("targetPerTrade");
  });
});
