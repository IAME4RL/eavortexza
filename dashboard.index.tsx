import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ScanLine, Activity, Clock, ChevronRight, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getScanQuota } from "@/lib/scan.functions";
import { Gauge, NeonCard, Pill, PwLabel } from "@/components/portal";
import { VortexHero } from "@/components/VortexHero";
import { useAuth } from "@/lib/auth";
import { timeframeLabel } from "@/lib/instruments";
import { HEARTBEAT_ONLINE_MS } from "@/lib/bridge";
import { formatRemaining, marketSession } from "@/lib/sessions";

export const Route = createFileRoute("/_authenticated/dashboard/")({ component: Overview });

// Markets shown as quick links. Each one opens Market Signals for that instrument.
const WATCHLIST = [
  { label: "GOLD", instrument: "XAUUSD" },
  { label: "NAS100", instrument: "NAS100" },
  { label: "EURUSD", instrument: "EURUSD" },
  { label: "GBPUSD", instrument: "GBPUSD" },
  { label: "US30", instrument: "US30" },
] as const;

function Overview() {
  const { user, hasRole } = useAuth();
  const quotaFn = useServerFn(getScanQuota);
  const quota = useQuery({ queryKey: ["quota"], queryFn: () => quotaFn() });
  const recent = useQuery({
    queryKey: ["scans", "recent"],
    queryFn: async () => (await supabase.from("scans").select("id,instrument,timeframe,status,created_at").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(5)).data ?? [],
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
    queryFn: async () => (await supabase.from("bots").select("status,last_heartbeat").eq("user_id", user!.id)).data ?? [],
  });
  const q = quota.data;
  const name = counts.data?.profile?.display_name;

  const running = bots.data?.some((b) => b.status === "running");
  const paused = bots.data?.some((b) => b.status === "paused");
  const online = bots.data?.some((b) => b.last_heartbeat && Date.now() - new Date(b.last_heartbeat).getTime() < HEARTBEAT_ONLINE_MS);
  const hasBot = !!bots.data?.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="sr-only">Home{name ? ` — ${name}` : ""}</h1>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2" aria-label="Bot status">
          {!hasBot ? <Pill tone="idle">No bot set up</Pill> : running ? <Pill tone="live">Bot active</Pill> : paused ? <Pill tone="warn">Bot paused</Pill> : <Pill tone="idle">Bot stopped</Pill>}
          {hasBot && (online ? <Pill tone="ok">MT5 online</Pill> : <Pill tone="idle">MT5 offline</Pill>)}
        </div>
        {name && <p className="pw-label text-muted-foreground">Welcome, {name}</p>}
      </div>

      {counts.data?.profile?.mentor_requested && !hasRole("mentor") && (
        <div className="pw-card-quiet flex items-center gap-3 p-4 text-sm"><Clock className="h-4 w-4 shrink-0 text-neutral" />Your mentor access request is awaiting administrator approval.</div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-5">
          <NeonCard className="overflow-hidden p-1.5">
            <VortexHero className="aspect-[4/3] w-full sm:aspect-[16/9] lg:aspect-[4/3]" />
          </NeonCard>

          <NeonCard className="p-4 sm:p-5">
            <PwLabel red>AI chart vision</PwLabel>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">Upload a TradingView or MT5 screenshot. The AI reads trend, structure and key levels from what is visible.</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Link to="/dashboard/scanner" className="pw-btn"><ScanLine className="h-4 w-4" />Scan chart</Link>
              <Link to="/dashboard/signals" className="pw-btn"><Activity className="h-4 w-4" />Signals</Link>
            </div>
            <p className="mt-3 font-mono text-[11px] text-muted-foreground">
              Free scans today: <span className="text-primary">{q ? `${Math.max(0, q.limit - q.used)}/${q.limit}` : "—"}</span> · resets 00:00 UTC
            </p>
          </NeonCard>
        </div>

        <div className="space-y-5">
          <NeonCard className="p-4 sm:p-5">
            <PwLabel>Market watchlist</PwLabel>
            <div className="mt-3 flex flex-wrap gap-2">
              {WATCHLIST.map((w) => (
                <Link key={w.label} to="/dashboard/signals" search={{ instrument: w.instrument, timeframe: "H1" }} className="pw-chip">{w.label}</Link>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Tap a market to open its latest signal.</p>
          </NeonCard>

          <SessionCard />

          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="Free scans" value={q ? `${Math.max(0, q.limit - q.used)}/${q.limit}` : "—"} />
            <MiniStat label="Accounts" value={counts.data?.accounts ?? "—"} />
            <MiniStat label="Unread" value={counts.data?.unread ?? "—"} to="/dashboard/notifications" />
            <MiniStat label="Recent scans" value={recent.data ? (recent.data.length >= 5 ? "5+" : recent.data.length) : "—"} to="/dashboard/history" />
          </div>
        </div>
      </div>

      <NeonCard>
        <div className="flex items-center justify-between border-b border-primary/20 px-4 py-3.5 sm:px-5">
          <PwLabel>Recent scans</PwLabel>
          <Link to="/dashboard/history" className="flex items-center gap-1 text-xs text-primary">View all <ChevronRight className="h-4 w-4" /></Link>
        </div>
        {recent.data?.length ? (
          <ul className="divide-y divide-primary/10">
            {recent.data.map((s) => (
              <li key={s.id}>
                <Link to="/dashboard/scan/$id" params={{ id: s.id }} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-primary/5 sm:px-5">
                  <span>
                    <span className="block font-display text-sm font-semibold uppercase tracking-wider">{s.instrument} · {timeframeLabel(s.timeframe)}</span>
                    <span className="block text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Pill tone={s.status === "completed" ? "ok" : s.status === "failed" ? "live" : "warn"}>{s.status}</Pill>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="px-5 py-8 text-sm text-muted-foreground">No scans yet. Upload your first chart to get started.</p>}
      </NeonCard>
    </div>
  );
}

function MiniStat({ label, value, to }: { label: string; value: React.ReactNode; to?: "/dashboard/notifications" | "/dashboard/history" }) {
  const body = (
    <>
      <p className="pw-label text-[0.6rem] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
    </>
  );
  return to
    ? <Link to={to} className="pw-card-quiet block p-3.5 hover:border-primary/50">{body}</Link>
    : <div className="pw-card-quiet p-3.5">{body}</div>;
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
    <NeonCard className="p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <PwLabel className="flex items-center gap-2"><Globe className="h-3.5 w-3.5 text-primary" />Session intelligence</PwLabel>
        {s && (s.state === "open" ? <Pill tone="live">Open</Pill> : <Pill tone="idle">Closed</Pill>)}
      </div>
      {!s ? <div className="mt-4 h-16" /> : s.state === "open" ? (
        <div className="mt-3 flex items-center gap-4">
          <Gauge value={s.progress} label={`${s.name} session elapsed`} />
          <div className="min-w-0">
            <p className="pw-title text-base">{s.name} session</p>
            <p className="mt-1 text-xs text-muted-foreground">{formatRemaining(s.remainingMs)} remaining{s.alsoOpen.length ? ` · overlaps ${s.alsoOpen.join(", ")}` : ""}</p>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <p className="pw-title text-base">Market closed</p>
          <p className="mt-1 text-xs text-muted-foreground">Forex reopens Sunday 22:00 UTC, in {formatRemaining(s.opensInMs)}.</p>
        </div>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground/80">Approximate session hours in UTC{s?.state === "open" ? ` (${s.hoursUtc})` : ""}. Informational only.</p>
    </NeonCard>
  );
}
