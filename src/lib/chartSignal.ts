import { symbolConflicts } from "./instruments";

/**
 * Builds the signal for an uploaded chart. Every scan returns a BUY or SELL with a confidence
 * rating — never "no trade". What stays strict is where the numbers come from:
 *  - Exact entry / stop-loss / take-profit are shown only if they trace to the price range the AI
 *    read off the chart's own axis. Otherwise the signal shows approximate zones in words instead,
 *    and confidence is capped low. Nothing here can create a price the chart did not show.
 *  - Confidence starts from the AI's own estimate but is capped by objective checks (legible
 *    price scale, level validity, evidence, image quality, symbol match, reward-to-risk).
 */
export type ConfidenceLevel = "Low" | "Medium" | "High";

export interface Confidence {
  /** 0–100. How clear and well-supported the chart reading is — NOT a probability of profit. */
  score: number;
  level: ConfidenceLevel;
  summary: string;
  /** Objective reasons the score was held down. */
  limits: string[];
  /** Things that could make the signal fail. */
  risks: string[];
}

export interface ChartSignal {
  action: "BUY" | "SELL";
  /** "exact" = numbers verified against the chart axis; "approximate" = zones described in words. */
  levels: "exact" | "approximate";
  entry: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  rr: number | null;
  zones: { entry: string; stop_loss: string; take_profit: string };
  basis: string;
  evidence: string[];
  warnings: string[];
  confidence: Confidence;
}

export interface ChartSignalInput {
  signal: unknown;
  axis: unknown;
  imageQuality: unknown;
  symbolDetected: string | null | undefined;
  selectedInstrument: string;
  bias?: unknown;
  trendDirection?: unknown;
}

/** Levels may sit at most this far (fraction of the visible range) outside the visible axis. */
export const AXIS_PAD = 0.1;
/** Entry must be within this fraction of the visible range from the last visible price. */
export const ENTRY_NEAR_LAST = 0.1;
/** Stop must be at least this fraction of the visible range away from entry. */
export const MIN_RISK_FRACTION = 0.01;

export const CONFIDENCE_LOW_BELOW = 40;
export const CONFIDENCE_HIGH_FROM = 70;

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const num = (v: unknown): number | null => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const strs = (v: unknown, max: number): string[] => (Array.isArray(v) ? v : []).map(str).filter(Boolean).slice(0, max);

export function confidenceLevel(score: number): ConfidenceLevel {
  return score < CONFIDENCE_LOW_BELOW ? "Low" : score < CONFIDENCE_HIGH_FROM ? "Medium" : "High";
}

/** True when the image is not a readable trading chart — the one case where no signal can exist. */
export function isUnreadable(imageQuality: unknown): boolean {
  return imageQuality === "unreadable";
}

function pickAction(i: ChartSignalInput, axis: Record<string, unknown>): { action: "BUY" | "SELL"; note: string | null; cap: number | null } | null {
  const a = str(rec(i.signal)["action"]).toUpperCase();
  if (a === "BUY" || a === "LONG") return { action: "BUY", note: null, cap: null };
  if (a === "SELL" || a === "SHORT") return { action: "SELL", note: null, cap: null };
  const bias = str(i.bias).toLowerCase();
  if (bias === "bullish") return { action: "BUY", note: "Direction taken from the chart's overall bullish bias.", cap: 40 };
  if (bias === "bearish") return { action: "SELL", note: "Direction taken from the chart's overall bearish bias.", cap: 40 };
  const trend = str(i.trendDirection).toLowerCase();
  if (trend === "uptrend") return { action: "BUY", note: "Direction taken from the visible uptrend.", cap: 40 };
  if (trend === "downtrend") return { action: "SELL", note: "Direction taken from the visible downtrend.", cap: 40 };
  const lo = num(axis["min_visible"]);
  const hi = num(axis["max_visible"]);
  const last = num(axis["last_price"]);
  if (axis["legible"] === true && lo !== null && hi !== null && last !== null && hi > lo) {
    return last < (lo + hi) / 2
      ? { action: "BUY", note: "No clear trend: leaning BUY because price sits in the lower half of the visible range.", cap: 25 }
      : { action: "SELL", note: "No clear trend: leaning SELL because price sits in the upper half of the visible range.", cap: 25 };
  }
  return null;
}

