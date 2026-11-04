import { describe, expect, it } from "vitest";
import { cloudConfigOf, cloudStartBlockers, dailyLossBreached, planCloudCycle, toBrokerLevels, type CycleInput } from "@/lib/cloudTrade";

const quote = { bid: 2330.1, ask: 2330.4 };
const idea = { entry: 2300, sl: 2290, tp: 2320 }; // feed prices differ from the broker's
const decision = { trade: { strategy: "ema", side: "buy" as const, entry: 2300, sl: 2290, tp: 2320, key: "ema:XAUUSD:H1:1", reason: "pullback" }, explanation: "x" };
const base: CycleInput = {
  status: "running", connected: true, accountType: "demo", mode: "demo", liveConfirmed: false, demoOnly: true,
  defaultLot: 0.02, maxLot: 0.1, maxOpen: 2, maxDailyLoss: 50, openCount: 0, floatingPL: 0, closedTodayPL: 0,
  decision, quote, feedLast: 2329, digits: 2, brokerSymbol: "XAUUSDm",
  profitGoal: 0, profitSinceGoal: 0, goalMode: "stop",
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
  const ok = { connected: true, accountType: "demo" as const, mode: "demo" as const, liveConfirmed: false, demoOnly: true, strategy: "auto", defaultLot: 0.01, maxLot: 0.1, maxOpen: 1, riskPct: 1, maxDailyLoss: 20, instrument: "XAUUSD", brokerSymbol: "XAUUSD", profitGoal: 0, goalMode: "stop" };
  it("passes for a valid demo setup", () => expect(cloudStartBlockers(ok)).toEqual([]));
  it("blocks when not connected, live without confirmation, or bad limits", () => {
    expect(cloudStartBlockers({ ...ok, connected: false }).length).toBe(1);
    expect(cloudStartBlockers({ ...ok, accountType: "live" }).length).toBeGreaterThanOrEqual(1);
    expect(cloudStartBlockers({ ...ok, accountType: "live", mode: "live", liveConfirmed: true, demoOnly: false })).toEqual([]);
    expect(cloudStartBlockers({ ...ok, maxDailyLoss: 0, defaultLot: 1 }).length).toBe(2);
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
