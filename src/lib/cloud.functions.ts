import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { FEED_INSTRUMENTS, FEED_TIMEFRAMES } from "@/lib/marketdata";
import { cloudConfigOf, type CloudConfig } from "@/lib/cloudTrade";
import { NO_KEY_MESSAGE, deleteApiKey, hasApiKey, loadApiKey, saveApiKey, validApiKey } from "@/lib/cloudKeys";

const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;
const BotId = z.object({ botId: z.string().uuid() });

async function ownBot(ctx: { supabase: any; userId: string }, botId: string) {
  const { data: bot } = await ctx.supabase.from("bots").select("*").eq("id", botId).maybeSingle();
  if (!bot || bot.user_id !== ctx.userId) throw new Error("Bot not found");
  return bot;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const Connect = BotId.extend({
  login: z.string().trim().regex(/^\d{3,12}$/, "MT5 login must be 3–12 digits"),
  password: z.string().min(1, "Enter your MT5 password").max(100),
  server: z.string().trim().min(2).max(80),
  accountType: z.enum(["demo", "live"]),
  instrument: z.string().refine((v) => FEED_INSTRUMENTS.includes(v), "Unsupported instrument"),
  brokerSymbol: z.string().trim().regex(/^[A-Za-z0-9._#-]{2,20}$/, "Enter your broker's exact symbol name, e.g. XAUUSD or XAUUSDm"),
  timeframe: z.string().refine((v) => FEED_TIMEFRAMES.includes(v), "Unsupported timeframe"),
  acknowledged: z.literal(true, { errorMap: () => ({ message: "Please confirm you understand how your login is used" }) }),
});

/**
 * Connects the client's MT5 account through API2Trade so the bot can trade from the cloud (no PC).
 * The password is forwarded to API2Trade once and is never stored, logged or returned.
 */
export const connectCloudAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Connect.parse(d))
  .handler(async ({ data, context }) => {
    const api = await import("@/lib/api2trade");
    const bot = await ownBot(context, data.botId);
    const db = await admin();
    const key = await loadApiKey(db, context.userId);
    if (!key) throw new Error(NO_KEY_MESSAGE);
    // Replace any earlier cloud connection so we never keep a stale account at the provider.
    const old = cloudConfigOf(bot.terminal_info);
    if (old) await api.deleteAccount(key, old.accountId).catch(() => undefined);
    await db.from("bots").update({ status: "stopped", stop_requested_at: new Date().toISOString() }).eq("id", bot.id);

    let accountId: string;
    try {
      accountId = (await api.registerAccount(key, { login: data.login, password: data.password, server: data.server })).id;
    } catch (e) {
      throw new Error(e instanceof api.CloudError ? `Could not connect: ${e.message}` : "Could not connect your account.");
    }
    let connected = false;
    for (let i = 0; i < 4 && !connected; i++) { connected = await api.checkConnect(key, accountId); if (!connected) await sleep(1500); }
    if (!connected) {
      await api.deleteAccount(key, accountId).catch(() => undefined);
      throw new Error("Connected to API2Trade but not to your broker. Check the login, password and exact server name, then try again.");
    }
    const summary = await api.accountSummary(key, accountId).catch(() => null);

    const cloud: CloudConfig = { provider: "api2trade", accountId, accountType: data.accountType, instrument: data.instrument, brokerSymbol: data.brokerSymbol, timeframe: data.timeframe, connectedAt: new Date().toISOString() };
    await db.from("trading_accounts").update({ account_login: data.login, broker_server: data.server, connection_status: "connected" }).eq("id", bot.account_id);
    await db.from("bots").update({
      // Cloud replaces the EA: disabling the bridge token stops an EA from overwriting this bot's data.
      bridge_token_hash: null, status: "stopped", last_error: null, last_heartbeat: new Date().toISOString(),
      terminal_info: { cloud, demo: data.accountType === "demo", open: 0, positions: [], ...(summary ? { balance: summary.balance, equity: summary.equity, currency: summary.currency } : {}) } as never,
    }).eq("id", bot.id);
    return { ok: true as const, balance: summary?.balance ?? null, currency: summary?.currency ?? "" };
  });

/** Re-checks the cloud connection and refreshes balance/equity. */
export const refreshCloudStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BotId.parse(d))
  .handler(async ({ data, context }) => {
    const api = await import("@/lib/api2trade");
    const bot = await ownBot(context, data.botId);
    const cfg = cloudConfigOf(bot.terminal_info);
    if (!cfg) throw new Error("This bot is not connected through API2Trade.");
    const db = await admin();
    const key = await loadApiKey(db, context.userId);
    if (!key) throw new Error(NO_KEY_MESSAGE);
    const connected = await api.checkConnect(key, cfg.accountId).catch((e) => { if (e instanceof api.CloudError && e.code === "bad_key") throw new Error(e.message); return false; });
    await db.from("trading_accounts").update({ connection_status: connected ? "connected" : "error" }).eq("id", bot.account_id);
    if (!connected) return { connected: false as const };
    const s = await api.accountSummary(key, cfg.accountId).catch(() => null);
    if (s) await db.from("bots").update({ terminal_info: { ...(bot.terminal_info as object), balance: s.balance, equity: s.equity, currency: s.currency } as never, last_heartbeat: new Date().toISOString() }).eq("id", bot.id);
    return { connected: true as const, balance: s?.balance ?? null, currency: s?.currency ?? "" };
  });

/** Stops the bot and removes the account from API2Trade. Open positions are NOT closed. */
export const disconnectCloudAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BotId.parse(d))
  .handler(async ({ data, context }) => {
    const api = await import("@/lib/api2trade");
    const bot = await ownBot(context, data.botId);
    const cfg = cloudConfigOf(bot.terminal_info);
    const db = await admin();
    await db.from("bots").update({ status: "stopped", stop_requested_at: new Date().toISOString(), stop_ack_at: new Date().toISOString() }).eq("id", bot.id);
    await db.from("trade_signals").update({ status: "cancelled" }).eq("bot_id", bot.id).eq("status", "queued");
    const key = await loadApiKey(db, context.userId);
    if (cfg && key) await api.deleteAccount(key, cfg.accountId).catch(() => undefined);
    await db.from("bots").update({ terminal_info: null, last_heartbeat: null }).eq("id", bot.id);
    await db.from("trading_accounts").update({ connection_status: "pending" }).eq("id", bot.account_id);
    return { ok: true as const };
  });

const SaveKey = z.object({ apiKey: z.string().max(400) });

/** Whether this client has saved an API2Trade key. Never returns the key itself, only its last 4 characters. */
export const getCloudKeyStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => hasApiKey(await admin(), context.userId));

/** Saves the client's own API2Trade key (they pay API2Trade directly for it). */
export const saveCloudKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveKey.parse(d))
  .handler(async ({ data, context }) => {
    const key = validApiKey(data.apiKey);
    if (!key) throw new Error("That does not look like an API2Trade key. Copy the whole key from \"Your API key\" in API2Trade, with no spaces.");
    await saveApiKey(await admin(), context.userId, key);
    return { ok: true as const, last4: key.slice(-4) };
  });

/** Removes the saved key. Refused while a cloud account is connected, because the bot could then no longer close trades. */
export const removeCloudKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const { data: bots } = await db.from("bots").select("terminal_info").eq("user_id", context.userId);
    if ((bots ?? []).some((b) => cloudConfigOf(b.terminal_info))) throw new Error("Disconnect your MT5 account first. Without the key the bot cannot close your trades.");
    await deleteApiKey(db, context.userId);
    return { ok: true as const };
  });
