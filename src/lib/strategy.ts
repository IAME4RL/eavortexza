// EA VORTEX Strategy Engine — pure, deterministic rules evaluated on CLOSED bars
// reported by the user's own MT5 terminal. No external or invented market data.

export interface Bar { t: number; o: number; h: number; l: number; c: number }
export type StrategyId = "ema_trend" | "breakout";
export type StrategySetting = StrategyId | "auto" | "manual";
export const STRATEGIES: { id: StrategyId; name: string; rules: string }[] = [
  { id: "ema_trend", name: "Vortex Trend Pullback",
    rules: "EMA20 above EMA50 and the last closed bar reclaims EMA20 with RSI14 between 50–70 (BUY); mirrored for SELL. SL 1.5×ATR14, TP 3×ATR14 (1:2)." },
  { id: "breakout", name: "Vortex Range Breakout",
    rules: "Last closed bar closes beyond the prior 20-bar high/low with a range larger than ATR14. SL 1.5×ATR14, TP 3×ATR14 (1:2)." },
];
export const MIN_BARS = 60;

export interface TradeIdea { strategy: StrategyId; side: "buy" | "sell"; entry: number; sl: number; tp: number; key: string; reason: string }
export type Decision = { trade: TradeIdea } | { trade: null; reason: string };

export function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1); const out: number[] = [];
  values.forEach((v, i) => out.push(i === 0 ? v : v * k + out[i - 1] * (1 - k)));
  return out;
}
export function rsi(closes: number[], period = 14): number {
  let gain = 0, loss = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gain += d; else loss -= d;
  }
  if (loss === 0) return gain === 0 ? 50 : 100;
  return 100 - 100 / (1 + gain / loss);
}
export function atr(bars: Bar[], period = 14): number {
  let sum = 0;
  for (let i = bars.length - period; i < bars.length; i++) {
    const p = bars[i - 1].c, b = bars[i];
    sum += Math.max(b.h - b.l, Math.abs(b.h - p), Math.abs(b.l - p));
  }
  return sum / period;
}
const round = (v: number, digits: number) => Number(v.toFixed(digits));

function build(strategy: StrategyId, side: "buy" | "sell", last: Bar, a: number, digits: number, symbol: string, tf: string, reason: string): TradeIdea {
  const entry = last.c, d = side === "buy" ? 1 : -1;
  return { strategy, side, entry, sl: round(entry - d * 1.5 * a, digits), tp: round(entry + d * 3 * a, digits),
    key: `${strategy}:${symbol}:${tf}:${last.t}`, reason };
}

export function evaluateStrategy(id: StrategyId, bars: Bar[], symbol: string, tf: string, digits: number): TradeIdea | null {
  if (bars.length < MIN_BARS) return null;
  const closes = bars.map((b) => b.c), last = bars[bars.length - 1], prev = bars[bars.length - 2];
  const a = atr(bars); if (!(a > 0)) return null;
  if (id === "ema_trend") {
    const e20 = ema(closes, 20), e50 = ema(closes, 50), n = closes.length - 1, r = rsi(closes);
    if (e20[n] > e50[n] && prev.c <= e20[n - 1] && last.c > e20[n] && r >= 50 && r <= 70)
      return build(id, "buy", last, a, digits, symbol, tf, `EMA20>EMA50, close reclaimed EMA20, RSI ${r.toFixed(1)}`);
    if (e20[n] < e50[n] && prev.c >= e20[n - 1] && last.c < e20[n] && r <= 50 && r >= 30)
      return build(id, "sell", last, a, digits, symbol, tf, `EMA20<EMA50, close lost EMA20, RSI ${r.toFixed(1)}`);
    return null;
  }
  const prior = bars.slice(-21, -1);
  const hi = Math.max(...prior.map((b) => b.h)), lo = Math.min(...prior.map((b) => b.l));
  if (last.h - last.l <= a) return null;
  if (last.c > hi) return build(id, "buy", last, a, digits, symbol, tf, `Closed above 20-bar high ${hi}`);
  if (last.c < lo) return build(id, "sell", last, a, digits, symbol, tf, `Closed below 20-bar low ${lo}`);
  return null;
}

/** Evaluates implemented strategies and selects at most ONE eligible idea; otherwise NO TRADE. */
export function decide(setting: StrategySetting, bars: Bar[], symbol: string, tf: string, digits: number): Decision {
  if (setting === "manual") return { trade: null, reason: "NO TRADE: manual mode (strategy engine off)" };
  if (bars.length < MIN_BARS) return { trade: null, reason: `NO TRADE: need ${MIN_BARS} closed bars, received ${bars.length}` };
  const ids: StrategyId[] = setting === "auto" ? STRATEGIES.map((s) => s.id) : [setting];
  for (const id of ids) {
    const idea = evaluateStrategy(id, bars, symbol, tf, digits);
    if (idea) return { trade: idea };
  }
  return { trade: null, reason: "NO TRADE: no strategy entry conditions met" };
}

/** Parses "t,o,h,l,c;..." (oldest first). Returns null on any malformed value. */
export function parseBars(raw: string): Bar[] | null {
  if (!raw) return [];
  const out: Bar[] = [];
  for (const row of raw.split(";").slice(0, 300)) {
    const p = row.split(",").map(Number);
    if (p.length !== 5 || p.some((x) => !Number.isFinite(x))) return null;
    const [t, o, h, l, c] = p;
    if (h < l || c <= 0) return null;
    out.push({ t, o, h, l, c });
  }
  for (let i = 1; i < out.length; i++) if (out[i].t <= out[i - 1].t) return null;
  return out;
}
