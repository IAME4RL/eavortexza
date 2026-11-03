import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getMyAssignedMentorBot } from "@/lib/mentorBots";
import circuit from "@/assets/home-circuit.jpg";

/** Small floating avatar square shown on every portal screen while the client's bot is running. */
export function BotRunningOverlay() {
  const { user } = useAuth();
  const bots = useQuery({
    queryKey: ["portal-bot", user?.id], enabled: !!user, refetchInterval: 15_000,
    queryFn: async () => (await supabase.from("bots").select("*").eq("user_id", user!.id)).data ?? [],
  });
  const mentorBot = useQuery({
    queryKey: ["assigned-mentor-bot", user?.id], enabled: !!user, refetchInterval: 60_000, retry: 1,
    queryFn: () => getMyAssignedMentorBot(user!.id),
  });
  if (bots.data?.[0]?.status !== "running") return null;
  const mb = mentorBot.data ?? null;
  const img = mb?.avatar_url ?? circuit;
  const name = mb?.name ?? "EA VORTEX";
  return (
    <Link
      to="/dashboard/auto-trade"
      aria-label={`${name} bot is running`}
      className="fixed bottom-24 right-4 z-40 flex flex-col items-center gap-1 lg:bottom-6"
    >
      <span className="relative block h-16 w-16 overflow-hidden rounded-xl border-2 border-primary shadow-[0_0_22px_-4px_var(--primary)]">
        <img src={img} alt="" className="h-full w-full object-cover" />
        <span className="absolute right-1 top-1 flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
        </span>
      </span>
      <span className="rounded-md border border-primary/40 bg-background/85 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary-soft">Running</span>
    </Link>
  );
}
