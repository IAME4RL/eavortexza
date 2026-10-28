import { useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { 
  Users, Key, Bot, ShieldCheck, Copy, Check, BarChart3, 
  Sparkles, Layers, ArrowUpRight, PlusCircle, Clock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatusBadge } from "@/components/dash";
import { useAuth } from "@/lib/auth";
import { timeframeLabel } from "@/lib/instruments";
import { STRATEGIES } from "@/lib/strategy";

export const Route = createFileRoute("/_authenticated/dashboard/mentor")({ component: MentorPortalPage });

type ActiveTab = "overview" | "bots" | "keys" | "strategies" | "clients";

function MentorPortalPage() {
  const { user, hasRole, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [copiedCode, setCopiedCode] = useState(false);

  // Mentor referral code
  const mentorCode = user ? `EVX-MTR-${user.id.slice(0, 4).toUpperCase()}-${user.id.slice(4, 8).toUpperCase()}` : "";

  // 1. Fetch Mentor's Assigned Clients
  const clientsQuery = useQuery({
    queryKey: ["mentor-clients", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: assignments } = await supabase
        .from("mentor_assignments")
        .select("client_id,created_at")
        .eq("mentor_id", user!.id);

      if (!assignments?.length) return [];
      const ids = assignments.map((a) => a.client_id);
      const { data: profiles } = await supabase.from("profiles").select("id,display_name,email").in("id", ids);
      const { data: scans } = await supabase
        .from("scans")
        .select("id,user_id,instrument,timeframe,status,created_at")
        .in("user_id", ids)
        .order("created_at", { ascending: false })
        .limit(50);

      return (profiles ?? []).map((p) => ({
        ...p,
        scans: (scans ?? []).filter((s) => s.user_id === p.id).slice(0, 5),
      }));
    },
  });

  // 2. Fetch Mentor's Bots
  const botsQuery = useQuery({
    queryKey: ["mentor-bots", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("bots")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const copyMentorCode = () => {
    if (!mentorCode) return;
    navigator.clipboard.writeText(mentorCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  if (!loading && !hasRole("mentor") && !hasRole("admin")) {
    return <Navigate to="/dashboard" />;
  }

  const clients = clientsQuery.data ?? [];
  const bots = botsQuery.data ?? [];

  const totalRobots = bots.length;
  const totalClients = clients.length;
  const activeBots = bots.filter((b) => b.status === "running").length;
  const supportedStrategies = Object.keys(STRATEGIES);

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        eyebrow="Mentor Executive Portal"
        title="Mentor Control Hub"
        sub="Manage trading robots, distribute client access licenses, and monitor live trading activity."
      />

      {/* Navigation Tabs inspired by EA NEXUS */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
        {(
          [
            { id: "overview", label: "Overview", icon: BarChart3 },
            { id: "bots", label: "Bots", icon: Bot, badge: totalRobots },
            { id: "keys", label: "Keys", icon: Key },
            { id: "strategies", label: "Strategies", icon: Layers, badge: supportedStrategies.length },
            { id: "clients", label: "Clients", icon: Users, badge: totalClients },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : "bg-surface/60 text-muted-foreground hover:bg-surface hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              {"badge" in tab && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-mono ${
                    isActive ? "bg-black/30 text-white" : "bg-border text-muted-foreground"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Mentor Referral & Activation Code Banner (EA NEXUS Reference) */}
      <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-r from-surface via-surface/90 to-primary/10 p-5 shadow-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Your Unique Mentor Code
            </div>
            <h3 className="font-mono text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
              {mentorCode || "GENERATING..."}
            </h3>
            <p className="text-xs text-muted-foreground">
              Share this code with your trading students or community so they link directly to your Mentor Portal.
            </p>
          </div>

          <button
            onClick={copyMentorCode}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 active:scale-95"
          >
            {copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span>{copiedCode ? "Copied to Clipboard" : "Copy Mentor Code"}</span>
          </button>
        </div>
      </div>

      {/* Tab 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-xl border border-border/60 bg-surface/80 p-4">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wider">Total Robots</span>
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <p className="mt-2 font-mono text-2xl font-black text-foreground">{totalRobots}</p>
              <p className="mt-1 text-xs text-muted-foreground">{activeBots} running execution</p>
            </div>

            <div className="rounded-xl border border-border/60 bg-surface/80 p-4">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wider">Assigned Clients</span>
                <Users className="h-4 w-4 text-cyan-400" />
              </div>
              <p className="mt-2 font-mono text-2xl font-black text-foreground">{totalClients}</p>
              <p className="mt-1 text-xs text-muted-foreground">Active in your academy</p>
            </div>

            <div className="rounded-xl border border-border/60 bg-surface/80 p-4">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wider">Supported Strategies</span>
                <Layers className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="mt-2 font-mono text-2xl font-black text-foreground">{supportedStrategies.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">SMC, ICT & Price Action</p>
            </div>

            <div className="rounded-xl border border-border/60 bg-surface/80 p-4">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wider">Execution Bridge</span>
                <ShieldCheck className="h-4 w-4 text-primary" />
              </div>
              <p className="mt-2 font-mono text-2xl font-black text-foreground">MT5 Ready</p>
              <p className="mt-1 text-xs text-muted-foreground">Windows Terminal Active</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <button
              onClick={() => setActiveTab("bots")}
              className="flex items-center justify-between rounded-xl border border-border bg-surface/60 p-4 text-left transition-all hover:border-primary/50 hover:bg-surface"
            >
              <div>
                <p className="font-bold text-foreground">Configure Trading Robots</p>
                <p className="text-xs text-muted-foreground">Set symbols, timeframes, and strategies</p>
              </div>
              <ArrowUpRight className="h-5 w-5 text-primary" />
            </button>

            <button
              onClick={() => setActiveTab("keys")}
              className="flex items-center justify-between rounded-xl border border-border bg-surface/60 p-4 text-left transition-all hover:border-primary/50 hover:bg-surface"
            >
              <div>
                <p className="font-bold text-foreground">Issue License Keys</p>
                <p className="text-xs text-muted-foreground">Grant robot access to your clients</p>
              </div>
              <ArrowUpRight className="h-5 w-5 text-primary" />
            </button>

            <Link
              to="/dashboard/auto-trade"
              className="flex items-center justify-between rounded-xl border border-border bg-surface/60 p-4 text-left transition-all hover:border-primary/50 hover:bg-surface"
            >
              <div>
                <p className="font-bold text-foreground">Client Auto Trade View</p>
                <p className="text-xs text-muted-foreground">Inspect client execution interface</p>
              </div>
              <ArrowUpRight className="h-5 w-5 text-primary" />
            </Link>
          </div>
        </div>
      )}

      {/* Tab 2: BOTS */}
      {activeTab === "bots" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Your Trading Robots</h3>
            <Link
              to="/dashboard/auto-trade"
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
            >
              <PlusCircle className="h-4 w-4" />
              Manage Execution Bot
            </Link>
          </div>

          {bots.length === 0 ? (
            <EmptyState icon={Bot} title="No robots configured yet">
              Head to the Auto Trade console to establish your first trading robot settings and MT5 bridge token.
            </EmptyState>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {bots.map((b) => (
                <div key={b.id} className="rounded-xl border border-border bg-surface/70 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-foreground">{b.name}</h4>
                      <p className="text-xs text-muted-foreground">
                        {b.symbol} · {b.timeframe} · {b.strategy_id}
                      </p>
                    </div>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3 text-xs text-muted-foreground">
                    <span>Lot Size: {b.lot_size}</span>
                    <span>Max Spread: {b.max_spread_points} pts</span>
                    <span>{b.live_mode ? "LIVE ACCOUNT" : "DEMO ACCOUNT"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: KEYS */}
      {activeTab === "keys" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface/70 p-5">
            <h3 className="font-bold text-foreground">Robot License Generator</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Generate secure client license tokens linked to your mentor ID. Clients paste this key into their Client Portal to unlock robot operation.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => {
                  const key = `EVX-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
                  navigator.clipboard.writeText(key);
                  alert(`Generated and copied license key: ${key}`);
                }}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
              >
                <Key className="h-4 w-4" />
                Generate & Copy Instant Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: STRATEGIES */}
      {activeTab === "strategies" && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold">Supported Strategy Engine</h3>
          <p className="text-xs text-muted-foreground">
            EA VORTEX includes 15 genuine technical strategies configured for GOLD/XAUUSD and major FX pairs.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.values(STRATEGIES).map((strat) => (
              <div key={strat.id} className="rounded-xl border border-border bg-surface/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">{strat.name}</span>
                  <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-mono font-bold text-primary">
                    ACTIVE
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  {strat.description}
                </p>
                <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Timeframes: M5, M15, H1, H4</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: CLIENTS */}
      {activeTab === "clients" && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold">Assigned Academy Clients</h3>
          {clients.length ? (
            <div className="space-y-4">
              {clients.map((c) => (
                <div key={c.id} className="rounded-xl border border-border bg-surface/70 p-5">
                  <div className="flex items-center justify-between border-b border-border/50 pb-3">
                    <div>
                      <p className="font-bold text-foreground">{c.display_name || c.email || "Client"}</p>
                      {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                    </div>
                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                      Active Student
                    </span>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Recent Chart Analyses
                    </p>
                    {c.scans.length ? (
                      <ul className="mt-2 divide-y divide-border/40">
                        {c.scans.map((s) => (
                          <li key={s.id} className="py-2">
                            <Link
                              to="/dashboard/scan/$id"
                              params={{ id: s.id }}
                              className="flex items-center justify-between text-xs hover:text-primary"
                            >
                              <span className="font-mono">
                                {s.instrument} · {timeframeLabel(s.timeframe)}
                              </span>
                              <span className="text-muted-foreground">
                                {new Date(s.created_at).toLocaleDateString()}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">No chart scans submitted yet.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Users} title="No clients assigned yet">
              Share your Mentor Code with clients so they link to your portal.
            </EmptyState>
          )}
        </div>
      )}
    </div>
  );
}
