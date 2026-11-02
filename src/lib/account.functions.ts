import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ChangeAccountInput, identityChanged } from "@/lib/accountChange";
import { cloudConfigOf } from "@/lib/cloudTrade";

const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

/**
 * Switches the MT5 account a bot is attached to. Works for both connection methods:
 *  - Cloud (API2Trade): the old cloud connection is removed; the user reconnects with the new login.
 *  - PC Bridge: the registered login/server change, so the Bridge holds orders until it is attached
 *    to the new account (the bridge compares the terminal's login and server on every poll).
 * Open positions on the old account are never touched.
 */
export const changeAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ChangeAccountInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: bot } = await supabase.from("bots").select("*").eq("id", data.botId).maybeSingle();
    if (!bot || bot.user_id !== userId) throw new Error("Bot not found");
    const { data: account } = await supabase.from("trading_accounts").select("*").eq("id", bot.account_id).eq("user_id", userId).maybeSingle();
    if (!account) throw new Error("Account not found");

    const db = await admin();
    const switched = identityChanged({ login: account.account_login, server: account.broker_server }, data);
    if (!switched) {
      const { error } = await db.from("trading_accounts").update({ label: data.label }).eq("id", account.id).eq("user_id", userId);
      if (error) throw new Error("Could not save the label.");
      return { ok: true as const, switched: false as const, wasCloud: false as const };
    }

    const { data: dup } = await supabase.from("trading_accounts").select("id").eq("user_id", userId).eq("platform", account.platform)
      .eq("account_login", data.login).eq("broker_server", data.server).neq("id", account.id).limit(1);
    if (dup?.length) throw new Error("You already have this account registered. Use that one instead.");

    // 1. Drop the cloud connection to the old account (if any) so nothing keeps trading it.
    const cfg = cloudConfigOf(bot.terminal_info);
    if (cfg) {
      const api = await import("@/lib/api2trade");
      await api.deleteAccount(cfg.accountId).catch(() => undefined);
    }
    // 2. Stop the bot, cancel orders that have not been delivered yet, and reset to demo so live
    //    trading has to be confirmed again for the new account. Open positions are not closed.
    const now = new Date().toISOString();
    await db.from("trade_signals").update({ status: "cancelled" }).eq("bot_id", bot.id).eq("status", "queued");
    await db.from("bots").update({
      status: "stopped", stop_requested_at: now, stop_ack_at: now, trading_mode: "demo", live_confirmed_at: null,
      terminal_info: null, last_heartbeat: null, last_error: null,
    }).eq("id", bot.id);
    // 3. Point the registered account at the new login and server.
    const { error } = await db.from("trading_accounts")
      .update({ account_login: data.login, broker_server: data.server, label: data.label, connection_status: "pending" })
      .eq("id", account.id).eq("user_id", userId);
    if (error) throw new Error("The bot was stopped, but the new account could not be saved. Please try again.");
    return { ok: true as const, switched: true as const, wasCloud: !!cfg };
  });
