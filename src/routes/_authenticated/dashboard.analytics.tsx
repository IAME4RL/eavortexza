import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, Stat } from "@/components/dash";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/dashboard/analytics")({ component: Page });

interface ScanRow {
  instrument: string;
  status: string;
  created_at: string;
  analysis: unknown;
}

function Page() {
  const { user } = useAuth();
  const scans = useQuery({
    queryKey: ["scans", "analytics"],
    queryFn: async () =>
      ((await supabase.from("scans").select("instrument,status,created_at,analysis")
        .eq("user_id", user!.id).order("created_at", { ascending: false }).limit(500)).data ?? []) as ScanRow[],
  });

  const rows = scans.data ?? [];
  const completed = rows.filter((r) => r.status === "completed");
  const failed = rows.filter((r) => r.status === "failed");

  const byInstrument = new Map<string, number>();
  const biases = { bullish: 0, bearish: 0, neutral: 0, mixed: 0 };
  for (const r of completed) {
    byInstrument.set(r.instrument, (byInstrument.get(r.instrument) ?? 0) + 1);
    const b = (r.analysis as { bias?: string } | null)?.bias;
    if (b && b in biases) biases[b as keyof typeof biases] += 1;
  }
  const topInstruments = [...byInstrument.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxCount = topInstruments[0]?.[1] ?? 1;
  const biasTotal = Math.max(1, biases.bullish + biases.bearish + biases.neutral + biases.mixed);

  return (
    <>
      <PageHeader eyebrow="Your data only" title="Trading Analytics"
        sub="Statistics computed from your own scan history. No invented performance figures — this reflects your actual usage of the scanner." />

      {!rows.length ? (
        <EmptyState icon={BarChart3} title="Nothing to analyse yet"
          action={<Button variant="hero" asChild><Link to="/dashboard/scanner">Scan a chart</Link></Button>}>
          Analytics appear here once you have scanned at least one chart.
        </EmptyState>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Total scans" value={rows.length} />
            <Stat label="Completed" value={completed.length} />
            <Stat label="Failed" value={failed.length} />
            <Stat label="Success rate" value={`${Math.round((completed.length / Math.max(1, rows.length)) * 100)}%`} />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="panel p-6">
              <h2 className="font-bold uppercase">Most scanned instruments</h2>
              <ul className="mt-5 space-y-3">
                {topInstruments.map(([inst, count]) => (
                  <li key={inst}>
                    <div className="flex justify-between font-mono text-xs">
                      <span>{inst}</span><span className="text-muted-foreground">{count}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded bg-muted">
                      <div className="h-full rounded bg-gradient-red" style={{ width: `${(count / maxCount) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="panel p-6">
              <h2 className="font-bold uppercase">AI bias distribution</h2>
              <p className="mt-1 text-xs text-muted-foreground">How the AI read your charts — not a predictor of future results.</p>
              <ul className="mt-5 space-y-3">
                {([
                  ["Bullish", biases.bullish, "bg-bull"],
                  ["Bearish", biases.bearish, "bg-bear"],
                  ["Neutral", biases.neutral, "bg-neutral"],
                  ["Mixed", biases.mixed, "bg-muted-foreground"],
                ] as const).map(([label, count, cls]) => (
                  <li key={label}>
                    <div className="flex justify-between font-mono text-xs">
                      <span>{label}</span><span className="text-muted-foreground">{count} · {Math.round((count / biasTotal) * 100)}%</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded bg-muted">
                      <div className={`h-full rounded ${cls}`} style={{ width: `${(count / biasTotal) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </>
  );
}
