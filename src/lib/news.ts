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

// ---------------------------------------------------------------------------
// Eulerpool economic-calendar adapter. The response format is not strictly documented,
// so this accepts common field names and shapes and normalises them to NewsEvent.
// ---------------------------------------------------------------------------

const COUNTRY_TO_CCY: Record<string, string> = {
  US: "USD", USA: "USD", "UNITED STATES": "USD",
  EU: "EUR", EA: "EUR", EMU: "EUR", EZ: "EUR", DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR",
  "EURO AREA": "EUR", EUROZONE: "EUR", EUROPE: "EUR", GERMANY: "EUR", FRANCE: "EUR", ITALY: "EUR", SPAIN: "EUR",
  GB: "GBP", UK: "GBP", "UNITED KINGDOM": "GBP",
  JP: "JPY", JAPAN: "JPY",
  CA: "CAD", CANADA: "CAD",
  AU: "AUD", AUSTRALIA: "AUD",
  NZ: "NZD", "NEW ZEALAND": "NZD",
  CH: "CHF", SWITZERLAND: "CHF",
  CN: "CNY", CHINA: "CNY",
};

function pick(r: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    const v = r[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

function findArray(json: unknown, depth = 0): unknown[] | null {
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object" && depth < 3) {
    for (const v of Object.values(json as Record<string, unknown>)) {
      const found = findArray(v, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function toCurrency(r: Record<string, unknown>): string {
  const ccy = pick(r, ["currency", "currency_code", "currencyCode"]);
  if (typeof ccy === "string" && /^[A-Za-z]{3}$/.test(ccy)) return ccy.toUpperCase();
  const c = pick(r, ["country", "country_code", "countryCode", "region", "area"]);
  if (typeof c !== "string") return "";
  const key = c.trim().toUpperCase();
  return COUNTRY_TO_CCY[key] ?? (/^[A-Z]{3}$/.test(key) && key !== "USA" ? key : "");
}

function toImpact(v: unknown): string {
  if (typeof v === "number") return v >= 3 ? "High" : v === 2 ? "Medium" : "Low";
  const s = String(v ?? "").trim().toLowerCase();
  if (["high", "3", "red", "h"].includes(s)) return "High";
  if (["medium", "moderate", "2", "orange", "m"].includes(s)) return "Medium";
  return "Low";
}

function toTime(v: unknown): number {
  if (typeof v === "number") return v < 1e12 ? v * 1000 : v;
  if (typeof v !== "string") return NaN;
  const s = v.trim();
  if (/^\d+$/.test(s)) return toTime(Number(s));
  // No timezone in the string: treat as UTC.
  const withZone = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(s) ? s.replace(" ", "T") + "Z" : s;
  return Date.parse(withZone);
}

function toFigure(v: unknown, unit: unknown): string {
  if (v === undefined || v === null || v === "") return "";
  const s = String(v);
  if (typeof v === "number" && typeof unit === "string" && /^(%|K|M|B|T)$/i.test(unit.trim())) return s + unit.trim();
  return s;
}

/** Short description of the response shape, used in on-screen diagnostics. */
export function describeShape(json: unknown): string {
  const arr = findArray(json);
  if (!arr) return `no list found; top-level: ${json && typeof json === "object" ? Object.keys(json as object).slice(0, 6).join(",") : typeof json}`;
  const first = arr[0];
  return `${arr.length} items; fields: ${first && typeof first === "object" ? Object.keys(first as object).slice(0, 10).join(",") : typeof first}`;
}

export function parseEulerpool(json: unknown): NewsEvent[] {
  const arr = findArray(json);
  if (!arr) return [];
  return arr.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const r = raw as Record<string, unknown>;
    const title = pick(r, ["event", "title", "name", "indicator", "category"]);
    let when = pick(r, ["datetime", "dateTime", "timestamp", "date", "release_date", "released", "scheduled", "time"]);
    // Some feeds give a date-only value plus a separate time of day: combine them (assumed UTC).
    const clock = pick(r, ["time", "release_time", "hour"]);
    if (typeof when === "string" && /^\d{4}-\d{2}-\d{2}$/.test(when.trim()) && typeof clock === "string" && /^\d{1,2}:\d{2}/.test(clock.trim())) {
      const [h, m] = clock.trim().split(":");
      when = `${when.trim()}T${h!.padStart(2, "0")}:${m!.slice(0, 2)}:00Z`;
    }
    const time = toTime(when);
    const country = toCurrency(r);
    if (typeof title !== "string" || !Number.isFinite(time) || !country) return [];
    const unit = pick(r, ["unit", "units"]);
    return [{
      title,
      country,
      time,
      impact: toImpact(pick(r, ["impact", "importance", "volatility", "priority"])),
      forecast: toFigure(pick(r, ["forecast", "consensus", "estimate", "expected"]), unit),
      previous: toFigure(pick(r, ["previous", "prior", "last"]), unit),
    }];
  });
}
