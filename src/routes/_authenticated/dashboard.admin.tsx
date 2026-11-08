import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ShieldCheck, Save, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, Stat } from "@/components/dash";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/dashboard/admin")({ component: Page });

interface Stats { users: number; scans: number; scans_today: number; mentor_requests: number; accounts: number; }

function Page() {
  const { hasRole, loading, user } = useAuth();
  const qc = useQueryClient();

  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => (await supabase.rpc("admin_stats")).data as Stats | null,
  });
  const settings = useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => (await supabase.from("app_settings").select("*").eq("id", 1).single()).data,
  });
  const requests = useQuery({
    queryKey: ["mentor-requests"],
    queryFn: async () =>
      (await supabase.from("profiles").select("id,display_name,email,created_at")
        .eq("mentor_requested", true).order("created_at", { ascending: true })).data ?? [],
  });

  const [enabled, setEnabled] = useState(true);
  const [limit, setLimit] = useState("5");
  useEffect(() => {
    if (settings.data) {
      setEnabled(settings.data.scanner_enabled);
      setLimit(String(settings.data.daily_scan_limit));
    }
  }, [settings.data]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      const n = Math.max(0, Math.min(1000, parseInt(limit, 10) || 0));
      const { error } = await supabase.from("app_settings")
        .update({ scanner_enabled: enabled, daily_scan_limit: n, updated_at: new Date().toISOString() }).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Scanner settings saved");
      qc.invalidateQueries({ queryKey: ["app-settings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save settings"),
  });

  const decide = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      if (approve) {
        const { error } = await supabase.from("user_roles").insert({ user_id: id, role: "mentor" });
        if (error && error.code !== "23505") throw error;
        await supabase.from("notifications").insert({
          user_id: id, sender_id: user!.id,
          title: "Mentor access approved",
          body: "Your mentor access request has been approved. The Mentor Portal is now available in your dashboard.",
        });
      } else {
        await supabase.from("notifications").insert({
          user_id: id, sender_id: user!.id,
          title: "Mentor access request declined",
          body: "Your mentor access request was not approved at this time.",
        });
      }
      const { error } = await supabase.from("profiles").update({ mentor_requested: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.approve ? "Mentor approved" : "Request declined");
      qc.invalidateQueries({ queryKey: ["mentor-requests"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Action failed"),
  });

  if (!loading && !hasRole("admin")) return <Navigate to="/dashboard" />;
  const s = stats.data;

  return (
    <div className="space-y-6 pb-12">
      <PageHeader eyebrow="Administration" title="Admin Console" sub="Platform usage, scanner controls and mentor approvals." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Users" value={s?.users ?? "—"} />
        <Stat label="Total scans" value={s?.scans ?? "—"} />
        <Stat label="Scans today" value={s?.scans_today ?? "—"} />
        <Stat label="Mentor requests" value={s?.mentor_requests ?? "—"} />
        <Stat label="Trading accounts" value={s?.accounts ?? "—"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="pw-card p-5">
          <h2 className="pw-title text-lg">Scanner controls</h2>
          <div className="mt-5 space-y-5">
            <div className="pw-card-quiet flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="text-sm font-bold">Scanner enabled</p>
                <p className="text-xs text-muted-foreground">When off, users cannot run new AI scans.</p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Scanner enabled" />
            </div>
            <div>
              <label htmlFor="limit" className="pw-label block text-muted-foreground">Free scans per user per day</label>
              <input
                id="limit"
                type="number"
                min={0}
                max={1000}
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                className="pw-field mt-1 w-32"
              />
            </div>
            <button
              onClick={() => saveSettings.mutate()}
              disabled={saveSettings.isPending}
              className="pw-btn pw-btn-solid w-full justify-center disabled:opacity-60"
            >
              <Save className="h-4 w-4" />{saveSettings.isPending ? "Saving…" : "Save settings"}
            </button>
          </div>
        </div>

        <div className="pw-card p-5">
          <h2 className="pw-title text-lg">Mentor access requests</h2>
          {requests.data?.length ? (
            <ul className="mt-5 space-y-3">
              {requests.data.map((r) => (
                <li key={r.id} className="pw-card-quiet p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{r.display_name || r.email}</p>
                    {r.display_name && <p className="truncate text-xs text-muted-foreground">{r.email}</p>}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => decide.mutate({ id: r.id, approve: true })}
                      disabled={decide.isPending}
                      className="pw-btn pw-btn-solid flex-1 justify-center disabled:opacity-60"
                    >
                      <Check className="h-3.5 w-3.5" />Approve
                    </button>
                    <button
                      onClick={() => decide.mutate({ id: r.id, approve: false })}
                      disabled={decide.isPending}
                      className="pw-btn flex-1 justify-center disabled:opacity-60"
                    >
                      <X className="h-3.5 w-3.5" />Decline
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 text-xs text-muted-foreground">No pending requests.</p>
          )}
        </div>
      </div>

      {!s && !stats.isLoading && (
        <EmptyState icon={ShieldCheck} title="Stats unavailable">Platform statistics could not be loaded.</EmptyState>
      )}
    </div>
  );
}
