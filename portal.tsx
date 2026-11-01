import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, CandlestickChart, House, Menu, ScanLine, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

/* ---------- small primitives shared by the client portal screens ---------- */

export function NeonCard({ className, children, quiet }: { className?: string; children: ReactNode; quiet?: boolean }) {
  return <section className={cn(quiet ? "pw-card-quiet" : "pw-card", className)}>{children}</section>;
}

export function PwLabel({ children, className, red }: { children: ReactNode; className?: string; red?: boolean }) {
  return <p className={cn("pw-label", red ? "text-primary" : "text-foreground", className)}>{children}</p>;
}

export function Pill({ tone, children }: { tone: "live" | "ok" | "idle" | "warn"; children: ReactNode }) {
  return <span className="pw-pill" data-tone={tone}>{children}</span>;
}

export function Chip({ active, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return <button type="button" data-active={!!active} aria-pressed={active} className={cn("pw-chip", className)} {...rest} />;
}

/** Page heading for client screens (replaces the generic PageHeader on these routes only). */
export function PortalTitle({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="pw-title text-xl sm:text-2xl">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Semicircular gauge (0–1). */
export function Gauge({ value, label }: { value: number; label: string }) {
  const v = Math.min(1, Math.max(0, value));
  const len = Math.PI * 38;
  return (
    <svg viewBox="0 0 100 62" className="h-16 w-24 shrink-0" role="img" aria-label={`${label}: ${Math.round(v * 100)}%`}>
      <path d="M12 52 A38 38 0 0 1 88 52" fill="none" stroke="var(--border)" strokeWidth="7" strokeLinecap="round" />
      <path d="M12 52 A38 38 0 0 1 88 52" fill="none" stroke="var(--primary)" strokeWidth="7" strokeLinecap="round"
        strokeDasharray={`${len * v} ${len}`} style={{ filter: "drop-shadow(0 0 5px var(--primary))" }} />
      <text x="50" y="50" textAnchor="middle" fontFamily="var(--font-display)" fontSize="17" fontWeight="700" fill="var(--foreground)">{Math.round(v * 100)}</text>
    </svg>
  );
}

/* ---------- app chrome ---------- */

export const TABS = [
  { to: "/dashboard", label: "Home", Icon: House, exact: true },
  { to: "/dashboard/scanner", label: "Scanner", Icon: ScanLine, exact: false },
  { to: "/dashboard/auto-trade", label: "Trades", Icon: CandlestickChart, exact: false },
  { to: "/dashboard/settings", label: "Settings", Icon: Settings, exact: false },
] as const;

export function TabBar() {
  return (
    <nav className="pw-tabbar lg:hidden" aria-label="Main">
      <div className="pw-tabbar-inner">
        {TABS.map(({ to, label, Icon, exact }) => (
          <Link key={to} to={to} activeOptions={{ exact }} className="pw-tab">
            <Icon className="h-5 w-5" aria-hidden />
            <span>{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function PortalHeader({ onMenu }: { onMenu: () => void }) {
  const { user } = useAuth();
  const unread = useQuery({
    queryKey: ["portal-unread", user?.id],
    enabled: !!user,
    refetchInterval: 60_000,
    queryFn: async () => (await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user!.id).eq("read", false)).count ?? 0,
  });
  const n = unread.data ?? 0;
  const iconBtn = "relative flex h-11 w-11 items-center justify-center rounded-xl border border-primary/30 text-primary";
  return (
    <header className="sticky top-0 z-30 border-b border-primary/20 bg-black/85 px-3 pb-3 pt-3 backdrop-blur lg:hidden">
      <div className="grid grid-cols-[2.75rem_1fr_auto] items-center gap-3">
        <Link to="/dashboard" aria-label="EA VORTEX home" className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/50 bg-black shadow-[0_0_18px_-6px_var(--primary)]">
          <LogoMark className="h-7 w-7" />
        </Link>
        <div className="min-w-0 text-center">
          <p className="pw-title truncate text-base leading-tight">EA VORTEX</p>
          <p className="pw-label mt-0.5 text-[0.56rem] text-muted-foreground">Power your trading</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/dashboard/notifications" aria-label={n ? `Notifications, ${n} unread` : "Notifications"} className={iconBtn}>
            <Bell className="h-5 w-5" />
            {n > 0 && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />}
          </Link>
          <button type="button" aria-label="Open menu" onClick={onMenu} className={iconBtn}><Menu className="h-5 w-5" /></button>
        </div>
      </div>
    </header>
  );
}
