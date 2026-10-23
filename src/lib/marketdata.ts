// EA VORTEX market-data layer — fetches REAL OHLC bars from Yahoo Finance's public chart
// endpoint (server-side only). No key is required. If the feed is unreachable, incomplete,
// out of order or stale, the caller gets a typed failure and NO analysis is produced —
// prices are never invented.
import { canonicalInstrument } from "./instruments";
import type { Bar } from "./strategy";

const H = 3600_000;
const D = 24 * H;

export interface FeedSpec { symbol: string; digits: number; staleMs: number }

/** Canonical instrument → Yahoo symbol, price precision and staleness tolerance.
 *  Forex/indices tolerate weekends (Fri close → Mon open); crypto trades 24/7. */
export const FEEDS: Record<string, FeedSpec> = {
  XAUUSD: { symbol: "XAUUSD=X", digits: 2, staleMs: 3 * D },
  EURUSD: { symbol: "EURUSD=X", digits: 5, staleMs: 3 * D },
  GBPUSD: { symbol: "GBPUSD=X", digits: 5, staleMs: 3 * D },
  USDJPY: { symbol: "USDJPY=X", digits: 3, staleMs: 3 * D },
  GBPJPY: { symbol: "GBPJPY=X", digits: 3, staleMs: 3 * D },
  AUDUSD: { symbol: "AUDUSD=X", digits: 5, staleMs: 3 * D },
  USDCHF: { symbol: "USDCHF=X", digits: 5, staleMs: 3 * D },
  USDCAD: { symbol: "USDCAD=X", digits: 5, staleMs: 3 * D },
  NAS100: { symbol: "^NDX", digits: 1, staleMs: 3 * D },
  US30: { symbol: "^DJI", digits: 1, staleMs: 3 * D },
  BTCUSD: { symbol: "BTC-USD", digits: 2, staleMs: 6 * H },
};

export const FEED_INSTRUMENTS = Object.keys(FEEDS);
export const feedFor = (raw: string): FeedSpec | null => FEEDS[canonicalInstrument(raw)] ?? null;

interface TfSpec { interval: string; range: string; ms: number; aggregate?: number }
const TF: Record<string, TfSpec> = {
  M1: { interval: "1m", range: "1d", ms: 60_000 },
  M5: { interval: "5m", range: "5d", ms: 5 * 60_000 },
  M15: { interval: "15m", range: "5d", ms: 15 * 60_000 },
  M30: { interval: "30m", range: "1mo", ms: 30 * 60_000 },
  H1: { interval: "60m", range: "1mo", ms: H },
  H4: { interval: "60m", range: "3mo", ms: 4 * H, aggregate: 4 },
  D1: { interval: "1d", range: "1y", ms: D },
};
export const FEED_TIMEFRAMES = Object.keys(TF);
export const timeframeMs = (tf: string): number => TF[tf]?.ms ?? H;

/** Higher timeframe used for multi-timeframe confirmation. */
export const HTF_OF: Record<string, string | null> = {
  M1: "M15", M5: "M15", M15: "H1", M30: "H1", H1: "H4", H4: "D1", D1: null,
};

export type FetchResult =
  | { ok: true; bars: Bar[]; source: string; digits: number; dataAt: number }
  | { ok: false; error: string };

function aggregate(bars: Bar[], n: number): Bar[] {
  const out: Bar[] = [];
  for (let i = 0; i + n <= bars.length; i += n) {
    const g = bars.slice(i, i + n);
    out.push({
      t: g[0]!.t, o: g[0]!.o,
      h: Math.max(...g.map((b) => b.h)),
      l: Math.min(...g.map((b) => b.l)),
      c: g[n - 1]!.c,
    });
  }
  return out;
}

/** Fetches and validates closed OHLC bars. Only fully closed bars are returned. */
export async function fetchBars(instrument: string, timeframe: string, now = Date.now()): Promise<FetchResult> {
  const feed = feedFor(instrument);
  if (!feed) return { ok: false, error: `No market-data feed is configured for ${instrument}.` };
  const tf = TF[timeframe];
  if (!tf) return { ok: false, error: `Unsupported timeframe ${timeframe}.` };

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(feed.symbol)}?interval=${tf.interval}&range=${tf.range}&includePrePost=false`;
  let json: unknown;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (EA VORTEX market data)", Accept: "application/json" },
    });
    if (!res.ok) return { ok: false, error: `Market-data source returned HTTP ${res.status} for ${feed.symbol}.` };
    json = await res.json();
  } catch {
    return { ok: false, error: "Could not reach the market-data source. Check the server connection and retry." };
  }

  const r = (json as { chart?: { result?: unknown[] } })?.chart?.result?.[0] as
    | { timestamp?: number[]; indicators?: { quote?: { open?: unknown[]; high?: unknown[]; low?: unknown[]; close?: unknown[] }[] } }
    | undefined;
  const ts = r?.timestamp;
  const q = r?.indicators?.quote?.[0];
  if (!ts?.length || !q) return { ok: false, error: `Market-data source returned no usable bars for ${feed.symbol}.` };

  const bars: Bar[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i];
    if ([o, h, l, c].some((v) => typeof v !== "number" || !Number.isFinite(v as number))) continue; // skip incomplete bars
    const b = { t: ts[i]! * 1000, o: o as number, h: h as number, l: l as number, c: c as number };
    if (b.h < b.l || b.c <= 0) continue; // contradictory bar
    bars.push(b);
  }
  for (let i = 1; i < bars.length; i++) {
    if (bars[i]!.t <= bars[i - 1]!.t) return { ok: false, error: "Market data arrived out of order; rejected." };
  }
  // Drop the still-forming bar: only closed bars may drive signals.
  while (bars.length && bars[bars.length - 1]!.t + tf.ms > now) bars.pop();

  const out = tf.aggregate ? aggregate(bars, tf.aggregate) : bars;
  if (out.length < 80) {
    return { ok: false, error: `Only ${out.length} closed bars available for ${instrument} ${timeframe}; at least 80 are required.` };
  }
  const lastT = out[out.length - 1]!.t;
  if (now - lastT > feed.staleMs + tf.ms) {
    return { ok: false, error: `Market data is stale (last closed bar ${new Date(lastT).toISOString()}). No signal can be generated.` };
  }
  return { ok: true, bars: out.slice(-400), source: `Yahoo Finance · ${feed.symbol} · ${tf.interval}`, digits: feed.digits, dataAt: lastT };
}
