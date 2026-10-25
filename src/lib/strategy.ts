// EA VORTEX Strategy Engine — pure, deterministic rules evaluated on CLOSED bars
// reported by the user's own MT5 terminal (or uploaded for backtesting). No external or invented market data.
// Each strategy returns at most one candidate with a structural stop loss (invalidation) and a target.
// The selector picks ONE candidate per opportunity and explains why; otherwise NO TRADE.

export interface Bar { t: number; o: number; h: number; l: number; c: number }
export type Side = "buy" | "sell";

export const MIN_BARS = 60;
const MAX_RISK_ATR = 4; // reject setups whose stop is wider than 4×ATR14
const MIN_RR = 1.5;

// ---------- indicators ----------
export function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1); const out: number[] = [];
  values.forEach((v, i) => out.push(i === 0 ? v : v * k + out[i - 1]! * (1 - k)));
  return out;
}
export function sma(values: number[], period: number, end = values.length): number {
  let s = 0; for (let i = end - period; i < end; i++) s += values[i]!; return s / period;
}
export function rsiSeries(closes: number[], period = 14): number[] {
  const out = new Array<number>(closes.length).fill(50);
  let g = 0, l = 0;
  for (let i = 1; i < closes.length; i++) {
    const d = closes[i]! - closes[i - 1]!;
    const up = d > 0 ? d : 0, dn = d < 0 ? -d : 0;
    if (i <= period) { g += up / period; l += dn / period; } else { g = (g * (period - 1) + up) / period; l = (l * (period - 1) + dn) / period; }
    if (i >= period) out[i] = l === 0 ? (g === 0 ? 50 : 100) : 100 - 100 / (1 + g / l);
  }
  return out;
}
export function rsi(closes: number[], period = 14): number {
  let gain = 0, loss = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i]! - closes[i - 1]!;
    if (d > 0) gain += d; else loss -= d;
  }
  if (loss === 0) return gain === 0 ? 50 : 100;
  return 100 - 100 / (1 + gain / loss);
}
export function atr(bars: Bar[], period = 14): number {
  let sum = 0;
  for (let i = bars.length - period; i < bars.length; i++) {
    const p = bars[i - 1]!.c, b = bars[i]!;
    sum += Math.max(b.h - b.l, Math.abs(b.h - p), Math.abs(b.l - p));
  }
  return sum / period;
}
/** Fractal swing points: a bar whose high/low is the extreme of `w` bars on each side. */
export function swings(bars: Bar[], w = 2): { highs: number[]; lows: number[] } {
  const highs: number[] = [], lows: number[] = [];
  for (let i = w; i < bars.length - w; i++) {
    let hi = true, lo = true;
    for (let j = i - w; j <= i + w; j++) { if (j === i) continue; if (bars[j]!.h >= bars[i]!.h) hi = false; if (bars[j]!.l <= bars[i]!.l) lo = false; }
    if (hi) highs.push(i); if (lo) lows.push(i);
  }
  return { highs, lows };
}
const hiOf = (b: Bar[]) => Math.max(...b.map((x) => x.h));
const loOf = (b: Bar[]) => Math.min(...b.map((x) => x.l));
const body = (b: Bar) => Math.abs(b.c - b.o);

// ---------- strategy registry ----------
interface Ctx { bars: Bar[]; closes: number[]; last: Bar; prev: Bar; n: number; a: number }
interface Candidate { side: Side; sl: number; tp?: number; reason: string; score: number }
interface StrategyDef { id: string; name: string; family: string; rules: string; minBars: number; evaluate: (c: Ctx) => Candidate | null }

