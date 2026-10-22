// Pure helpers for the MT5 bridge protocol (shared by the server route, server functions and tests).

export type BotStatus = "running" | "paused" | "stopped";
export type TradingMode = "demo" | "live";
/** Account type exactly as MT5 reports ACCOUNT_TRADE_MODE. Anything else is unverified. */
export type TerminalType = "demo" | "real" | "contest" | "unknown";

export interface DeliveryInput {
  status: BotStatus;
  mode: TradingMode;
  liveConfirmed: boolean;
  terminalType: TerminalType;
  terminalLogin: string;
  accountLogin: string;
  terminalServer?: string;
  accountServer?: string;
  openTrades: number;
  maxOpenTrades: number;
  dayPL?: number | null;
  maxDailyLoss?: number;
}

const norm = (s: string | undefined) => (s ?? "").trim().toLowerCase();

/** Returns null when orders may be sent to the terminal, otherwise the reason they are held. */
export function holdReason(i: DeliveryInput): string | null {
  if (i.terminalLogin.trim() !== i.accountLogin.trim()) return "LOGIN_MISMATCH";
  if (i.accountServer !== undefined && norm(i.terminalServer) !== norm(i.accountServer)) return "SERVER_MISMATCH";
  if (i.status !== "running") return i.status === "paused" ? "PAUSED" : "STOPPED";
  if (i.terminalType !== "demo" && i.terminalType !== "real") return "ACCOUNT_TYPE_UNVERIFIED";
  if (i.mode === "demo" && i.terminalType === "real") return "LIVE_ACCOUNT_IN_DEMO_MODE";
  if (i.mode === "live" && i.terminalType === "demo") return "DEMO_ACCOUNT_IN_LIVE_MODE";
  if (i.mode === "live" && !i.liveConfirmed) return "LIVE_NOT_CONFIRMED";
  if (i.maxDailyLoss !== undefined) {
    if (i.dayPL == null || !Number.isFinite(i.dayPL)) return "DAILY_PL_UNVERIFIED";
    if (i.dayPL <= -i.maxDailyLoss) return "DAILY_LOSS_LIMIT";
  }
  if (i.openTrades >= i.maxOpenTrades) return "MAX_OPEN";
  return null;
}

export const HOLD_TEXT: Record<string, string> = {
  LOGIN_MISMATCH: "The MT5 terminal is logged into a different account than the one registered.",
  SERVER_MISMATCH: "The MT5 terminal is on a different broker server than the one registered.",
  PAUSED: "Bot is paused — no new orders.",
  STOPPED: "Bot is stopped — no new orders.",
  ACCOUNT_TYPE_UNVERIFIED: "MT5 did not report a demo or real account (e.g. contest). Orders are blocked.",
  LIVE_ACCOUNT_IN_DEMO_MODE: "A LIVE account is connected but the bot is in demo mode. Orders are blocked.",
  DEMO_ACCOUNT_IN_LIVE_MODE: "A DEMO account is connected but the bot is in live mode. Orders are blocked.",
  LIVE_NOT_CONFIRMED: "Live trading has not been confirmed.",
  DAILY_PL_UNVERIFIED: "The terminal did not report today's P/L, so the daily loss limit can't be checked.",
  DAILY_LOSS_LIMIT: "Daily loss limit reached — no new orders today.",
  MAX_OPEN: "Maximum open positions reached.",
};

export function terminalTypeOf(raw: unknown): TerminalType {
  return raw === "demo" || raw === "real" || raw === "contest" ? raw : "unknown";
}

/** How many queued signals can be delivered right now. */
export function deliverySlots(openTrades: number, maxOpenTrades: number): number {
  return Math.max(0, maxOpenTrades - openTrades);
}

export function volumeAllowed(volume: number, maxLot: number): boolean {
  return volume > 0 && volume <= maxLot;
}

export interface SignalLine {
  id: string; symbol: string; side: "buy" | "sell"; volume: number;
  stop_loss: number | null; take_profit: number | null;
}

/** One pipe-separated line per signal; MQL5 parses this with StringSplit. */
export function formatSignalLine(s: SignalLine): string {
  return ["SIG", s.id, s.symbol, s.side, s.volume, s.stop_loss ?? 0, s.take_profit ?? 0].join("|");
}

export interface BridgeConfig {
  status: BotStatus; mode: TradingMode; liveConfirmed: boolean; maxLot: number; maxOpen: number;
  riskPct: number; maxDailyLoss: number; strategy: string; hold: string | null;
}
/** First line of every bridge response: the terminal re-reads backend permissions each cycle. */
export function formatConfigLine(c: BridgeConfig): string {
  return ["CFG", c.status, c.mode, c.liveConfirmed ? 1 : 0, c.maxLot, c.maxOpen, c.riskPct, c.maxDailyLoss, c.strategy, c.hold ?? "NONE"].join("|");
}

export async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Terminal counts as online if it checked in within this window. */
export const HEARTBEAT_ONLINE_MS = 90_000;

export type ExecutionReport = "filled" | "rejected" | "closed";

/** Retries acknowledge the same result without regressing a later terminal state. */
export function reportTransition(current: string, result: ExecutionReport): "apply" | "ack" | "reject" {
  if (current === result || (current === "closed" && result === "filled")) return "ack";
  if (current === "sent" && (result === "filled" || result === "rejected")) return "apply";
  if (current === "filled" && result === "closed") return "apply";
  return "reject";
}

export interface StartInput {
  hasToken: boolean; lastHeartbeat: string | null; now: number;
  terminal: { login?: string; server?: string; type?: string; daypl?: number | null } | null;
  accountLogin: string; accountServer: string; mode: TradingMode; liveConfirmed: boolean;
  strategy: string; defaultLot: number; maxLot: number; maxOpen: number; riskPct: number; maxDailyLoss: number;
}
/** Every check START must pass. Empty array = may start. */
export function startBlockers(i: StartInput): string[] {
  const out: string[] = [];
  if (!i.hasToken) out.push("Create a bridge token and pair your MT5 terminal first.");
  if (!i.lastHeartbeat || i.now - new Date(i.lastHeartbeat).getTime() > HEARTBEAT_ONLINE_MS) out.push("MT5 bridge is not online (no heartbeat in the last 90 seconds).");
  if (!i.terminal) return out.concat("Terminal has not reported its account yet.");
  const r = holdReason({
    status: "running", mode: i.mode, liveConfirmed: i.liveConfirmed, terminalType: terminalTypeOf(i.terminal.type),
    terminalLogin: String(i.terminal.login ?? ""), accountLogin: i.accountLogin,
    terminalServer: i.terminal.server, accountServer: i.accountServer,
    openTrades: 0, maxOpenTrades: Math.max(1, i.maxOpen), dayPL: i.terminal.daypl ?? null, maxDailyLoss: i.maxDailyLoss,
  });
  if (r) out.push(HOLD_TEXT[r] ?? r);
  if (!["auto", "ema_trend", "breakout", "manual"].includes(i.strategy)) out.push("Selected strategy is not implemented.");
  if (!(i.defaultLot > 0) || !(i.maxLot > 0) || i.defaultLot > i.maxLot) out.push("Lot sizes are invalid (default must be > 0 and ≤ max lot).");
  if (!(i.maxOpen >= 1)) out.push("Max open positions must be at least 1.");
  if (!(i.riskPct > 0 && i.riskPct <= 5)) out.push("Risk per trade must be between 0 and 5%.");
  if (!(i.maxDailyLoss > 0)) out.push("Max daily loss must be greater than 0.");
  return out;
}
