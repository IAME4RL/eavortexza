import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, FlaskConical, Minus, RefreshCw } from "lucide-react";
import { generateSignal, listSignals, runSignalBacktest } from "@/lib/signal.functions";
import { FEED_INSTRUMENTS, FEED_TIMEFRAMES } from "@/lib/marketdata";
import { STRATEGIES } from "@/lib/strategy";
import type { BacktestMetrics, Signal } from "@/lib/signals";
import { PageHeader, StatusBadge } from "@/components/dash";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type SignalsSearch = { instrument?: string; timeframe?: string; auto?: boolean };

export const Route = createFileRoute("/_authenticated/dashboard/signals")({
  validateSearch: (s: Record<string, unknown>): SignalsSearch => {
    const out: SignalsSearch = { auto: s["auto"] === true || s["auto"] === "true" };
    if (typeof s["instrument"] === "string") out.instrument = s["instrument"];
    if (typeof s["timeframe"] === "string") out.timeframe = s["timeframe"];
    return out;
  },
  head: () => ({ meta: [{ title: "Market Signals — EA VORTEX" }, { name: "robots", content: "noindex" }] }),
  component: SignalsPage,
});

type GenResult =
  | { ok: true; id: string; signal: Signal; source: string }
  | { ok: false; reason?: string; error?: string };

