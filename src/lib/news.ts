import type { Bar, Side } from "./strategy";

/** Economic-calendar event from ForexFactory feed. */
export interface NewsEvent {
  title: string;
  country: string; // e.g. USD, EUR, GBP
  time: number; // ms epoch
  impact: "High" | "Medium" | "Low" | "Holiday" | string;
  forecast: string;
  previous: string;
}

export interface NewsBias {
  side: Side | null;
  headline: string;
  reason: string;
}

export interface NewsTrade {
  side: Side;
  entry: number;
  sl: number;
  tp: [number, number, number];
  rangeHigh: number;
  rangeLow: number;
  at: number;
  confidence: "high" | "medium";
  reason: string;
}

export type NewsReaction =
  | { state: "upcoming" }
  | { state: "forming"; reason: string }
  | { state: "waiting"; reason: string; rangeHigh: number; rangeLow: number }
  | { state: "signal"; trade: NewsTrade }
  | { state: "expired"; reason: string };

/** News where a HIGHER number is BAD for the currency (e.g. unemployment, jobless claims). */
const INVERSE = [/unemployment/i, /jobless/i, /claims/i, /trade deficit/i];

export function parseNum(raw: string): number | null {
  const m = raw.trim().match(/^(-?\d+(?:\.\d+)?)\s*([KMBT%])?/i);
  if (!m) return null;
  const n = Number(m[1]);
  const mult: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };
  return n * (mult[(m[2] ?? "").toUpperCase()] ?? 1);
}

/** Currencies that move an instrument (+1 lifts price, -1 drops price). */
export function exposure(instrument: string): Record<string, 1 | -1> {
  const i = instrument.toUpperCase();
  if (i === "XAUUSD" || i === "GOLD") return { USD: -1 }; // Gold trades inverse to USD
  if (/^[A-Z]{6}$/.test(i) && i !== "NAS100" && i !== "BTCUSD") {
    return { [i.slice(0, 3)]: 1, [i.slice(3)]: -1 };
  }
  return {};
}

export function isRelevant(e: NewsEvent, instrument: string): boolean {
  return (e.impact === "High" || e.impact === "Medium") && e.country in exposure(instrument);
}

/** Analyzes forecast vs previous numbers to determine BUY or SELL forecast signal. */
export function forecastBias(e: NewsEvent, instrument: string): NewsBias {
  const dir = exposure(instrument)[e.country];
  if (!dir) {
    return { side: null, headline: "NEUTRAL", reason: `${e.country} news has no direct correlation with ${instrument}.` };
  }
  const f = parseNum(e.forecast);
  const p = parseNum(e.previous);

  if (f === null || p === null) {
    return {
      side: null,
      headline: "PENDING DATA",
      reason: "Forecast or previous numbers not provided by broker calendar. Awaiting live release.",
    };
  }
  if (f === p) {
    return {
      side: null,
      headline: "NEUTRAL",
      reason: `Forecast (${e.forecast}) equals previous (${e.previous}). No significant shift expected unless actual data surprises.`,
    };
  }

  const isInverse = INVERSE.some((r) => r.test(e.title));
  const currencyBullish = isInverse ? f < p : f > p;
  const side: Side = (currencyBullish ? 1 : -1) * dir > 0 ? "buy" : "sell";

  const targetName = instrument.toUpperCase() === "XAUUSD" ? "GOLD" : instrument;
  const currencyOutcome = currencyBullish ? "stronger" : "weaker";

  let explanation = "";
  if (targetName === "GOLD") {
    explanation = currencyBullish
      ? `Forecast (${e.forecast}) vs previous (${e.previous}) expects a STRONGER US Dollar. A stronger USD pushes Gold down → Forecast is SELL.`
      : `Forecast (${e.forecast}) vs previous (${e.previous}) expects a WEAKER US Dollar. A weaker USD lifts Gold prices up → Forecast is BUY.`;
  } else {
    explanation = `Forecast (${e.forecast} vs prev ${e.previous}) expects ${e.country} to be ${currencyOutcome}, pointing ${targetName} ${side.toUpperCase()}.`;
  }

  return {
    side,
    headline: side === "buy" ? "FORECAST BUY" : "FORECAST SELL",
    reason: explanation,
  };
}

const BAR = 5 * 60_000;
const RANGE_BARS = 3;
const WINDOW = 2 * 60 * 60_000;
const round = (n: number, d: number) => Number(n.toFixed(d));

/** Live breakout tracking after release. */
export function newsReaction(e: NewsEvent, bars: Bar[], bias: NewsBias, digits: number, now = Date.now()): NewsReaction {
  if (now < e.time) return { state: "upcoming" };
  const after = bars.filter((b) => b.t >= e.time - 1000 && b.t + BAR <= now);
  if (after.length < RANGE_BARS) return { state: "forming", reason: "Measuring initial 15-minute price impulse." };
  const range = after.slice(0, RANGE_BARS);
  if (range[0]!.t - e.time > BAR) return { state: "expired", reason: "No price feed recorded at event time." };
  const hi = Math.max(...range.map((b) => b.h));
  const lo = Math.min(...range.map((b) => b.l));
  const impulse: Side = range[RANGE_BARS - 1]!.c >= range[0]!.o ? "buy" : "sell";

  for (const b of after.slice(RANGE_BARS)) {
    if (b.t - e.time > WINDOW) break;
    const side: Side | null = b.c > hi ? "buy" : b.c < lo ? "sell" : null;
    if (!side) continue;
    if (side !== impulse) return { state: "expired", reason: "Broke opposite to initial impulse (fake-out risk)." };
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
        reason: `M5 candle closed ${side === "buy" ? "above" : "below"} the news range in direction of initial impulse.${
          bias.side ? (agrees ? " Matches forecast prediction." : " Market reacted against forecast (surprise).") : ""
        }`,
      },
    };
  }
  const last = after[after.length - 1]!;
  if (last.t - e.time > WINDOW) return { state: "expired", reason: "No breakout within 2 hours." };
  return { state: "waiting", reason: "Waiting for M5 close outside the news range.", rangeHigh: round(hi, digits), rangeLow: round(lo, digits) };
}

export function parseFeed(json: unknown): NewsEvent[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((r) => {
    const t = Date.parse(String(r?.date ?? ""));
    if (!Number.isFinite(t) || typeof r?.title !== "string") return [];
    return [{
      title: r.title,
      country: String(r.country ?? ""),
      time: t,
      impact: String(r.impact ?? ""),
      forecast: String(r.forecast ?? ""),
      previous: String(r.previous ?? "")
    }];
  });
}
