import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  deliverySlots, formatConfigLine, formatSignalLine, holdReason, reportTransition, sha256Hex, volumeAllowed,
  type BotStatus, type TradingMode,
} from "@/lib/bridge";
import type { Database } from "@/integrations/supabase/types";
import { decide, parseBars, type StrategySetting } from "@/lib/strategy";

const text = (body: string, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });

const num = z.coerce.number().finite();
const Heartbeat = z.object({
  login: z.string().min(1).max(40), server: z.string().max(80).default(""),
  type: z.enum(["demo", "real", "contest"]), balance: num.optional(), equity: num.optional(),
  currency: z.string().max(10).optional(), open: z.coerce.number().int().min(0).max(1000).default(0),
  daypl: num.optional(), positions: z.string().max(3000).optional(), version: z.string().max(20).optional(),
  symbol: z.string().max(30).optional(), tf: z.string().max(10).optional(), digits: z.coerce.number().int().min(0).max(10).optional(),
  bars: z.string().max(40000).optional(),
});
const Report = z.object({
  id: z.string().uuid(), result: z.enum(["filled", "rejected", "closed"]),
  ticket: z.string().max(40).optional(), price: num.optional(), profit: num.optional(), error: z.string().max(200).optional(),
});
const Emergency = z.object({ requested: z.string().max(40), closed: z.coerce.number().int().min(0), failed: z.coerce.number().int().min(0) });

function parsePositions(raw?: string) {
  if (!raw) return [];
  return raw.split(";").slice(0, 50).map((r) => {
    const [ticket, symbol, side, volume, price, profit] = r.split(",");
    return { ticket, symbol, side, volume: Number(volume), price: Number(price), profit: Number(profit) };
  }).filter((p) => p.ticket && p.symbol && Number.isFinite(p.volume));
}

