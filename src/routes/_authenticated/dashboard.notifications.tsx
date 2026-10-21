import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/dash";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/notifications")({ component: Page });

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const items = useQuery({
    queryKey: ["notifications"],
    queryFn: async () =>
      (await supabase.from("notifications").select("*").eq("user_id", user!.id)
        .order("created_at", { ascending: false }).limit(100)).data ?? [],
  });

  const markAll = useMutation({
    mutationFn: async () => {
      await supabase.from("notifications").update({ read: true }).eq("user_id", user!.id).eq("read", false);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const markOne = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("notifications").update({ read: true }).eq("id", id).eq("user_id", user!.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unread = items.data?.filter((n) => !n.read).length ?? 0;

  return (
    <>
      <PageHeader eyebrow="Inbox" title="Notifications"
        sub="Messages from your mentor and the EA VORTEX team."
        actions={unread > 0 && (
          <Button variant="frame" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
            <CheckCheck />Mark all read
          </Button>
        )} />

      {items.data?.length ? (
        <ul className="space-y-3">
          {items.data.map((n) => (
            <li key={n.id}>
              <button onClick={() => !n.read && markOne.mutate(n.id)}
                className={cn("panel w-full p-5 text-left transition-colors",
                  !n.read && "border-primary/40 red-glow-soft")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-border" : "bg-primary animate-pulse-dot")} />
                    <div>
                      <p className={cn("font-semibold", n.read && "text-muted-foreground")}>{n.title}</p>
                      {n.body && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{n.body}</p>}
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Bell} title="All quiet">You have no notifications yet.</EmptyState>
      )}
    </>
  );
}
