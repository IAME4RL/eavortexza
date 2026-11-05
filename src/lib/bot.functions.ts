import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sha256Hex, startBlockers, type TradingMode } from "@/lib/bridge";
import { cloudConfigOf, cloudStartBlockers } from "@/lib/cloudTrade";

const BotId = z.object({ botId: z.string().uuid() });
export const LIVE_CONFIRM_PHRASE = "ENABLE LIVE TRADING";
export const CLOSE_CONFIRM_PHRASE = "CLOSE ALL POSITIONS";

async function ownBot(ctx: { supabase: any; userId: string }, botId: string) {
  const { data: bot } = await ctx.supabase.from("bots").select("*").eq("id", botId).maybeSingle();
  if (!bot || bot.user_id !== ctx.userId) throw new Error("Bot not found");
  return bot;
}
const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

/** Creates (or replaces) the bridge token for one of the caller's bots. The plain token is returned once only. */
export const createBridgeToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BotId.parse(d))
  .handler(async ({ data, context }) => {
    const bot = await ownBot(context, data.botId);
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const token = "evx_" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    const { error } = await (await admin()).from("bots")
      .update({ bridge_token_hash: await sha256Hex(token), last_heartbeat: null, terminal_info: null, status: "stopped" })
      .eq("id", bot.id);
    if (error) throw new Error("Could not create token");
    return { token };
  });

/** START: verifies account, permission, bridge, mode, strategy and risk limits before allowing execution. */
export const startBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BotId.parse(d))
  .handler(async ({ data, context }) => {
    const bot = await ownBot(context, data.botId);
    if (bot.status === "running") return { ok: true, already: true, blockers: [] as string[] };
    const cloud = cloudConfigOf(bot.terminal_info);
    if (cloud) {
      // Cloud (API2Trade) bot: verify the live connection and every safety rule before running.
      const api = await import("@/lib/api2trade");
      let connected = false;
      try { connected = await api.checkConnect(cloud.accountId); } catch (e) { return { ok: false, already: false, blockers: [e instanceof Error ? e.message : "Cloud trading is unavailable."] }; }
      const blockers = cloudStartBlockers({
        connected, accountType: cloud.accountType, mode: bot.trading_mode as TradingMode, liveConfirmed: !!bot.live_confirmed_at, demoOnly: bot.demo_only,
        strategy: bot.strategy, defaultLot: Number(bot.default_lot), maxLot: Number(bot.max_lot), maxOpen: bot.max_open_trades,
        riskPct: Number(bot.risk_per_trade_pct), maxDailyLoss: Number(bot.max_daily_loss), instrument: cloud.instrument, brokerSymbol: cloud.brokerSymbol,
        profitGoal: Number(bot.profit_goal), goalMode: bot.profit_goal_mode,
      });
      if (blockers.length) return { ok: false, already: false, blockers };
      await (await admin()).from("bots").update({ status: "running", stop_requested_at: null, stop_ack_at: null, last_error: null, goal_started_at: new Date().toISOString(), goal_profit: 0, last_heartbeat: new Date().toISOString() }).eq("id", bot.id).neq("status", "running");
      // Do not wait for the next scheduled check: evaluate now and open the first trade right away.
      let entry = "Bot started. The first check runs within a minute.";
      try { entry = await (await import("@/lib/cloudEngine")).runCloudBotOnce(bot.id, { entryOnStart: true }); } catch { /* the scheduled check will pick it up */ }
      return { ok: true, already: false, blockers, entry };
    }
    const { data: account } = await context.supabase.from("trading_accounts").select("account_login,broker_server").eq("id", bot.account_id).maybeSingle();
    if (!account) return { ok: false, already: false, blockers: ["Registered MT5 account not found."] };
    const blockers = startBlockers({
      hasToken: !!bot.bridge_token_hash, lastHeartbeat: bot.last_heartbeat, now: Date.now(), terminal: bot.terminal_info,
      accountLogin: account.account_login, accountServer: account.broker_server, mode: bot.trading_mode as TradingMode,
      liveConfirmed: !!bot.live_confirmed_at, strategy: bot.strategy, defaultLot: Number(bot.default_lot), maxLot: Number(bot.max_lot),
      maxOpen: bot.max_open_trades, riskPct: Number(bot.risk_per_trade_pct), maxDailyLoss: Number(bot.max_daily_loss),
    });
    if (blockers.length) return { ok: false, already: false, blockers };
    // Conditional update prevents duplicate START commands racing each other.
    await (await admin()).from("bots").update({ status: "running", stop_requested_at: null, stop_ack_at: null, goal_started_at: new Date().toISOString(), goal_profit: 0 }).eq("id", bot.id).neq("status", "running");
    return { ok: true, already: false, blockers };
  });

