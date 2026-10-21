import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Bot, Play, Pause, Square, KeyRound, Copy, Download, Send, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatusBadge, Stat } from "@/components/dash";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { createBridgeToken } from "@/lib/bot.functions";
import { HEARTBEAT_ONLINE_MS } from "@/lib/bridge";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/dashboard/auto-trade")({
  head: () => ({ meta: [{ title: "Auto Trade — EA VORTEX" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

type BotRow = Database["public"]["Tables"]["bots"]["Row"];
type Account = Database["public"]["Tables"]["trading_accounts"]["Row"];
const lbl = "font-mono text-[11px] uppercase tracking-widest text-muted-foreground";

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const data = useQuery({
    queryKey: ["auto-trade"],
    refetchInterval: 15_000,
    queryFn: async () => {
      const [a, b] = await Promise.all([
        supabase.from("trading_accounts").select("*").eq("user_id", user!.id).eq("platform", "MT5").order("created_at"),
        supabase.from("bots").select("*").eq("user_id", user!.id),
      ]);
      return { accounts: a.data ?? [], bots: b.data ?? [] };
    },
  });

  const createBot = useMutation({
    mutationFn: async (accountId: string) => {
      const { error } = await supabase.from("bots").insert({ user_id: user!.id, account_id: accountId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auto-trade"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create bot"),
  });

  const accounts = data.data?.accounts ?? [];
  return (
    <>
      <PageHeader eyebrow="MetaTrader 5" title="Auto Trade"
        sub="Control your EA VORTEX bot. Orders are executed by the EA VORTEX Bridge running inside your own MT5 terminal, so trading continues while this website is closed — as long as MT5 stays open." />
      {!accounts.length ? (
        <EmptyState icon={Bot} title="No MT5 account yet"
          action={<Button variant="hero" asChild><Link to="/dashboard/ea">Register MT5 account</Link></Button>}>
          Register your MetaTrader 5 account login and server first.
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {accounts.map((a) => {
            const bot = data.data?.bots.find((b) => b.account_id === a.id);
            return bot ? <BotPanel key={a.id} account={a} bot={bot} /> : (
              <div key={a.id} className="panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="font-mono font-semibold">{a.label || a.account_login}</p><p className="text-sm text-muted-foreground">{a.account_login} · {a.broker_server}</p></div>
                <Button variant="hero" onClick={() => createBot.mutate(a.id)} disabled={createBot.isPending}><Bot />Set up bot</Button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function BotPanel({ account, bot }: { account: Account; bot: BotRow }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const genToken = useServerFn(createBridgeToken);
  const [token, setToken] = useState<string | null>(null);
  const [lot, setLot] = useState(String(bot.default_lot));
  const [maxLot, setMaxLot] = useState(String(bot.max_lot));
  const [maxOpen, setMaxOpen] = useState(String(bot.max_open_trades));
  const [symbol, setSymbol] = useState("XAUUSD");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [vol, setVol] = useState(String(bot.default_lot));
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");

  const online = !!bot.last_heartbeat && Date.now() - new Date(bot.last_heartbeat).getTime() < HEARTBEAT_ONLINE_MS;
  const info = bot.terminal_info as { demo?: boolean; balance?: number; equity?: number; currency?: string; open?: number; login?: string } | null;
  const refresh = () => qc.invalidateQueries({ queryKey: ["auto-trade"] });

  const signals = useQuery({
    queryKey: ["signals", bot.id],
    refetchInterval: 10_000,
    queryFn: async () => (await supabase.from("trade_signals").select("*").eq("bot_id", bot.id).order("created_at", { ascending: false }).limit(50)).data ?? [],
  });

  const update = useMutation({
    mutationFn: async (patch: Partial<BotRow>) => {
      const { error } = await supabase.from("bots").update(patch).eq("id", bot.id);
      if (error) throw error;
    },
    onSuccess: () => { refresh(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const stopAll = useMutation({
    mutationFn: async () => {
      await supabase.from("bots").update({ status: "stopped" }).eq("id", bot.id);
      await supabase.from("trade_signals").update({ status: "cancelled" }).eq("bot_id", bot.id).eq("status", "queued");
    },
    onSuccess: () => { toast.success("Bot stopped and queued orders cancelled"); refresh(); qc.invalidateQueries({ queryKey: ["signals", bot.id] }); },
  });

  const queue = useMutation({
    mutationFn: async () => {
      const v = Number(vol);
      if (!(v > 0) || v > Number(bot.max_lot)) throw new Error(`Volume must be between 0.01 and your max lot (${bot.max_lot})`);
      const { error } = await supabase.from("trade_signals").insert({
        user_id: user!.id, bot_id: bot.id, symbol: symbol.trim().toUpperCase(), side, volume: v,
        stop_loss: sl ? Number(sl) : null, take_profit: tp ? Number(tp) : null, comment: "EA VORTEX",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success(bot.status === "running" ? "Order queued — the bridge will pick it up" : "Order queued — start the bot to send it"); setSl(""); setTp(""); qc.invalidateQueries({ queryKey: ["signals", bot.id] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not queue order"),
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => { await supabase.from("trade_signals").update({ status: "cancelled" }).eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["signals", bot.id] }),
  });

  const rows = signals.data ?? [];
  const closed = rows.filter((r) => r.status === "closed" && r.profit != null);
  const pnl = closed.reduce((s, r) => s + Number(r.profit), 0);
  const endpoint = typeof window !== "undefined" ? `${window.location.origin}/api/public/bridge/mt5` : "";

  return (
    <div className="panel p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-lg font-semibold">{account.label || account.account_login}</p>
          <p className="text-sm text-muted-foreground">MT5 · {account.account_login} · {account.broker_server}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge status={bot.status} />
            <StatusBadge status={online ? "terminal_online" : bot.last_heartbeat ? "terminal_offline" : "terminal_never"} />
            {info && <StatusBadge status={info.demo ? "demo" : "live"} />}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {bot.status !== "running" && <Button variant="hero" onClick={() => update.mutate({ status: "running" })}><Play />{bot.status === "paused" ? "Resume" : "Start"}</Button>}
          {bot.status === "running" && <Button variant="frame" onClick={() => update.mutate({ status: "paused" })}><Pause />Pause</Button>}
          {bot.status !== "stopped" && <Button variant="outline" onClick={() => stopAll.mutate()}><Square />Stop</Button>}
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Balance" value={info?.balance != null ? `${info.balance.toFixed(2)} ${info.currency ?? ""}` : "—"} hint="Reported by your MT5 terminal" />
        <Stat label="Equity" value={info?.equity != null ? info.equity.toFixed(2) : "—"} />
        <Stat label="Open positions" value={info?.open ?? "—"} hint={`Limit ${bot.max_open_trades}`} />
        <Stat label="Closed P/L (bot)" value={closed.length ? pnl.toFixed(2) : "—"} hint={`${closed.length} closed bot trades`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-md border border-border p-4">
          <h3 className="font-bold uppercase">Risk settings</h3>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label className={lbl}>Default lot</Label><Input inputMode="decimal" value={lot} onChange={(e) => setLot(e.target.value)} /></div>
            <div className="space-y-1"><Label className={lbl}>Max lot</Label><Input inputMode="decimal" value={maxLot} onChange={(e) => setMaxLot(e.target.value)} /></div>
            <div className="space-y-1"><Label className={lbl}>Max open</Label><Input inputMode="numeric" value={maxOpen} onChange={(e) => setMaxOpen(e.target.value)} /></div>
          </div>
          <label className="mt-4 flex items-center justify-between gap-3 text-sm">
            <span>Demo accounts only <span className="block text-xs text-muted-foreground">Orders are held if the terminal reports a live account.</span></span>
            <Switch checked={bot.demo_only} onCheckedChange={(v) => update.mutate({ demo_only: v })} />
          </label>
          <Button variant="frame" className="mt-4" onClick={() => update.mutate({ default_lot: Number(lot), max_lot: Number(maxLot), max_open_trades: Number(maxOpen) }, { onSuccess: () => toast.success("Settings saved") })}>Save settings</Button>
        </div>

        <div className="rounded-md border border-border p-4">
          <h3 className="font-bold uppercase">Connect MT5</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Download the EA VORTEX Bridge and copy it to MT5 → File → Open Data Folder → MQL5/Experts.</li>
            <li>In MT5: Tools → Options → Expert Advisors → allow WebRequest for the URL below.</li>
            <li>Attach the Bridge to any chart, paste your token, and enable Algo Trading.</li>
          </ol>
          <div className="mt-3 flex items-center gap-2"><Input readOnly value={endpoint} className="font-mono text-xs" />
            <Button size="icon" variant="outline" aria-label="Copy URL" onClick={() => { navigator.clipboard.writeText(endpoint); toast.success("URL copied"); }}><Copy /></Button></div>
          {token && (
            <div className="mt-3 rounded-md border border-primary/40 bg-accent p-3">
              <p className="text-xs text-muted-foreground">Your bridge token — shown once. Keep it private.</p>
              <div className="mt-2 flex items-center gap-2"><Input readOnly value={token} className="font-mono text-xs" />
                <Button size="icon" variant="outline" aria-label="Copy token" onClick={() => { navigator.clipboard.writeText(token); toast.success("Token copied"); }}><Copy /></Button></div>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="hero" onClick={async () => { try { const r = await genToken({ data: { botId: bot.id } }); setToken(r.token); refresh(); } catch { toast.error("Could not create token"); } }}>
              <KeyRound />{bot.bridge_token_hash ? "Replace token" : "Create token"}</Button>
            <Button variant="outline" asChild><a href="/EAVortexBridge.mq5" download><Download />Download Bridge EA</a></Button>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-border p-4">
        <h3 className="font-bold uppercase">Send an order to MT5</h3>
        <p className="mt-1 text-xs text-muted-foreground">Market order executed by your terminal while the bot is running. Use your broker's exact symbol name (e.g. XAUUSD, XAUUSD.m, GOLD). Trading carries risk; no outcome is guaranteed.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="space-y-1"><Label className={lbl}>Symbol</Label><Input value={symbol} onChange={(e) => setSymbol(e.target.value)} maxLength={20} /></div>
          <div className="space-y-1"><Label className={lbl}>Side</Label>
            <Select value={side} onValueChange={(v) => setSide(v as "buy" | "sell")}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="buy">Buy</SelectItem><SelectItem value="sell">Sell</SelectItem></SelectContent></Select></div>
          <div className="space-y-1"><Label className={lbl}>Volume</Label><Input inputMode="decimal" value={vol} onChange={(e) => setVol(e.target.value)} /></div>
          <div className="space-y-1"><Label className={lbl}>Stop loss</Label><Input inputMode="decimal" value={sl} onChange={(e) => setSl(e.target.value)} placeholder="optional" /></div>
          <div className="space-y-1"><Label className={lbl}>Take profit</Label><Input inputMode="decimal" value={tp} onChange={(e) => setTp(e.target.value)} placeholder="optional" /></div>
          <div className="flex items-end"><Button variant="hero" className="w-full" onClick={() => queue.mutate()} disabled={queue.isPending || symbol.trim().length < 2}><Send />Queue</Button></div>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="font-bold uppercase">Bot trade history</h3>
        {!rows.length ? <p className="mt-2 text-sm text-muted-foreground">No orders yet.</p> : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="text-left font-mono text-[11px] uppercase text-muted-foreground">
                <th className="py-2">Time</th><th>Symbol</th><th>Side</th><th>Vol</th><th>Status</th><th>Ticket</th><th>Price</th><th>P/L</th><th /></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id} className="border-t border-border font-mono text-xs">
                  <td className="py-2">{new Date(r.created_at).toLocaleString()}</td><td>{r.symbol}</td><td className="uppercase">{r.side}</td><td>{r.volume}</td>
                  <td><StatusBadge status={`sig_${r.status}`} />{r.error && <span className="ml-2 text-muted-foreground">{r.error}</span>}</td>
                  <td>{r.ticket ?? "—"}</td><td>{r.fill_price ?? "—"}</td><td>{r.profit ?? "—"}</td>
                  <td>{r.status === "queued" && <button aria-label="Cancel order" onClick={() => cancel.mutate(r.id)} className="text-muted-foreground hover:text-primary"><X className="h-4 w-4" /></button>}</td>
                </tr>))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
