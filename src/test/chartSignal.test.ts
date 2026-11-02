import { describe, expect, it } from "vitest";
import { buildChartSignal, confidenceLevel, isUnreadable } from "@/lib/chartSignal";

const axis = { legible: true, min_visible: 2300, max_visible: 2350, last_price: 2330 };
const sig = {
  action: "BUY", entry: 2330, stop_loss: 2318, take_profit: 2352, basis: "Pullback to support in an uptrend",
  evidence: ["Higher highs and higher lows", "Bounce from the 2318 support zone", "Rejection wick at 2322"],
  confidence_score: 80, confidence_reason: "Clear uptrend with support holding", risks: ["Resistance near 2350"],
  entry_zone: "near the current price", stop_zone: "below the recent swing low", target_zone: "at the prior swing high",
};
const base = { signal: sig, axis, imageQuality: "good", symbolDetected: "XAUUSD", selectedInstrument: "GOLD" };

describe("buildChartSignal", () => {
  it("returns an exact BUY with confidence when levels trace to the chart", () => {
    const r = buildChartSignal(base)!;
    expect(r.action).toBe("BUY");
    expect(r.levels).toBe("exact");
    expect(r.rr).toBe(1.83);
    expect(r.confidence.score).toBe(80);
    expect(r.confidence.level).toBe("High");
  });
  it("supports SELL", () => {
    const r = buildChartSignal({ ...base, signal: { ...sig, action: "SELL", entry: 2330, stop_loss: 2342, take_profit: 2308 } })!;
    expect(r.action).toBe("SELL");
    expect(r.levels).toBe("exact");
  });
  it("never returns no-trade: unreadable price scale gives approximate zones and low confidence", () => {
    const r = buildChartSignal({ ...base, axis: { legible: false } })!;
    expect(r.action).toBe("BUY");
    expect(r.levels).toBe("approximate");
    expect([r.entry, r.stop_loss, r.take_profit]).toEqual([null, null, null]);
    expect(r.confidence.score).toBeLessThanOrEqual(35);
    expect(r.confidence.level).toBe("Low");
    expect(r.zones.stop_loss).toBe("below the recent swing low");
  });
  it("drops levels outside the visible range instead of showing them", () => {
    const r = buildChartSignal({ ...base, signal: { ...sig, take_profit: 2420 } })!;
    expect(r.levels).toBe("approximate");
    expect(r.take_profit).toBeNull();
    expect(r.warnings.join(" ")).toMatch(/outside the price range/);
  });
  it("drops wrong-side stops and far-from-price entries", () => {
    expect(buildChartSignal({ ...base, signal: { ...sig, stop_loss: 2340 } })!.levels).toBe("approximate");
    expect(buildChartSignal({ ...base, signal: { ...sig, entry: 2305, stop_loss: 2300, take_profit: 2330 } })!.levels).toBe("approximate");
  });
  it("caps confidence for weak evidence, limited images and low reward-to-risk", () => {
    expect(buildChartSignal({ ...base, signal: { ...sig, evidence: ["looks bullish"] } })!.confidence.score).toBeLessThanOrEqual(40);
    expect(buildChartSignal({ ...base, imageQuality: "limited" })!.confidence.score).toBeLessThanOrEqual(60);
    expect(buildChartSignal({ ...base, signal: { ...sig, take_profit: 2338 } })!.confidence.score).toBeLessThanOrEqual(45);
  });
  it("still signals on a symbol mismatch but warns and caps confidence", () => {
    const r = buildChartSignal({ ...base, symbolDetected: "EURUSD" })!;
    expect(r.action).toBe("BUY");
    expect(r.warnings.join(" ")).toMatch(/EURUSD/);
    expect(r.confidence.score).toBeLessThanOrEqual(30);
  });
  it("derives a direction from bias, trend, then price position when the AI gives none", () => {
    const none = { ...sig, action: "NO_TRADE" };
    expect(buildChartSignal({ ...base, signal: none, bias: "bearish" })!.action).toBe("SELL");
    expect(buildChartSignal({ ...base, signal: none, trendDirection: "uptrend" })!.action).toBe("BUY");
    const mid = buildChartSignal({ ...base, signal: { ...none, entry: null }, axis: { ...axis, last_price: 2345 } })!;
    expect(mid.action).toBe("SELL");
    expect(mid.confidence.score).toBeLessThanOrEqual(25);
  });
  it("returns null only when there is no readable chart or no way to pick a direction", () => {
    expect(buildChartSignal({ ...base, imageQuality: "unreadable" })).toBeNull();
    expect(isUnreadable("unreadable")).toBe(true);
    expect(buildChartSignal({ ...base, signal: { action: "NO_TRADE" }, axis: { legible: false } })).toBeNull();
  });
  it("labels confidence levels", () => {
    expect([confidenceLevel(10), confidenceLevel(55), confidenceLevel(90)]).toEqual(["Low", "Medium", "High"]);
  });
});
