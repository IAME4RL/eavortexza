import { Link, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import avatar from "@/assets/assistant-avatar.jpg";

export function AssistantAvatar() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const bots = useQuery({
    queryKey: ["portal-bot", user?.id],
    enabled: !!user,
    refetchInterval: 15_000,
    queryFn: async () => {
      if (!user) return [];
      return (await supabase.from("bots").select("*").eq("user_id", user.id)).data ?? [];
    },
  });
  if (pathname === "/dashboard/ai") return null;
  return (
    <Button asChild variant="ghost" size="icon"
      className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-4 z-40 h-12 w-12 overflow-hidden rounded-lg border-2 border-primary bg-background p-0 red-glow lg:bottom-6 lg:left-[17rem]">
      <Link to="/dashboard/ai" search={{ botId: bots.data?.[0]?.id }} aria-label="Open AI assistant" title="AI assistant">
        <img src={avatar} alt="" width={48} height={48} loading="lazy" className="h-full w-full object-cover" />
      </Link>
    </Button>
  );
}