const DEFS: StrategyDef[] = [
  { id: "ema_trend", name: "Trend Pullback (Moving Averages)", family: "Moving Averages", minBars: 60,
    rules: "EMA20 above EMA50 and the last closed bar reclaims EMA20 with RSI14 between 50–70 (BUY); mirrored for SELL. SL 1.5×ATR14, TP 3×ATR14 (1:2).",
    evaluate: ({ closes, last, prev, n, a }) => {
      const e20 = ema(closes, 20), e50 = ema(closes, 50), r = rsi(closes);
      if (e20[n]! > e50[n]! && prev.c <= e20[n - 1]! && last.c > e20[n]! && r >= 50 && r <= 70)
        return { side: "buy", sl: last.c - 1.5 * a, tp: last.c + 3 * a, reason: `EMA20>EMA50, close reclaimed EMA20, RSI ${r.toFixed(1)}`, score: 2 };
      if (e20[n]! < e50[n]! && prev.c >= e20[n - 1]! && last.c < e20[n]! && r <= 50 && r >= 30)
        return { side: "sell", sl: last.c + 1.5 * a, tp: last.c - 3 * a, reason: `EMA20<EMA50, close lost EMA20, RSI ${r.toFixed(1)}`, score: 2 };
      return null;
    } },
  { id: "breakout", name: "Range Breakout", family: "Breakouts", minBars: 60,
    rules: "Last closed bar closes beyond the prior 20-bar high/low with a range larger than ATR14. SL 1.5×ATR14, TP 3×ATR14 (1:2).",
    evaluate: ({ bars, last, a }) => {
      const prior = bars.slice(-21, -1), hi = hiOf(prior), lo = loOf(prior);
      if (last.h - last.l <= a) return null;
      if (last.c > hi) return { side: "buy", sl: last.c - 1.5 * a, tp: last.c + 3 * a, reason: `Closed above 20-bar high ${hi}`, score: 1.5 };
      if (last.c < lo) return { side: "sell", sl: last.c + 1.5 * a, tp: last.c - 3 * a, reason: `Closed below 20-bar low ${lo}`, score: 1.5 };
      return null;
    } },
  { id: "bb_reversion", name: "Bollinger Band Re-entry", family: "Bollinger Bands", minBars: 60,
    rules: "Previous bar closed outside the 20/2σ band and the last bar closes back inside with RSI14 <35 (BUY) or >65 (SELL). SL beyond the two-bar extreme +0.2×ATR; TP at the middle band, minimum 1.5R.",
    evaluate: ({ closes, last, prev, n, a }) => {
      const band = (end: number) => { const m = sma(closes, 20, end); let v = 0; for (let i = end - 20; i < end; i++) v += (closes[i]! - m) ** 2; const sd = Math.sqrt(v / 20); return { m, up: m + 2 * sd, lo: m - 2 * sd }; };
      const b0 = band(n + 1), b1 = band(n), r = rsi(closes);
      if (prev.c < b1.lo && last.c > b0.lo && r < 35) return { side: "buy", sl: Math.min(prev.l, last.l) - 0.2 * a, tp: b0.m, reason: `Re-entered lower band, RSI ${r.toFixed(1)}`, score: 1.5 };
      if (prev.c > b1.up && last.c < b0.up && r > 65) return { side: "sell", sl: Math.max(prev.h, last.h) + 0.2 * a, tp: b0.m, reason: `Re-entered upper band, RSI ${r.toFixed(1)}`, score: 1.5 };
      return null;
    } },
  { id: "rsi_divergence", name: "RSI Divergence", family: "RSI Divergence", minBars: 60,
    rules: "Two most recent swing lows (fractal, 2 bars) within 30 bars: price lower low, RSI14 higher low, and last bar closes bullish above the second swing bar's high (BUY); mirrored for SELL. SL beyond the swing −0.3×ATR, TP 2R.",
    evaluate: ({ bars, closes, last, n, a }) => {
      const r = rsiSeries(closes), { highs, lows } = swings(bars);
      const recent = (xs: number[]) => xs.filter((i) => i >= n - 30 && i <= n - 2).slice(-2);
      const L = recent(lows), H = recent(highs);
      if (L.length === 2) { const [p, q] = L as [number, number];
        if (bars[q]!.l < bars[p]!.l && r[q]! > r[p]! && last.c > last.o && last.c > bars[q]!.h) return { side: "buy", sl: bars[q]!.l - 0.3 * a, reason: `Bullish divergence: price LL, RSI ${r[p]!.toFixed(0)}→${r[q]!.toFixed(0)}`, score: 2.5 }; }
      if (H.length === 2) { const [p, q] = H as [number, number];
        if (bars[q]!.h > bars[p]!.h && r[q]! < r[p]! && last.c < last.o && last.c < bars[q]!.l) return { side: "sell", sl: bars[q]!.h + 0.3 * a, reason: `Bearish divergence: price HH, RSI ${r[p]!.toFixed(0)}→${r[q]!.toFixed(0)}`, score: 2.5 }; }
      return null;
    } },
  { id: "macd_cross", name: "MACD Trend Cross", family: "MACD", minBars: 100,
    rules: "MACD(12,26) crosses its 9-signal below zero while close is above EMA100 (BUY); above zero below EMA100 (SELL). SL 1.5×ATR, TP 2R.",
    evaluate: ({ closes, last, n, a }) => {
      const e12 = ema(closes, 12), e26 = ema(closes, 26), m = closes.map((_, i) => e12[i]! - e26[i]!), s = ema(m, 9), t = ema(closes, 100)[n]!;
      if (m[n - 1]! <= s[n - 1]! && m[n]! > s[n]! && m[n]! < 0 && last.c > t) return { side: "buy", sl: last.c - 1.5 * a, reason: "MACD bullish cross below zero, above EMA100", score: 1.5 };
      if (m[n - 1]! >= s[n - 1]! && m[n]! < s[n]! && m[n]! > 0 && last.c < t) return { side: "sell", sl: last.c + 1.5 * a, reason: "MACD bearish cross above zero, below EMA100", score: 1.5 };
      return null;
    } },
  { id: "stoch_pullback", name: "Stochastic Pullback", family: "Stochastic", minBars: 60,
    rules: "EMA50 rising and Stochastic %K(14,3) crosses above %D from below 20 (BUY); mirrored above 80 (SELL). SL beyond the 5-bar extreme −0.2×ATR, TP 2R.",
    evaluate: ({ bars, closes, last, n, a }) => {
      const k = (end: number) => { const w = bars.slice(end - 14, end); const h = hiOf(w), l = loOf(w); return h === l ? 50 : ((bars[end - 1]!.c - l) / (h - l)) * 100; };
      const K = [k(n - 3), k(n - 2), k(n - 1), k(n), k(n + 1)]; const D1 = (K[1]! + K[2]! + K[3]!) / 3, D0 = (K[2]! + K[3]! + K[4]!) / 3;
      const e = ema(closes, 50), up = e[n]! > e[n - 5]!, w5 = bars.slice(-5);
      if (up && K[3]! <= D1 && K[4]! > D0 && K[3]! < 20) return { side: "buy", sl: loOf(w5) - 0.2 * a, reason: `Stoch %K crossed up from ${K[3]!.toFixed(0)} in uptrend`, score: 1.5 };
      if (!up && e[n]! < e[n - 5]! && K[3]! >= D1 && K[4]! < D0 && K[3]! > 80) return { side: "sell", sl: hiOf(w5) + 0.2 * a, reason: `Stoch %K crossed down from ${K[3]!.toFixed(0)} in downtrend`, score: 1.5 };
      return null;
    } },
  { id: "engulfing", name: "Engulfing at Support/Resistance", family: "Candlestick Patterns", minBars: 60,
    rules: "Bullish engulfing (body engulfs prior opposite body) whose low is within 0.5×ATR of the prior 20-bar low (BUY); mirrored at the 20-bar high (SELL). SL beyond the pattern extreme −0.2×ATR, TP 2R.",
    evaluate: ({ bars, last, prev, a }) => {
      const w = bars.slice(-22, -2), lo = loOf(w), hi = hiOf(w), pl = Math.min(last.l, prev.l), ph = Math.max(last.h, prev.h);
      if (prev.c < prev.o && last.c > last.o && last.c >= prev.o && last.o <= prev.c && body(last) > body(prev) && pl - lo <= 0.5 * a)
        return { side: "buy", sl: pl - 0.2 * a, reason: `Bullish engulfing at support ${lo}`, score: 2 };
      if (prev.c > prev.o && last.c < last.o && last.c <= prev.o && last.o >= prev.c && body(last) > body(prev) && hi - ph <= 0.5 * a)
        return { side: "sell", sl: ph + 0.2 * a, reason: `Bearish engulfing at resistance ${hi}`, score: 2 };
      return null;
    } },
  { id: "pin_bar", name: "Pin Bar Rejection", family: "Candlestick Patterns", minBars: 60,
    rules: "Last bar's lower wick ≥ 2/3 of its range, range ≥ ATR, and it trades below the prior 10-bar low then closes back above it (BUY); mirrored (SELL). SL beyond the wick −0.2×ATR, TP 2R.",
    evaluate: ({ bars, last, a }) => {
      const rng = last.h - last.l; if (rng < a) return null;
      const w = bars.slice(-11, -1), lo = loOf(w), hi = hiOf(w);
      if (Math.min(last.o, last.c) - last.l >= (2 / 3) * rng && last.l < lo && last.c > lo) return { side: "buy", sl: last.l - 0.2 * a, reason: `Bullish pin bar rejected ${lo}`, score: 2 };
      if (last.h - Math.max(last.o, last.c) >= (2 / 3) * rng && last.h > hi && last.c < hi) return { side: "sell", sl: last.h + 0.2 * a, reason: `Bearish pin bar rejected ${hi}`, score: 2 };
      return null;
    } },
  { id: "inside_bar", name: "Inside Bar Breakout", family: "Candlestick Patterns", minBars: 60,
    rules: "Bar[-3] is a mother bar, bar[-2] is fully inside it, the last bar closes beyond the mother bar in the EMA50 direction. SL at the opposite mother-bar extreme, TP 2R.",
    evaluate: ({ bars, closes, last, n }) => {
      const m = bars[n - 2]!, ib = bars[n - 1]!; if (!(ib.h < m.h && ib.l > m.l)) return null;
      const e = ema(closes, 50)[n]!;
      if (last.c > m.h && last.c > e) return { side: "buy", sl: m.l, reason: "Closed above mother bar after inside bar", score: 1.5 };
      if (last.c < m.l && last.c < e) return { side: "sell", sl: m.h, reason: "Closed below mother bar after inside bar", score: 1.5 };
      return null;
    } },
  { id: "liquidity_sweep", name: "Liquidity Sweep (SMC/ICT)", family: "Liquidity Sweeps", minBars: 60,
    rules: "Last bar wicks beyond the prior 20-bar low (sell-side liquidity) by ≥0.1×ATR then closes back above it (BUY); mirrored for buy-side liquidity (SELL). SL beyond the sweep wick −0.2×ATR, TP 2R.",
    evaluate: ({ bars, last, a }) => {
      const w = bars.slice(-21, -1), lo = loOf(w), hi = hiOf(w);
      if (last.l < lo - 0.1 * a && last.c > lo && last.c > last.o) return { side: "buy", sl: last.l - 0.2 * a, reason: `Swept sell-side liquidity below ${lo} and reclaimed`, score: 2.5 };
      if (last.h > hi + 0.1 * a && last.c < hi && last.c < last.o) return { side: "sell", sl: last.h + 0.2 * a, reason: `Swept buy-side liquidity above ${hi} and rejected`, score: 2.5 };
      return null;
    } },
  { id: "fvg", name: "Fair Value Gap Retest (ICT)", family: "FVGs", minBars: 60,
    rules: "Within the last 15 bars a displacement bar (body >1.2×ATR) left a bullish gap (bar[i-1].high < bar[i+1].low) not yet filled; the last bar trades into the gap and closes above it (BUY); mirrored (SELL). SL beyond the gap −0.3×ATR, TP 2R.",
    evaluate: ({ bars, last, n, a }) => {
      for (let i = n - 2; i >= n - 15 && i >= 1; i--) {
        const p = bars[i - 1]!, d = bars[i]!, nx = bars[i + 1]!; if (body(d) <= 1.2 * a) continue;
        const between = bars.slice(i + 2, n);
        if (d.c > d.o && p.h < nx.l) { const top = nx.l, bot = p.h;
          if (between.every((b) => b.l > bot) && last.l <= top && last.c > top) return { side: "buy", sl: bot - 0.3 * a, reason: `Retested bullish FVG ${bot}–${top}`, score: 2.5 }; }
        if (d.c < d.o && p.l > nx.h) { const bot = nx.h, top = p.l;
          if (between.every((b) => b.h < top) && last.h >= bot && last.c < bot) return { side: "sell", sl: top + 0.3 * a, reason: `Retested bearish FVG ${bot}–${top}`, score: 2.5 }; }
      }
      return null;
    } },
  { id: "bos", name: "Break of Structure (BOS)", family: "Market Structure", minBars: 60,
    rules: "In an EMA50 uptrend the last bar closes above the most recent swing high with a displacement body >ATR (BUY); mirrored (SELL). SL beyond the most recent opposite swing, TP 2R.",
    evaluate: ({ bars, closes, last, n, a }) => {
      const { highs, lows } = swings(bars), e = ema(closes, 50); const sh = highs.at(-1), sl = lows.at(-1);
      if (sh == null || sl == null || body(last) <= a) return null;
      if (e[n]! > e[n - 10]! && last.c > last.o && last.c > bars[sh]!.h && bars[n - 1]!.c <= bars[sh]!.h) return { side: "buy", sl: bars[sl]!.l, reason: `Bullish BOS above swing high ${bars[sh]!.h}`, score: 2 };
      if (e[n]! < e[n - 10]! && last.c < last.o && last.c < bars[sl]!.l && bars[n - 1]!.c >= bars[sl]!.l) return { side: "sell", sl: bars[sh]!.h, reason: `Bearish BOS below swing low ${bars[sl]!.l}`, score: 2 };
      return null;
    } },
  { id: "choch", name: "Change of Character (CHoCH / MSS)", family: "Market Structure", minBars: 60,
    rules: "After two descending swing highs (bearish structure) the last bar closes above the latest swing high (BUY); after two ascending swing lows it closes below the latest swing low (SELL). SL beyond the latest opposite swing, TP 2R.",
    evaluate: ({ bars, last, n }) => {
      const { highs, lows } = swings(bars); const H = highs.slice(-2), L = lows.slice(-2); if (H.length < 2 || L.length < 2) return null;
      const [h1, h2] = H as [number, number], [l1, l2] = L as [number, number];
      if (bars[h2]!.h < bars[h1]!.h && last.c > bars[h2]!.h && bars[n - 1]!.c <= bars[h2]!.h) return { side: "buy", sl: bars[l2]!.l, reason: `CHoCH: broke lower-high ${bars[h2]!.h}`, score: 2 };
      if (bars[l2]!.l > bars[l1]!.l && last.c < bars[l2]!.l && bars[n - 1]!.c >= bars[l2]!.l) return { side: "sell", sl: bars[h2]!.h, reason: `CHoCH: broke higher-low ${bars[l2]!.l}`, score: 2 };
      return null;
    } },
  { id: "double_pattern", name: "Double Bottom / Top", family: "Chart Patterns", minBars: 60,
    rules: "Two swing lows within 0.5×ATR of each other in the last 40 bars; the last bar closes above the neckline (highest high between them) (BUY); mirrored for double top (SELL). SL beyond the lower low −0.2×ATR, TP = pattern height, minimum 1.5R.",
    evaluate: ({ bars, last, n, a }) => {
      const { highs, lows } = swings(bars); const L = lows.filter((i) => i >= n - 40).slice(-2), H = highs.filter((i) => i >= n - 40).slice(-2);
      if (L.length === 2) { const [p, q] = L as [number, number]; const neck = hiOf(bars.slice(p, q + 1)), low = Math.min(bars[p]!.l, bars[q]!.l);
        if (Math.abs(bars[p]!.l - bars[q]!.l) <= 0.5 * a && last.c > neck && bars[n - 1]!.c <= neck) return { side: "buy", sl: low - 0.2 * a, tp: last.c + (neck - low), reason: `Double bottom neckline ${neck} broken`, score: 2 }; }
      if (H.length === 2) { const [p, q] = H as [number, number]; const neck = loOf(bars.slice(p, q + 1)), high = Math.max(bars[p]!.h, bars[q]!.h);
        if (Math.abs(bars[p]!.h - bars[q]!.h) <= 0.5 * a && last.c < neck && bars[n - 1]!.c >= neck) return { side: "sell", sl: high + 0.2 * a, tp: last.c - (high - neck), reason: `Double top neckline ${neck} broken`, score: 2 }; }
      return null;
    } },
  { id: "ichimoku", name: "Ichimoku Cloud Cross", family: "Ichimoku", minBars: 80,
    rules: "Tenkan(9) crosses Kijun(26) while price closes above the cloud (Senkou A/B projected 26 bars) (BUY); mirrored below the cloud (SELL). SL at Kijun ∓0.3×ATR, TP 2R.",
    evaluate: ({ bars, last, n, a }) => {
      const mid = (end: number, p: number) => { const w = bars.slice(end - p + 1, end + 1); return (hiOf(w) + loOf(w)) / 2; };
      const tk = (i: number) => mid(i, 9), kj = (i: number) => mid(i, 26);
      const c = n - 26, sa = (tk(c) + kj(c)) / 2, sb = mid(c, 52), top = Math.max(sa, sb), bot = Math.min(sa, sb);
      if (tk(n - 1) <= kj(n - 1) && tk(n) > kj(n) && last.c > top) return { side: "buy", sl: kj(n) - 0.3 * a, reason: "Tenkan crossed above Kijun above the cloud", score: 1.5 };
      if (tk(n - 1) >= kj(n - 1) && tk(n) < kj(n) && last.c < bot) return { side: "sell", sl: kj(n) + 0.3 * a, reason: "Tenkan crossed below Kijun below the cloud", score: 1.5 };
      return null;
    } },
];

