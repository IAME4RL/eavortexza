import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ScanLine, ArrowRight, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getScanQuota } from "@/lib/scan.functions";
import { PageHeader, Stat, StatusBadge } from "@/components/dash";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { timeframeLabel } from "@/lib/instruments";

export const Route = createFileRoute("/_authenticated/dashboard/")({ component: Overview });

function Overview() {
  const { user, hasRole } = useAuth();
  const quotaFn = useServerFn(getScanQuota);
  const quota = useQuery({ queryKey: ["quota"], queryFn: () => quotaFn() });
  const recent = useQuery({
    queryKey: ["scans", "recent"],
    queryFn: async () => (await supabase.from("scans").select("id,instrument,timeframe,status,created_at").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(5)).data ?? [],
  });
  const counts = useQuery({
    queryKey: ["overview-counts"],
    queryFn: async () => {
      const [a, n, p] = await Promise.all([
        supabase.from("trading_accounts").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user!.id).eq("read", false),
        supabase.from("profiles").select("mentor_requested,display_name").eq("id", user!.id).single(),
      ]);
      return { accounts: a.count ?? 0, unread: n.count ?? 0, profile: p.data };
    },
  });
  const q = quota.data;

  return (
    <>
      <PageHeader eyebrow="Client portal" title={`Welcome${counts.data?.profile?.display_name ? `, ${counts.data.profile.display_name}` : ""}`}
        actions={<Button variant="hero" asChild><Link to="/dashboard/scanner"><ScanLine />Scan a chart</Link></Button>} />
      {counts.data?.profile?.mentor_requested && !hasRole("mentor") && (
        <div className="mb-6 flex items-center gap-3 rounded-md border border-neutral/40 bg-card p-4 text-sm"><Clock className="h-4 w-4 text-neutral" />Your mentor access request is awaiting administrator approval.</div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Free scans today" value={q ? `${Math.max(0, q.limit - q.used)}/${q.limit}` : "—"} hint="Resets daily at 00:00 UTC" />
        <Stat label="Total scans" value={recent.data ? (recent.data.length >= 5 ? "5+" : recent.data.length) : "—"} />
        <Stat label="Trading accounts" value={counts.data?.accounts ?? "—"} hint="Registered for integration" />
        <Stat label="Unread notifications" value={counts.data?.unread ?? "—"} />
      </div>
      <div className="mt-8 panel">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-bold uppercase">Recent scans</h2>
          <Link to="/dashboard/history" className="flex items-center gap-1 text-sm text-primary">View all <ArrowRight className="h-4 w-4" /></Link>
        </div>
        {recent.data?.length ? (
          <ul className="divide-y divide-border">
            {recent.data.map((s) => (
              <li key={s.id}>
                <Link to="/dashboard/scan/$id" params={{ id: s.id }} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-surface">
                  <span className="font-mono text-sm">{s.instrument} · {timeframeLabel(s.timeframe)}</span>
                  <span className="flex items-center gap-3 text-xs text-muted-foreground"><StatusBadge status={s.status} />{new Date(s.created_at).toLocaleString()}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="px-5 py-8 text-sm text-muted-foreground">No scans yet. Upload your first chart to get started.</p>}
      </div>
    </>
  );
}
