import { describe, expect, it } from "vitest";
import { buildSignal, backtest, htfBias, SIGNAL_EXPIRY_BARS } from "@/lib/signals";
import { timeframeMs } from "@/lib/marketdata";
import type { Bar } from "@/lib/strategy";

/** Flat, low-volatility bars — no strategy should fire on these. */
function flatBars(n: number, start = 1_700_000_000_000, step = 3_600_000): Bar[] {
  const out: Bar[] = [];
  for (let i = 0; i < n; i++) {
    const c = 2000 + Math.sin(i / 7) * 0.3;
    out.push({ t: start + i * step, o: c, h: c + 0.2, l: c - 0.2, c });
  }
  return out;
}

/** Flat bars then a decisive breakout bar closing above the 20-bar high. */
function breakoutBars(): Bar[] {
  const bars = flatBars(80);
  const last = bars[bars.length - 1]!;
  const hi = Math.max(...bars.slice(-21, -1).map((b) => b.h));
  const c = hi + 5;
  bars.push({ t: last.t + 3_600_000, o: hi, h: c + 1, l: hi - 1, c });
  return bars;
}

function bearishBars(n: number): Bar[] {
  const out: Bar[] = [];
  for (let i = 0; i < n; i++) {
    const c = 2000 - i * 2;
    out.push({ t: 1_700_000_000_000 + i * 3_600_000, o: c + 1, h: c + 1.5, l: c - 1, c });
  }
  return out;
}

describe("buildSignal", () => {
  it("returns NO TRADE on featureless data", () => {
    const r = buildSignal("auto", flatBars(120), null, "XAUUSD", "H1", 2, Date.now());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/^NO TRADE/);
  });

  it("produces a valid BUY setup on a breakout with correct SL/TP geometry", () => {
    const bars = breakoutBars();
    const dataAt = bars[bars.length - 1]!.t;
    const r = buildSignal("breakout", bars, null, "XAUUSD", "H1", 2, dataAt);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = r.signal;
    expect(s.side).toBe("buy");
    expect(s.entry).toBe(Number(bars[bars.length - 1]!.c.toFixed(2))); // entry rounded to instrument digits
    expect(s.sl).toBeLessThan(s.entry); // stop below entry for a buy
    expect(s.tp).toBeGreaterThan(s.entry); // target above entry for a buy
    expect(s.rr).toBeGreaterThanOrEqual(1.5);
  });

  it("expires the signal 3 bars after the data timestamp", () => {
    const bars = breakoutBars();
    const dataAt = bars[bars.length - 1]!.t;
    const r = buildSignal("breakout", bars, null, "XAUUSD", "H1", 2, dataAt);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.signal.expiresAt - r.signal.dataAt).toBe(SIGNAL_EXPIRY_BARS * timeframeMs("H1"));
  });

  it("produces a deterministic dedupe key per bar", () => {
    const bars = breakoutBars();
    const a = buildSignal("breakout", bars, null, "XAUUSD", "H1", 2, 0);
    const b = buildSignal("breakout", bars, null, "XAUUSD", "H1", 2, 0);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.signal.key).toBe(b.signal.key);
  });

  it("rejects a long setup when the higher timeframe is bearish", () => {
    const bars = breakoutBars();
    const r = buildSignal("breakout", bars, bearishBars(80), "XAUUSD", "H1", 2, bars[bars.length - 1]!.t);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("higher timeframe");
  });

  it("manual mode never trades", () => {
    const r = buildSignal("manual", breakoutBars(), null, "XAUUSD", "H1", 2, 0);
    expect(r.ok).toBe(false);
  });
});

describe("htfBias", () => {
  it("reads a steady downtrend as bearish", () => {
    expect(htfBias(bearishBars(80))).toBe("bearish");
  });
  it("returns neutral on too little data", () => {
    expect(htfBias(flatBars(20))).toBe("neutral");
  });
});

describe("backtest", () => {
  it("never reads future candles: a prefix run matches the full run for completed trades", () => {
    // Trending series with pullbacks so strategies actually fire.
    const bars: Bar[] = [];
    for (let i = 0; i < 260; i++) {
      const trend = i * 1.5;
      const wave = Math.sin(i / 3) * 6;
      const c = 2000 + trend + wave;
      bars.push({ t: 1_700_000_000_000 + i * 3_600_000, o: c - 2, h: c + 3, l: c - 4, c });
    }
    const k = 180;
    const full = backtest("auto", bars, "XAUUSD", "H1", 2);
    const prefix = backtest("auto", bars.slice(0, k), "XAUUSD", "H1", 2);
    // Every trade closed before the prefix ends must be identical in the full run.
    // (The prefix's last trade may still be open at the boundary and time out there,
    // while the full run sees it through — that is data availability, not lookahead.)
    const settled = prefix.rMultiples.slice(0, -1);
    expect(full.rMultiples.slice(0, settled.length)).toEqual(settled);
  });

  it("reports honest zero-trade metrics when nothing qualifies", () => {
    const m = backtest("auto", flatBars(120), "XAUUSD", "H1", 2);
    expect(m.trades).toBe(0);
    expect(m.winRate).toBe(0);
    expect(m.totalR).toBe(0);
  });
});