export type StrategyId = string;
export type StrategySetting = StrategyId | "auto" | "manual";
export const STRATEGIES = DEFS.map(({ id, name, family, rules, minBars }) => ({ id, name, family, rules, minBars }));
export const STRATEGY_IDS = DEFS.map((d) => d.id);
export const isValidSetting = (s: string) => s === "auto" || s === "manual" || STRATEGY_IDS.includes(s);

/** Requested methodologies NOT yet implemented, with the honest reason. */
export const PLANNED: { name: string; why: string }[] = [
  { name: "VWAP / Volume Profile / Wyckoff", why: "Needs volume data; the Bridge currently sends price bars only." },
  { name: "London Breakout / Asian Range / New York Session / Kill Zones", why: "Needs verified broker server time-zone offset to map sessions correctly." },
  { name: "Elliott Wave / Harmonic Patterns", why: "Subjective wave/ratio counting; no objective rule set validated yet." },
  { name: "Fibonacci retracement entries", why: "Planned as a confluence filter on BOS/CHoCH swings." },
  { name: "Order / Breaker / Mitigation / Rejection Blocks, Supply & Demand zones", why: "Zone-tracking across sessions not yet built; FVG and liquidity sweeps cover part of SMC." },
  { name: "Head & Shoulders, Triple Tops/Bottoms, Wedges, Flags, Pennants, Triangles, Cup & Handle, Rounding Bottom, Channels, Trend Lines", why: "Need a geometric pattern detector; only double tops/bottoms are implemented." },
  { name: "Doji / Outside Bar / Scalping presets", why: "Not yet given standalone entry rules." },
];

