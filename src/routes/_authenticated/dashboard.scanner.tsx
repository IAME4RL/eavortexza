import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ScanLine, AlertTriangle, ArrowDownRight, ArrowUpRight, Cpu, Globe, Minus } from "lucide-react";
import { generateSignal, listSignals } from "@/lib/signal.functions";
import { FEED_INSTRUMENTS, FEED_TIMEFRAMES } from "@/lib/marketdata";
import { STRATEGIES } from "@/lib/strategy";
import type { Signal } from "@/lib/signals";
import { formatRemaining, marketSession } from "@/lib/sessions";
import { NeonCard, PortalTitle, PwLabel, Pill } from "@/components/portal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type ScannerSearch = { instrument?: string; timeframe?: string };

export const Route = createFileRoute("/_authenticated/dashboard/scanner")({
  validateSearch: (s: Record<string, unknown>): ScannerSearch => {
    const out: ScannerSearch = {};
    if (typeof s["instrument"] === "string") out.instrument = s["instrument"];
    if (typeof s["timeframe"] === "string") out.timeframe = s["timeframe"];
    return out;
  },
  head: () => ({ meta: [{ title: "AI Chart Scanner — EA VORTEX" }, { name: "robots", content: "noindex" }] }),
  component: Scanner,
});

const STAGES = ["Fetching market data", "Reading market structure", "Checking higher timeframe", "Evaluating strategies"];

type GenResult =
  | { ok: true; id: string; signal: Signal; source: string }
  | { ok: false; reason?: string; error?: string };

