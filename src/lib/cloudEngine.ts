import * as api from "./api2trade";
import { closedProfitSince, deliverySlots, floatingProfitOf, volumeAllowed } from "./bridge";
import { cloudConfigOf, planCloudCycle, utcDayStart, type CloudConfig } from "./cloudTrade";
import { fetchBars, type FetchResult } from "./marketdata";
import { biasIdea, decide, type Decision, type StrategySetting } from "./strategy";
import type { Database } from "@/integrations/supabase/types";

type BotRow = Database["public"]["Tables"]["bots"]["Row"];
type Db = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

const iso = (ms: number) => new Date(ms).toISOString();
const errText = (e: unknown) => (e instanceof Error ? e.message : "Unknown error").slice(0, 180);

/** Sends one order and records the outcome. An unknown outcome is never retried automatically. */
async function sendAndRecord(db: Db, rowId: string, cfg: CloudConfig, o: { side: "buy" | "sell"; volume: number; sl: number | null; tp: number | null; entry: number | null }): Promise<string> {
  try {
    const r = await api.orderSend(cfg.accountId, { symbol: cfg.brokerSymbol, side: o.side, volume: o.volume, stopLoss: o.sl, takeProfit: o.tp });
    if (r.ok) {
      await db.from("trade_signals").update({ status: "filled", ticket: r.ticket, fill_price: r.price ?? o.entry, filled_at: iso(Date.now()), error: null }).eq("id", rowId);
      return `filled #${r.ticket}`;
    }
    await db.from("trade_signals").update({ status: "rejected", error: r.error ?? "Rejected by broker" }).eq("id", rowId);
    return `rejected: ${r.error ?? "broker rejected"}`;
  } catch (e) {
    // Timeout / network after sending: the order may or may not exist. Leave it as 'sent' for the client to check.
    await db.from("trade_signals").update({ error: `Outcome unknown — check MT5 history before retrying (${errText(e)})` }).eq("id", rowId);
    return "outcome unknown";
  }
}

/** Marks filled trades as closed once their ticket is no longer open, with profit from history. */
async function syncClosed(db: Db, bot: BotRow, openTickets: Set<string>, history: api.Closed[]): Promise<void> {
  const { data: filled } = await db.from("trade_signals").select("id,ticket").eq("bot_id", bot.id).eq("status", "filled").not("ticket", "is", null).limit(50);
  for (const s of filled ?? []) {
    if (!s.ticket || openTickets.has(s.ticket)) continue;
    const h = history.find((x) => x.ticket === s.ticket);
    if (h) await db.from("trade_signals").update({ status: "closed", profit: h.profit, close_price: h.closePrice, closed_at: iso(Date.now()) }).eq("id", s.id);
  }
}

/** Profit banked toward the running goal: bot trades closed since the window opened, plus the bot's open trades. */
async function goalProfit(db: Db, bot: BotRow, pos: api.Position[]): Promise<number> {
  const sinceMs = bot.goal_started_at ? new Date(bot.goal_started_at).getTime() : Date.now();
  const [{ data: closed }, { data: filled }] = await Promise.all([
    db.from("trade_signals").select("profit,closed_at").eq("bot_id", bot.id).eq("status", "closed").gte("closed_at", new Date(sinceMs).toISOString()).limit(500),
    db.from("trade_signals").select("ticket").eq("bot_id", bot.id).eq("status", "filled").not("ticket", "is", null).limit(200),
  ]);
  const tickets = new Set((filled ?? []).map((f) => String(f.ticket)));
  return closedProfitSince(closed ?? [], sinceMs) + floatingProfitOf(pos.map((p) => ({ ticket: p.ticket, profit: p.profit })), tickets);
}