export const Route = createFileRoute("/api/public/bridge/mt5")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-bridge-token") ?? "";
        if (!/^evx_[0-9a-f]{48}$/.test(token)) return text("ERR|UNAUTHORIZED", 401);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: bot } = await supabaseAdmin.from("bots").select("*").eq("bridge_token_hash", await sha256Hex(token)).maybeSingle();
        if (!bot) return text("ERR|UNAUTHORIZED", 401);
        const { data: account } = await supabaseAdmin.from("trading_accounts").select("id,account_login,broker_server").eq("id", bot.account_id).maybeSingle();
        if (!account) return text("ERR|NO_ACCOUNT", 404);

        const form = new URLSearchParams(await request.text());
        const action = form.get("action");
        const fields = Object.fromEntries(form.entries());

        if (action === "heartbeat" || action === "poll" || action === "config") {
          const hb = Heartbeat.safeParse(fields);
          if (!hb.success) return text("ERR|BAD_REQUEST", 400);
          const h = hb.data;
          const now = new Date().toISOString();
          const reason = holdReason({
            status: bot.status as BotStatus, mode: bot.trading_mode as TradingMode, liveConfirmed: !!bot.live_confirmed_at,
            terminalType: h.type, terminalLogin: h.login, accountLogin: account.account_login,
            terminalServer: h.server, accountServer: account.broker_server,
            openTrades: h.open, maxOpenTrades: bot.max_open_trades, dayPL: h.daypl ?? null, maxDailyLoss: Number(bot.max_daily_loss),
          });
          const identityOk = reason !== "LOGIN_MISMATCH" && reason !== "SERVER_MISMATCH";
          const patch: Database["public"]["Tables"]["bots"]["Update"] = {
            last_heartbeat: now, last_error: reason,
            terminal_info: {
              login: h.login, server: h.server, type: h.type, demo: h.type === "demo", balance: h.balance ?? null, equity: h.equity ?? null,
              currency: h.currency ?? null, open: h.open, daypl: h.daypl ?? null, positions: parsePositions(h.positions),
              version: h.version ?? null, symbol: h.symbol ?? null, tf: h.tf ?? null,
            },
          };
          // The terminal received the stopped state on this cycle: acknowledge STOP.
          if (bot.status === "stopped" && bot.stop_requested_at && !bot.stop_ack_at) patch.stop_ack_at = now;
          await supabaseAdmin.from("trading_accounts").update({ connection_status: identityOk ? "connected" : "error" }).eq("id", account.id);

          const lines = [formatConfigLine({
            status: bot.status as BotStatus, mode: bot.trading_mode as TradingMode, liveConfirmed: !!bot.live_confirmed_at,
            maxLot: Number(bot.max_lot), maxOpen: bot.max_open_trades, riskPct: Number(bot.risk_per_trade_pct),
            maxDailyLoss: Number(bot.max_daily_loss), strategy: bot.strategy, hold: reason,
          })];
          if (identityOk && bot.emergency_close_requested_at && !bot.emergency_close_ack_at) lines.push(`CLOSEALL|${bot.emergency_close_requested_at}`);

          if (action === "poll" && !reason) {
            // Strategy engine: evaluate closed bars reported by this terminal; at most one idea, deduped by signal_key.
            if (bot.strategy !== "manual" && h.bars && h.symbol && h.tf) {
              const bars = parseBars(h.bars);
              if (!bars) patch.last_decision = "NO TRADE: malformed bar data from terminal";
              else {
                const d = decide(bot.strategy as StrategySetting, bars, h.symbol, h.tf, h.digits ?? 5);
                if (!d.trade) patch.last_decision = d.reason;
                else {
                  const t = d.trade;
                  const volume = Math.min(Number(bot.default_lot), Number(bot.max_lot));
                  const { error } = await supabaseAdmin.from("trade_signals").insert({
                    user_id: bot.user_id, bot_id: bot.id, symbol: h.symbol, side: t.side, volume,
                    stop_loss: t.sl, take_profit: t.tp, strategy: t.strategy, signal_key: t.key, comment: t.reason.slice(0, 180),
                  });
                  patch.last_decision = error
                    ? (error.code === "23505" ? `Duplicate signal ignored (${t.key})` : "Could not queue strategy signal")
                    : `${t.strategy} ${t.side.toUpperCase()} ${h.symbol}: ${t.reason}`;
                }
              }
            }
            const { data: queued } = await supabaseAdmin.from("trade_signals").select("*")
              .eq("bot_id", bot.id).eq("status", "queued").order("created_at").limit(deliverySlots(h.open, bot.max_open_trades));
            for (const s of queued ?? []) {
              if (!volumeAllowed(Number(s.volume), Number(bot.max_lot)) || s.stop_loss == null) {
                await supabaseAdmin.from("trade_signals").update({ status: "rejected", error: s.stop_loss == null ? "Stop loss required for risk check" : "Volume exceeds bot max lot" }).eq("id", s.id);
                continue;
              }
              const { data: claimed } = await supabaseAdmin.from("trade_signals")
                .update({ status: "sent", sent_at: now }).eq("id", s.id).eq("status", "queued").select("id");
              if (claimed?.length) lines.push(formatSignalLine({ id: s.id, symbol: s.symbol, side: s.side as "buy" | "sell", volume: Number(s.volume), stop_loss: s.stop_loss, take_profit: s.take_profit }));
            }
          }
          await supabaseAdmin.from("bots").update(patch).eq("id", bot.id);
          return text(lines.join("\n"));
        }

        if (action === "emergency") {
          const e = Emergency.safeParse(fields);
          if (!e.success) return text("ERR|BAD_REQUEST", 400);
          if (!bot.emergency_close_requested_at || bot.emergency_close_ack_at) return text("OK");
          if (new Date(e.data.requested).getTime() !== new Date(bot.emergency_close_requested_at).getTime()) return text("ERR|STALE_REQUEST", 409);
          const result = `Closed ${e.data.closed}, failed ${e.data.failed}`;
          await supabaseAdmin.from("bots").update({ emergency_close_ack_at: new Date().toISOString(), emergency_close_result: result }).eq("id", bot.id);
          await supabaseAdmin.from("notifications").insert({ user_id: bot.user_id, title: "Emergency close processed by MT5", body: result });
          return text("OK");
        }

        if (action === "report") {
          const r = Report.safeParse(fields);
          if (!r.success) return text("ERR|BAD_REQUEST", 400);
          const d = r.data;
          const { data: existing, error: readError } = await supabaseAdmin.from("trade_signals").select("status")
            .eq("id", d.id).eq("bot_id", bot.id).maybeSingle();
          if (readError) return text("ERR|RETRY", 503);
          if (!existing) return text("ERR|NOT_FOUND", 404);
          const transition = reportTransition(existing.status, d.result);
          if (transition === "ack") return text("OK");
          if (transition === "reject") return text("ERR|INVALID_TRANSITION", 409);
          const now = new Date().toISOString();
          const patch =
            d.result === "filled" ? { status: "filled", ticket: d.ticket ?? null, fill_price: d.price ?? null, filled_at: now }
            : d.result === "closed" ? { status: "closed", close_price: d.price ?? null, profit: d.profit ?? null, closed_at: now }
            : { status: "rejected", error: d.error ?? "Rejected by terminal" };
          const { data: updated, error: updateError } = await supabaseAdmin.from("trade_signals").update(patch)
            .eq("id", d.id).eq("bot_id", bot.id).eq("status", existing.status).select("id,user_id,symbol,side");
          if (updateError) return text("ERR|RETRY", 503);
          const row = updated?.[0];
          if (!row) return text("ERR|RETRY", 503);
          await supabaseAdmin.from("notifications").insert({
            user_id: row.user_id, title: `${row.side.toUpperCase()} ${row.symbol} ${d.result}`,
            body: d.result === "rejected" ? d.error ?? "Order rejected by MT5" : d.ticket ? `MT5 ticket ${d.ticket}` : null,
          });
          return text("OK");
        }

        return text("ERR|UNKNOWN_ACTION", 400);
      },
    },
  },
});
