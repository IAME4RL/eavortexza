import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Newspaper, ChevronRight, TrendingUp, TrendingDown, Clock, Flame, Calendar } from "lucide-react";
import { getNewsSignals, type NewsItem } from "@/lib/news.functions";
import { NeonCard, Pill, PwLabel } from "@/components/portal";

function formatEventTime(t: number) {
  const d = new Date(t);
  const day = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return { day, time };
}

function countdown(t: number) {
  const diff = t - Date.now();
  if (diff <= 0) return "Released";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `In ${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `In ${hrs}h ${remMins}m`;
}

function Row({ n, full }: { n: NewsItem; full: boolean }) {
  const r = n.reaction;
  const { day, time } = formatEventTime(n.time);
  const timeUntil = countdown(n.time);
  const isPast = n.time <= Date.now();
  const isHighImpact = n.impact === "High";

  return (
    <div className="rounded-xl border border-border/70 bg-background/50 p-3.5 space-y-3">
      {/* Top Header: Title, Impact, and Time */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="pw-mono text-xs font-bold px-1.5 py-0.5 rounded bg-muted/60 text-foreground">
              {n.country}
            </span>
            <span className="text-sm font-semibold truncate text-foreground">{n.title}</span>
            {isHighImpact && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                <Flame className="h-3 w-3" /> HIGH
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" /> {day} · {time}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 font-medium text-foreground/80">
              <Clock className="h-3 w-3 text-primary-soft" /> {timeUntil}
            </span>
          </div>
        </div>

        {r.state === "signal" ? (
          <Pill tone="live">Triggered</Pill>
        ) : isPast ? (
          <Pill tone="idle">Passed</Pill>
        ) : (
          <Pill tone="idle">Upcoming</Pill>
        )}
      </div>

      {/* Main Signal Display */}
      {n.bias.side === "buy" ? (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/25 p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-400 tracking-wide">FORECAST SIGNAL: BUY</p>
              <p className="text-[10px] text-muted-foreground">Predicted from economic figures</p>
            </div>
          </div>
          <span className="pw-mono text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
            BUY
          </span>
        </div>
      ) : n.bias.side === "sell" ? (
        <div className="rounded-lg border border-red-500/40 bg-red-950/25 p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-red-500/20 text-red-400 flex items-center justify-center font-bold">
              <TrendingDown className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-red-400 tracking-wide">FORECAST SIGNAL: SELL</p>
              <p className="text-[10px] text-muted-foreground">Predicted from economic figures</p>
            </div>
          </div>
          <span className="pw-mono text-xs font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-300">
            SELL
          </span>
        </div>
      ) : (
        <div className="rounded-lg border border-border/50 bg-muted/20 p-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">NEUTRAL</span> — No directional change expected.
        </div>
      )}

      {/* Forecast & Previous Numbers */}
      <div className="flex items-center gap-3 text-xs border-t border-border/40 pt-2">
        <div className="flex-1 rounded bg-background/60 border border-border/50 p-1.5 text-center">
          <span className="text-[10px] text-muted-foreground block uppercase">Forecast</span>
          <span className="pw-mono font-bold text-foreground">{n.forecast || "—"}</span>
        </div>
        <div className="flex-1 rounded bg-background/60 border border-border/50 p-1.5 text-center">
          <span className="text-[10px] text-muted-foreground block uppercase">Previous</span>
          <span className="pw-mono font-bold text-foreground">{n.previous || "—"}</span>
        </div>
      </div>

      {/* Explanation Reasoning */}
      <p className="text-[11px] leading-relaxed text-muted-foreground/90 bg-muted/15 p-2 rounded border border-border/30">
        💡 <b className="text-foreground">Why:</b> {n.bias.reason}
      </p>

      {/* Post-Release breakout info if already released */}
      {r.state === "signal" && (
        <div className="rounded-md border border-primary/40 bg-primary/10 p-2 text-xs text-foreground">
          <p className="font-semibold text-primary">
            ⚡ Live Breakout Confirmed: {r.trade.side.toUpperCase()} at {r.trade.entry}
          </p>
          <p className="pw-mono text-[11px] text-muted-foreground mt-0.5">
            SL {r.trade.sl} · TP1 {r.trade.tp[0]} · TP2 {r.trade.tp[1]}
          </p>
        </div>
      )}
    </div>
  );
}

export function NewsSignals({ instrument = "XAUUSD", limit, full = false }: { instrument?: string; limit?: number; full?: boolean }) {
  const fn = useServerFn(getNewsSignals);
  const q = useQuery({
    queryKey: ["news-signals", instrument],
    queryFn: () => fn({ data: { instrument } }),
    // 5-minute interval prevents 429 rate limiting
    refetchInterval: 5 * 60_000,
  });
  const items = q.data?.ok ? q.data.items.slice(0, limit ?? 99) : [];

  return (
    <NeonCard className="p-5">
      <div className="flex items-center justify-between">
        <PwLabel className="flex items-center gap-2">
          <Newspaper className="h-3.5 w-3.5 text-primary" />
          News Signals · {instrument === "XAUUSD" ? "GOLD" : instrument}
        </PwLabel>
        {!full && (
          <Link to="/dashboard/news" className="flex items-center text-xs text-primary-soft">
            All News <ChevronRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      <div className="mt-3.5 space-y-3">
        {q.isLoading && <p className="text-xs text-muted-foreground">Loading news signals…</p>}
        {q.isError && <p className="text-xs text-muted-foreground">The economic calendar is unavailable right now. Try again shortly.</p>}
        {q.data?.ok && items.length === 0 && (
          <p className="text-xs text-muted-foreground">No upcoming high or medium impact events found for this market.</p>
        )}
        {items.map((n) => (
          <Row key={`${n.title}-${n.time}`} n={n} full={full} />
        ))}
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground/80">
        Signals compare expected economic figures with previous releases to project market reaction before the event.
      </p>
    </NeonCard>
  );
}