async function runBot(db: Db, bot: BotRow, now: number, barsCache: Map<string, FetchResult>, opts: { entryOnStart?: boolean } = {}): Promise<string> {
  const cfg = cloudConfigOf(bot.terminal_info);
  if (!cfg) return "not a cloud bot";
  const patch: Partial<BotRow> = { last_heartbeat: iso(now) };
  const save = async (extra: Partial<BotRow> = {}) => { await db.from("bots").update({ ...patch, ...extra } as never).eq("id", bot.id); };

  const connected = await api.checkConnect(cfg.accountId);
  const [pos, hist, summary] = connected
    ? await Promise.all([
        api.positions(cfg.accountId).catch(() => null),
        api.orderHistory(cfg.accountId, utcDayStart(now), new Date(now + 3_600_000)).catch(() => null),
        api.accountSummary(cfg.accountId).catch(() => null),
      ])
    : [null, null, null];

  if (!connected) {
    await save({ last_decision: "Lost connection to your MT5 account — retrying next cycle.", last_error: "MT5 account not reachable via API2Trade" });
    return "disconnected";
  }
  if (!pos || !hist) {
    await save({ last_decision: "Could not read positions/history — skipping this cycle for safety." });
    return "data unavailable";
  }

  await syncClosed(db, bot, new Set(pos.map((p) => p.ticket)), hist);
  const closedToday = hist.reduce((a, h) => a + h.profit, 0);
  const floating = pos.reduce((a, p) => a + p.profit, 0);
  const goalOn = Number(bot.profit_goal) > 0;
  const profitSinceGoal = goalOn ? await goalProfit(db, bot, pos) : 0;
  patch.terminal_info = {
    ...(bot.terminal_info as object),
    ...(summary ? { balance: summary.balance, equity: summary.equity, currency: summary.currency } : {}),
    open: pos.length, daypl: Math.round((closedToday + floating) * 100) / 100, demo: cfg.accountType === "demo",
    positions: pos.slice(0, 50).map((p) => ({ ticket: p.ticket, symbol: p.symbol, side: p.side ?? "", volume: p.volume, price: p.price ?? 0, profit: p.profit })),
  } as never;
  patch.last_error = null;

  // ---- strategy decision from closed candles (skipped for manual-only bots)
  let decision: Decision | null = null;
  let feedLast: number | null = null;
  let digits = 5;
  let startBars: FetchResult | null = null;
  if (bot.strategy === "manual") decision = { trade: null, reason: "Manual mode: strategy engine is off." };
  else {
    const k = `${cfg.instrument}|${cfg.timeframe}`;
    if (!barsCache.has(k)) barsCache.set(k, await fetchBars(cfg.instrument, cfg.timeframe, now));
    const f = barsCache.get(k)!;
    startBars = f;
    if (f.ok && f.bars.length) {
      digits = f.digits;
      feedLast = f.bars[f.bars.length - 1]!.c;
      decision = decide(bot.strategy as StrategySetting, f.bars, cfg.brokerSymbol, cfg.timeframe, f.digits);
    } else decision = { trade: null, reason: `NO TRADE: market data unavailable${f.ok ? "" : ` (${f.error})`}` };
  }
  // Entry on START: when no strategy qualifies, take the direction the price signals favor. Every risk gate in planCloudCycle still applies.
  if (opts.entryOnStart && decision && !decision.trade && startBars?.ok && startBars.bars.length) {
    const b = biasIdea(startBars.bars, cfg.brokerSymbol, cfg.timeframe, digits, String(now));
    decision = b
      ? { trade: b.idea, explanation: `Entry on START: ${b.why}` }
      : { trade: null, reason: `${decision.reason} · Entry on START skipped: price signals do not agree on a direction` };
  }
  const quote = decision?.trade ? await api.getQuote(cfg.accountId, cfg.brokerSymbol).catch(() => null) : null;

  const plan = planCloudCycle({
    status: bot.status, connected, accountType: cfg.accountType, mode: bot.trading_mode as "demo" | "live", liveConfirmed: !!bot.live_confirmed_at, demoOnly: bot.demo_only,
    defaultLot: Number(bot.default_lot), maxLot: Number(bot.max_lot), maxOpen: Number(bot.max_open_trades ?? 1), maxDailyLoss: Number(bot.max_daily_loss),
    openCount: pos.length, floatingPL: floating, closedTodayPL: closedToday, decision, quote, feedLast: feedLast ?? 0, digits, brokerSymbol: cfg.brokerSymbol,
  });

  if (plan.kind === "stop") {
    await db.from("trade_signals").update({ status: "cancelled" }).eq("bot_id", bot.id).eq("status", "queued");
    await save({ status: "stopped", stop_requested_at: iso(now), stop_ack_at: iso(now), last_decision: plan.reason, last_error: plan.reason });
    return "stopped: " + plan.reason;
  }

  let opened = 0;
  let result = plan.reason;
  if (plan.kind === "trade") {
    // The client may have pressed Stop while this cycle was running: re-check right before ordering.
    const { data: fresh } = await db.from("bots").select("status").eq("id", bot.id).maybeSingle();
    if (fresh?.status !== "running") { await save({ last_decision: "Stopped by you — order not sent." }); return "stopped by user"; }
    const t = plan.trade;
    const { data: row, error } = await db.from("trade_signals").insert({
      user_id: bot.user_id, bot_id: bot.id, symbol: cfg.brokerSymbol, side: t.side, volume: t.volume, stop_loss: t.sl, take_profit: t.tp,
      strategy: t.strategy, signal_key: t.key, comment: t.comment, status: "sent", sent_at: iso(now),
    }).select("id").maybeSingle();
    if (error || !row) result = error?.code === "23505" ? `Duplicate signal ignored (${t.key})` : "Could not record strategy signal";
    else { result = `${plan.reason} → ${await sendAndRecord(db, row.id, cfg, { side: t.side, volume: t.volume, sl: t.sl, tp: t.tp, entry: t.entry })}`; opened = 1; }
  }

  // ---- manual orders the client queued in the Auto Trade page
  const slots = deliverySlots(pos.length + opened, bot.max_open_trades);
  if (slots > 0) {
    const { data: queued } = await db.from("trade_signals").select("*").eq("bot_id", bot.id).eq("status", "queued").order("created_at").limit(slots);
    for (const s of queued ?? []) {
      if (s.stop_loss == null || !volumeAllowed(Number(s.volume), Number(bot.max_lot))) {
        await db.from("trade_signals").update({ status: "rejected", error: s.stop_loss == null ? "Stop loss required for risk check" : "Volume exceeds bot max lot" }).eq("id", s.id);
        continue;
      }
      const claimed = await db.from("trade_signals").update({ status: "sent", sent_at: iso(now) }).eq("id", s.id).eq("status", "queued").select("id");
      if (!claimed.data?.length) continue;
      await sendAndRecord(db, s.id, cfg, { side: s.side as "buy" | "sell", volume: Number(s.volume), sl: s.stop_loss, tp: s.take_profit, entry: null });
    }
  }

  await save({ last_decision: result });
  return result;
}

