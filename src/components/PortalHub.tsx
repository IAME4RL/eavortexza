import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bot, Cable, ScanLine, Settings2, ArrowUpRight, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { HEARTBEAT_ONLINE_MS } from "@/lib/bridge";

type Tone = "ok" | "warn" | "off";
type Card = { I: typeof Bot; title: string; to: string; state: string; tone: Tone; detail: string };

const toneCls: Record<Tone, string> = {
  ok: "border-bull/50 text-bull",
  warn: "border-primary/50 text-primary",
  off: "border-border text-muted-foreground",
};

export function StatusHub() {
  const { user } = useAuth();
  const [cards, setCards] = useState<Card[] | null>(null);

  useEffect(() => {
    if (!user) { setCards(null); return; }
    let live = true;
    (async () => {
      const [bots, accts, scans] = await Promise.all([
        supabase.from("bots").select("status,last_heartbeat,trading_mode"),
        supabase.from("trading_accounts").select("id", { count: "exact", head: true }),
        supabase.from("signals").select("symbol,timeframe,side,created_at").order("created_at", { ascending: false }).limit(3),
      ]);
      if (!live) return;
      const b = bots.data ?? [];
      const now = Date.now();
      const online = b.filter((x) => x.last_heartbeat && now - new Date(x.last_heartbeat).getTime() < HEARTBEAT_ONLINE_MS).length;
      const running = b.filter((x) => x.status === "running").length;
      const s = scans.data ?? [];
      setCards([
        { I: Cable, title: "MT5 Bridge", to: "/dashboard/auto-trade", tone: online ? "ok" : "off",
          state: online ? `${online} terminal online` : "Disconnected",
          detail: b.length ? (online ? "Heartbeat received in the last 90s" : "No recent heartbeat from MT5") : "No bot set up yet" },
        { I: Bot, title: "Auto Trade bot", to: "/dashboard/auto-trade", tone: running ? "ok" : b.length ? "warn" : "off",
          state: running ? `${running} running` : b.length ? "Stopped" : "Not set up",
          detail: b.length ? `${b.filter((x) => x.trading_mode === "live").length} live · ${b.filter((x) => x.trading_mode !== "live").length} demo` : "Create a bot from Auto Trade" },
        { I: ScanLine, title: "Recent signals", to: "/dashboard/history", tone: s.length ? "ok" : "off",
          state: s.length ? `${s.length} latest` : "None yet",
          detail: s.length ? s.map((x) => `${x.symbol} ${x.timeframe} ${String(x.side).toUpperCase()}`).join(" · ") : "Run a scan to get your first signal" },
        { I: Settings2, title: "EA Management", to: "/dashboard/ea", tone: accts.count ? "ok" : "off",
          state: accts.count ? `${accts.count} account${accts.count > 1 ? "s" : ""}` : "No accounts",
          detail: accts.count ? "Registered MT4/MT5 accounts" : "Register an MT5 account" },
      ]);
    })();
    return () => { live = false; };
  }, [user]);

  const shown: Card[] = cards ?? [
    { I: Cable, title: "MT5 Bridge", to: "/auth", tone: "off", state: "Sign in to view", detail: "Real terminal heartbeat status" },
    { I: Bot, title: "Auto Trade bot", to: "/auth", tone: "off", state: "Sign in to view", detail: "Start / stop state and mode" },
    { I: ScanLine, title: "Recent signals", to: "/auth", tone: "off", state: "Sign in to view", detail: "Your private analysis history" },
    { I: Settings2, title: "EA Management", to: "/auth", tone: "off", state: "Sign in to view", detail: "Your registered MT5 accounts" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {shown.map(({ I, title, to, state, tone, detail }, i) => (
        <Link key={title} to={to}
          style={{ animationDelay: `${i * 80}ms` }}
          className="panel group relative animate-fade-up overflow-hidden p-5 transition-all hover:-translate-y-1 hover:border-primary/60 hover:red-glow-soft">
          <div className="flex items-center justify-between">
            <I className="h-5 w-5 text-primary" />
            <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
          </div>
          <p className="mt-4 font-mono text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
          <span className={`mt-2 inline-block rounded border px-2 py-0.5 font-mono text-xs ${toneCls[tone]}`}>{state}</span>
          <p className="mt-3 text-sm text-muted-foreground">{detail}</p>
        </Link>
      ))}
    </div>
  );
}

const MARKETS = [
  { s: "XAUUSD", n: "Gold / US Dollar", featured: true },
  { s: "EURUSD", n: "Euro / US Dollar" }, { s: "GBPUSD", n: "Pound / US Dollar" },
  { s: "USDJPY", n: "US Dollar / Yen" }, { s: "GBPJPY", n: "Pound / Yen" },
  { s: "NAS100", n: "Nasdaq 100" }, { s: "US30", n: "Dow Jones 30" }, { s: "BTCUSD", n: "Bitcoin / US Dollar" },
];

// Session hours in UTC (approximate, ignores DST shifts).
const SESSIONS = [
  { n: "Sydney", o: 21, c: 6 }, { n: "Tokyo", o: 0, c: 9 },
  { n: "London", o: 7, c: 16 }, { n: "New York", o: 12, c: 21 },
];
const isOpen = (h: number, o: number, c: number) => (o < c ? h >= o && h < c : h >= o || h < c);

export function MarketOverview() {
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => {
    const t = () => setHour(new Date().getUTCHours() + new Date().getUTCMinutes() / 60);
    t(); const id = setInterval(t, 60_000); return () => clearInterval(id);
  }, []);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="panel p-5 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Supported instruments</p>
          <span className="rounded border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground">LIVE PRICES: NO PROVIDER CONNECTED</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {MARKETS.map((m) => (
            <Link key={m.s} to="/scanner"
              className={`flex items-center justify-between rounded-md border p-3 transition-colors hover:border-primary/60 ${m.featured ? "border-primary/50 bg-primary/5 sm:col-span-2" : "border-border"}`}>
              <div>
                <p className="font-mono text-sm font-semibold">{m.s}{m.featured && <span className="ml-2 text-xs text-primary">GOLD</span>}</p>
                <p className="text-xs text-muted-foreground">{m.n}</p>
              </div>
              <span className="text-xs text-muted-foreground">Price unavailable · Scan chart →</span>
            </Link>
          ))}
        </div>
      </div>
      <div className="panel p-5">
        <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground"><Clock className="h-3.5 w-3.5" />Trading sessions (UTC)</p>
        <ul className="mt-4 space-y-3">
          {SESSIONS.map((s) => {
            const open = hour !== null && isOpen(hour, s.o, s.c);
            return (
              <li key={s.n} className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <p className="text-sm font-semibold">{s.n}</p>
                  <p className="font-mono text-xs text-muted-foreground">{String(s.o).padStart(2, "0")}:00–{String(s.c).padStart(2, "0")}:00</p>
                </div>
                <span className={`flex items-center gap-1.5 font-mono text-xs ${open ? "text-bull" : "text-muted-foreground"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${open ? "bg-bull animate-pulse-dot" : "bg-muted-foreground"}`} />
                  {hour === null ? "—" : open ? "OPEN" : "CLOSED"}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-[11px] text-muted-foreground">Approximate hours; daylight-saving shifts not applied.</p>
      </div>
    </div>
  );
}
