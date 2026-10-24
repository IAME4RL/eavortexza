// EA VORTEX Signal Engine — turns the strategy registry into forward-looking trade setups
// computed from REAL closed bars (see marketdata.ts). Pure and deterministic: same bars in,
// same signal out. Signals expire, carry a dedupe key, and are confirmed against the higher
// timeframe. The backtester walks forward bar by bar and never reads future candles.
import { MIN_BARS, decide, ema, type Bar, type StrategySetting } from "./strategy";
import { timeframeMs } from "./marketdata";

/** A signal stays valid for this many bars after the bar that produced it. */
export const SIGNAL_EXPIRY_BARS = 3;
/** Backtest exits a trade that hit neither SL nor TP after this many bars. */
export const BACKTEST_MAX_HOLD_BARS = 24;

export type HtfBias = "bullish" | "bearish" | "neutral" | "none";

export interface Signal {
  strategy: string;
  side: "buy" | "sell";
  entry: number;
  sl: number;
  tp: number;
  rr: number;
  reason: string;
  explanation: string;
  key: string;
  dataAt: number;
  expiresAt: number;
  htf: HtfBias;
}

export type SignalOutcome = { ok: true; signal: Signal } | { ok: false; reason: string };

/** Higher-timeframe trend bias from EMA20/EMA50 alignment on closed bars. */
export function htfBias(bars: Bar[]): "bullish" | "bearish" | "neutral" {
  if (bars.length < 55) return "neutral";
  const closes = bars.map((b) => b.c);
  const e20 = ema(closes, 20), e50 = ema(closes, 50);
  const n = closes.length - 1;
  if (e20[n]! > e50[n]! && closes[n]! > e20[n]!) return "bullish";
  if (e20[n]! < e50[n]! && closes[n]! < e20[n]!) return "bearish";
  return "neutral";
}

/**
 * Builds a validated signal from real closed bars. Returns NO TRADE (ok: false) when no
 * strategy qualifies, when the setup conflicts with the higher timeframe, or when the
 * risk checks inside the strategy engine reject it.
 */
export function buildSignal(
  setting: StrategySetting,
  bars: Bar[],
  htfBars: Bar[] | null,
  symbol: string,
  tf: string,
  digits: number,
  dataAt: number,
): SignalOutcome {
  const d = decide(setting, bars, symbol, tf, digits);
  if (!d.trade) return { ok: false, reason: d.reason };

  const bias: HtfBias = htfBars && htfBars.length ? htfBias(htfBars) : "none";
  if (bias === "bullish" && d.trade.side === "sell")
    return { ok: false, reason: "NO TRADE: setup is short but the higher timeframe is bullish — confirmation failed." };
  if (bias === "bearish" && d.trade.side === "buy")
    return { ok: false, reason: "NO TRADE: setup is long but the higher timeframe is bearish — confirmation failed." };

  const t = d.trade;
  const risk = Math.abs(t.entry - t.sl);
  if (!(risk > 0)) return { ok: false, reason: "NO TRADE: invalid stop-loss distance." };
  const rr = Math.abs(t.tp - t.entry) / risk;
  const explanation =
    d.explanation +
    (bias === "none"
      ? " No higher timeframe available for confirmation."
      : ` Higher timeframe is ${bias}, consistent with this ${t.side.toUpperCase()} setup.`);

  return {
    ok: true,
    signal: {
      strategy: t.strategy,
      side: t.side,
      entry: t.entry,
      sl: t.sl,
      tp: t.tp,
      rr: Number(rr.toFixed(2)),
      reason: t.reason,
      explanation,
      key: t.key, // strategy:symbol:tf:barTime — unique per bar, prevents duplicates
      dataAt,
      expiresAt: dataAt + SIGNAL_EXPIRY_BARS * timeframeMs(tf),
      htf: bias,
    },
  };
}

export interface BacktestMetrics {
  strategy: string;
  trades: number;
  wins: number;
  losses: number;
  timeouts: number;
  winRate: number;
  avgR: number;
  totalR: number;
  maxDrawdownR: number;
  profitFactor: number | null;
  rMultiples: number[];
  firstBar: number;
  lastBar: number;
}

/**
 * Walk-forward backtest on historical closed bars. At bar i the strategy only ever sees
 * bars[0..i] — future candles are never read. One position at a time; if a bar touches
 * both SL and TP, the stop is counted first (conservative). Results are historical
 * statistics, never a guarantee of future performance.
 */
export function backtest(
  setting: StrategySetting,
  bars: Bar[],
  symbol: string,
  tf: string,
  digits: number,
  maxHoldBars = BACKTEST_MAX_HOLD_BARS,
): BacktestMetrics {
  const rMultiples: number[] = [];
  let timeouts = 0;
  let i = MIN_BARS;
  while (i < bars.length - 1) {
    const window = bars.slice(0, i + 1); // closed bars up to and including i — no lookahead
    const d = decide(setting, window, symbol, tf, digits);
    if (!d.trade) {
      i++;
      continue;
    }
    const t = d.trade;
    const risk = Math.abs(t.entry - t.sl);
    let r: number | null = null;
    let exit = Math.min(i + maxHoldBars, bars.length - 1);
    for (let j = i + 1; j <= exit; j++) {
      const b = bars[j]!;
      if (t.side === "buy") {
        if (b.l <= t.sl) { r = -1; exit = j; break; }
        if (b.h >= t.tp) { r = (t.tp - t.entry) / risk; exit = j; break; }
      } else {
        if (b.h >= t.sl) { r = -1; exit = j; break; }
        if (b.l <= t.tp) { r = (t.entry - t.tp) / risk; exit = j; break; }
      }
    }
    if (r === null) {
      const b = bars[exit]!;
      r = t.side === "buy" ? (b.c - t.entry) / risk : (t.entry - b.c) / risk;
      timeouts++;
    }
    rMultiples.push(Number(r.toFixed(3)));
    i = exit + 1; // one position at a time
  }

  const wins = rMultiples.filter((r) => r > 0);
  const losses = rMultiples.filter((r) => r < 0);
  const grossWin = wins.reduce((s, r) => s + r, 0);
  const grossLoss = Math.abs(losses.reduce((s, r) => s + r, 0));
  let peak = 0, equity = 0, maxDd = 0;
  for (const r of rMultiples) {
    equity += r;
    peak = Math.max(peak, equity);
    maxDd = Math.max(maxDd, peak - equity);
  }
  return {
    strategy: setting,
    trades: rMultiples.length,
    wins: wins.length,
    losses: losses.length,
    timeouts,
    winRate: rMultiples.length ? Number(((wins.length / rMultiples.length) * 100).toFixed(1)) : 0,
    avgR: rMultiples.length ? Number((rMultiples.reduce((s, r) => s + r, 0) / rMultiples.length).toFixed(3)) : 0,
    totalR: Number(rMultiples.reduce((s, r) => s + r, 0).toFixed(3)),
    maxDrawdownR: Number(maxDd.toFixed(3)),
    profitFactor: grossLoss > 0 ? Number((grossWin / grossLoss).toFixed(2)) : null,
    rMultiples,
    firstBar: bars[0]?.t ?? 0,
    lastBar: bars[bars.length - 1]?.t ?? 0,
  };
}
