import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatusBadge } from "@/components/dash";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { STRATEGIES } from "@/lib/strategy";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/history")({ component: Page });

function Page() {
  const { user } = useAuth();
  const signals = useQuery({
    queryKey: ["signals", "history"],
    queryFn: async () => (
      await supabase
        .from("signals")
        .select("id,symbol,timeframe,strategy,side,entry,stop_loss,take_profit,risk_reward,reason,status,created_at,expires_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100)
    ).data ?? [],
  });

  return (
    <>
      <PageHeader eyebrow="Your signals" title="Signal History"
        sub="Every signal the scanner has generated for you, newest first."
        actions={<Button variant="hero" asChild><Link to="/dashboard/scanner">New scan</Link></Button>} />

      {signals.data?.length ? (
        <div className="panel divide-y divide-border">
          {signals.data.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <p className="font-mono text-sm font-semibold">
                  {s.symbol} · {s.timeframe} · <span className={cn("uppercase", s.side === "buy" ? "text-bull" : "text-primary")}>{s.side}</span>
                </p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  Entry {s.entry} · SL {s.stop_loss} · TP {s.take_profit} · R:R 1:{s.risk_reward}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {STRATEGIES.find((x) => x.id === s.strategy)?.name ?? s.strategy} · {new Date(s.created_at).toLocaleString()}
                </p>
              </div>
              <StatusBadge status={`sig_${s.status === "active" ? "queued" : s.status === "expired" ? "closed" : "cancelled"}`} />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={History} title="No signals yet"
          action={<Button variant="hero" asChild><Link to="/dashboard/scanner">Run your first scan</Link></Button>}>
          You have not generated any signals yet.
        </EmptyState>
      )}
    </>
  );
}
