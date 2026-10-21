import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Bot, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatusBadge } from "@/components/dash";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/dashboard/ea")({ component: Page });

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [platform, setPlatform] = useState("MT5");
  const [login, setLogin] = useState("");
  const [server, setServer] = useState("");
  const [label, setLabel] = useState("");

  const accounts = useQuery({
    queryKey: ["trading-accounts"],
    queryFn: async () =>
      (await supabase.from("trading_accounts").select("*").eq("user_id", user!.id)
        .order("created_at", { ascending: false })).data ?? [],
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("trading_accounts").insert({
        user_id: user!.id, platform, account_login: login.trim(),
        broker_server: server.trim(), label: label.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setLogin(""); setServer(""); setLabel("");
      toast.success("Account registered — integration pending");
      qc.invalidateQueries({ queryKey: ["trading-accounts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not register account"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trading_accounts").delete().eq("id", id).eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trading-accounts"] }),
  });

  const valid = login.trim().length >= 3 && server.trim().length >= 3;

  return (
    <>
      <PageHeader eyebrow="Expert Advisors" title="EA Management"
        sub="Register the MetaTrader accounts you want to connect to EA VORTEX. Registered accounts show as awaiting integration until the EA bridge is linked on your terminal." />

      <div className="panel mb-8 p-5">
        <h2 className="font-bold uppercase">Register a trading account</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Platform</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MT4">MetaTrader 4</SelectItem>
                <SelectItem value="MT5">MetaTrader 5</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Account login</Label>
            <Input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="e.g. 51002341" maxLength={40} />
          </div>
          <div className="space-y-2">
            <Label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Broker server</Label>
            <Input value={server} onChange={(e) => setServer(e.target.value)} placeholder="e.g. Broker-Live01" maxLength={80} />
          </div>
          <div className="space-y-2">
            <Label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Label (optional)</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Main account" maxLength={60} />
          </div>
        </div>
        <Button variant="hero" className="mt-4" onClick={() => add.mutate()} disabled={!valid || add.isPending}>
          <Plus />Register account
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">Never enter your trading password here. EA VORTEX only needs the login number and server name to identify the account.</p>
      </div>

      {accounts.data?.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {accounts.data.map((a) => (
            <div key={a.id} className="panel group p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-lg font-semibold">{a.label || a.account_login}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{a.platform} · {a.account_login} · {a.broker_server}</p>
                </div>
                <button aria-label="Remove account" onClick={() => remove.mutate(a.id)}
                  className="text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4"><StatusBadge status={a.connection_status} /></div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Bot} title="No accounts registered">Register your first MetaTrader account above to prepare it for EA integration.</EmptyState>
      )}
    </>
  );
}
