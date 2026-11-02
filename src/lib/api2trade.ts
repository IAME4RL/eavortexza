/**
 * Server-only client for API2Trade (https://api.metatraderapi.dev), which connects to a client's
 * MT5 account in the cloud so orders can be placed without a PC or an Expert Advisor.
 *
 * Auth: one platform API key (env API2TRADE_API_KEY) in the x-api-key header; each client account
 * is addressed by the UUID API2Trade returns from RegisterAccount (?id=). The client's broker
 * password is only ever sent to RegisterAccount. It is never stored, logged or returned.
 */
export class CloudError extends Error {
  constructor(public code: string, message: string) { super(message); this.name = "CloudError"; }
}

const TIMEOUT_MS = 15_000;
const baseUrl = () => (process.env["API2TRADE_BASE_URL"] ?? "https://api.metatraderapi.dev").replace(/\/+$/, "");
export const cloudConfigured = () => !!process.env["API2TRADE_API_KEY"];

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const numOf = (v: unknown): number | null => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};
const pick = (o: Obj, ...names: string[]): unknown => { for (const n of names) if (o[n] !== undefined && o[n] !== null) return o[n]; return undefined; };

/** Removes secrets from an error string and keeps it short. */
export function scrub(text: string, secrets: string[] = []): string {
  let out = text;
  for (const s of secrets) if (s) out = out.split(s).join("***");
  return out.replace(/\s+/g, " ").trim().slice(0, 200);
}

function messageOf(json: unknown, raw: string): string {
  const o = obj(json);
  const m = pick(o, "message", "error", "Message", "Error", "detail", "comment");
  return typeof m === "string" ? m : raw;
}

async function call(method: "GET" | "POST" | "DELETE", path: string, opts: { id?: string; query?: Record<string, string>; body?: unknown; secrets?: string[] } = {}): Promise<unknown> {
  const key = process.env["API2TRADE_API_KEY"];
  if (!key) throw new CloudError("not_configured", "Cloud trading is not set up on this server yet. Ask the administrator to add the API2Trade key.");
  const url = new URL(baseUrl() + path);
  if (opts.id) url.searchParams.set("id", opts.id);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      headers: { "x-api-key": key, ...(opts.body !== undefined ? { "content-type": "application/json" } : {}) },
      ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json: unknown = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON body */ }
    if (!res.ok) throw new CloudError(`http_${res.status}`, scrub(messageOf(json, text) || `API2Trade returned ${res.status}`, opts.secrets));
    return json;
  } catch (e) {
    if (e instanceof CloudError) throw e;
    if (e instanceof Error && e.name === "AbortError") throw new CloudError("timeout", "API2Trade did not respond in time.");
    throw new CloudError("network", "Could not reach API2Trade.");
  } finally {
    clearTimeout(timer);
  }
}

/** Connects a client's MT5 account. The password goes only to this call. */
export async function registerAccount(a: { login: string; password: string; server: string }): Promise<{ id: string }> {
  const json = obj(await call("POST", "/RegisterAccount", { body: { login: a.login, password: a.password, server: a.server }, secrets: [a.password] }));
  const id = pick(json, "id", "Id", "uuid");
  if (typeof id !== "string" || id.length < 8) throw new CloudError("bad_response", "API2Trade did not return an account id.");
  return { id };
}

export async function checkConnect(id: string): Promise<boolean> {
  try {
    const json = obj(await call("GET", "/CheckConnect", { id }));
    const flag = pick(json, "connected", "isConnected", "Connected");
    return flag === undefined ? true : flag !== false && flag !== "false";
  } catch (e) {
    if (e instanceof CloudError && e.code === "not_configured") throw e;
    return false;
  }
}

export async function deleteAccount(id: string): Promise<void> { await call("DELETE", "/DeleteAccount", { id }); }

export interface Summary { balance: number; equity: number; margin: number | null; freeMargin: number | null; currency: string }
export async function accountSummary(id: string): Promise<Summary> {
  const j = obj(await call("GET", "/AccountSummary", { id }));
  const balance = numOf(pick(j, "balance", "Balance"));
  const equity = numOf(pick(j, "equity", "Equity"));
  if (balance === null || equity === null) throw new CloudError("bad_response", "Unexpected account summary from API2Trade.");
  const cur = pick(j, "currency", "Currency");
  return { balance, equity, margin: numOf(pick(j, "margin", "Margin")), freeMargin: numOf(pick(j, "freeMargin", "FreeMargin")), currency: typeof cur === "string" ? cur : "" };
}