export interface TradeIdea { strategy: StrategyId; side: Side; entry: number; sl: number; tp: number; key: string; reason: string }
export type Decision = { trade: TradeIdea; explanation: string } | { trade: null; reason: string };

const round = (v: number, digits: number) => Number(v.toFixed(digits));

function ctxOf(bars: Bar[]): Ctx | null {
  const n = bars.length - 1, a = atr(bars);
  if (!(a > 0)) return null;
  return { bars, closes: bars.map((b) => b.c), last: bars[n]!, prev: bars[n - 1]!, n, a };
}

/** Validates the candidate's stop/target; returns a finished idea or null. */
function finalize(def: StrategyDef, c: Candidate, ctx: Ctx, symbol: string, tf: string, digits: number): TradeIdea | null {
  const entry = ctx.last.c, d = c.side === "buy" ? 1 : -1, risk = (entry - c.sl) * d;
  if (!(risk > 0) || risk > MAX_RISK_ATR * ctx.a) return null; // invalid or oversized invalidation
  let tp = c.tp ?? entry + d * 2 * risk;
  if ((tp - entry) * d < MIN_RR * risk) { if (c.tp != null) return null; tp = entry + d * MIN_RR * risk; }
  return { strategy: def.id, side: c.side, entry: round(entry, digits), sl: round(c.sl, digits), tp: round(tp, digits),
    key: `${def.id}:${symbol}:${tf}:${ctx.last.t}`, reason: c.reason };
}

