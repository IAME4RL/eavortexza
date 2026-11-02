import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ChartSignal } from "@/lib/chartSignal";
import { PageHeader } from "@/components/dash";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/scan/$id")({ component: ScanResult });

// Shown as the signal card / chart preview instead of generic text panels.
const HIDDEN_KEYS = new Set(["signal", "price_axis"]);

function ScanResult() {
  const { id } = Route.useParams();
  const q = useQuery({ queryKey: ["scans", id], queryFn: async () => (await supabase.from("scans").select("*").eq("id", id).single()).data });
  const chart = useQuery({
    queryKey: ["scan-chart", id, q.data?.image_path],
    enabled: !!q.data?.image_path,
    queryFn: async () => (await supabase.storage.from("charts").createSignedUrl(q.data?.image_path ?? "", 3600)).data?.signedUrl ?? null,
  });
  const a = (q.data?.analysis ?? {}) as Record<string, unknown>;
  const sig = a["signal"] as ChartSignal | undefined;
  const axis = (a["price_axis"] ?? null) as { min_visible?: number | null; max_visible?: number | null; last_price?: number | null } | null;

  return (
    <>
      <PageHeader eyebrow="Hypothetical analysis · not financial advice" title={`${q.data?.instrument ?? ""} ${q.data?.timeframe ?? ""}`}
        actions={<Button variant="hero" asChild><Link to="/dashboard/scanner">Scan Another Chart</Link></Button>} />
      {q.data?.error && <p className="panel p-4 text-primary">{q.data.error}</p>}

      <div className="mb-4 grid gap-4 lg:grid-cols-5">
        {sig && (
          <div className="panel overflow-hidden lg:col-span-3">
            {sig.action === "NO_TRADE" ? (
              <div className="flex items-start gap-3 p-5">
                <Minus className="mt-0.5 h-5 w-5 shrink-0 text-neutral" />
                <div>
                  <p className="font-display text-2xl font-bold uppercase">No Trade</p>
                  <p className="mt-1 text-sm text-muted-foreground">{sig.reason ?? sig.basis}</p>
                  <p className="mt-3 text-xs text-muted-foreground">No signal is better than a guessed one. Try a clearer chart with the price scale visible.</p>
                </div>
              </div>
            ) : (
              <>
                <div className={cn("flex items-center justify-between border-b border-border px-5 py-4", sig.action === "BUY" ? "bg-bull/10" : "bg-primary/10")}>
                  <div className="flex items-center gap-3">
                    {sig.action === "BUY" ? <ArrowUpRight className="h-6 w-6 text-bull" /> : <ArrowDownRight className="h-6 w-6 text-primary" />}
                    <p className={cn("font-display text-2xl font-bold uppercase", sig.action === "BUY" ? "text-bull" : "text-primary")}>{sig.action}</p>
                  </div>
                  <span className="rounded border border-border bg-card px-3 py-1.5 font-mono text-xs">R:R 1:{sig.rr}</span>
                </div>
                <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
                  <Level label="Entry" value={sig.entry} />
                  <Level label="Stop loss" value={sig.stop_loss} />
                  <Level label="Take profit" value={sig.take_profit} />
                </div>
                <div className="space-y-3 p-5 text-sm">
                  <p className="text-muted-foreground">{sig.basis}</p>
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-widest text-primary">Read from your chart</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">{sig.evidence.map((e) => <li key={e}>{e}</li>)}</ul>
                  </div>
                  {axis?.min_visible != null && axis?.max_visible != null && (
                    <p className="font-mono text-[11px] text-muted-foreground">
                      Verified against the visible price range {axis.min_visible} – {axis.max_visible}
                      {axis.last_price != null ? ` · last price ${axis.last_price}` : ""}
                    </p>
                  )}
                  <p className="flex items-start gap-2 rounded border border-border bg-card p-3 text-xs text-muted-foreground">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    These levels come from your screenshot, not a live feed. Price may have moved since it was taken — check the live price before acting. Not financial advice; no outcome is guaranteed.
                  </p>
                </div>
              </>
            )}
          </div>
        )}
        {chart.data && (
          <div className={cn("panel p-3", sig ? "lg:col-span-2" : "lg:col-span-5")}>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Your chart</p>
            <img src={chart.data} alt="Uploaded chart" className="max-h-[420px] w-full rounded-lg object-contain" />
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(a).filter(([k]) => !HIDDEN_KEYS.has(k)).map(([k, v]) => (
          <div key={k} className="panel p-5">
            <h3 className="font-mono text-xs uppercase text-primary">{k.replace(/_/g, " ")}</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{typeof v === "string" ? v : JSON.stringify(v, null, 2)}</p>
          </div>
        ))}
      </div>
    </>
  );
}

function Level({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="px-3 py-4 text-center">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg font-bold sm:text-xl">{value}</p>
    </div>
  );
}
