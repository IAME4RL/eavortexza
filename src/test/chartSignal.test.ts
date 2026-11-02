import { describe, expect, it } from "vitest";
import { validateChartSignal } from "@/lib/chartSignal";

const axis = { legible: true, min_visible: 2300, max_visible: 2350, last_price: 2330 };
const buy = { action: "BUY", entry: 2330, stop_loss: 2318, take_profit: 2348, basis: "Pullback to support in an uptrend", evidence: ["Higher highs and higher lows", "Bounce from the 2318 support zone"] };
const base = { signal: buy, axis, imageQuality: "good", symbolDetected: "XAUUSD", selectedInstrument: "GOLD" };

describe("validateChartSignal", () => {
  it("accepts a BUY whose levels all come from the visible chart", () => {
    const r = validateChartSignal(base);
    expect(r.action).toBe("BUY");
    expect(r.rr).toBe(1.5);
    expect(r.reason).toBeNull();
  });
  it("accepts a SELL with correct ordering", () => {
    const r = validateChartSignal({ ...base, signal: { ...buy, action: "SELL", entry: 2330, stop_loss: 2342, take_profit: 2312 } });
    expect(r.action).toBe("SELL");
  });
  it("rejects levels outside the visible price range", () => {
    const r = validateChartSignal({ ...base, signal: { ...buy, take_profit: 2420 } });
    expect(r.action).toBe("NO_TRADE");
    expect(r.reason).toMatch(/outside the price range/);
  });
  it("rejects when the price axis is not legible", () => {
    expect(validateChartSignal({ ...base, axis: { ...axis, legible: false } }).action).toBe("NO_TRADE");
    expect(validateChartSignal({ ...base, axis: {} }).action).toBe("NO_TRADE");
  });
  it("rejects an entry far from the latest visible price", () => {
    expect(validateChartSignal({ ...base, signal: { ...buy, entry: 2305, stop_loss: 2300, take_profit: 2330 } }).reason).toMatch(/not near/);
  });
  it("rejects wrong-side stop or target", () => {
    expect(validateChartSignal({ ...base, signal: { ...buy, stop_loss: 2340 } }).reason).toMatch(/wrong sides/);
  });
  it("rejects reward-to-risk below 1:1", () => {
    expect(validateChartSignal({ ...base, signal: { ...buy, stop_loss: 2310, take_profit: 2335 } }).reason).toMatch(/Reward-to-risk/);
  });
  it("rejects a setup without enough visible evidence", () => {
    expect(validateChartSignal({ ...base, signal: { ...buy, evidence: ["looks bullish"] } }).reason).toMatch(/evidence/);
  });
  it("rejects when the chart symbol differs from the selected one", () => {
    const r = validateChartSignal({ ...base, symbolDetected: "EURUSD" });
    expect(r.action).toBe("NO_TRADE");
    expect(r.reason).toMatch(/EURUSD/);
  });
  it("rejects unreadable images and honours the model's own NO_TRADE", () => {
    expect(validateChartSignal({ ...base, imageQuality: "unreadable" }).action).toBe("NO_TRADE");
    expect(validateChartSignal({ ...base, signal: { action: "NO_TRADE", basis: "Price is mid-range" } }).reason).toBe("Price is mid-range");
  });
  it("never leaks levels on NO_TRADE", () => {
    const r = validateChartSignal({ ...base, signal: { ...buy, take_profit: 9999 } });
    expect([r.entry, r.stop_loss, r.take_profit]).toEqual([null, null, null]);
  });
});
