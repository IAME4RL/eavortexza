import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { deliverySlots, formatSignalLine, holdReason, reportTransition, sha256Hex, volumeAllowed, type BotStatus } from "@/lib/bridge";

const text = (body: string, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });

const num = z.coerce.number().finite();
const Heartbeat = z.object({
  login: z.string().min(1).max(40), server: z.string().max(80).default(""),
  demo: z.enum(["0", "1"]), balance: num.optional(), equity: num.optional(),
  currency: z.string().max(10).optional(), open: z.coerce.number().int().min(0).max(1000).default(0),
});
const Report = z.object({
  id: z.string().uuid(), result: z.enum(["filled", "rejected", "closed"]),
  ticket: z.string().max(40).optional(), price: num.optional(), profit: num.optional(), error: z.string().max(200).optional(),
});

export const Route = createFileRoute("/api/public/bridge/mt5")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-bridge-token") ?? "";
        if (!/^evx_[0-9a-f]{48}$/.test(token)) return text("ERR|UNAUTHORIZED", 401);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: bot } = await supabaseAdmin.from("bots").select("*").eq("bridge_token_hash", await sha256Hex(token)).maybeSingle();
        if (!bot) return text("ERR|UNAUTHORIZED", 401);
        const { data: account } = await supabaseAdmin.from("trading_accounts").select("id,account_login").eq("id", bot.account_id).maybeSingle();
        if (!account) return text("ERR|NO_ACCOUNT", 404);

        const form = new URLSearchParams(await request.text());
        const action = form.get("action");
        const fields = Object.fromEntries(form.entries());

        if (action === "heartbeat" || action === "poll") {
          const hb = Heartbeat.safeParse(fields);
          if (!hb.success) return text("ERR|BAD_REQUEST", 400);
          const h = hb.data;
          const loginOk = h.login.trim() === account.account_login.trim();
          await supabaseAdmin.from("bots").update({
            last_heartbeat: new Date().toISOString(),
            terminal_info: { login: h.login, server: h.server, demo: h.demo === "1", balance: h.balance ?? null, equity: h.equity ?? null, currency: h.currency ?? null, open: h.open },
          }).eq("id", bot.id);
          await supabaseAdmin.from("trading_accounts").update({ connection_status: loginOk ? "connected" : "error" }).eq("id", account.id);

          const reason = holdReason({
            status: bot.status as BotStatus, demoOnly: bot.demo_only, terminalIsDemo: h.demo === "1",
            terminalLogin: h.login, accountLogin: account.account_login, openTrades: h.open, maxOpenTrades: bot.max_open_trades,
          });
          if (action === "heartbeat" || reason) return text(`OK|${bot.status}${reason ? "|" + reason : ""}`);

          const { data: queued } = await supabaseAdmin.from("trade_signals").select("*")
            .eq("bot_id", bot.id).eq("status", "queued").order("created_at").limit(deliverySlots(h.open, bot.max_open_trades));
          const lines: string[] = [];
          for (const s of queued ?? []) {
            if (!volumeAllowed(Number(s.volume), Number(bot.max_lot))) {
              await supabaseAdmin.from("trade_signals").update({ status: "rejected", error: "Volume exceeds bot max lot" }).eq("id", s.id);
              continue;
            }
            const { data: claimed } = await supabaseAdmin.from("trade_signals")
              .update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", s.id).eq("status", "queued").select("id");
            if (claimed?.length) lines.push(formatSignalLine({ id: s.id, symbol: s.symbol, side: s.side as "buy" | "sell", volume: Number(s.volume), stop_loss: s.stop_loss, take_profit: s.take_profit }));
          }
          return text(lines.length ? lines.join("\n") : "NONE");
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