export function evaluateStrategy(id: StrategyId, bars: Bar[], symbol: string, tf: string, digits: number): TradeIdea | null {
  const def = DEFS.find((d) => d.id === id); if (!def || bars.length < Math.max(MIN_BARS, def.minBars)) return null;
  const ctx = ctxOf(bars); if (!ctx) return null;
  const c = def.evaluate(ctx); return c ? finalize(def, c, ctx, symbol, tf, digits) : null;
}

export const isGold = (symbol: string) => /XAU|GOLD/i.test(symbol);

/** Evaluates implemented strategies and selects at most ONE eligible idea; otherwise NO TRADE.
 *  Auto: highest confluence score wins; conflicting directions across strategies → NO TRADE. */
export function decide(setting: StrategySetting, bars: Bar[], symbol: string, tf: string, digits: number): Decision {
  if (setting === "manual") return { trade: null, reason: "NO TRADE: manual mode (strategy engine off)" };
  if (bars.length < MIN_BARS) return { trade: null, reason: `NO TRADE: need ${MIN_BARS} closed bars, received ${bars.length}` };
  if (!isValidSetting(setting)) return { trade: null, reason: `NO TRADE: strategy "${setting}" is not implemented` };
  const ctx = ctxOf(bars); if (!ctx) return { trade: null, reason: "NO TRADE: zero volatility in bar data" };
  const defs = setting === "auto" ? DEFS : DEFS.filter((d) => d.id === setting);
  const found: { def: StrategyDef; idea: TradeIdea; score: number }[] = [];
  for (const def of defs) {
    if (bars.length < def.minBars) continue;
    const c = def.evaluate(ctx); if (!c) continue;
    const idea = finalize(def, c, ctx, symbol, tf, digits); if (idea) found.push({ def, idea, score: c.score });
  }
  if (!found.length) return { trade: null, reason: `NO TRADE: none of ${defs.length} strateg${defs.length === 1 ? "y" : "ies"} met entry and risk conditions` };
  const sides = new Set(found.map((f) => f.idea.side));
  if (sides.size > 1) return { trade: null, reason: `NO TRADE: conflicting signals (${found.map((f) => `${f.def.id} ${f.idea.side}`).join(", ")})` };
  found.sort((x, y) => y.score - x.score);
  const pick = found[0]!;
  const others = found.slice(1).map((f) => f.def.name);
  const explanation = `Selected ${pick.def.name} (score ${pick.score}) — ${pick.idea.reason}.` +
    (others.length ? ` Also aligned: ${others.join(", ")}.` : " No other strategy qualified.") +
    (isGold(symbol) ? " GOLD symbol: spread and lot limits are enforced by the Bridge." : "");
  return { trade: pick.idea, explanation };
}

/** Parses "t,o,h,l,c;..." (oldest first). Returns null on any malformed value. */
export function parseBars(raw: string): Bar[] | null {
  if (!raw) return [];
  const out: Bar[] = [];
  for (const row of raw.split(";").slice(0, 300)) {
    const p = row.split(",").map(Number);
    if (p.length !== 5 || p.some((x) => !Number.isFinite(x))) return null;
    const [t, o, h, l, c] = p as [number, number, number, number, number];
    if (h < l || c <= 0) return null;
    out.push({ t, o, h, l, c });
  }
  for (let i = 1; i < out.length; i++) if (out[i]!.t <= out[i - 1]!.t) return null;
  return out;
}
