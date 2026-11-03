import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getMyAssignedMentorBot } from "@/lib/mentorBots";
import circuit from "@/assets/home-circuit.jpg";

/** Small floating avatar square shown on every portal screen while the client's bot is running. */
export function BotRunningOverlay() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);
  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem("evx-badge-pos") ?? "null"); if (v && typeof v.x === "number") setPos(v); } catch { /* ignore */ }
  }, []);
  const clamp = (x: number, y: number) => ({ x: Math.max(4, Math.min(window.innerWidth - 72, x)), y: Math.max(4, Math.min(window.innerHeight - 96, y)) });
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
    <button
      type="button"
      aria-label={`${name} bot is running — drag to move, tap to open Auto Trade`}
      style={pos ? { left: pos.x, top: pos.y } : undefined}
      className={`fixed z-40 flex touch-none select-none flex-col items-center gap-1 ${pos ? "" : "bottom-24 right-4 lg:bottom-6"}`}
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current; if (!d) return;
        const n = clamp(e.clientX - d.dx, e.clientY - d.dy);
        if (!d.moved && pos && Math.hypot(n.x - pos.x, n.y - pos.y) < 4) return;
        d.moved = true; setPos(n);
      }}
      onPointerUp={() => {
        const d = drag.current; drag.current = null;
        if (d?.moved) { if (pos) localStorage.setItem("evx-badge-pos", JSON.stringify(pos)); }
        else navigate({ to: "/dashboard/auto-trade" });
      }}
    >
      <span className="relative block h-16 w-16 overflow-hidden rounded-xl border-2 border-primary shadow-[0_0_22px_-4px_var(--primary)]">
        <img src={img} alt="" draggable={false} className="h-full w-full object-cover" />
        <span className="absolute right-1 top-1 flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
        </span>
      </span>
      <span className="rounded-md border border-primary/40 bg-background/85 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary-soft">Running</span>
    </button>
  );
}
