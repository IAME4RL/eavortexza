import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatusBadge } from "@/components/dash";
import { useAuth } from "@/lib/auth";
import { timeframeLabel } from "@/lib/instruments";

export const Route = createFileRoute("/_authenticated/dashboard/mentor")({ component: Page });

function Page() {
  const { user, hasRole, loading } = useAuth();

  const clients = useQuery({
    queryKey: ["mentor-clients"],
    enabled: !!user,
    queryFn: async () => {
      const { data: assignments } = await supabase
        .from("mentor_assignments").select("client_id,created_at").eq("mentor_id", user!.id);
      if (!assignments?.length) return [];
      const ids = assignments.map((a) => a.client_id);
      const { data: profiles } = await supabase.from("profiles").select("id,display_name,email").in("id", ids);
      const { data: scans } = await supabase.from("scans")
        .select("id,user_id,instrument,timeframe,status,created_at")
        .in("user_id", ids).order("created_at", { ascending: false }).limit(50);
      return (profiles ?? []).map((p) => ({
        ...p,
        scans: (scans ?? []).filter((s) => s.user_id === p.id).slice(0, 5),
      }));
    },
  });

  if (!loading && !hasRole("mentor") && !hasRole("admin")) return <Navigate to="/dashboard" />;

  return (
    <>
      <PageHeader eyebrow="Mentor portal" title="Your Clients"
        sub="Review the chart analyses of clients assigned to you. An administrator manages assignments." />

      {clients.data?.length ? (
        <div className="space-y-6">
          {clients.data.map((c) => (
            <div key={c.id} className="panel">
              <div className="border-b border-border px-5 py-4">
                <p className="font-bold">{c.display_name || c.email || "Client"}</p>
                {c.display_name && c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
              </div>
              {c.scans.length ? (
                <ul className="divide-y divide-border">
                  {c.scans.map((s) => (
                    <li key={s.id}>
                      <Link to="/dashboard/scan/$id" params={{ id: s.id }}
                        className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-surface">
                        <span className="font-mono text-sm">{s.instrument} · {timeframeLabel(s.timeframe)}</span>
                        <span className="flex items-center gap-3 text-xs text-muted-foreground">
                          <StatusBadge status={s.status} />{new Date(s.created_at).toLocaleString()}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-6 text-sm text-muted-foreground">This client has not scanned any charts yet.</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Users} title="No clients assigned">Once an administrator assigns clients to you, their scan activity will appear here.</EmptyState>
      )}
    </>
  );
}
