import type { Bar, Side } from "./strategy";

/** Economic-calendar event as published by the free ForexFactory weekly feed. */
export interface NewsEvent {
  title: string;
  country: string; // currency code, e.g. USD
  time: number; // ms epoch
  impact: "High" | "Medium" | "Low" | "Holiday" | string;
  forecast: string;
  previous: string;
}

export interface NewsBias {
  side: Side | null;
  reason: string;
}

export interface NewsTrade {
  side: Side;
  entry: number;
  sl: number;
  tp: [number, number, number];
  rangeHigh: number;
  rangeLow: number;
  at: number; // breakout bar close time
  confidence: "high" | "medium";
  reason: string;
}

export type NewsReaction =
  | { state: "upcoming" }
  | { state: "forming"; reason: string }
  | { state: "waiting"; reason: string; rangeHigh: number; rangeLow: number }
  | { state: "signal"; trade: NewsTrade }
  | { state: "expired"; reason: string };

/** Releases where a HIGHER number is BAD for the currency. */
const INVERSE = [/unemployment/i, /jobless/i, /claims/i, /trade deficit/i];

export function parseNum(raw: string): number | null {
  const m = raw.trim().match(/^(-?\d+(?:\.\d+)?)\s*([KMBT%])?/i);
  if (!m) return null;
  const n = Number(m[1]);
  const mult: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };
  return n * (mult[(m[2] ?? "").toUpperCase()] ?? 1);
}

/** Currencies that move an instrument, with +1 when strength lifts the price and -1 when it drops it. */
export function exposure(instrument: string): Record<string, 1 | -1> {
  const i = instrument.toUpperCase();
  if (i === "XAUUSD" || i === "GOLD") return { USD: -1 }; // gold is priced in dollars and trades inverse to USD
  if (/^[A-Z]{6}$/.test(i) && i !== "NAS100" && i !== "BTCUSD") return { [i.slice(0, 3)]: 1, [i.slice(3)]: -1 };
  return {};
}

export function isRelevant(e: NewsEvent, instrument: string): boolean {
  return (e.impact === "High" || e.impact === "Medium") && e.country in exposure(instrument);
}

/** Forecast-vs-previous fundamental bias. It is an expectation, not a released result. */
export function forecastBias(e: NewsEvent, instrument: string): NewsBias {
  const dir = exposure(instrument)[e.country];
  if (!dir) return { side: null, reason: `${e.country} news has no direct effect on ${instrument}.` };
  const f = parseNum(e.forecast), p = parseNum(e.previous);
  if (f === null || p === null) return { side: null, reason: "No forecast/previous figures — wait for the price reaction." };
  if (f === p) return { side: null, reason: `Forecast equals previous (${e.forecast}) — no expected bias.` };
  const better = (f > p) !== INVERSE.some((r) => r.test(e.title));
  const side: Side = (better ? 1 : -1) * dir > 0 ? "buy" : "sell";
  return {
    side,
    reason: `Forecast ${e.forecast} vs previous ${e.previous} → ${e.country} expected ${better ? "stronger" : "weaker"}, which points ${instrument} ${side === "buy" ? "up" : "down"}.`,
  };
}

const BAR = 5 * 60_000;
const RANGE_BARS = 3; // first 15 minutes after release define the news range
const WINDOW = 2 * 60 * 60_000; // breakout must happen within 2 hours

const round = (n: number, d: number) => Number(n.toFixed(d));

/** News Range Breakout on closed M5 bars:
 *  1. The first 15 minutes after the release form the range.
 *  2. A later M5 bar must CLOSE beyond the range in the direction of the initial impulse.
 *  3. SL at the opposite range edge, TP1/2/3 at 1R/2R/3R. */
export function newsReaction(e: NewsEvent, bars: Bar[], bias: NewsBias, digits: number, now = Date.now()): NewsReaction {
  if (now < e.time) return { state: "upcoming" };
  const after = bars.filter((b) => b.t >= e.time - 1000 && b.t + BAR <= now);
  if (after.length < RANGE_BARS) return { state: "forming", reason: "Measuring the first 15 minutes of price reaction." };
  const range = after.slice(0, RANGE_BARS);
  if (range[0]!.t - e.time > BAR) return { state: "expired", reason: "No price data at the release time (market closed or feed gap)." };
  const hi = Math.max(...range.map((b) => b.h));
  const lo = Math.min(...range.map((b) => b.l));
  const impulse: Side = range[RANGE_BARS - 1]!.c >= range[0]!.o ? "buy" : "sell";

  for (const b of after.slice(RANGE_BARS)) {
    if (b.t - e.time > WINDOW) break;
    const side: Side | null = b.c > hi ? "buy" : b.c < lo ? "sell" : null;
    if (!side) continue;
    if (side !== impulse) return { state: "expired", reason: "Price broke the range against the initial news impulse — no trade (fake-out risk)." };
    const entry = b.c;
    const sl = side === "buy" ? lo : hi;
    const r = Math.abs(entry - sl);
    const k = side === "buy" ? 1 : -1;
    const agrees = bias.side === side;
    return {
      state: "signal",
      trade: {
        side,
        entry: round(entry, digits),
        sl: round(sl, digits),
        tp: [round(entry + k * r, digits), round(entry + k * 2 * r, digits), round(entry + k * 3 * r, digits)],
        rangeHigh: round(hi, digits),
        rangeLow: round(lo, digits),
        at: b.t + BAR,
        confidence: agrees ? "high" : "medium",
        reason: `News Range Breakout: a 5-minute candle closed ${side === "buy" ? "above" : "below"} the 15-minute post-release range in the direction of the initial impulse.${
          bias.side ? (agrees ? " Agrees with the forecast bias." : " Goes against the forecast bias — the market is reacting to a surprise.") : ""
        }`,
      },
    };
  }
  const last = after[after.length - 1]!;
  if (last.t - e.time > WINDOW) return { state: "expired", reason: "No breakout within 2 hours of the release — the news setup has expired." };
  return { state: "waiting", reason: "Waiting for a 5-minute close outside the news range.", rangeHigh: round(hi, digits), rangeLow: round(lo, digits) };
}

export function parseFeed(json: unknown): NewsEvent[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((r) => {
    const t = Date.parse(String(r?.date ?? ""));
    if (!Number.isFinite(t) || typeof r?.title !== "string") return [];
    return [{ title: r.title, country: String(r.country ?? ""), time: t, impact: String(r.impact ?? ""), forecast: String(r.forecast ?? ""), previous: String(r.previous ?? "") }];
  });
}