export interface Quote { bid: number; ask: number }
export async function getQuote(id: string, symbol: string): Promise<Quote> {
  const j = obj(await call("GET", "/GetQuote", { id, query: { symbol } }));
  const bid = numOf(pick(j, "bid", "Bid"));
  const ask = numOf(pick(j, "ask", "Ask"));
  if (bid === null || ask === null || bid <= 0 || ask <= 0 || ask < bid) throw new CloudError("bad_quote", `No valid quote for ${symbol}. Check the broker symbol name.`);
  return { bid, ask };
}

export interface SendResult { ok: boolean; ticket: string | null; price: number | null; error: string | null }
/** operation: 0 = buy market, 1 = sell market. */
export async function orderSend(id: string, o: { symbol: string; side: "buy" | "sell"; volume: number; stopLoss: number | null; takeProfit: number | null }): Promise<SendResult> {
  const j = obj(await call("POST", "/OrderSend", {
    id,
    body: { symbol: o.symbol, operation: o.side === "buy" ? 0 : 1, volume: o.volume, ...(o.stopLoss != null ? { stopLoss: o.stopLoss } : {}), ...(o.takeProfit != null ? { takeProfit: o.takeProfit } : {}) },
  }));
  const retcode = numOf(pick(j, "retcode", "retCode", "Retcode"));
  const ticketRaw = pick(j, "ticket", "Ticket", "order");
  const ticket = ticketRaw === undefined ? null : String(ticketRaw);
  const ok = (retcode === null ? ticket !== null : retcode === 0) && ticket !== null && ticket !== "0";
  const msg = pick(j, "comment", "message", "error");
  return { ok, ticket: ok ? ticket : null, price: numOf(pick(j, "price", "openPrice", "Price")), error: ok ? null : scrub(typeof msg === "string" && msg ? msg : `Rejected (code ${retcode ?? "?"})`) };
}

export async function orderClose(id: string, ticket: string, volume: number): Promise<boolean> {
  const j = obj(await call("POST", "/OrderClose", { id, body: { ticket: Number(ticket), volume } }));
  const retcode = numOf(pick(j, "retcode", "retCode", "Retcode"));
  return retcode === null || retcode === 0;
}

export interface Position { ticket: string; symbol: string; side: "buy" | "sell" | null; volume: number; price: number | null; profit: number }
export async function positions(id: string): Promise<Position[]> {
  const raw = await call("GET", "/Positions", { id });
  const list = Array.isArray(raw) ? raw : Array.isArray(obj(raw)["positions"]) ? (obj(raw)["positions"] as unknown[]) : [];
  return list.map((p) => {
    const o = obj(p);
    const t = pick(o, "ticket", "Ticket");
    const type = pick(o, "operation", "type", "orderType", "Type");
    const tl = String(type).toLowerCase();
    const side: "buy" | "sell" | null = type === 0 || tl === "0" || tl === "buy" ? "buy" : type === 1 || tl === "1" || tl === "sell" ? "sell" : null;
    return { ticket: t === undefined ? "" : String(t), symbol: String(pick(o, "symbol", "Symbol") ?? ""), side, volume: numOf(pick(o, "volume", "lots", "Volume")) ?? 0, price: numOf(pick(o, "openPrice", "price", "OpenPrice")), profit: numOf(pick(o, "profit", "Profit")) ?? 0 };
  }).filter((p) => p.ticket !== "");
}

export interface Closed { ticket: string; profit: number; closePrice: number | null }
export async function orderHistory(id: string, from: Date, to: Date): Promise<Closed[]> {
  const raw = await call("GET", "/OrderHistory", { id, query: { dateFrom: from.toISOString().replace(/\.\d+Z$/, "Z"), dateTo: to.toISOString().replace(/\.\d+Z$/, "Z") } });
  const list = Array.isArray(raw) ? raw : Array.isArray(obj(raw)["data"]) ? (obj(raw)["data"] as unknown[]) : [];
  return list.map((h) => {
    const o = obj(h);
    const t = pick(o, "ticket", "Ticket", "order");
    return { ticket: t === undefined ? "" : String(t), profit: numOf(pick(o, "profit", "Profit")) ?? 0, closePrice: numOf(pick(o, "closePrice", "ClosePrice")) };
  }).filter((h) => h.ticket !== "");
}
