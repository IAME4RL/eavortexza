import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { useEffect, useRef, useState } from "react";
import { Bot, Play, Pause, Square, KeyRound, Copy, Download, Send, X, ChevronDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
@@ -16,8 +16,7 @@ import { cn } from "@/lib/utils";
import { createBridgeToken, startBot, stopBot, enableLiveMode, disableLiveMode, requestEmergencyClose, LIVE_CONFIRM_PHRASE, CLOSE_CONFIRM_PHRASE } from "@/lib/bot.functions";
import { STRATEGIES } from "@/lib/strategy";
import { CloudConnect } from "@/components/CloudConnect";
import { ChangeAccount } from "@/components/ChangeAccount";
import { cloudConfigOf, NO_DAILY_LIMIT, withPerTrade } from "@/lib/cloudTrade";
import { cloudConfigOf } from "@/lib/cloudTrade";
import { HEARTBEAT_ONLINE_MS } from "@/lib/bridge";
import type { Database } from "@/integrations/supabase/types";

@@ -98,6 +97,16 @@ function BotPanel({ account, bot }: { account: Account; bot: BotRow }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const genToken = useServerFn(createBridgeToken);
  // Arriving from the home screen's "Start bot" lands on the profit card, scrolled into view.
  useEffect(() => {
    if (window.location.hash !== "#profit-card") return;
    const el = document.getElementById("profit-card");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary");
    const t = window.setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 2500);
    return () => window.clearTimeout(t);
  }, []);
  const startFn = useServerFn(startBot);
  const stopFn = useServerFn(stopBot);
  const liveOn = useServerFn(enableLiveMode);
@@ -109,19 +118,12 @@ function BotPanel({ account, bot }: { account: Account; bot: BotRow }) {
  const [closeText, setCloseText] = useState("");
  const [strategy, setStrategy] = useState(bot.strategy);
  const [riskPct, setRiskPct] = useState(String(bot.risk_per_trade_pct));
  const [maxLoss, setMaxLoss] = useState(Number(bot.max_daily_loss) > 0 && Number(bot.max_daily_loss) < NO_DAILY_LIMIT ? String(bot.max_daily_loss) : "");
  const [riskAmt, setRiskAmt] = useState(cloudConfigOf(bot.terminal_info)?.riskPerTrade != null ? String(cloudConfigOf(bot.terminal_info)?.riskPerTrade) : "");
  const [targetAmt, setTargetAmt] = useState(cloudConfigOf(bot.terminal_info)?.targetPerTrade != null ? String(cloudConfigOf(bot.terminal_info)?.targetPerTrade) : "");
  const [maxLoss, setMaxLoss] = useState(String(bot.max_daily_loss));
  const run = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); if (ok) toast.success(ok); refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Action failed"); } };
  const [token, setToken] = useState<string | null>(null);
  const [lot, setLot] = useState(String(bot.default_lot));
  const [maxLot, setMaxLot] = useState(String(bot.max_lot));
  const [maxOpen, setMaxOpen] = useState(String(bot.max_open_trades));
    const [profitGoal, setProfitGoal] = useState(Number(bot.profit_goal) > 0 ? String(bot.profit_goal) : "");
  const [profitGoalMode, setProfitGoalMode] = useState<"stop" | "again">(bot.profit_goal_mode === "again" ? "again" : "stop");
  const currentGoalProfit = Number(bot.goal_profit ?? 0);
  const targetProfitNum = Number(profitGoal) || 0;
  const goalProgress = targetProfitNum > 0 ? Math.min(100, Math.max(0, (currentGoalProfit / targetProfitNum) * 100)) : 0;
  const [symbol, setSymbol] = useState("XAUUSD");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [vol, setVol] = useState(String(bot.default_lot));
@@ -176,16 +178,9 @@ function BotPanel({ account, bot }: { account: Account; bot: BotRow }) {
  });

  const rows = signals.data ?? [];
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const closedAll = rows.filter((r) => r.status === "closed" && r.profit != null);
  const historyAll = closedAll;
  const closedToday = closedAll.filter((r) => new Date(r.closed_at ?? r.created_at).getTime() >= dayAgo);
  const closed = closedToday;
  const history = closedToday;
  // Live orders always show; finished ones (rejected / failed / cancelled) disappear after 24 hours.
  const LIVE = new Set(["queued", "sent", "filled", "pending"]);
  const recent = rows.filter((r) => r.status !== "closed" && (LIVE.has(r.status) || new Date(r.created_at).getTime() >= dayAgo));
  const closed = rows.filter((r) => r.status === "closed" && r.profit != null);
  const history = rows.filter((r) => r.status === "closed");
  const recent = rows.filter((r) => r.status !== "closed");
  const pnl = closed.reduce((s, r) => s + Number(r.profit), 0);
  const endpoint = typeof window !== "undefined" ? `${window.location.origin}/api/public/bridge/mt5` : "";
  const positions = Array.isArray(info?.positions) ? info!.positions! : [];
