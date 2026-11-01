import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { Bot, Play, Pause, Square, KeyRound, Copy, Download, Send, X, ChevronDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/dash";
import { NeonCard, PortalTitle, PwLabel } from "@/components/portal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { createBridgeToken, startBot, stopBot, enableLiveMode, disableLiveMode, requestEmergencyClose, LIVE_CONFIRM_PHRASE, CLOSE_CONFIRM_PHRASE } from "@/lib/bot.functions";
import { STRATEGIES } from "@/lib/strategy";
import { HEARTBEAT_ONLINE_MS } from "@/lib/bridge";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/dashboard/auto-trade")({
  head: () => ({ meta: [
    { title: "Auto Trade — EA VORTEX" },
    { name: "description", content: "Connect your MT5 terminal with the EA VORTEX Bridge and manage queued orders and execution reports." },
    { property: "og:title", content: "Auto Trade — EA VORTEX" },
    { property: "og:description", content: "MT5 Bridge connection, order controls and terminal-reported trade history." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "robots", content: "noindex" },
  ] }),
  component: Page,
});

type BotRow = Database["public"]["Tables"]["bots"]["Row"];
type Account = Database["public"]["Tables"]["trading_accounts"]["Row"];
const lbl = "pw-label text-[0.62rem] text-muted-foreground";
const field = "pw-field";
type Position = { ticket: string; symbol: string; side: string; volume: number; price: number; profit: number };

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const data = useQuery({
    queryKey: ["auto-trade"],
    refetchInterval: 15_000,
    queryFn: async () => {
      const [a, b] = await Promise.all([
        supabase.from("trading_accounts").select("*").eq("user_id", user?.id ?? "").eq("platform", "MT5").order("created_at"),
        supabase.from("bots").select("*").eq("user_id", user?.id ?? ""),
      ]);
      return { accounts: a.data ?? [], bots: b.data ?? [] };
    },
  });

  const createBot = useMutation({
    mutationFn: async (accountId: string) => {
      if (!user) throw new Error("Sign in first");
      const { error } = await supabase.from("bots").insert({ user_id: user.id, account_id: accountId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auto-trade"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create bot"),
  });

  const accounts = data.data?.accounts ?? [];
  return (
    <>
      <PortalTitle title="Trades"
        sub="Control your EA VORTEX bot. Orders are executed by the EA VORTEX Bridge running inside your own MT5 terminal, so trading continues while this website is closed, as long as MT5 stays open." />
      {!accounts.length ? (
        <NeonCard className="flex flex-col items-center px-6 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/40 text-primary"><Bot className="h-5 w-5" /></div>
          <h2 className="pw-title mt-5 text-lg">No MT5 account yet</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">Register your MetaTrader 5 account login and server first.</p>
          <Link to="/dashboard/ea" className="pw-btn pw-btn-solid mt-6">Register MT5 account</Link>
        </NeonCard>
      ) : (
        <div className="space-y-8">
          {accounts.map((a) => {
            const bot = data.data?.bots.find((b) => b.account_id === a.id);
            return bot ? <BotPanel key={a.id} account={a} bot={bot} /> : (
              <NeonCard key={a.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="font-display text-lg font-bold">{a.label || a.account_login}</p><p className="text-sm text-muted-foreground">{a.account_login} · {a.broker_server}</p></div>
                <button type="button" className="pw-btn pw-btn-solid" onClick={() => createBot.mutate(a.id)} disabled={createBot.isPending}><Bot className="h-4 w-4" />Set up bot</button>
              </NeonCard>
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
  const startFn = useServerFn(startBot);
  const stopFn = useServerFn(stopBot);
  const liveOn = useServerFn(enableLiveMode);
  const liveOff = useServerFn(disableLiveMode);
  const closeFn = useServerFn(requestEmergencyClose);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [liveText, setLiveText] = useState("");
  const [liveAck, setLiveAck] = useState(false);
  const [closeText, setCloseText] = useState("");
  const [strategy, setStrategy] = useState(bot.strategy);
  const [riskPct, setRiskPct] = useState(String(bot.risk_per_trade_pct));
  const [maxLoss, setMaxLoss] = useState(String(bot.max_daily_loss));
  const run = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); if (ok) toast.success(ok); refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Action failed"); } };
  const [token, setToken] = useState<string | null>(null);
  const [lot, setLot] = useState(String(bot.default_lot));
  const [maxLot, setMaxLot] = useState(String(bot.max_lot));
  const [maxOpen, setMaxOpen] = useState(String(bot.max_open_trades));
  const [symbol, setSymbol] = useState("XAUUSD");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [vol, setVol] = useState(String(bot.default_lot));
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [connectOpen, setConnectOpen] = useState(!bot.bridge_token_hash);
  const [orderOpen, setOrderOpen] = useState(false);
  const [showAllSignals, setShowAllSignals] = useState(false);
  const orderRef = useRef<HTMLDetailsElement>(null);

  const online = !!bot.last_heartbeat && Date.now() - new Date(bot.last_heartbeat).getTime() < HEARTBEAT_ONLINE_MS;
  const info = bot.terminal_info as { demo?: boolean; balance?: number; equity?: number; currency?: string; open?: number; login?: string; positions?: Position[] } | null;
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

  const doStart = () => run(async () => { const r = await startFn({ data: { botId: bot.id } }); setBlockers(r.blockers); if (!r.ok) throw new Error("Start blocked — see checks below"); }, "Bot started");
  const doStop = () => run(async () => { const r = await stopFn({ data: { botId: bot.id } }); qc.invalidateQueries({ queryKey: ["signals", bot.id] }); return r; }, "Bot stopped — new orders blocked, queued orders cancelled");
  const queue = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in first");
      const v = Number(vol);
      if (!(v > 0) || v > Number(bot.max_lot)) throw new Error(`Volume must be between 0.01 and your max lot (${bot.max_lot})`);
      const { error } = await supabase.from("trade_signals").insert({
        user_id: user.id, bot_id: bot.id, symbol: symbol.trim(), side, volume: v,
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
  const history = rows.filter((r) => r.status === "closed");
  const recent = rows.filter((r) => r.status !== "closed");
  const pnl = closed.reduce((s, r) => s + Number(r.profit), 0);
  const endpoint = typeof window !== "undefined" ? `${window.location.origin}/api/public/bridge/mt5` : "";
  const positions = Array.isArray(info?.positions) ? info!.positions! : [];
  const openCount = info?.open ?? positions.length;
  const last = rows[0];
  const openOrderForm = () => { setOrderOpen(true); setTimeout(() => orderRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50); };

  return (
    <div className="space-y-5">
      <NeonCard className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold">{account.label || account.account_login}</p>
            <p className="text-sm text-muted-foreground">MT5 · {account.account_login} · {account.broker_server}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge status={bot.status} />
              <StatusBadge status={online ? "terminal_online" : bot.last_heartbeat ? "terminal_offline" : "terminal_never"} />
              <StatusBadge status={bot.trading_mode === "live" ? "live" : "demo"} />
            </div>
            {bot.stop_requested_at && !bot.stop_ack_at && <p className="mt-2 text-xs text-muted-foreground">Stop awaiting terminal confirmation</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {bot.status !== "running" && <button type="button" className="pw-btn pw-btn-solid" onClick={doStart}><Play className="h-4 w-4" />{bot.status === "paused" ? "Resume" : "Start"}</button>}
            {bot.status === "running" && <button type="button" className="pw-btn" onClick={() => update.mutate({ status: "paused" })}><Pause className="h-4 w-4" />Pause</button>}
            {bot.status !== "stopped" && <button type="button" className="pw-btn" onClick={doStop}><Square className="h-4 w-4" />Stop</button>}
          </div>
        </div>
        {blockers.length > 0 && (
          <div role="alert" className="mt-4 rounded-xl border border-destructive/50 p-3 text-sm">
            <p className="font-semibold">Start blocked:</p>
            <ul className="mt-1 list-disc pl-5 text-muted-foreground">{blockers.map((b) => <li key={b}>{b}</li>)}</ul>
          </div>
        )}
      </NeonCard>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Balance" value={info?.balance != null ? `${info.balance.toFixed(2)} ${info.currency ?? ""}` : "—"} hint="From your MT5 terminal" />
        <Metric label="Equity" value={info?.equity != null ? info.equity.toFixed(2) : "—"} />
        <Metric label="Open positions" value={info?.open ?? "—"} hint={`Limit ${bot.max_open_trades}`} />
        <Metric label="Closed P/L (bot)" value={closed.length ? pnl.toFixed(2) : "—"} hint={`${closed.length} closed bot trades`} tone={closed.length ? (pnl >= 0 ? "bull" : "bear") : undefined} />
      </div>

      <NeonCard className="p-4 sm:p-5">
        <PwLabel red>Active trades</PwLabel>
        {positions.length > 0 ? (
          <ul className="mt-3 divide-y divide-primary/10">
            {positions.map((p) => (
              <li key={p.ticket} className="flex items-center justify-between gap-3 py-3">
                <span><span className="font-display text-sm font-bold uppercase tracking-wider">{p.symbol} · {p.side}</span><span className="block font-mono text-xs text-muted-foreground">#{p.ticket} · {p.volume} lots @ {p.price}</span></span>
                <span className={cn("font-mono text-sm font-semibold", Number(p.profit) >= 0 ? "text-bull" : "text-bear")}>{Number(p.profit) >= 0 ? "+" : ""}{Number(p.profit).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="py-5 text-center">
            <p className="pw-title text-lg">{openCount ? `${openCount} open position${openCount === 1 ? "" : "s"}` : "No active trades"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{openCount ? "Your terminal did not send position details." : bot.status === "running" ? "Waiting for setup…" : "Start the bot to begin."}</p>
          </div>
        )}
        <div className="mt-2 grid grid-cols-2 gap-3 border-t border-primary/15 pt-4">
          <div><p className={lbl}>Last signal</p><p className="mt-1 font-display text-sm font-bold uppercase">{last ? `${last.symbol} ${last.side}` : "—"}</p></div>
          <div><p className={lbl}>Last check-in</p><p className="mt-1 font-display text-sm font-bold">{bot.last_heartbeat ? new Date(bot.last_heartbeat).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</p></div>
        </div>
        {bot.last_decision && <p className="mt-3 break-words text-xs text-muted-foreground">Strategy: {bot.last_decision}</p>}
        <button type="button" className="pw-btn mt-4 w-full" onClick={openOrderForm}><Plus className="h-4 w-4" />Send order</button>
      </NeonCard>

      <NeonCard>
        <div className="border-b border-primary/20 px-4 py-3.5 sm:px-5"><PwLabel>Trade history</PwLabel></div>
        {!history.length ? <p className="px-5 py-6 text-sm text-muted-foreground">No closed bot trades yet.</p> : (
          <ul className="divide-y divide-primary/10">
            {history.map((r) => <OrderRow key={r.id} r={r} />)}
          </ul>
        )}
      </NeonCard>

      <NeonCard>
        <div className="border-b border-primary/20 px-4 py-3.5 sm:px-5"><PwLabel>Recent signals</PwLabel></div>
        {!recent.length ? <p className="px-5 py-6 text-sm text-muted-foreground">No orders yet.</p> : (
          <>
            <ul className="divide-y divide-primary/10">
              {(showAllSignals ? recent : recent.slice(0, 8)).map((r) => <OrderRow key={r.id} r={r} onCancel={r.status === "queued" ? () => cancel.mutate(r.id) : undefined} />)}
            </ul>
            {recent.length > 8 && <button type="button" className="w-full border-t border-primary/15 py-3 text-xs text-primary" onClick={() => setShowAllSignals((v) => !v)}>{showAllSignals ? "Show fewer" : `Show all ${recent.length}`}</button>}
          </>
        )}
      </NeonCard>

      <Section title="Risk settings">
        <div className="space-y-1"><Label className={lbl}>Strategy</Label>
          <Select value={strategy} onValueChange={setStrategy}><SelectTrigger className={field}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual orders only</SelectItem>
              <SelectItem value="auto">Auto (all built-in strategies)</SelectItem>
              {STRATEGIES.map((st) => <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>)}
            </SelectContent></Select>
          <p className="text-xs text-muted-foreground">{STRATEGIES.find((st) => st.id === strategy)?.rules ?? (strategy === "auto" ? "The terminal sends recent candles and the bot opens trades when a built-in strategy's rules are met." : "The bot only sends orders you queue yourself.")}</p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="space-y-1"><Label className={lbl}>Default lot</Label><Input className={field} inputMode="decimal" value={lot} onChange={(e) => setLot(e.target.value)} /></div>
          <div className="space-y-1"><Label className={lbl}>Max lot</Label><Input className={field} inputMode="decimal" value={maxLot} onChange={(e) => setMaxLot(e.target.value)} /></div>
          <div className="space-y-1"><Label className={lbl}>Max open</Label><Input className={field} inputMode="numeric" value={maxOpen} onChange={(e) => setMaxOpen(e.target.value)} /></div>
          <div className="space-y-1"><Label className={lbl}>Risk % / trade</Label><Input className={field} inputMode="decimal" value={riskPct} onChange={(e) => setRiskPct(e.target.value)} /></div>
          <div className="space-y-1"><Label className={lbl}>Max daily loss</Label><Input className={field} inputMode="decimal" value={maxLoss} onChange={(e) => setMaxLoss(e.target.value)} /></div>
        </div>
        <label className="mt-4 flex items-center justify-between gap-3 text-sm">
          <span>Demo accounts only <span className="block text-xs text-muted-foreground">Orders are held if the terminal reports a live account.</span></span>
          <Switch checked={bot.demo_only} onCheckedChange={(v) => update.mutate({ demo_only: v })} />
        </label>
        <button type="button" className="pw-btn mt-4" onClick={() => update.mutate({ default_lot: Number(lot), max_lot: Number(maxLot), max_open_trades: Number(maxOpen), strategy, risk_per_trade_pct: Number(riskPct), max_daily_loss: Number(maxLoss) }, { onSuccess: () => toast.success("Settings saved") })}>Save settings</button>
      </Section>

      <Section title="Connect MT5" open={connectOpen} onToggle={setConnectOpen}>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Download the EA VORTEX Bridge and copy it to MT5 → File → Open Data Folder → MQL5/Experts. Open it in MetaEditor and press Compile (F7).</li>
          <li>In MT5: Tools → Options → Expert Advisors → allow WebRequest for the URL below.</li>
          <li>Attach the Bridge to one chart only. Set BridgeURL to the published address below, BridgeToken to your private token, ExpectedLogin to {account.account_login}, and ExpectedServer to {account.broker_server}.</li>
          <li>Use an MT5 demo hedging account first. Keep DemoOnly enabled, check the terminal lot, spread and position limits, then enable Algo Trading. Keep MT5 open on your PC or VPS.</li>
        </ol>
        <p className="mt-2 text-xs text-muted-foreground">This Bridge executes queued orders; it does not generate a strategy. Pause and Stop do not close existing positions. If an order remains Sent after a connection interruption, check MT5 history before replacing it. Do not run the same bot on multiple terminals.</p>
        <div className="mt-3 flex items-center gap-2"><Input readOnly value={endpoint} className={cn(field, "font-mono text-xs")} />
          <button type="button" className="pw-btn min-h-11 w-11 shrink-0 px-0" aria-label="Copy URL" onClick={() => { navigator.clipboard.writeText(endpoint); toast.success("URL copied"); }}><Copy className="h-4 w-4" /></button></div>
        {token && (
          <div className="mt-3 rounded-xl border border-primary/40 bg-accent p-3">
            <p className="text-xs text-muted-foreground">Your bridge token — shown once. Keep it private.</p>
            <div className="mt-2 flex items-center gap-2"><Input readOnly value={token} className={cn(field, "font-mono text-xs")} />
              <button type="button" className="pw-btn min-h-11 w-11 shrink-0 px-0" aria-label="Copy token" onClick={() => { navigator.clipboard.writeText(token); toast.success("Token copied"); }}><Copy className="h-4 w-4" /></button></div>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="pw-btn pw-btn-solid" onClick={async () => { try { const r = await genToken({ data: { botId: bot.id } }); setToken(r.token); refresh(); } catch { toast.error("Could not create token"); } }}>
            <KeyRound className="h-4 w-4" />{bot.bridge_token_hash ? "Replace token" : "Create token"}</button>
          <a className="pw-btn" href="/EA_VORTEX_Bridge.mq5" download><Download className="h-4 w-4" />Download Bridge EA</a>
        </div>
      </Section>

      <Section title="Send an order to MT5" open={orderOpen} onToggle={setOrderOpen} innerRef={orderRef}>
        <p className="text-xs text-muted-foreground">Market order executed by your terminal while the bot is running. Use your broker's exact symbol name (e.g. XAUUSD, XAUUSD.m, GOLD). Trading carries risk; no outcome is guaranteed.</p>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-6">
          <div className="space-y-1"><Label className={lbl}>Symbol</Label><Input className={field} value={symbol} onChange={(e) => setSymbol(e.target.value)} maxLength={20} /></div>
          <div className="space-y-1"><Label className={lbl}>Side</Label>
            <Select value={side} onValueChange={(v) => setSide(v as "buy" | "sell")}><SelectTrigger className={field}><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="buy">Buy</SelectItem><SelectItem value="sell">Sell</SelectItem></SelectContent></Select></div>
          <div className="space-y-1"><Label className={lbl}>Volume</Label><Input className={field} inputMode="decimal" value={vol} onChange={(e) => setVol(e.target.value)} /></div>
          <div className="space-y-1"><Label className={lbl}>Stop loss</Label><Input className={field} inputMode="decimal" value={sl} onChange={(e) => setSl(e.target.value)} placeholder="optional" /></div>
          <div className="space-y-1"><Label className={lbl}>Take profit</Label><Input className={field} inputMode="decimal" value={tp} onChange={(e) => setTp(e.target.value)} placeholder="optional" /></div>
          <div className="flex items-end"><button type="button" className="pw-btn pw-btn-solid w-full" onClick={() => queue.mutate()} disabled={queue.isPending || symbol.trim().length < 2}><Send className="h-4 w-4" />Queue</button></div>
        </div>
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <NeonCard className="p-4 sm:p-5">
          <PwLabel red>Trading mode: {bot.trading_mode === "live" ? "LIVE" : "DEMO"}</PwLabel>
          {bot.trading_mode === "live" ? (
            <><p className="mt-2 text-xs text-muted-foreground">Live mode uses real money. Switching back to demo stops the bot.</p>
            <button type="button" className="pw-btn mt-3" onClick={() => run(() => liveOff({ data: { botId: bot.id } }), "Switched to demo mode")}>Switch to demo</button></>
          ) : (
            <><p className="mt-2 text-xs text-muted-foreground">Live trading risks real money and has not been verified on your terminal. To enable it, type <span className="font-mono">{LIVE_CONFIRM_PHRASE}</span>.</p>
            <Input className={cn(field, "mt-2")} value={liveText} onChange={(e) => setLiveText(e.target.value)} placeholder={LIVE_CONFIRM_PHRASE} />
            <label className="mt-2 flex items-center gap-2 text-xs"><Switch checked={liveAck} onCheckedChange={setLiveAck} />I understand I can lose money and no profit is guaranteed.</label>
            <button type="button" className="pw-btn mt-3" disabled={!liveAck || liveText.trim() !== LIVE_CONFIRM_PHRASE}
              onClick={() => run(() => liveOn({ data: { botId: bot.id, confirm: liveText, acknowledged: true } }), "Live mode enabled — press Start to verify and run")}>Enable live mode</button></>
          )}
        </NeonCard>
        <section className="rounded-[1.15rem] border border-destructive/45 bg-[#080303] p-4 sm:p-5">
          <PwLabel className="text-destructive">Emergency close</PwLabel>
          <p className="mt-2 text-xs text-muted-foreground">Stops the bot and asks MT5 to close this bot's open positions (subject to broker rules). Type <span className="font-mono">{CLOSE_CONFIRM_PHRASE}</span>.</p>
          {bot.emergency_close_requested_at && <p className="mt-1 text-xs">{bot.emergency_close_ack_at ? `Terminal result: ${bot.emergency_close_result ?? "done"}` : "Waiting for terminal…"}</p>}
          <Input className={cn(field, "mt-2")} value={closeText} onChange={(e) => setCloseText(e.target.value)} placeholder={CLOSE_CONFIRM_PHRASE} />
          <button type="button" className="pw-btn pw-btn-danger mt-3" disabled={closeText.trim() !== CLOSE_CONFIRM_PHRASE}
            onClick={() => run(async () => { await closeFn({ data: { botId: bot.id, confirm: closeText } }); setCloseText(""); }, "Emergency close sent")}>Close all positions</button>
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: "bull" | "bear" | undefined }) {
  return (
    <div className="pw-card-quiet p-3.5">
      <p className="pw-label text-[0.6rem] text-muted-foreground">{label}</p>
      <p className={cn("mt-1 break-words font-display text-xl font-bold sm:text-2xl", tone === "bull" && "text-bull", tone === "bear" && "text-bear")}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

type SignalRow = Database["public"]["Tables"]["trade_signals"]["Row"];
function OrderRow({ r, onCancel }: { r: SignalRow; onCancel?: (() => void) | undefined }) {
  const profit = r.profit != null ? Number(r.profit) : null;
  return (
    <li className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <p className="font-display text-sm font-bold uppercase tracking-wider">
          {r.symbol} <span className={r.side === "buy" ? "text-bull" : "text-bear"}>{r.side}</span>
          <span className="ml-2 whitespace-nowrap font-mono text-xs font-normal normal-case text-muted-foreground">{r.volume} lots</span>
        </p>
        <p className="mt-0.5 break-words font-mono text-[11px] text-muted-foreground">
          {new Date(r.created_at).toLocaleString()}{r.strategy ? ` · ${r.strategy}` : ""}{r.ticket ? ` · #${r.ticket}` : ""}{r.fill_price != null ? ` · @ ${r.fill_price}` : ""}
        </p>
        {r.error && <p className="mt-0.5 text-xs text-muted-foreground">{r.error}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {profit != null && <span className={cn("font-mono text-sm font-semibold", profit >= 0 ? "text-bull" : "text-bear")}>{profit >= 0 ? "+" : ""}{profit.toFixed(2)}</span>}
        <StatusBadge status={`sig_${r.status}`} />
        {onCancel && <button type="button" aria-label="Cancel order" onClick={onCancel} className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}
      </div>
    </li>
  );
}

function Section({ title, children, open, onToggle, innerRef }: {
  title: string; children: React.ReactNode; open?: boolean | undefined; onToggle?: ((v: boolean) => void) | undefined; innerRef?: React.Ref<HTMLDetailsElement> | undefined;
}) {
  return (
    <details ref={innerRef} open={open} onToggle={onToggle ? (e) => onToggle(e.currentTarget.open) : undefined} className="pw-card-quiet group">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-4 py-3 sm:px-5 [&::-webkit-details-marker]:hidden">
        <PwLabel>{title}</PwLabel>
        <ChevronDown className="h-4 w-4 text-primary transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t border-primary/15 p-4 sm:p-5">{children}</div>
    </details>
  );
}
