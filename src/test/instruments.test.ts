import { describe, it, expect } from "vitest";
import { canonicalInstrument, isGold, symbolConflicts } from "@/lib/instruments";

describe("gold symbol support", () => {
  it("treats GOLD, XAUUSD, XAU/USD, GOLDUSD and broker suffixes as the same instrument", () => {
    for (const s of ["GOLD", "XAUUSD", "XAU/USD", "GOLDUSD", "xauusd.m", "XAUUSDm"]) {
      expect(isGold(s)).toBe(true);
    }
  });
  it("does not flag a conflict when GOLD is selected and chart shows XAUUSD", () => {
    expect(symbolConflicts("GOLD", "XAUUSD")).toBe(false);
  });
  it("flags a conflict when GOLD is selected but chart shows EURUSD", () => {
    expect(symbolConflicts("GOLD", "EURUSD")).toBe(true);
  });
  it("does not flag a conflict when no symbol is visible", () => {
    expect(symbolConflicts("EURUSD", null)).toBe(false);
  });
  it("keeps EURUSD distinct from gold", () => {
    expect(canonicalInstrument("EURUSD")).toBe("EURUSD");
  });
});