function Scanner() {
  const search = Route.useSearch();
  const qc = useQueryClient();
  const genFn = useServerFn(generateSignal);
  const listFn = useServerFn(listSignals);
  const history = useQuery({ queryKey: ["signals"], queryFn: () => listFn() });

  const [instrument, setInstrument] = useState(() =>
    search.instrument && FEED_INSTRUMENTS.includes(search.instrument) ? search.instrument : "XAUUSD");
  const [timeframe, setTimeframe] = useState(() =>
    search.timeframe && FEED_TIMEFRAMES.includes(search.timeframe) ? search.timeframe : "H1");
  const [strategy, setStrategy] = useState("auto");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState<GenResult | null>(null);

  async function scan() {
    setBusy(true); setResult(null); setStage(0);
    const timer = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 1500);
    try {
      const res = (await genFn({ data: { instrument, timeframe, strategy } })) as GenResult;
      setResult(res);
      if (res.ok) qc.invalidateQueries({ queryKey: ["signals"] });
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : "Scan failed" });
    } finally {
      clearInterval(timer);
      setBusy(false);
    }
  }

  const sig = result?.ok ? result.signal : null;
  const session = marketSession(new Date());

  return (
    <>
      <PortalTitle title="Scan market" sub="Scans real closed price bars with the built-in strategy engine and gives you a BUY / SELL signal. Results are educational, probabilistic and never guaranteed." />

      <div className="grid gap-5 lg:grid-cols-5">
        <NeonCard className="space-y-5 p-4 sm:p-5 lg:col-span-2 lg:self-start">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Symbol">
              <Select value={instrument} onValueChange={setInstrument}>
                <SelectTrigger className="pw-field h-11"><SelectValue /></SelectTrigger>
                <SelectContent>{FEED_INSTRUMENTS.map((i) => <SelectItem key={i} value={i}>{i}{i === "XAUUSD" ? " (GOLD)" : ""}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Timeframe">
              <Select value={timeframe} onValueChange={setTimeframe}>
                <SelectTrigger className="pw-field h-11"><SelectValue /></SelectTrigger>
                <SelectContent>{FEED_TIMEFRAMES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Strategy">
            <Select value={strategy} onValueChange={setStrategy}>
              <SelectTrigger className="pw-field h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto — best setup</SelectItem>
                {STRATEGIES.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <div className="pw-card-quiet flex items-start gap-2.5 p-3 text-xs text-muted-foreground">
            <Globe className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            {session.state === "open"
              ? <span>{session.name} session · {formatRemaining(session.remainingMs)} remaining{session.alsoOpen.length ? ` · overlaps ${session.alsoOpen.join(", ")}` : ""}</span>
              : <span>Market closed · reopens in {formatRemaining(session.opensInMs)}. Signals use the latest closed bars.</span>}
          </div>

          <button type="button" className="pw-btn pw-btn-solid w-full" disabled={busy} onClick={scan}>
            {busy ? <><Cpu className="h-4 w-4 animate-pulse" />Scanning…</> : <><ScanLine className="h-4 w-4" />Scan market</>}
          </button>

          {busy && (
            <ol className="space-y-2 font-mono text-xs" aria-live="polite">
              {STAGES.map((s, i) => (
                <li key={s} className={cn("flex items-center gap-2", i < stage ? "text-bull" : i === stage ? "text-primary" : "text-muted-foreground")}>
                  <span className={cn("h-1.5 w-1.5 rounded-full bg-current", i === stage && "animate-pulse-dot")} />{s}
                </li>
              ))}
            </ol>
          )}
          <p className="text-xs text-muted-foreground">Hypothetical setups from historical closed bars. Not financial advice.</p>
        </NeonCard>

        <div className="lg:col-span-3">
          <PwLabel className="mb-3">Signal</PwLabel>

          {!result && (
            <div className="pw-card flex min-h-[260px] items-center justify-center border-dashed p-8 text-center lg:min-h-[420px]">
              <div className="flex flex-col items-center gap-3">
                <ScanLine className="h-10 w-10 text-primary" />
                <span className="font-display text-base font-bold uppercase tracking-wider">{busy ? "Scanning…" : "Ready to scan"}</span>
                <span className="text-sm text-muted-foreground">Choose a symbol and timeframe, then tap Scan market.<br />Your signal appears here.</span>
              </div>
            </div>
          )}

          {result && !result.ok && (
            <NeonCard className="flex items-start gap-3 p-5">
              {result.error ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-primary" /> : <Minus className="mt-0.5 h-5 w-5 shrink-0 text-neutral" />}
              <div>
                <p className="font-display text-lg font-bold uppercase">{result.error ? "Could not scan" : "No Trade"}</p>
                <p className="mt-1 text-sm text-muted-foreground">{result.error ?? result.reason}</p>
              </div>
            </NeonCard>
          )}

          {sig && (
            <NeonCard className="overflow-hidden">
              <div className={cn("flex items-center justify-between border-b border-primary/20 px-4 py-4 sm:px-5", sig.side === "buy" ? "bg-bull/10" : "bg-primary/10")}>
                <div className="flex items-center gap-3">
                  {sig.side === "buy" ? <ArrowUpRight className="h-6 w-6 text-bull" /> : <ArrowDownRight className="h-6 w-6 text-primary" />}
                  <div>
                    <p className={cn("font-display text-2xl font-bold uppercase", sig.side === "buy" ? "text-bull" : "text-primary")}>{sig.side}</p>
                    <p className="font-mono text-xs text-muted-foreground">{instrument} · {timeframe} · {STRATEGIES.find((s) => s.id === sig.strategy)?.name ?? sig.strategy}</p>
                  </div>
                </div>
                <Pill tone="live">R:R 1:{sig.rr}</Pill>
              </div>
              <div className="grid grid-cols-3 divide-x divide-primary/20 border-b border-primary/20">
                <Level label="Entry" value={sig.entry} />
                <Level label="Stop loss" value={sig.sl} />
                <Level label="Take profit" value={sig.tp} />
              </div>
              <div className="space-y-3 p-4 text-sm sm:p-5">
                <p className="text-muted-foreground">{sig.explanation}</p>
                <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] text-muted-foreground">
                  <span>Data: {new Date(sig.dataAt).toUTCString()}</span>
                  <span>Valid until: {new Date(sig.expiresAt).toUTCString()}</span>
                  <span>HTF: {sig.htf.toUpperCase()}</span>
                </div>
              </div>
            </NeonCard>
          )}
        </div>
      </div>

      <PwLabel className="mb-3 mt-8">Recent signals</PwLabel>
      <NeonCard>
        {history.data?.length ? (
          <ul className="divide-y divide-primary/10">
            {history.data.slice(0, 10).map((s) => (
              <li key={s.id} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <span>
                  <span className="block font-display text-sm font-semibold uppercase tracking-wider">
                    {s.symbol} · {s.timeframe} · <span className={s.side === "buy" ? "text-bull" : "text-primary"}>{s.side}</span>
                  </span>
                  <span className="block font-mono text-xs text-muted-foreground">
                    Entry {s.entry} · SL {s.stop_loss} · TP {s.take_profit}
                  </span>
                  <span className="block text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()}</span>
                </span>
                <Pill tone={s.status === "active" ? "live" : "idle"}>{s.status}</Pill>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">No signals yet — run your first scan above.</div>
        )}
      </NeonCard>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><PwLabel className="text-muted-foreground">{label}</PwLabel>{children}</div>;
}
function Level({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-3 py-4 text-center">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg font-bold sm:text-xl">{value}</p>
    </div>
  );
}
