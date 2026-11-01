import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ScanLine, Clock, ChevronRight, Globe, Key, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Gauge, NeonCard, Pill, PwLabel } from "@/components/portal";
import { useAuth } from "@/lib/auth";
import { HEARTBEAT_ONLINE_MS } from "@/lib/bridge";
import { formatRemaining, marketSession } from "@/lib/sessions";
import { getMyAssignedMentorBot, redeemMentorLicense } from "@/lib/mentorBots";
import { FeaturedBotCard } from "@/components/FeaturedBotCard";

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
  const queryClient = useQueryClient();

  const [licenseInput, setLicenseInput] = useState("");
  const [licenseStatus, setLicenseStatus] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const featuredCardRef = useRef<HTMLDivElement>(null);

  const recent = useQuery({
    queryKey: ["signals", "recent"],
    queryFn: async () => (
      await supabase
        .from("signals")
        .select("id,symbol,timeframe,side,entry,status,created_at")
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

  // The bot assigned through a redeemed mentor license. No row (or an error) means the
  // default EAVORTEX card stays on screen. Polled gently so mentor edits/revocations show up.
  const assignedMentorBot = useQuery({
    queryKey: ["assigned-mentor-bot", user?.id], enabled: !!user,
    queryFn: () => getMyAssignedMentorBot(user!.id),
    refetchInterval: 60_000,
    retry: 1,
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
  const name = counts.data?.profile?.display_name;

  const running = userBot?.status === "running";
  const online = userBot?.last_heartbeat && Date.now() - new Date(userBot.last_heartbeat).getTime() < HEARTBEAT_ONLINE_MS;

  const handleActivateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseInput.trim() || redeeming) return;
    setRedeeming(true);
    setLicenseStatus(null);
    try {
      const redeemed = await redeemMentorLicense(licenseInput);
      setLicenseInput("");
      const key = ["assigned-mentor-bot", user?.id];
      await queryClient.refetchQueries({ queryKey: key });
      if (queryClient.getQueryState(key)?.status === "error") {
        setLicenseStatus(`Connected to ${redeemed.bot_name} by ${redeemed.mentor_name}. Reload the page if the card above has not updated.`);
      } else {
        setLicenseStatus(`Connected to ${redeemed.bot_name} by ${redeemed.mentor_name}.`);
        // The key form sits below the card; bring the newly assigned bot into view.
        featuredCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch (error) {
      setLicenseStatus(error instanceof Error ? error.message : "Could not verify this license key.");
    } finally {
      setRedeeming(false);
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

      {/* FEATURED BOT CARD: the mentor's bot once a license is redeemed, otherwise the default EAVORTEX bot */}
      <div ref={featuredCardRef} className="scroll-mt-4">
        <FeaturedBotCard
          mentorBot={assignedMentorBot.data}
          loading={assignedMentorBot.isLoading}
          userBot={userBot}
          running={running}
          online={!!online}
        />
      </div>

      {/* MAIN CALL TO ACTION */}
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
              AI CHART SCANNER
            </h3>
            <p className="text-xs text-muted-foreground">
              Scan real market data and get BUY / SELL signals
            </p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
      </Link>

      {/* MARKET WATCHLIST & SESSION INTELLIGENCE */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Watchlist */}
        <NeonCard className="p-5">
          <div className="flex items-center justify-between">
            <PwLabel>Market Watchlist</PwLabel>
            <span className="text-[11px] font-mono text-muted-foreground">TAP TO SCAN</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {WATCHLIST.map((w) => (
              <Link
                key={w.label}
                to="/dashboard/scanner"
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
            disabled={redeeming}
            className="rounded-lg bg-primary px-4 py-2 font-display text-xs font-bold uppercase text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {redeeming ? "Verifying…" : "Activate Key"}
          </button>
        </form>

        {licenseStatus && (
          <p className={`mt-2 text-xs font-medium flex items-center gap-1.5 ${licenseStatus.startsWith("Connected") ? "text-emerald-400" : "text-rose-400"}`}>
            <Check className="h-3.5 w-3.5" />{licenseStatus}
          </p>
        )}
      </NeonCard>

      {/* RECENT SIGNALS */}
      <NeonCard>
        <div className="flex items-center justify-between border-b border-primary/20 px-4 py-3.5 sm:px-5">
          <PwLabel>Recent Signals</PwLabel>
          <Link to="/dashboard/history" className="flex items-center gap-1 text-xs text-primary">
            View all <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        {recent.data?.length ? (
          <ul className="divide-y divide-primary/10">
            {recent.data.map((s) => (
              <li key={s.id} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <span>
                  <span className="block font-display text-sm font-semibold uppercase tracking-wider">
                    {s.symbol} · {s.timeframe} · <span className={s.side === "buy" ? "text-bull" : "text-primary"}>{s.side}</span>
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Entry {s.entry} · {new Date(s.created_at).toLocaleString()}
                  </span>
                </span>
                <Pill tone={s.status === "active" ? "live" : "idle"}>{s.status}</Pill>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            No signals yet. Run your first scan to get started.
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
