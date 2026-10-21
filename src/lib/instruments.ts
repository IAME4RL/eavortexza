export const INSTRUMENTS = [
  "GOLD", "XAUUSD", "XAU/USD", "GOLDUSD", "EURUSD", "GBPUSD", "USDJPY", "GBPJPY",
  "AUDUSD", "USDCHF", "USDCAD", "NAS100", "US30", "BTCUSD",
] as const;
export type Instrument = (typeof INSTRUMENTS)[number];

export const TIMEFRAMES = [
  { value: "M1", label: "1 minute" },
  { value: "M5", label: "5 minutes" },
  { value: "M15", label: "15 minutes" },
  { value: "M30", label: "30 minutes" },
  { value: "H1", label: "1 hour" },
  { value: "H4", label: "4 hours" },
  { value: "D1", label: "Daily" },
] as const;
export type Timeframe = (typeof TIMEFRAMES)[number]["value"];

export const STYLES = [
  { value: "scalping", label: "Scalping" },
  { value: "day", label: "Day Trading" },
  { value: "swing", label: "Swing Trading" },
] as const;
export type TradingStyle = (typeof STYLES)[number]["value"];

const ALIAS_GROUPS: string[][] = [
  ["GOLD", "XAUUSD", "XAU/USD", "GOLDUSD", "XAUUSDM", "XAUUSD.", "GOLD.", "XAU"],
  ["NAS100", "US100", "USTEC", "NDX", "NASDAQ"],
  ["US30", "DJ30", "DJI", "WS30", "DOW"],
  ["BTCUSD", "BTC/USD", "BTCUSDT", "XBTUSD", "BITCOIN"],
];

/** Normalise a broker symbol: uppercase, strip separators and common suffixes (e.g. "XAUUSD.m", "EURUSD-pro"). */
export function normalizeSymbol(raw: string): string {
  let s = raw.toUpperCase().trim().replace(/[\s/._\-#]/g, "");
  s = s.replace(/(PRO|ECN|RAW|MICRO|MINI|M|C|I|Z|PLUS)$/,(m)=> (s.length - m.length >= 5 ? "" : m));
  return s;
}

/** Canonical key used to compare instruments: every gold variation maps to "XAUUSD". */
export function canonicalInstrument(raw: string): string {
  const n = normalizeSymbol(raw);
  for (const group of ALIAS_GROUPS) {
    if (group.some((a) => normalizeSymbol(a) === n)) return normalizeSymbol(group[1]);
  }
  return n;
}

export function isGold(raw: string) {
  return canonicalInstrument(raw) === "XAUUSD";
}

/** True when a symbol visible on the chart clearly differs from the user's selection. */
export function symbolConflicts(selected: string, detected: string | null | undefined): boolean {
  if (!detected || !detected.trim()) return false;
  return canonicalInstrument(selected) !== canonicalInstrument(detected);
}

export function timeframeLabel(v: string) {
  return TIMEFRAMES.find((t) => t.value === v)?.label ?? v;
}
export function styleLabel(v: string) {
  return STYLES.find((t) => t.value === v)?.label ?? v;
}

export const ALLOWED_MIME = ["image/png", "image/jpeg", "image/jpg"];
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
