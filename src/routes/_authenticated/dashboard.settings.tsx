import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Save, UserRound, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { NeonCard, PortalTitle, PwLabel } from "@/components/portal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/dashboard/settings")({ component: Page });

function Page() {
  const { user, hasRole, refreshRoles } = useAuth();
  const qc = useQueryClient();
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).single()).data,
  });
  const [name, setName] = useState("");
  useEffect(() => {
    if (profile.data && !name) setName(profile.data.display_name ?? "");
  }, [profile.data, name]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({ display_name: name.trim() || null }).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const requestMentor = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({ mentor_requested: true }).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mentor access requested");
      qc.invalidateQueries({ queryKey: ["profile"] });
      refreshRoles();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not send request"),
  });

  const requested = profile.data?.mentor_requested;
  const isMentor = hasRole("mentor");

  return (
    <>
      <PortalTitle title="Settings" sub="Manage your profile and platform access." />

      <div className="grid gap-5 lg:grid-cols-2">
        <NeonCard className="p-5 sm:p-6">
          <PwLabel red className="flex items-center gap-2"><UserRound className="h-4 w-4" />Profile</PwLabel>
          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="pw-label text-[0.62rem] text-muted-foreground">Email</Label>
              <Input id="email" className="pw-field" value={user?.email ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="display_name" className="pw-label text-[0.62rem] text-muted-foreground">Display name</Label>
              <Input id="display_name" className="pw-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="How should we address you?" maxLength={60} />
            </div>
            <button type="button" className="pw-btn pw-btn-solid" onClick={() => save.mutate()} disabled={save.isPending}>
              <Save className="h-4 w-4" />{save.isPending ? "Saving…" : "Save profile"}
            </button>
          </div>
        </NeonCard>

        <NeonCard className="p-5 sm:p-6">
          <PwLabel red className="flex items-center gap-2"><GraduationCap className="h-4 w-4" />Mentor access</PwLabel>
          <p className="mt-3 text-sm text-muted-foreground">
            Mentors can review their clients' chart analyses and send guidance through notifications.
          </p>
          <div className="mt-5">
            {isMentor ? (
              <p className="rounded-xl border border-bull/40 bg-card p-3 text-sm text-bull">Mentor access is active on your account.</p>
            ) : requested ? (
              <p className="rounded-xl border border-neutral/40 bg-card p-3 text-sm text-neutral">Your request is awaiting administrator approval.</p>
            ) : (
              <button type="button" className="pw-btn" onClick={() => requestMentor.mutate()} disabled={requestMentor.isPending}>
                Request mentor access
              </button>
            )}
          </div>
        </NeonCard>
      </div>
    </>
  );
}
