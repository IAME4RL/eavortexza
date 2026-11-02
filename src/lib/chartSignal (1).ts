import { symbolConflicts } from "./instruments";

/**
 * Turns the AI's reading of an uploaded chart into a signal — but only if every number can be
 * traced to the chart itself. The model reports the price range it can read off the axis; any
 * level outside that range, on the wrong side of entry, or not backed by evidence is thrown away
 * and the result becomes NO TRADE. Nothing here can create a level the chart did not show.
 */
export interface ChartSignal {
  action: "BUY" | "SELL" | "NO_TRADE";
  entry: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  rr: number | null;
  basis: string;
  evidence: string[];
  /** Why the result is NO TRADE (null for BUY/SELL). */
  reason: string | null;
}

export interface ChartSignalInput {
  signal: unknown;
  axis: unknown;
  imageQuality: unknown;
  symbolDetected: string | null | undefined;
  selectedInstrument: string;
}

/** Levels may sit at most this far (fraction of the visible price range) outside the visible axis. */
export const AXIS_PAD = 0.1;
/** Entry must be within this fraction of the visible range from the last visible price. */
export const ENTRY_NEAR_LAST = 0.1;
/** Stop must be at least this fraction of the visible range away from entry (no absurd stops). */
export const MIN_RISK_FRACTION = 0.01;
export const MIN_RR = 1;

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const num = (v: unknown): number | null => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

function noTrade(reason: string, basis = ""): ChartSignal {
  return { action: "NO_TRADE", entry: null, stop_loss: null, take_profit: null, rr: null, basis: basis || reason, evidence: [], reason };
}

export function validateChartSignal(i: ChartSignalInput): ChartSignal {
  const s = rec(i.signal);
  const basis = str(s["basis"]);
  const action = str(s["action"]).toUpperCase().replace(/[\s-]/g, "_");

  if (i.imageQuality === "unreadable") return noTrade("The image could not be read as a trading chart.", basis);
  if (symbolConflicts(i.selectedInstrument, i.symbolDetected)) {
    return noTrade(`The chart shows ${i.symbolDetected} but you selected ${i.selectedInstrument}. Upload the matching chart or change the symbol.`);
  }
  if (action !== "BUY" && action !== "SELL") {
    return noTrade(basis || "The chart does not show a clear, supported setup.", basis);
  }

  const axis = rec(i.axis);
  const lo = num(axis["min_visible"]);
  const hi = num(axis["max_visible"]);
  const last = num(axis["last_price"]);
  if (axis["legible"] !== true || lo === null || hi === null || last === null || !(hi > lo)) {
    return noTrade("The price scale on the chart is not legible, so exact levels cannot be read from it.");
  }
  const range = hi - lo;
  const pad = range * AXIS_PAD;

  const entry = num(s["entry"]);
  const sl = num(s["stop_loss"]);
  const tp = num(s["take_profit"]);
  if (entry === null || sl === null || tp === null || entry <= 0 || sl <= 0 || tp <= 0) {
    return noTrade("The chart does not give a complete entry, stop-loss and take-profit.");
  }
  for (const [name, v] of [["Entry", entry], ["Stop loss", sl], ["Take profit", tp]] as const) {
    if (v < lo - pad || v > hi + pad) return noTrade(`${name} (${v}) is outside the price range visible on your chart (${lo}–${hi}), so it was rejected.`);
  }
  if (Math.abs(entry - last) > range * ENTRY_NEAR_LAST) {
    return noTrade(`Entry (${entry}) is not near the latest visible price (${last}).`);
  }
  const ordered = action === "BUY" ? sl < entry && entry < tp : tp < entry && entry < sl;
  if (!ordered) return noTrade(`Stop loss and take profit are on the wrong sides of entry for a ${action}.`);

  const risk = Math.abs(entry - sl);
  const reward = Math.abs(tp - entry);
  if (risk < range * MIN_RISK_FRACTION) return noTrade("Stop loss is unrealistically close to entry.");
  const rr = reward / risk;
  if (rr < MIN_RR) return noTrade(`Reward-to-risk is only 1:${rr.toFixed(2)}, below the 1:${MIN_RR} minimum.`);

  const evidence = (Array.isArray(s["evidence"]) ? s["evidence"] : []).map(str).filter(Boolean).slice(0, 5);
  if (evidence.length < 2) return noTrade("The setup is not backed by enough visible evidence on the chart.");

  return { action, entry, stop_loss: sl, take_profit: tp, rr: Math.round(rr * 100) / 100, basis, evidence, reason: null };
}
