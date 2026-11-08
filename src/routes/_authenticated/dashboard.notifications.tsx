import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 border-b border-primary/20 pb-4">
        <div className="min-w-0">
          <p className="pw-label text-primary">Inbox</p>
          <h1 className="pw-title text-2xl">Notifications</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Messages from your mentor and the EA VORTEX team.
          </p>
        </div>
        {unread > 0 && (
          <button
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
            className="pw-btn shrink-0"
          >
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </button>
        )}
      </div>

      {items.data?.length ? (
        <ul className="space-y-3">
          {items.data.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => !n.read && markOne.mutate(n.id)}
                className={cn(
                  "w-full p-4 text-left transition-colors",
                  n.read ? "pw-card-quiet" : "pw-card",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        n.read ? "bg-border" : "bg-primary animate-pulse-dot",
                      )}
                    />
                    <div className="min-w-0">
                      <p className={cn("text-sm font-bold", n.read && "text-muted-foreground")}>{n.title}</p>
                      {n.body && (
                        <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                          {n.body}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {new Date(n.created_at).toLocaleString()}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="pw-card-quiet border-dashed p-12 text-center">
          <Bell className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <h3 className="mt-4 font-display text-base font-bold uppercase text-foreground">All quiet</h3>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">You have no notifications yet.</p>
        </div>
      )}
    </div>
  );
}
