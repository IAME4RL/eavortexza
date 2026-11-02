import { describe, expect, it } from "vitest";
import { biasIdea, type Bar } from "@/lib/strategy";

const mk = (f: (i: number) => number): Bar[] => Array.from({ length: 80 }, (_, i) => { const c = f(i); return { t: i * 3600, o: c - 0.2, h: c + 1, l: c - 1, c }; });

describe("biasIdea (entry on START)", () => {
  it("buys a steady uptrend with the stop below and the target above", () => {
    const r = biasIdea(mk((i) => 2000 + i * 2), "XAUUSD", "H1", 2, "1");
    expect(r?.idea.side).toBe("buy");
    expect(r!.idea.sl).toBeLessThan(r!.idea.entry);
    expect(r!.idea.tp).toBeGreaterThan(r!.idea.entry);
    expect(r!.idea.key).toBe("start:XAUUSD:H1:1");
  });
  it("sells a steady downtrend", () => {
    const r = biasIdea(mk((i) => 3000 - i * 2), "XAUUSD", "H1", 2, "2");
    expect(r?.idea.side).toBe("sell");
    expect(r!.idea.sl).toBeGreaterThan(r!.idea.entry);
  });
  it("gives no direction when the price signals disagree", () => {
    expect(biasIdea(mk((i) => 2000 + (i % 2 ? 1 : -1)), "XAUUSD", "H1", 2, "3")).toBeNull();
  });
  it("needs enough bars", () => expect(biasIdea(mk((i) => 2000 + i).slice(0, 30), "XAUUSD", "H1", 2, "4")).toBeNull());
});
