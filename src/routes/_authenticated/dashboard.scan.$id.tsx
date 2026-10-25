import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { canonicalInstrument } from "@/lib/instruments";
import { FEEDS, FEED_TIMEFRAMES } from "@/lib/marketdata";
import { PageHeader } from "@/components/dash";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard/scan/$id")({ component: ScanResult });

function ScanResult() {
  const { id } = Route.useParams();
  const q = useQuery({ queryKey: ["scans", id], queryFn: async () => (await supabase.from("scans").select("*").eq("id", id).single()).data });
  const a = (q.data?.analysis ?? {}) as Record<string, unknown>;
  const feedSymbol = q.data ? canonicalInstrument(q.data.instrument) : null;
  const signalSearch = q.data && feedSymbol && FEEDS[feedSymbol]
    ? {
        instrument: feedSymbol,
        timeframe: FEED_TIMEFRAMES.includes(q.data.timeframe) ? q.data.timeframe : "H1",
        auto: true,
      }
    : null;
  return (
    <>
      <PageHeader eyebrow="Hypothetical analysis · not financial advice" title={`${q.data?.instrument ?? ""} ${q.data?.timeframe ?? ""}`}
        actions={<Button variant="hero" asChild><Link to="/dashboard/scanner">Scan Another Chart</Link></Button>} />
      {q.data?.error && <p className="panel p-4 text-primary">{q.data.error}</p>}
      {signalSearch && (
        <div className="panel mb-4 flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <h3 className="font-display text-lg font-bold uppercase">Want a live trade setup for {q.data?.instrument}?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Cross-check this chart against the rule-based Market Signals engine — real closed-bar data, calculated entry, stop-loss and targets. No invented prices.
            </p>
          </div>
          <Button variant="hero" asChild>
            <Link to="/dashboard/signals" search={signalSearch}><Activity />Get Market Signals Now</Link>
          </Button>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(a).map(([k, v]) => (
          <div key={k} className="panel p-5">
            <h3 className="font-mono text-xs uppercase text-primary">{k.replace(/_/g, " ")}</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{typeof v === "string" ? v : JSON.stringify(v, null, 2)}</p>
          </div>
        ))}
      </div>
    </>
  );
}
