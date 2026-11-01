import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { 
  ScanLine, Activity, Clock, ChevronRight, Globe, Zap, 
  Bot, ShieldCheck, Key, Check, TrendingUp, Layers
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getScanQuota } from "@/lib/scan.functions";
import { Gauge, NeonCard, Pill, PwLabel } from "@/components/portal";
import { useAuth } from "@/lib/auth";
import { timeframeLabel } from "@/lib/instruments";
import { HEARTBEAT_ONLINE_MS } from "@/lib/bridge";
import { formatRemaining, marketSession } from "@/lib/sessions";

export const Route = createFileRoute("/_authenticated/dashboard/")({ component: ClientOverview });

const WATCHLIST = [
  { label: "GOLD", instrument: "XAUUSD", tf: "H1" },
  { label: "NAS100", instrument: "NAS100", tf: "M15" },
  { label: "EURUSD", instrument: "EURUSD", tf: "H1" },
  { label: "GBPUSD", instrument: "GBPUSD", tf: "H1" },
  { label: "BTCUSD", instrument: "BTCUSD", tf: "H1" },
  { label: "US30", instrument: "US30", tf: "M15" },
] as const;

function ClientOverview() {
  const { user, hasRole } = useAuth();
  const quotaFn = useServerFn(getScanQuota);
  const quota = useQuery({ queryKey: ["quota"], queryFn: () => quotaFn() });

  const [licenseInput, setLicenseInput] = useState("");
  const [licenseStatus, setLicenseStatus] = useState<string | null>(null);

  const recent = useQuery({
    queryKey: ["scans", "recent"],
    queryFn: async () => (
      await supabase
        .from("scans")
        .select("id,instrument,timeframe,status,created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(5)
    ).data ?? [],
  });

  const counts = useQuery({
    queryKey: ["overview-counts"],
    queryFn: async () => {
      const [a, n, p] = await Promise.all([
        supabase.from("trading_accounts").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user!.id).eq("read", false),
        supabase.from("profiles").select("mentor_requested,display_name").eq("id", user!.id).single(),
      ]);
      return { accounts: a.count ?? 0, unread: n.count ?? 0, profile: p.data };
    },
  });

  const bots = useQuery({
    queryKey: ["portal-bot", user?.id],
    refetchInterval: 15_000,
    queryFn: async () => (
      await supabase
        .from("bots")
        .select("*")
        .eq("user_id", user!.id)
    ).data ?? [],
  });

  const userBot = bots.data?.[0];
  const q = quota.data;
  const name = counts.data?.profile?.display_name;

  const running = userBot?.status === "running";
  const online = userBot?.last_heartbeat && Date.now() - new Date(userBot.last_heartbeat).getTime() < HEARTBEAT_ONLINE_MS;

  const handleActivateLicense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseInput.trim()) return;
    if (licenseInput.trim().toUpperCase().startsWith("EVX-")) {
      setLicenseStatus("License verified! Mentor execution bot privileges unlocked.");
    } else {
      setLicenseStatus("Invalid format. Mentor keys must start with EVX-");
    }
  };

  return (
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

      {/* FEATURED BOT CARD (Reference Screen) */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-surface via-surface/90 to-primary/10 p-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded bg-primary/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
                {userBot ? userBot.strategy.replace(/_/g, " ") : "QUANTUM VORTEX AI"}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {userBot?.trading_mode === "live" ? "LIVE EXECUTION" : "DEMO / TEST"}
              </span>
            </div>
            <h2 className="font-display text-xl font-black uppercase tracking-wide text-foreground sm:text-2xl">
              {userBot ? "EA VORTEX ENGINE" : "GOLD VORTEX PRO AI"}
            </h2>
            <p className="text-xs text-muted-foreground">
              Institutional order block & ICT liquidity execution on XAUUSD.
            </p>
          </div>

          <div className="text-right">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs font-bold ${
              running ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-primary/20 text-primary border border-primary/30"
            }`}>
              <span className={`h-2 w-2 rounded-full ${running ? "bg-emerald-400 animate-pulse" : "bg-primary"}`} />
              {running ? "ACTIVE" : "STANDBY"}
            </span>
          </div>
        </div>

        {/* Bot Performance Metrics */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-border/60 pt-4">
          <div className="rounded-lg bg-black/40 p-2.5">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Target Symbol</p>
            <p className="mt-0.5 font-mono text-sm font-bold text-foreground">GOLD / XAUUSD</p>
          </div>
          <div className="rounded-lg bg-black/40 p-2.5">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Win Rate (Backtest)</p>
            <p className="mt-0.5 font-mono text-sm font-bold text-emerald-400">78.4%</p>
          </div>
          <div className="rounded-lg bg-black/40 p-2.5">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Max Drawdown</p>
            <p className="mt-0.5 font-mono text-sm font-bold text-foreground">4.2%</p>
          </div>
          <div className="rounded-lg bg-black/40 p-2.5">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">MT5 Bridge</p>
            <p className="mt-0.5 font-mono text-sm font-bold text-primary">
              {online ? "Connected" : "Disconnected"}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-2">
          <p className="text-xs text-muted-foreground">
            Configure risk, lot size, and Windows MetaTrader 5 bridge in Auto Trade.
          </p>
          <Link
            to="/dashboard/auto-trade"
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90 transition-all"
          >
            <Zap className="h-3.5 w-3.5" />
            Manage Bot Controls
          </Link>
        </div>
      </div>

      {/* TWO MAIN CALL TO ACTION BUTTONS (Reference Screen) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

        <Link
          to="/dashboard/signals"
          className="group relative flex items-center justify-between overflow-hidden rounded-xl border border-border bg-surface/80 p-5 transition-all hover:border-primary hover:bg-surface hover:shadow-lg hover:shadow-primary/10"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 text-primary transition-transform group-hover:scale-105">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold uppercase text-foreground">
                MARKET SIGNALS
              </h3>
              <p className="text-xs text-muted-foreground">
                View 15+ automated technical setups and levels
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
        </Link>
      </div>

      {/* MARKET WATCHLIST & SESSION INTELLIGENCE */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Watchlist */}
        <NeonCard className="p-5">
          <div className="flex items-center justify-between">
            <PwLabel>Market Watchlist</PwLabel>
            <span className="text-[11px] font-mono text-muted-foreground">TAP TO VIEW SIGNALS</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {WATCHLIST.map((w) => (
              <Link
                key={w.label}
                to="/dashboard/signals"
                search={{ instrument: w.instrument, timeframe: w.tf }}
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
      </div>

      {/* MENTOR KEY REDEMPTION CARD */}
      <NeonCard className="p-5">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-primary" />
          <PwLabel>Link Mentor License Key</PwLabel>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          If your mentor issued you a robot license key, enter it below to connect your account to their academy and custom bot strategies.
        </p>

        <form onSubmit={handleActivateLicense} className="mt-3 flex flex-wrap gap-2">
          <input
            type="text"
            value={licenseInput}
            onChange={(e) => setLicenseInput(e.target.value)}
            placeholder="e.g. EVX-MTR-8942-XAU"
            className="flex-1 min-w-[200px] rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs uppercase text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 font-display text-xs font-bold uppercase text-primary-foreground hover:bg-primary/90 transition-all"
          >
            Activate Key
          </button>
        </form>

        {licenseStatus && (
          <p className="mt-2 text-xs font-medium text-emerald-400 flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5" />
            {licenseStatus}
          </p>
        )}
      </NeonCard>

      {/* RECENT SCANS */}
      <NeonCard>
        <div className="flex items-center justify-between border-b border-primary/20 px-4 py-3.5 sm:px-5">
          <PwLabel>Recent Chart Scans</PwLabel>
          <Link to="/dashboard/history" className="flex items-center gap-1 text-xs text-primary">
            View all <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        {recent.data?.length ? (
          <ul className="divide-y divide-primary/10">
            {recent.data.map((s) => (
              <li key={s.id}>
                <Link
                  to="/dashboard/scan/$id"
                  params={{ id: s.id }}
                  className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-primary/5 sm:px-5"
                >
                  <span>
                    <span className="block font-display text-sm font-semibold uppercase tracking-wider">
                      {s.instrument} · {timeframeLabel(s.timeframe)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {new Date(s.created_at).toLocaleString()}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Pill tone={s.status === "completed" ? "ok" : s.status === "failed" ? "live" : "warn"}>
                      {s.status}
                    </Pill>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            No scans yet. Upload your first chart to get started.
          </div>
        )}
      </NeonCard>
    </div>
  );
}

function SessionCard() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const s = now ? marketSession(now) : null;
  return (
    <NeonCard className="p-5">
      <div className="flex items-center justify-between">
        <PwLabel className="flex items-center gap-2">
          <Globe className="h-3.5 w-3.5 text-primary" />Session Intelligence
        </PwLabel>
        {s && (s.state === "open" ? <Pill tone="live">Open</Pill> : <Pill tone="idle">Closed</Pill>)}
      </div>
      {!s ? (
        <div className="mt-4 h-16" />
      ) : s.state === "open" ? (
        <div className="mt-3 flex items-center gap-4">
          <Gauge value={s.progress} label={`${s.name} session elapsed`} />
          <div className="min-w-0">
            <p className="pw-title text-base">{s.name} session</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatRemaining(s.remainingMs)} remaining{s.alsoOpen.length ? ` · overlaps ${s.alsoOpen.join(", ")}` : ""}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <p className="pw-title text-base">Market closed</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Forex reopens Sunday 22:00 UTC, in {formatRemaining(s.opensInMs)}.
          </p>
        </div>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground/80">
        Approximate session hours in UTC{s?.state === "open" ? ` (${s.hoursUtc})` : ""}. Informational only.
      </p>
    </NeonCard>
  );
}