export function buildChartSignal(i: ChartSignalInput): ChartSignal | null {
  if (isUnreadable(i.imageQuality)) return null;
  const s = rec(i.signal);
  const axis = rec(i.axis);
  const picked = pickAction(i, axis);
  if (!picked) return null;
  const { action } = picked;

  const warnings: string[] = [];
  const caps: { cap: number; reason: string }[] = [];
  if (picked.note && picked.cap !== null) {
    warnings.push(picked.note);
    caps.push({ cap: picked.cap, reason: "The chart gave no explicit direction." });
  }

  if (i.imageQuality === "limited") caps.push({ cap: 60, reason: "Image quality is limited." });
  if (symbolConflicts(i.selectedInstrument, i.symbolDetected)) {
    warnings.push(`This chart shows ${i.symbolDetected} but you selected ${i.selectedInstrument}. The signal is for the chart you uploaded.`);
    caps.push({ cap: 30, reason: "The chart's symbol does not match your selection." });
  }

  const evidence = strs(s["evidence"], 5);
  if (evidence.length < 2) caps.push({ cap: 40, reason: "Very little visible evidence supports this signal." });
  else if (evidence.length < 3) caps.push({ cap: 70, reason: "Only a couple of visible observations support this signal." });

  // ---- levels: exact only if every number traces to the chart's own price axis
  const lo = num(axis["min_visible"]);
  const hi = num(axis["max_visible"]);
  const last = num(axis["last_price"]);
  const entry = num(s["entry"]);
  const sl = num(s["stop_loss"]);
  const tp = num(s["take_profit"]);
  let levelProblem: string | null = null;
  let rr: number | null = null;

  if (axis["legible"] !== true || lo === null || hi === null || last === null || !(hi > lo)) {
    levelProblem = "The price scale on the chart is not legible, so exact prices cannot be read from it.";
  } else if (entry === null || sl === null || tp === null || entry <= 0 || sl <= 0 || tp <= 0) {
    levelProblem = "The chart did not give a complete entry, stop-loss and take-profit.";
  } else {
    const range = hi - lo;
    const pad = range * AXIS_PAD;
    const outside = ([["Entry", entry], ["Stop loss", sl], ["Take profit", tp]] as const).find(([, v]) => v < lo - pad || v > hi + pad);
    if (outside) levelProblem = `${outside[0]} (${outside[1]}) was outside the price range visible on your chart (${lo}–${hi}).`;
    else if (Math.abs(entry - last) > range * ENTRY_NEAR_LAST) levelProblem = `Entry (${entry}) was not near the latest visible price (${last}).`;
    else if (!(action === "BUY" ? sl < entry && entry < tp : tp < entry && entry < sl)) levelProblem = `Stop loss and take profit were on the wrong sides of entry for a ${action}.`;
    else if (Math.abs(entry - sl) < range * MIN_RISK_FRACTION) levelProblem = "Stop loss was unrealistically close to entry.";
    else rr = Math.round((Math.abs(tp - entry) / Math.abs(entry - sl)) * 100) / 100;
  }

  const exact = levelProblem === null && rr !== null;
  if (!exact && levelProblem) {
    warnings.push(`${levelProblem} Showing approximate zones instead of exact prices.`);
    caps.push({ cap: 35, reason: "Exact levels could not be verified against the chart." });
  }
  if (exact && rr !== null) {
    if (rr < 1) caps.push({ cap: 45, reason: `Reward-to-risk is only 1:${rr}.` });
    else if (rr < 1.5) caps.push({ cap: 65, reason: `Reward-to-risk is modest (1:${rr}).` });
  }

  // ---- confidence
  const modelScore = num(s["confidence_score"]);
  const base = Math.min(95, Math.max(5, Math.round(modelScore ?? 50)));
  const capped = caps.length ? Math.min(base, ...caps.map((c) => c.cap)) : base;
  const score = Math.max(5, capped);
  const level = confidenceLevel(score);
  const reasonText = str(s["confidence_reason"]);
  const summary = reasonText || (level === "High" ? "The chart is clear and the evidence lines up." : level === "Medium" ? "A reasonable setup, but some things are unclear." : "Weak or unclear evidence — treat this as a lean, not a conviction.");

  return {
    action,
    levels: exact ? "exact" : "approximate",
    entry: exact ? entry : null,
    stop_loss: exact ? sl : null,
    take_profit: exact ? tp : null,
    rr: exact ? rr : null,
    zones: { entry: str(s["entry_zone"]), stop_loss: str(s["stop_zone"]), take_profit: str(s["target_zone"]) },
    basis: str(s["basis"]),
    evidence,
    warnings,
    confidence: { score, level, summary, limits: caps.map((c) => c.reason), risks: strs(s["risks"], 4) },
  };
}
