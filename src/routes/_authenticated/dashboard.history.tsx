import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { History, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatusBadge } from "@/components/dash";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { timeframeLabel, styleLabel } from "@/lib/instruments";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/history")({ component: Page });

const FILTERS = [
  { value: "all", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
] as const;

function Page() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const scans = useQuery({
    queryKey: ["scans", "history", filter],
    queryFn: async () => {
      let q = supabase
        .from("scans")
        .select("id,instrument,timeframe,trading_style,status,created_at,error")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (filter !== "all") q = q.eq("status", filter);
      return (await q).data ?? [];
    },
  });

  return (
    <>
      <PageHeader eyebrow="Your analyses" title="Scan History"
        sub="Every chart you have scanned, newest first. Completed analyses can be reopened at any time."
        actions={<Button variant="hero" asChild><Link to="/dashboard/scanner">New scan</Link></Button>} />

      <div className="mb-6 flex gap-1.5">
        {FILTERS.map((f) => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={cn("rounded border px-3 py-1.5 font-mono text-xs uppercase",
              filter === f.value ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
            {f.label}
          </button>
        ))}
      </div>

      {scans.data?.length ? (
        <div className="panel divide-y divide-border">
          {scans.data.map((s) => (
            <Link key={s.id} to="/dashboard/scan/$id" params={{ id: s.id }}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-surface">
              <div>
                <p className="font-mono text-sm font-semibold">{s.instrument} · {timeframeLabel(s.timeframe)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{styleLabel(s.trading_style)} · {new Date(s.created_at).toLocaleString()}</p>
              </div>
              <span className="flex items-center gap-3">
                <StatusBadge status={s.status} />
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState icon={History} title="No scans found"
          action={<Button variant="hero" asChild><Link to="/dashboard/scanner">Scan your first chart</Link></Button>}>
          {filter === "all" ? "You have not scanned any charts yet." : `No ${filter} scans.`}
        </EmptyState>
      )}
    </>
  );
}
