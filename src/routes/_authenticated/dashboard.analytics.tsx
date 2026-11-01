import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, Stat } from "@/components/dash";
import { Button } from "@/components/ui/button";
import { STRATEGIES } from "@/lib/strategy";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/dashboard/analytics")({ component: Page });

interface SignalRow {
  symbol: string;
  side: string;
  strategy: string;
  status: string;
  created_at: string;
}

function Page() {
  const { user } = useAuth();
  const signals = useQuery({
    queryKey: ["signals", "analytics"],
    queryFn: async () =>
      ((await supabase.from("signals").select("symbol,side,strategy,status,created_at")
        .eq("user_id", user!.id).order("created_at", { ascending: false }).limit(500)).data ?? []) as SignalRow[],
  });

  const rows = signals.data ?? [];
  const buys = rows.filter((r) => r.side === "buy").length;
  const sells = rows.filter((r) => r.side === "sell").length;
  const active = rows.filter((r) => r.status === "active").length;

  const count = (key: (r: SignalRow) => string) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  };
  const byInstrument = count((r) => r.symbol);
  const byStrategy = count((r) => STRATEGIES.find((s) => s.id === r.strategy)?.name ?? r.strategy);
  const total = Math.max(1, rows.length);

  return (
    <>
      <PageHeader eyebrow="Your data only" title="Trading Analytics"
        sub="Statistics computed from the signals you have generated. No invented performance figures — this reflects your actual usage of the scanner." />

      {!rows.length ? (
        <EmptyState icon={BarChart3} title="Nothing to analyse yet"
          action={<Button variant="hero" asChild><Link to="/dashboard/scanner">Run a scan</Link></Button>}>
          Analytics appear here once you have generated at least one signal.
        </EmptyState>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Total signals" value={rows.length} />
            <Stat label="Buy" value={buys} />
            <Stat label="Sell" value={sells} />
            <Stat label="Still active" value={active} />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Breakdown title="Most scanned instruments" items={byInstrument} total={total} />
            <Breakdown title="Strategies that fired" items={byStrategy} total={total} />
          </div>
        </>
      )}
    </>
  );
}

function Breakdown({ title, items, total }: { title: string; items: [string, number][]; total: number }) {
  return (
    <div className="panel p-6">
      <h2 className="font-bold uppercase">{title}</h2>
      <ul className="mt-5 space-y-3">
        {items.map(([label, n]) => (
          <li key={label}>
            <div className="flex justify-between font-mono text-xs">
              <span>{label}</span><span className="text-muted-foreground">{n} · {Math.round((n / total) * 100)}%</span>
            </div>
            <div className="mt-1 h-1.5 rounded bg-muted">
              <div className="h-full rounded bg-gradient-red" style={{ width: `${(n / total) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