@@ -213,7 +208,6 @@ function BotPanel({ account, bot }: { account: Account; bot: BotRow }) {
            {bot.status !== "stopped" && <button type="button" className="pw-btn" onClick={doStop}><Square className="h-4 w-4" />Stop</button>}
          </div>
        </div>
        <ChangeAccount botId={bot.id} login={account.account_login} server={account.broker_server} label={account.label} isCloud={isCloud} />
        {blockers.length > 0 && (
          <div role="alert" className="mt-4 rounded-xl border border-destructive/50 p-3 text-sm">
            <p className="font-semibold">Start blocked:</p>
@@ -226,77 +220,11 @@ function BotPanel({ account, bot }: { account: Account; bot: BotRow }) {
        <Metric label="Balance" value={info?.balance != null ? `${info.balance.toFixed(2)} ${info.currency ?? ""}` : "—"} hint="From your MT5 terminal" />
        <Metric label="Equity" value={info?.equity != null ? info.equity.toFixed(2) : "—"} />
        <Metric label="Open positions" value={info?.open ?? "—"} hint={`Limit ${bot.max_open_trades}`} />
        <Metric label="Closed P/L (bot)" value={closed.length ? pnl.toFixed(2) : "—"} hint={`${closed.length} closed bot trades`} tone={closed.length ? (pnl >= 0 ? "bull" : "bear") : undefined} />
        <Metric id="profit-card" label="Closed P/L (bot)" value={closed.length ? pnl.toFixed(2) : "—"} hint={`${closed.length} closed bot trades`} tone={closed.length ? (pnl >= 0 ? "bull" : "bear") : undefined} />
      </div>

            {/* Running Profit Goal */}
      <NeonCard className="p-4 sm:p-5">
        <PwLabel red>Running Profit Goal</PwLabel>
        <p className="mt-1 text-xs text-muted-foreground">
          Set a target profit in Rands. When reached, the bot automatically closes all open trades.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className={lbl}>Target Profit (R)</Label>
            <Input
              className={field}
              inputMode="decimal"
              placeholder="e.g. 500 (or leave empty to disable)"
              value={profitGoal}
              onChange={(e) => setProfitGoal(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className={lbl}>When reached</Label>
            <Select value={profitGoalMode} onValueChange={(v) => setProfitGoalMode(v as "stop" | "again")}>
              <SelectTrigger className={field}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="stop">Stop bot (bank profit)</SelectItem>
                <SelectItem value="again">Keep trading (start new goal)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {targetProfitNum > 0 && (
          <div className="mt-4 rounded-xl border border-primary/20 bg-background/50 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Goal Progress</span>
              <span className={cn("font-mono font-bold", currentGoalProfit >= targetProfitNum ? "text-bull" : "text-foreground")}>
                R{currentGoalProfit.toFixed(2)} / R{targetProfitNum.toFixed(2)} ({goalProgress.toFixed(0)}%)
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${goalProgress}%` }}
              />
            </div>
          </div>
        )}
        <button
          type="button"
          className="pw-btn mt-4"
          onClick={() => {
            const g = profitGoal.trim() === "" ? 0 : Number(profitGoal);
            if (g < 0 || !Number.isFinite(g)) {
              toast.error("Profit goal must be 0 or a positive number");
              return;
            }
            update.mutate(
              { profit_goal: g, profit_goal_mode: profitGoalMode },
              { onSuccess: () => toast.success("Profit goal saved") }
            );
          }}
        >
          Save goal
        </button>
      </NeonCard>
      <NeonCard className="p-4 sm:p-5">
        <PwLabel red>Active trades</PwLabel>
      
        {positions.length > 0 ? (
          <ul className="mt-3 divide-y divide-primary/10">
            {positions.map((p) => (
@@ -321,8 +249,8 @@ function BotPanel({ account, bot }: { account: Account; bot: BotRow }) {
      </NeonCard>

      <NeonCard>
        <div className="border-b border-primary/20 px-4 py-3.5 sm:px-5"><PwLabel>Trade history · last 24 hours</PwLabel></div>
        {!history.length ? <p className="px-5 py-6 text-sm text-muted-foreground">{historyAll.length ? "No closed bot trades in the last 24 hours." : "No closed bot trades yet."}</p> : (
        <div className="border-b border-primary/20 px-4 py-3.5 sm:px-5"><PwLabel>Trade history</PwLabel></div>
        {!history.length ? <p className="px-5 py-6 text-sm text-muted-foreground">No closed bot trades yet.</p> : (
          <ul className="divide-y divide-primary/10">
            {history.map((r) => <OrderRow key={r.id} r={r} />)}
          </ul>
@@ -356,29 +284,13 @@ function BotPanel({ account, bot }: { account: Account; bot: BotRow }) {
          <div className="space-y-1"><Label className={lbl}>Max lot</Label><Input className={field} inputMode="decimal" value={maxLot} onChange={(e) => setMaxLot(e.target.value)} /></div>
          <div className="space-y-1"><Label className={lbl}>Max open</Label><Input className={field} inputMode="numeric" value={maxOpen} onChange={(e) => setMaxOpen(e.target.value)} /></div>
          <div className="space-y-1"><Label className={lbl}>Risk % / trade</Label><Input className={field} inputMode="decimal" value={riskPct} onChange={(e) => setRiskPct(e.target.value)} /></div>
          <div className="space-y-1"><Label className={lbl}>Max daily loss (R)</Label><Input className={field} inputMode="decimal" placeholder="Off" value={maxLoss} onChange={(e) => setMaxLoss(e.target.value)} /></div>
          {cloudConfigOf(bot.terminal_info) && (<>
          <div className="space-y-1"><Label className={lbl}>Lose per trade ($)</Label><Input className={field} inputMode="decimal" placeholder="e.g. 10" value={riskAmt} onChange={(e) => setRiskAmt(e.target.value)} /></div>
          <div className="space-y-1"><Label className={lbl}>Win per trade ($)</Label><Input className={field} inputMode="decimal" placeholder="e.g. 20" value={targetAmt} onChange={(e) => setTargetAmt(e.target.value)} /></div>
          </>)}
          <div className="space-y-1"><Label className={lbl}>Max daily loss</Label><Input className={field} inputMode="decimal" value={maxLoss} onChange={(e) => setMaxLoss(e.target.value)} /></div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Cloud trading only. Fill in both and the bot sizes each trade's lot so a stop-out loses about your "lose" amount, and sets the take profit at about your "win" amount. Leave both empty to use the default lot. USD accounts; gold and major pairs only. Trades are skipped if even the smallest lot would risk more than your limit. Leave Max daily loss empty for no daily limit: the bot then keeps trading after losing days, so rely on the per-trade loss amount.</p>
        <label className="mt-4 flex items-center justify-between gap-3 text-sm">
          <span>Demo accounts only <span className="block text-xs text-muted-foreground">Orders are held if the terminal reports a live account.</span></span>
          <Switch checked={bot.demo_only} onCheckedChange={(v) => update.mutate({ demo_only: v })} />
        </label>
        <button type="button" className="pw-btn mt-4" onClick={() => {
          const dl = maxLoss.trim() === "" ? NO_DAILY_LIMIT : Number(maxLoss);
          if (!Number.isFinite(dl) || dl <= 0) { toast.error("Max daily loss must be a positive number, or empty for no daily limit."); return; }
          const r = riskAmt.trim() === "" ? null : Number(riskAmt);
          const t = targetAmt.trim() === "" ? null : Number(targetAmt);
          if ((r === null) !== (t === null)) { toast.error("Fill in both the lose and win amounts, or leave both empty."); return; }
          if (r !== null && t !== null) {
            if (!(r > 0) || !(t > 0) || !Number.isFinite(r) || !Number.isFinite(t)) { toast.error("Lose and win amounts must be positive numbers."); return; }
            if (t / r < 0.25 || t / r > 10) { toast.error("Win amount should be between 0.25x and 10x the lose amount."); return; }
          }
          update.mutate({ default_lot: Number(lot), max_lot: Number(maxLot), max_open_trades: Number(maxOpen), strategy, risk_per_trade_pct: Number(riskPct), max_daily_loss: dl, ...(cloudConfigOf(bot.terminal_info) ? { terminal_info: withPerTrade(bot.terminal_info, r, t) as never } : {}) }, { onSuccess: () => toast.success("Settings saved") });
        }}>Save settings</button>
        <button type="button" className="pw-btn mt-4" onClick={() => update.mutate({ default_lot: Number(lot), max_lot: Number(maxLot), max_open_trades: Number(maxOpen), strategy, risk_per_trade_pct: Number(riskPct), max_daily_loss: Number(maxLoss) }, { onSuccess: () => toast.success("Settings saved") })}>Save settings</button>
      </Section>

      <Section title="Trade without a PC (API2Trade)" open={cloudOpen} onToggle={setCloudOpen}>
@@ -450,9 +362,9 @@ function BotPanel({ account, bot }: { account: Account; bot: BotRow }) {
  );
}

function Metric({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: "bull" | "bear" | undefined }) {
function Metric({ id, label, value, hint, tone }: { id?: string; label: string; value: React.ReactNode; hint?: string; tone?: "bull" | "bear" | undefined }) {
  return (
    <div className="pw-card-quiet p-3.5">
    <div id={id} className="pw-card-quiet scroll-mt-24 rounded-2xl p-3.5 transition-shadow">
      <p className="pw-label text-[0.6rem] text-muted-foreground">{label}</p>
      <p className={cn("mt-1 break-words font-display text-xl font-bold sm:text-2xl", tone === "bull" && "text-bull", tone === "bear" && "text-bear")}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
‎src/routes/_authenticated/dashboard.index.tsx‎
+69
-51
Lines changed: 69 additions & 51 deletions
Original file line number	Diff line number	Diff line change
@@ -1,9 +1,9 @@
import { createFileRoute, Link } from "@tanstack/react-router";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { ScanLine, Clock, ChevronRight, Globe, Key, Check, Upload } from "lucide-react";
import { ScanLine, Clock, ChevronRight, Globe, Key, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getScanQuota } from "@/lib/scan.functions";
import { startBot, stopBot } from "@/lib/bot.functions";
@@ -13,20 +13,9 @@ import { timeframeLabel } from "@/lib/instruments";
import { HEARTBEAT_ONLINE_MS } from "@/lib/bridge";
import { formatRemaining, marketSession } from "@/lib/sessions";
import { getMyAssignedMentorBot, redeemMentorLicense } from "@/lib/mentorBots";
import { BotControls, BotPills, FeaturedBotCard } from "@/components/FeaturedBotCard";
import { NewsSignals } from "@/components/NewsSignals";
import { FeaturedBotCard } from "@/components/FeaturedBotCard";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  head: () => ({ meta: [
    { title: "Client Portal — EA VORTEX" },
    { name: "description", content: "Your EA VORTEX bot, private chart scans, and trading signals." },
    { property: "og:title", content: "Client Portal — EA VORTEX" },
    { property: "og:description", content: "Manage your bot and review your private trading activity." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ClientOverview,
});
export const Route = createFileRoute("/_authenticated/dashboard/")({ component: ClientOverview });

const WATCHLIST = [
  { label: "GOLD", instrument: "XAUUSD", tf: "H1" },
@@ -96,13 +85,12 @@ function ClientOverview() {

  // Start/Stop for the client's bridge bot, available on the featured card for the default
  // bot and for every mentor bot. The server re-checks account, bridge, mode and risk limits.
  const navigate = useNavigate();
  const startFn = useServerFn(startBot);
  const stopFn = useServerFn(stopBot);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [botFeedback, setBotFeedback] = useState<string | null>(null);
  const botAction = useMutation({
    mutationFn: async (kind: "start" | "stop") => {
      setBotFeedback(null);
      if (!userBot) throw new Error("Set up your bot first");
      if (kind === "start") {
        const r = await startFn({ data: { botId: userBot.id } });
@@ -114,7 +102,12 @@ function ClientOverview() {
      await stopFn({ data: { botId: userBot.id } });
      return "Bot stopped — new orders blocked";
    },
    onSuccess: (msg) => { setBotFeedback(msg); toast.success(msg); },
    onSuccess: (msg, kind) => {
      toast.success(msg);
      // Once the bot has actually started, take the client to the profit card on the Trades page.
      // If the start is blocked the mutation throws instead, so they stay here and see the checks.
      if (kind === "start") void navigate({ to: "/dashboard/auto-trade", hash: "profit-card" });
    },
    onError: (e) => { toast.error(e instanceof Error ? e.message : "Action failed"); },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: ["portal-bot", user?.id] }); },
  });
@@ -149,71 +142,96 @@ function ClientOverview() {
  };

  return (
    <div className="w-full min-w-0 space-y-5 pb-10">
    <div className="space-y-5 pb-10">
      {/* Top Welcome / Mentor alert */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div>
          <h1 className="font-display text-xl font-bold uppercase tracking-wider text-foreground sm:text-2xl">
            Client Trading Portal
          </h1>
          <p className="text-xs text-muted-foreground">
            Welcome back{name ? `, ${name}` : ""}. Real-time algorithmic status & technical analysis.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {running ? <Pill tone="live">Bot active</Pill> : <Pill tone="idle">Bot standby</Pill>}
          {online ? <Pill tone="ok">MT5 online</Pill> : <Pill tone="idle">MT5 bridge offline</Pill>}
        </div>
      </div>
      {counts.data?.profile?.mentor_requested && !hasRole("mentor") && (
        <div className="pw-card-quiet flex items-center gap-3 p-4 text-sm text-neutral">
          <Clock className="h-4 w-4 shrink-0 text-primary" />
          <span>Your mentor access request is awaiting administrator approval.</span>
        </div>
      )}

      {/* Status pills, then the bot card: the picture only, name and avatar are in the top bar */}
      <BotPills running={!!running} />
      {/* FEATURED BOT CARD: the mentor's bot once a license is redeemed, otherwise the default EAVORTEX bot */}
      <div ref={featuredCardRef} className="scroll-mt-4">
        <FeaturedBotCard
          mentorBot={assignedMentorBot.data}
          loading={assignedMentorBot.isLoading}
          userBot={userBot}
          running={running}
          online={!!online}
          control={{
            hasBot: !!userBot,
            status: userBot?.status ?? "stopped",
            busy: botAction.isPending,
            blockers,
            onStart: () => botAction.mutate("start"),
            onStop: () => botAction.mutate("stop"),
          }}
        />
      </div>

      <BotControls
        control={{
          hasBot: !!userBot,
          status: userBot?.status ?? "stopped",
          busy: botAction.isPending,
          blockers,
          onStart: () => botAction.mutate("start"),
          onStop: () => botAction.mutate("stop"),
        }}
      />
      {botFeedback && <p role="status" className="text-center text-sm text-bull">{botFeedback}</p>}
      <div className="flex items-center justify-center gap-2">
        {online ? <Pill tone="ok">MT5 online</Pill> : <Pill tone="idle">MT5 bridge offline</Pill>}
      {/* TWO MAIN CALL TO ACTION BUTTONS (Reference Screen) */}
      <div className="grid grid-cols-1 gap-4">
        <Link
          to="/dashboard/scanner"
          className="group relative flex items-center justify-between overflow-hidden rounded-xl border border-primary/30 bg-surface/80 p-5 transition-all hover:border-primary hover:bg-surface hover:shadow-lg hover:shadow-primary/10"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 text-primary transition-transform group-hover:scale-105">
              <ScanLine className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold uppercase text-foreground">
                SCAN CHART
              </h3>
              <p className="text-xs text-muted-foreground">
                Upload TradingView/MT5 chart for AI vision analysis
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
        </Link>
      </div>

      {/* AI CHART VISION */}
      <NeonCard className="p-5">
        <PwLabel>AI Chart Vision</PwLabel>
        <p className="mt-2 text-xs text-muted-foreground">
          Drop a TradingView or MT5 screenshot — the AI reads structure, liquidity and your trade result.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link to="/dashboard/scanner" className="pw-btn"><ScanLine className="h-4 w-4" />Scan chart</Link>
          <Link to="/dashboard/history" className="pw-btn border-transparent bg-transparent shadow-none"><Upload className="h-4 w-4" />Trade result</Link>
        </div>
      </NeonCard>
      {/* MARKET WATCHLIST & SESSION INTELLIGENCE */}
      <div className="grid min-w-0 gap-5 lg:grid-cols-2 [&>*]:min-w-0">
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Watchlist */}
        <NeonCard className="p-5">
          <div className="flex items-center justify-between">
            <PwLabel>Market Watchlist</PwLabel>
            <span className="text-[11px] font-mono text-muted-foreground">TAP TO SCAN</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {WATCHLIST.map((w, i) => (
              <Link key={w.label} to="/dashboard/scanner" className="pw-chip" data-active={i === 0}>{w.label}</Link>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {WATCHLIST.map((w) => (
              <Link
                key={w.label}
                to="/dashboard/scanner"
                className="flex flex-col items-center justify-center rounded-lg border border-border/80 bg-background/50 p-3 text-center transition-all hover:border-primary/50 hover:bg-primary/5"
              >
                <span className="font-display text-sm font-bold text-foreground">{w.label}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{w.instrument}</span>
              </Link>
            ))}
          </div>
        </NeonCard>

        {/* Session Card */}
        <SessionCard />
        <NewsSignals limit={3} />
      </div>

      {/* MENTOR KEY REDEMPTION CARD */}