function SignalsPage() {
  const search = Route.useSearch();
  const qc = useQueryClient();
  const genFn = useServerFn(generateSignal);
  const listFn = useServerFn(listSignals);
  const btFn = useServerFn(runSignalBacktest);
  const history = useQuery({ queryKey: ["signals"], queryFn: () => listFn() });

  const [instrument, setInstrument] = useState(() =>
    search.instrument && FEED_INSTRUMENTS.includes(search.instrument) ? search.instrument : "XAUUSD");
  const [timeframe, setTimeframe] = useState(() =>
    search.timeframe && FEED_TIMEFRAMES.includes(search.timeframe) ? search.timeframe : "H1");
  const [strategy, setStrategy] = useState("auto");
  const [busy, setBusy] = useState(false);
  const [btBusy, setBtBusy] = useState(false);
  const [result, setResult] = useState<GenResult | null>(null);
  const [bt, setBt] = useState<{ metrics: BacktestMetrics; barCount: number; source: string } | null>(null);
  const [btError, setBtError] = useState<string | null>(null);
  const [autoPending, setAutoPending] = useState(false);
  const autoKeyRef = useRef<string | null>(null);

  async function generate() {
    setBusy(true); setResult(null);
    try {
      const res = (await genFn({ data: { instrument, timeframe, strategy } })) as GenResult;
      setResult(res);
      if (res.ok) qc.invalidateQueries({ queryKey: ["signals"] });
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : "Signal generation failed" });
    } finally {
      setBusy(false);
    }
  }

  // Arriving from the AI Chart Scanner (?instrument=…&timeframe=…&auto=true):
  // generate a signal immediately, once per unique parameter set.
  useEffect(() => {
    if (!search.auto) return;
    const key = `${search.instrument}|${search.timeframe}`;
    if (autoKeyRef.current === key) return;
    autoKeyRef.current = key;
    setAutoPending(true);
    void generate().finally(() => setAutoPending(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.auto, search.instrument, search.timeframe]);

  async function runBacktest() {
    setBtBusy(true); setBt(null); setBtError(null);
    try {
      const res = await btFn({ data: { instrument, timeframe, strategy } });
      if (!res.ok) setBtError(res.error);
      else setBt({ metrics: res.metrics, barCount: res.barCount, source: res.source });
    } catch (e) {
      setBtError(e instanceof Error ? e.message : "Backtest failed");
    } finally {
      setBtBusy(false);
    }
  }

  const sig = result?.ok ? result.signal : null;

  return (
    <>
      <PageHeader
        eyebrow="Real market data · rule-based engine"
        title="Market Signals"
        sub="Generates forward-looking BUY/SELL setups from real closed price bars using the built-in strategy engine, with higher-timeframe confirmation. Educational only — never a guarantee of profit."
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="panel space-y-5 p-5 lg:col-span-2">
          <Field label="Instrument">
            <Select value={instrument} onValueChange={setInstrument}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FEED_INSTRUMENTS.map((i) => <SelectItem key={i} value={i}>{i}{i === "XAUUSD" ? " (GOLD)" : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Timeframe">
            <div className="grid grid-cols-4 gap-1.5">
              {FEED_TIMEFRAMES.map((t) => (
                <button key={t} onClick={() => setTimeframe(t)}
                  className={cn("rounded border px-2 py-2 font-mono text-xs", timeframe === t ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground")}>{t}</button>
              ))}
            </div>
          </Field>
          <Field label="Strategy">
            <Select value={strategy} onValueChange={setStrategy}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto — engine picks the single best setup</SelectItem>
                {STRATEGIES.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <p className="rounded border border-border bg-card p-3 text-xs text-muted-foreground">
            {strategy === "auto"
              ? "All implemented strategies are evaluated on the latest closed bar; at most one is selected, with its reasoning shown."
              : STRATEGIES.find((s) => s.id === strategy)?.rules}
          </p>
          {autoPending && (
            <p className="rounded border border-primary/50 bg-card p-3 text-xs text-muted-foreground">
              Requested from your chart scan — analysing live {instrument} {timeframe} data automatically…
            </p>
          )}
          <Button variant="hero" size="xl" className="w-full" disabled={busy || autoPending} onClick={generate}>
            {busy || autoPending ? <><RefreshCw className="animate-spin" />Analysing…</> : <><Activity />Generate Signal</>}
          </Button>
          <Button variant="frame" className="w-full" disabled={btBusy} onClick={runBacktest}>
            {btBusy ? <><RefreshCw className="animate-spin" />Backtesting…</> : <><FlaskConical />Backtest on history</>}
          </Button>
        </div>

        <div className="space-y-6 lg:col-span-3">
          {result && !result.ok && (
            <div className="panel flex items-start gap-3 p-5">
              {result.error ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-primary" /> : <Minus className="mt-0.5 h-5 w-5 shrink-0 text-neutral" />}
              <div>
                <p className="font-display text-lg font-bold uppercase">{result.error ? "Could not generate a signal" : "No Trade"}</p>
                <p className="mt-1 text-sm text-muted-foreground">{result.error ?? result.reason}</p>
              </div>
            </div>
          )}

          {sig && (
            <div className="panel overflow-hidden">
              <div className={cn("flex items-center justify-between border-b border-border px-5 py-4", sig.side === "buy" ? "bg-bull/10" : "bg-primary/10")}>
                <div className="flex items-center gap-3">
                  {sig.side === "buy" ? <ArrowUpRight className="h-6 w-6 text-bull" /> : <ArrowDownRight className="h-6 w-6 text-primary" />}
                  <div>
                    <p className={cn("font-display text-2xl font-bold uppercase", sig.side === "buy" ? "text-bull" : "text-primary")}>{sig.side}</p>
                    <p className="font-mono text-xs text-muted-foreground">{instrument} · {timeframe} · {STRATEGIES.find((s) => s.id === sig.strategy)?.name ?? sig.strategy}</p>
                  </div>
                </div>
                <span className="rounded border border-border bg-card px-3 py-1.5 font-mono text-xs">R:R 1:{sig.rr}</span>
              </div>
              <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
                <Level label="Entry" value={sig.entry} />
                <Level label="Stop loss" value={sig.sl} />
                <Level label="Take profit" value={sig.tp} />
              </div>
              <div className="space-y-3 p-5 text-sm">
                <p className="text-muted-foreground">{sig.explanation}</p>
                <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] text-muted-foreground">
                  <span>Data: {new Date(sig.dataAt).toUTCString()}</span>
                  <span>Valid until: {new Date(sig.expiresAt).toUTCString()}</span>
                  <span>HTF: {sig.htf.toUpperCase()}</span>
                </div>
                <p className="text-xs text-muted-foreground">Hypothetical setup from historical closed bars. Not financial advice; no outcome is guaranteed.</p>
              </div>
            </div>
          )}

          {btError && (
            <div className="panel flex items-start gap-3 p-5">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <p className="text-sm text-muted-foreground">{btError}</p>
            </div>
          )}
          {bt && (
            <div className="panel p-5">
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                Backtest · {instrument} {timeframe} · {bt.barCount} closed bars · {bt.source}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="Trades" value={bt.metrics.trades} />
                <Metric label="Win rate" value={`${bt.metrics.winRate}%`} />
                <Metric label="Total R" value={bt.metrics.totalR} />
                <Metric label="Avg R" value={bt.metrics.avgR} />
                <Metric label="Wins" value={bt.metrics.wins} />
                <Metric label="Losses" value={bt.metrics.losses} />
                <Metric label="Max drawdown" value={`${bt.metrics.maxDrawdownR}R`} />
                <Metric label="Profit factor" value={bt.metrics.profitFactor ?? "—"} />
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Walk-forward backtest on historical closed bars (stop counted first when a bar touches both levels). Past performance does not guarantee future results.
              </p>
            </div>
          )}
        </div>
      </div>

      <h2 className="mb-4 mt-10 font-display text-lg font-bold uppercase">Your recent signals</h2>
      <div className="panel overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              <th className="px-4 py-3">When</th><th className="px-4 py-3">Symbol</th><th className="px-4 py-3">TF</th>
              <th className="px-4 py-3">Side</th><th className="px-4 py-3">Entry</th><th className="px-4 py-3">SL</th>
              <th className="px-4 py-3">TP</th><th className="px-4 py-3">Strategy</th><th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(history.data ?? []).map((s) => (
              <tr key={s.id} className="border-b border-border/50 last:border-0">
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{s.symbol}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{s.timeframe}</td>
                <td className={cn("px-4 py-2.5 font-mono text-xs font-bold uppercase", s.side === "buy" ? "text-bull" : "text-primary")}>{s.side}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{s.entry}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{s.stop_loss}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{s.take_profit}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{STRATEGIES.find((x) => x.id === s.strategy)?.name ?? s.strategy}</td>
                <td className="px-4 py-2.5"><StatusBadge status={`sig_${s.status === "active" ? "queued" : s.status === "expired" ? "closed" : "cancelled"}`} /></td>
              </tr>
            ))}
            {!history.data?.length && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">No signals yet — generate your first one above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{label}</Label>{children}</div>;
}
function Level({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-4 py-4 text-center">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-bold">{value}</p>
    </div>
  );
}
function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded border border-border bg-card p-3">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg font-bold">{value}</p>
    </div>
  );
}
