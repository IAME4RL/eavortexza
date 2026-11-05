import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Newspaper, ChevronRight } from "lucide-react";
import { getNewsSignals, type NewsItem } from "@/lib/news.functions";
import { NeonCard, Pill, PwLabel } from "@/components/portal";

const when = (t: number) =>
  new Date(t).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });

function SideTag({ side }: { side: "buy" | "sell" }) {
  return <span className={`pw-mono text-xs font-bold ${side === "buy" ? "text-success" : "text-primary"}`}>{side.toUpperCase()}</span>;
}

function Row({ n, full }: { n: NewsItem; full: boolean }) {
  const r = n.reaction;
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{n.country} · {n.title}</p>
          <p className="text-[11px] text-muted-foreground">{when(n.time)} · {n.impact} impact{n.forecast && ` · F ${n.forecast}`}{n.previous && ` · P ${n.previous}`}</p>
        </div>
        {r.state === "signal" ? <Pill tone="live">Signal</Pill> : r.state === "upcoming" ? <Pill tone="idle">Upcoming</Pill> : r.state === "expired" ? <Pill tone="idle">No trade</Pill> : <Pill tone="warn">Watching</Pill>}
      </div>
      <p className="mt-2 text-xs">
        Expected: {n.bias.side ? <SideTag side={n.bias.side} /> : <span className="text-muted-foreground">neutral</span>}
        {full && <span className="text-muted-foreground"> — {n.bias.reason}</span>}
      </p>
      {r.state === "signal" && (
        <div className="mt-2 rounded-md border border-primary/40 p-2 text-xs">
          <p><SideTag side={r.trade.side} /> now · entry <b className="pw-mono">{r.trade.entry}</b> · SL <b className="pw-mono">{r.trade.sl}</b> · {r.trade.confidence} confidence</p>
          <p className="pw-mono mt-1">TP1 {r.trade.tp[0]} · TP2 {r.trade.tp[1]} · TP3 {r.trade.tp[2]}</p>
          {full && <p className="mt-1 text-muted-foreground">{r.trade.reason}</p>}
        </div>
      )}
      {(r.state === "waiting" || r.state === "forming" || r.state === "expired") && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          {r.reason}{r.state === "waiting" && ` Range ${r.rangeLow} – ${r.rangeHigh}.`}
        </p>
      )}
    </div>
  );
}

export function NewsSignals({ instrument = "XAUUSD", limit, full = false }: { instrument?: string; limit?: number; full?: boolean }) {
  const fn = useServerFn(getNewsSignals);
  const q = useQuery({
    queryKey: ["news-signals", instrument],
    queryFn: () => fn({ data: { instrument } }),
    refetchInterval: 60_000,
  });
  const items = q.data?.ok ? q.data.items.slice(0, limit ?? 99) : [];
  return (
    <NeonCard className="p-5">
      <div className="flex items-center justify-between">
        <PwLabel className="flex items-center gap-2"><Newspaper className="h-3.5 w-3.5 text-primary" />News Signals · {instrument === "XAUUSD" ? "GOLD" : instrument}</PwLabel>
        {!full && <Link to="/dashboard/news" className="flex items-center text-xs text-primary-soft">All <ChevronRight className="h-3 w-3" /></Link>}
      </div>
      <div className="mt-3 space-y-2">
        {q.isLoading && <p className="text-xs text-muted-foreground">Loading economic calendar…</p>}
        {q.data && !q.data.ok && <p className="text-xs text-muted-foreground">{q.data.error}</p>}
        {q.data?.ok && items.length === 0 && <p className="text-xs text-muted-foreground">No high or medium impact news affecting this market right now.</p>}
        {items.map((n) => <Row key={`${n.title}-${n.time}`} n={n} full={full} />)}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground/80">
        "Expected" compares forecast vs previous. Trade signals appear only after release, when real price breaks the 15-minute news range. Not financial advice.
      </p>
    </NeonCard>
  );
}