/** STOP: blocks new orders immediately, cancels queued orders; the terminal acknowledges on its next cycle. Never closes positions. */
export const stopBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BotId.parse(d))
  .handler(async ({ data, context }) => {
    const bot = await ownBot(context, data.botId);
    const db = await admin();
    if (bot.status !== "stopped") await db.from("bots").update({ status: "stopped", stop_requested_at: new Date().toISOString(), stop_ack_at: null }).eq("id", bot.id);
    const { data: cancelled } = await db.from("trade_signals").update({ status: "cancelled" }).eq("bot_id", bot.id).eq("status", "queued").select("id");
    return { cancelled: cancelled?.length ?? 0, already: bot.status === "stopped" };
  });

/** Explicit, confirmed switch to LIVE mode. Never automatic. Bot is stopped so START re-verifies. */
export const enableLiveMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BotId.extend({ confirm: z.string(), acknowledged: z.literal(true) }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.confirm.trim() !== LIVE_CONFIRM_PHRASE) throw new Error(`Type "${LIVE_CONFIRM_PHRASE}" to confirm`);
    const bot = await ownBot(context, data.botId);
    await (await admin()).from("bots").update({ trading_mode: "live", live_confirmed_at: new Date().toISOString(), status: "stopped", stop_requested_at: new Date().toISOString(), stop_ack_at: null }).eq("id", bot.id);
    return { ok: true };
  });

export const disableLiveMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BotId.parse(d))
  .handler(async ({ data, context }) => {
    const bot = await ownBot(context, data.botId);
    await (await admin()).from("bots").update({ trading_mode: "demo", live_confirmed_at: null, status: "stopped", stop_requested_at: new Date().toISOString(), stop_ack_at: null }).eq("id", bot.id);
    return { ok: true };
  });

/** Separately confirmed emergency close of this bot's positions; also stops the bot. Executed by MT5 subject to broker rules. */
export const requestEmergencyClose = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BotId.extend({ confirm: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.confirm.trim() !== CLOSE_CONFIRM_PHRASE) throw new Error(`Type "${CLOSE_CONFIRM_PHRASE}" to confirm`);
    const bot = await ownBot(context, data.botId);
    const cloud = cloudConfigOf(bot.terminal_info);
    if (cloud) {
      // Cloud bot: close the positions right now through API2Trade (subject to broker rules).
      const t = new Date().toISOString();
      const db = await admin();
      await db.from("bots").update({ status: "stopped", stop_requested_at: t, stop_ack_at: t }).eq("id", bot.id);
      await db.from("trade_signals").update({ status: "cancelled" }).eq("bot_id", bot.id).eq("status", "queued");
      const { cloudCloseAll } = await import("@/lib/cloudEngine");
      const r = await cloudCloseAll(cloud).catch(() => ({ closed: 0, failed: -1 }));
      await db.from("bots").update({ emergency_close_requested_at: t, emergency_close_ack_at: new Date().toISOString(), emergency_close_result: r.failed < 0 ? "Could not reach API2Trade — check MT5 and close manually." : `Closed ${r.closed}, failed ${r.failed}` }).eq("id", bot.id);
      return { pending: false };
    }
    if (bot.emergency_close_requested_at && !bot.emergency_close_ack_at) return { pending: true };
    const now = new Date().toISOString();
    const db = await admin();
    await db.from("bots").update({ status: "stopped", stop_requested_at: now, stop_ack_at: null, emergency_close_requested_at: now, emergency_close_ack_at: null, emergency_close_result: null }).eq("id", bot.id);
    await db.from("trade_signals").update({ status: "cancelled" }).eq("bot_id", bot.id).eq("status", "queued");
    return { pending: false };
  });
