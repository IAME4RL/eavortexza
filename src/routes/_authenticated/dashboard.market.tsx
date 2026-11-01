import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LineChart, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/dash";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { INSTRUMENTS } from "@/lib/instruments";

export const Route = createFileRoute("/_authenticated/dashboard/market")({ component: Page });

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [instrument, setInstrument] = useState<string>("GOLD");
  const [note, setNote] = useState("");

  const items = useQuery({
    queryKey: ["watchlist"],
    queryFn: async () =>
      (await supabase.from("watchlist").select("*").eq("user_id", user!.id)
        .order("created_at", { ascending: false })).data ?? [],
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("watchlist").insert({
        user_id: user!.id, instrument, note: note.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNote("");
      toast.success(`${instrument} added to your watchlist`);
      qc.invalidateQueries({ queryKey: ["watchlist"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add instrument"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("watchlist").delete().eq("id", id).eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  return (
    <>
      <PageHeader eyebrow="Your markets" title="Market Watchlist"
        sub="Track the instruments you trade and keep notes on what you are watching. Prices are not streamed here — run the scanner for a signal on current structure." />

      <div className="panel mb-8 p-5">
        <div className="grid gap-4 sm:grid-cols-[200px_1fr_auto] sm:items-end">
          <div className="space-y-2">
            <Label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Instrument</Label>
            <Select value={instrument} onValueChange={setInstrument}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{INSTRUMENTS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={1} maxLength={300}
              placeholder="e.g. Watching for a break of the weekly high" />
          </div>
          <Button variant="hero" onClick={() => add.mutate()} disabled={add.isPending}><Plus />Add</Button>
        </div>
      </div>

      {items.data?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.data.map((w) => (
            <div key={w.id} className="panel group p-5">
              <div className="flex items-start justify-between">
                <p className="font-mono text-lg font-semibold">{w.instrument}</p>
                <button aria-label={`Remove ${w.instrument}`} onClick={() => remove.mutate(w.id)}
                  className="text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {w.note && <p className="mt-2 text-sm text-muted-foreground">{w.note}</p>}
              <p className="mt-3 font-mono text-[11px] text-muted-foreground">Added {new Date(w.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={LineChart} title="Watchlist is empty">Add the instruments you trade to keep them one click away.</EmptyState>
      )}
    </>
  );
}
