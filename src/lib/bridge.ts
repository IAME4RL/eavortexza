// Pure helpers for the MT5 bridge protocol (shared by the server route and tests).

export type BotStatus = "running" | "paused" | "stopped";

export interface DeliveryInput {
  status: BotStatus;
  demoOnly: boolean;
  terminalIsDemo: boolean;
  terminalLogin: string;
  accountLogin: string;
  openTrades: number;
  maxOpenTrades: number;
}

/** Returns null when signals may be sent to the terminal, otherwise the reason they are held. */
export function holdReason(i: DeliveryInput): string | null {
  if (i.terminalLogin.trim() !== i.accountLogin.trim()) return "LOGIN_MISMATCH";
  if (i.status !== "running") return i.status === "paused" ? "PAUSED" : "STOPPED";
  if (i.demoOnly && !i.terminalIsDemo) return "DEMO_ONLY";
  if (i.openTrades >= i.maxOpenTrades) return "MAX_OPEN";
  return null;
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