/** Runs the engine once for one running bot right now. Used when the client presses START so the first trade does not wait for the schedule. */
export async function runCloudBotOnce(botId: string, opts: { entryOnStart?: boolean } = {}): Promise<string> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data: bot } = await db.from("bots").select("*").eq("id", botId).eq("status", "running").maybeSingle();
  if (!bot) return "Bot is not running";
  return runBot(db, bot, Date.now(), new Map(), opts);
}

/** One engine pass over every running cloud bot. Called by the scheduled job. */
export async function runCloudCycle(now = Date.now(), limit = 50): Promise<{ bots: number; results: Record<string, number> }> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data: bots } = await db.from("bots").select("*").eq("status", "running").filter("terminal_info->cloud->>provider", "eq", "api2trade").limit(limit);
  const barsCache = new Map<string, FetchResult>();
  const results: Record<string, number> = {};
  for (const bot of bots ?? []) {
    let label: string;
    try { label = (await runBot(db, bot, now, barsCache)).split(/[:(→]/)[0]!.trim().slice(0, 40) || "ok"; }
    catch (e) {
      label = "error";
      await db.from("bots").update({ last_error: errText(e), last_heartbeat: iso(now) }).eq("id", bot.id);
    }
    results[label] = (results[label] ?? 0) + 1;
  }
  return { bots: bots?.length ?? 0, results };
}

/** Closes every open position of a cloud account (emergency close). */
export async function cloudCloseAll(cfg: CloudConfig): Promise<{ closed: number; failed: number }> {
  const open = await api.positions(cfg.accountId);
  let closed = 0, failed = 0;
  for (const p of open) {
    try { (await api.orderClose(cfg.accountId, p.ticket, p.volume)) ? closed++ : failed++; } catch { failed++; }
  }
  return { closed, failed };
}
