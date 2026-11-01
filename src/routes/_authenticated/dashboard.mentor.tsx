import { useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { 
  Users, Key, Bot, ShieldCheck, Copy, Check, BarChart3, 
  Sparkles, Layers, ArrowUpRight, PlusCircle, Clock, Trash2, CheckCircle2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatusBadge } from "@/components/dash";
import { useAuth } from "@/lib/auth";
import { timeframeLabel } from "@/lib/instruments";
import { STRATEGIES } from "@/lib/strategy";

export const Route = createFileRoute("/_authenticated/dashboard/mentor")({ component: MentorPortalPage });

type ActiveTab = "overview" | "bots" | "keys" | "strategies" | "clients";

interface GeneratedKey {
  id: string;
  code: string;
  createdAt: string;
  status: "active" | "redeemed";
}

export function MentorPortalPage() {
  const { user, hasRole, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [copiedCode, setCopiedCode] = useState(false);

  // Bot Creator Form state
  const [newBotName, setNewBotName] = useState("");
  const [newBotStrategy, setNewBotStrategy] = useState("smc_order_block");
  const [newBotSymbol, setNewBotSymbol] = useState("XAUUSD");
  const [newBotTimeframe, setNewBotTimeframe] = useState("H1");
  const [newBotLot, setNewBotLot] = useState("0.01");
  const [createdBots, setCreatedBots] = useState<Array<{
    id: string;
    name: string;
    strategy: string;
    symbol: string;
    timeframe: string;
    lot: string;
    status: string;
  }>>([
    {
      id: "bot-default",
      name: "GOLD VORTEX PRO AI",
      strategy: "SMC Order Block & Liquidity",
      symbol: "XAUUSD",
      timeframe: "H1",
      lot: "0.01",
      status: "running"
    }
  ]);

  // License Keys state
  const [generatedKeys, setGeneratedKeys] = useState<GeneratedKey[]>([
    { id: "1", code: "EVX-LIC-8921-XAU", createdAt: "Today", status: "active" },
    { id: "2", code: "EVX-LIC-3341-FX", createdAt: "Yesterday", status: "redeemed" }
  ]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Mentor referral code
  const mentorCode = user ? `EVX-MTR-${user.id.slice(0, 4).toUpperCase()}-${user.id.slice(4, 8).toUpperCase()}` : "";

  // 1. Fetch Mentor's Assigned Clients
  const clientsQuery = useQuery({
    queryKey: ["mentor-clients", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      const { data: assignments } = await supabase
        .from("mentor_assignments")
        .select("client_id,created_at")
        .eq("mentor_id", user.id);

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

  // 2. Fetch User's existing DB Bots
  const botsQuery = useQuery({
    queryKey: ["mentor-bots", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("bots")
        .select("*")
        .eq("user_id", user.id)
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

  const generateLicenseKey = () => {
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const newKey: GeneratedKey = {
      id: Date.now().toString(),
      code: `EVX-LIC-${randomHex}-${randomSuffix}`,
      createdAt: "Just now",
      status: "active"
    };
    setGeneratedKeys([newKey, ...generatedKeys]);
    navigator.clipboard.writeText(newKey.code);
    setCopiedKey(newKey.code);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleCreateBot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBotName.trim()) return;
    setCreatedBots([
      {
        id: Date.now().toString(),
        name: newBotName,
        strategy: newBotStrategy,
        symbol: newBotSymbol,
        timeframe: newBotTimeframe,
        lot: newBotLot,
        status: "running"
      },
      ...createdBots
    ]);
    setNewBotName("");
    alert(`Bot "${newBotName}" created! Clients linked to your mentor code will see this bot in their client portal.`);
  };

  if (!loading && !hasRole("mentor") && !hasRole("admin")) {
    return <Navigate to="/dashboard" />;
  }

  const clients = clientsQuery.data ?? [];
  const dbBots = botsQuery.data ?? [];

  const totalRobots = dbBots.length + createdBots.length;
  const totalClients = clients.length;
  const supportedStrategies = Object.keys(STRATEGIES);

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        eyebrow="Mentor Executive Portal"
        title="Mentor Control Hub"
        sub="Create and manage trading robots, distribute client license keys, and oversee student execution."
      />

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
        {(
          [
            { id: "overview", label: "Overview", icon: BarChart3 },
            { id: "bots", label: "Robots & Builder", icon: Bot, badge: totalRobots },
            { id: "keys", label: "License Keys", icon: Key, badge: generatedKeys.length },
            { id: "strategies", label: "Strategies", icon: Layers, badge: supportedStrategies.length },
            { id: "clients", label: "Students", icon: Users, badge: totalClients },
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

      {/* Mentor Referral & Activation Code Banner */}
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
              Share this code with clients. When they paste it in their portal, they link directly to your mentor academy.
            </p>
          </div>

          <button
            onClick={copyMentorCode}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 active:scale-95"
          >
            {copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span>{copiedCode ? "Copied Code" : "Copy Mentor Code"}</span>
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
              <p className="mt-1 text-xs text-muted-foreground">Active in academy</p>
            </div>

            <div className="rounded-xl border border-border/60 bg-surface/80 p-4">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wider">Assigned Students</span>
                <Users className="h-4 w-4 text-primary" />
              </div>
              <p className="mt-2 font-mono text-2xl font-black text-foreground">{totalClients}</p>
              <p className="mt-1 text-xs text-muted-foreground">Linked clients</p>
            </div>

            <div className="rounded-xl border border-border/60 bg-surface/80 p-4">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wider">Active Keys</span>
                <Key className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="mt-2 font-mono text-2xl font-black text-foreground">{generatedKeys.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">Issued licenses</p>
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
                <p className="font-bold text-foreground">Build & Configure Bots</p>
                <p className="text-xs text-muted-foreground">Configure symbol, strategy & lot sizing</p>
              </div>
              <ArrowUpRight className="h-5 w-5 text-primary" />
            </button>

            <button
              onClick={() => setActiveTab("keys")}
              className="flex items-center justify-between rounded-xl border border-border bg-surface/60 p-4 text-left transition-all hover:border-primary/50 hover:bg-surface"
            >
              <div>
                <p className="font-bold text-foreground">Issue Client Licenses</p>
                <p className="text-xs text-muted-foreground">Generate keys for your students</p>
              </div>
              <ArrowUpRight className="h-5 w-5 text-primary" />
            </button>

            <Link
              to="/dashboard"
              className="flex items-center justify-between rounded-xl border border-border bg-surface/60 p-4 text-left transition-all hover:border-primary/50 hover:bg-surface"
            >
              <div>
                <p className="font-bold text-foreground">Preview Client Portal</p>
                <p className="text-xs text-muted-foreground">See what your clients experience</p>
              </div>
              <ArrowUpRight className="h-5 w-5 text-primary" />
            </Link>
          </div>
        </div>
      )}

      {/* Tab 2: BOTS & BUILDER */}
      {activeTab === "bots" && (
        <div className="space-y-6">
          {/* Bot Builder Form */}
          <div className="rounded-xl border border-primary/30 bg-surface/80 p-5">
            <h3 className="font-display text-lg font-bold uppercase text-foreground">
              Create New Trading Robot
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Design a robot setup that displays on the Client Portal card for your students.
            </p>

            <form onSubmit={handleCreateBot} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase text-muted-foreground">Robot Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GOLD SCALPER PRO"
                  value={newBotName}
                  onChange={(e) => setNewBotName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-muted-foreground">Strategy</label>
                <select
                  value={newBotStrategy}
                  onChange={(e) => setNewBotStrategy(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="smc_order_block">SMC Order Block & Liquidity</option>
                  <option value="ict_silver_bullet">ICT Silver Bullet</option>
                  <option value="fair_value_gap">Fair Value Gap (FVG)</option>
                  <option value="fibonacci_golden_zone">Fibonacci Golden Zone</option>
                  <option value="break_and_retest">Break & Retest</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-muted-foreground">Target Symbol</label>
                <select
                  value={newBotSymbol}
                  onChange={(e) => setNewBotSymbol(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="XAUUSD">GOLD (XAUUSD)</option>
                  <option value="NAS100">NAS100</option>
                  <option value="EURUSD">EURUSD</option>
                  <option value="BTCUSD">BTCUSD</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-muted-foreground">Timeframe & Lot Size</label>
                <div className="mt-1 flex gap-2">
                  <select
                    value={newBotTimeframe}
                    onChange={(e) => setNewBotTimeframe(e.target.value)}
                    className="w-1/2 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                  >
                    <option value="M5">M5 Scalp</option>
                    <option value="M15">M15 Intraday</option>
                    <option value="H1">H1 Swing</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="1.0"
                    value={newBotLot}
                    onChange={(e) => setNewBotLot(e.target.value)}
                    className="w-1/2 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                    placeholder="Lot 0.01"
                  />
                </div>
              </div>

              <div className="sm:col-span-2 pt-2">
                <button
                  type="submit"
                  className="flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-display text-xs font-bold uppercase text-primary-foreground hover:bg-primary/90 transition-all"
                >
                  <PlusCircle className="h-4 w-4" />
                  Save & Publish Robot To Clients
                </button>
              </div>
            </form>
          </div>

          {/* List of Configured Bots */}
          <div className="space-y-4">
            <h4 className="font-bold text-foreground">Your Active Academy Robots</h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {createdBots.map((b) => (
                <div key={b.id} className="rounded-xl border border-border bg-surface/70 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-display font-bold text-foreground">{b.name}</h4>
                      <p className="text-xs text-muted-foreground">{b.strategy}</p>
                    </div>
                    <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 font-mono text-[10px] font-bold text-emerald-400">
                      ACTIVE
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3 text-xs text-muted-foreground font-mono">
                    <span>Symbol: {b.symbol}</span>
                    <span>TF: {b.timeframe}</span>
                    <span>Lot: {b.lot}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: KEYS */}
      {activeTab === "keys" && (
        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-surface/70 p-5">
            <h3 className="font-bold text-foreground">Robot License Generator</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Generate secure client license tokens. When your students paste this key into their Client Portal, it unlocks their access to your mentor robot.
            </p>

            <div className="mt-4">
              <button
                onClick={generateLicenseKey}
                className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-all active:scale-95"
              >
                <Key className="h-4 w-4" />
                Generate & Copy New License Key
              </button>
            </div>
          </div>

          {/* Generated keys list */}
          <div className="rounded-xl border border-border bg-surface/70 p-5">
            <h4 className="font-bold text-foreground mb-3">Issued License Keys</h4>
            <div className="divide-y divide-border/40">
              {generatedKeys.map((k) => (
                <div key={k.id} className="flex items-center justify-between py-3">
                  <div>
                    <span className="font-mono text-sm font-bold text-foreground">{k.code}</span>
                    <span className="ml-3 text-xs text-muted-foreground">Created: {k.createdAt}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                      k.status === "active" ? "bg-emerald-500/20 text-emerald-400" : "bg-neutral/20 text-muted-foreground"
                    }`}>
                      {k.status.toUpperCase()}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(k.code);
                        setCopiedKey(k.code);
                        setTimeout(() => setCopiedKey(null), 2000);
                      }}
                      className="rounded p-1.5 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                      title="Copy Key"
                    >
                      {copiedKey === k.code ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              ))}
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
                  {strat.rules}
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
          <h3 className="text-lg font-bold">Assigned Academy Students</h3>
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
            <EmptyState icon={Users} title="No students linked yet">
              Share your Mentor Code with clients so they link to your portal.
            </EmptyState>
          )}
        </div>
      )}
    </div>
  );
}
