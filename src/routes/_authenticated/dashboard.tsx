import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, ScanLine, History, Bot, BarChart3, LineChart, Bell, Settings, Users, ShieldCheck, LogOut, Menu, X, Zap, Activity,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { PortalHeader, TabBar } from "@/components/portal";
import { VortexBackground } from "@/components/VortexBackground";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — EA VORTEX" }, { name: "robots", content: "noindex" }] }),
  component: DashLayout,
});

const NAV = [
  { to: "/dashboard", label: "Overview", I: LayoutDashboard, exact: true },
  { to: "/dashboard/scanner", label: "AI Chart Scanner", I: ScanLine },
  { to: "/dashboard/signals", label: "Market Signals", I: Activity },
  { to: "/dashboard/history", label: "Scan History", I: History },
  { to: "/dashboard/auto-trade", label: "Auto Trade", I: Zap },
  { to: "/dashboard/ea", label: "EA Management", I: Bot },
  { to: "/dashboard/analytics", label: "Trading Analytics", I: BarChart3 },
  { to: "/dashboard/market", label: "Market Analysis", I: LineChart },
  { to: "/dashboard/notifications", label: "Notifications", I: Bell },
  { to: "/dashboard/settings", label: "Settings", I: Settings },
] as const;

const linkCls = "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:text-primary data-[status=active]:shadow-[inset_2px_0_0_var(--primary)]";

function useSignOut() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
}

function SidebarContent({ onNavigate }: { onNavigate: () => void }) {
  const { user, hasRole } = useAuth();
  const signOut = useSignOut();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-sidebar-border px-5"><Logo /></div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV.map(({ to, label, I, ...rest }) => (
          <Link key={to} to={to} activeOptions={{ exact: "exact" in rest }} className={linkCls} onClick={onNavigate}>
            <I className="h-4 w-4" />{label}
          </Link>
        ))}
        {(hasRole("mentor") || hasRole("admin")) && (
          <>
            <p className="px-3 pb-1 pt-5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Portals</p>
            {hasRole("mentor") && <Link to="/dashboard/mentor" className={linkCls} onClick={onNavigate}><Users className="h-4 w-4" />Mentor Portal</Link>}
            {hasRole("admin") && <Link to="/dashboard/admin" className={linkCls} onClick={onNavigate}><ShieldCheck className="h-4 w-4" />Admin</Link>}
          </>
        )}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <p className="truncate px-3 pb-2 text-xs text-muted-foreground">{user?.email}</p>
        <button onClick={signOut} className={cn(linkCls, "w-full")}><LogOut className="h-4 w-4" />Sign out</button>
      </div>
    </div>
  );
}

function DashLayout() {
  const { pathname } = useLocation();
  // The mentor and admin portals keep their current layout until they are redesigned.
  const legacy = pathname.startsWith("/dashboard/mentor") || pathname.startsWith("/dashboard/admin");
  return legacy ? <LegacyShell /> : <ClientShell />;
}

/** Existing layout, unchanged in look and behaviour: used by the mentor and admin pages. */
function LegacyShell() {
  const [open, setOpen] = useState(false);
  const sidebar = <SidebarContent onNavigate={() => setOpen(false)} />;
  return (
    <div className="min-h-screen lg:pl-64">
      <VortexBackground />
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-sidebar-border bg-sidebar lg:block">{sidebar}</aside>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur lg:hidden">
        <Logo />
        <button aria-label="Open menu" onClick={() => setOpen(true)}><Menu /></button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-background/80" onClick={() => setOpen(false)} />
          <aside className="relative h-full w-72 border-r border-sidebar-border bg-sidebar">
            <button aria-label="Close menu" className="absolute right-3 top-4" onClick={() => setOpen(false)}><X /></button>
            {sidebar}
          </aside>
        </div>
      )}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10"><Outlet /></main>
    </div>
  );
}

/** Client portal: phone-style header + bottom tabs on small screens, sidebar on desktop. */
function ClientShell() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative min-h-dvh lg:pl-64">
      <VortexBackground />
      <div className="pw-vignette" aria-hidden />
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-sidebar-border bg-sidebar lg:block">
        <SidebarContent onNavigate={() => setOpen(false)} />
      </aside>
      <PortalHeader onMenu={() => setOpen(true)} />
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/80" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 right-0 w-72 max-w-[85vw] border-l border-primary/30 bg-sidebar">
            <button aria-label="Close menu" className="absolute right-3 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground" onClick={() => setOpen(false)}><X /></button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-32 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-10"><Outlet /></main>
      <TabBar />
    </div>
  );
}
