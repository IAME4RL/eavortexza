import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ShieldCheck, Save, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, Stat } from "@/components/dash";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <>
      <PageHeader eyebrow="Administration" title="Admin Console" sub="Platform usage, scanner controls and mentor approvals." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Users" value={s?.users ?? "—"} />
        <Stat label="Total scans" value={s?.scans ?? "—"} />
        <Stat label="Scans today" value={s?.scans_today ?? "—"} />
        <Stat label="Mentor requests" value={s?.mentor_requests ?? "—"} />
        <Stat label="Trading accounts" value={s?.accounts ?? "—"} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="panel p-6">
          <h2 className="font-bold uppercase">Scanner controls</h2>
          <div className="mt-5 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Scanner enabled</p>
                <p className="text-xs text-muted-foreground">When off, users cannot run new AI scans.</p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Scanner enabled" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="limit" className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Free scans per user per day</Label>
              <Input id="limit" type="number" min={0} max={1000} value={limit} onChange={(e) => setLimit(e.target.value)} className="w-32" />
            </div>
            <Button variant="hero" onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
              <Save />{saveSettings.isPending ? "Saving…" : "Save settings"}
            </Button>
          </div>
        </div>

        <div className="panel p-6">
          <h2 className="font-bold uppercase">Mentor access requests</h2>
          {requests.data?.length ? (
            <ul className="mt-5 space-y-3">
              {requests.data.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">{r.display_name || r.email}</p>
                    {r.display_name && <p className="text-xs text-muted-foreground">{r.email}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="hero" onClick={() => decide.mutate({ id: r.id, approve: true })} disabled={decide.isPending}>
                      <Check />Approve
                    </Button>
                    <Button size="sm" variant="frame" onClick={() => decide.mutate({ id: r.id, approve: false })} disabled={decide.isPending}>
                      <X />Decline
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">No pending requests.</p>
          )}
        </div>
      </div>

      {!s && !stats.isLoading && (
        <EmptyState icon={ShieldCheck} title="Stats unavailable">Platform statistics could not be loaded.</EmptyState>
      )}
    </>
  );
}
