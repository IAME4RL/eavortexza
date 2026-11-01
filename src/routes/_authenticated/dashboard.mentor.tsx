import { useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { 
  Users, Key, Bot, ShieldCheck, Copy, Check, BarChart3, 
  Sparkles, Layers, Plus, X, Edit, Trash2, Upload, ShoppingBag, Eye
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/dash";
import { useAuth } from "@/lib/auth";
import { timeframeLabel } from "@/lib/instruments";
import { STRATEGIES } from "@/lib/strategy";

export const Route = createFileRoute("/_authenticated/dashboard/mentor")({ component: MentorPortalPage });

type ActiveTab = "overview" | "bots" | "keys" | "strategies" | "marketplace";

interface MentorBot {
  id: string;
  name: string;
  mentorName: string;
  description: string;
  strategies: string;
  avatarUrl: string;
  backgroundUrl: string;
  createdAt: string;
}

interface LicenseKeyItem {
  id: string;
  key: string;
  clientName: string;
  clientEmail: string;
  botName: string;
  status: "active" | "redeemed";
}

export function MentorPortalPage() {
  const { user, hasRole, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>("bots");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isGenerateKeyModalOpen, setIsGenerateKeyModalOpen] = useState(false);

  // Bot Form State
  const [botName, setBotName] = useState("");
  const [mentorName, setMentorName] = useState(user?.email?.split("@")[0] || "Mentor");
  const [description, setDescription] = useState("");
  const [strategyInput, setStrategyInput] = useState("Scalping, SMC, Breakout");
  const [avatarPreview, setAvatarPreview] = useState<string>("/placeholder.svg");
  const [bgPreview, setBgPreview] = useState<string>("");

  // Sample or Saved Bots
  const [mentorBots, setMentorBots] = useState<MentorBot[]>([
    {
      id: "bot-1",
      mentorName: user?.email?.split("@")[0] || "",
      description: "High precision XAUUSD scalper with ICT liquidity sweeps and tight risk.",
      strategies: "Scalping, ICT, Order Blocks",
      avatarUrl: "",
      backgroundUrl: "",
      createdAt: "2026-10-28",
    }
  ]);

  // Sample or Saved License Keys
  const [licenseKeys, setLicenseKeys] = useState<LicenseKeyItem[]>([
    {
      id: "k-1",
      status: "active",
    }
  ]);

  // Selected bot for generating new key
  const [selectedBotForNewKey, setSelectedBotForNewKey] = useState(mentorBots[0]?.name || "");
  const [clientEmailInput, setClientEmailInput] = useState("");
  const [clientNameInput, setClientNameInput] = useState("");

  const mentorCode = user ? `EVX-MTR-${user.id.slice(0, 4).toUpperCase()}-${user.id.slice(4, 8).toUpperCase()}` : "";

  // 1. Fetch Mentor's Assigned Clients from DB
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
      return profiles ?? [];
    },
  });

  const copyMentorCode = () => {
    if (!mentorCode) return;
    navigator.clipboard.writeText(mentorCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: "avatar" | "bg") => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (type === "avatar") setAvatarPreview(url);
    if (type === "bg") setBgPreview(url);
  };

  const handleSaveBot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!botName.trim()) return;

    const newBot: MentorBot = {
      id: `bot-${Date.now()}`,
      name: botName.trim(),
      mentorName: mentorName.trim(),
      description: description.trim(),
      strategies: strategyInput.trim(),
      avatarUrl: avatarPreview,
      backgroundUrl: bgPreview || avatarPreview,
      createdAt: new Date().toISOString().split("T")[0],
    };

    setMentorBots([newBot, ...mentorBots]);
    setIsCreateModalOpen(false);
    setBotName("");
    setDescription("");
  };

  const handleDeleteBot = (id: string) => {
    if (confirm("Are you sure you want to delete this bot?")) {
      setMentorBots(mentorBots.filter((b) => b.id !== id));
    }
  };

  const handleGenerateKey = (e: React.FormEvent) => {
    e.preventDefault();
    const p1 = Math.random().toString(36).substring(2, 6).toUpperCase();
    const p2 = Math.random().toString(36).substring(2, 6).toUpperCase();
    const p3 = Math.random().toString(36).substring(2, 6).toUpperCase();
    const generated = `EVX-${p1}-${p2}-${p3}`;

    const newKey: LicenseKeyItem = {
      id: `k-${Date.now()}`,
      key: generated,
      clientName: clientNameInput.trim() || "Client",
      clientEmail: clientEmailInput.trim() || "pending@eavortex.com",
      botName: selectedBotForNewKey || mentorBots[0]?.name || "Trading Bot",
      status: "active",
    };

    setLicenseKeys([newKey, ...licenseKeys]);
    setIsGenerateKeyModalOpen(false);
    setClientNameInput("");
    setClientEmailInput("");
    navigator.clipboard.writeText(generated);
    alert(`Generated & copied key: ${generated}`);
  };

  if (!loading && !hasRole("mentor") && !hasRole("admin")) {
    return <Navigate to="/dashboard" />;
  }

  const clients = clientsQuery.data ?? [];

  return (
    <div className="space-y-6 pb-12">
      {/* Brand Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-4">
        <div>
          <h1 className="font-display text-2xl font-black uppercase tracking-wider text-foreground">
            EA VORTEX <span className="text-primary font-mono text-sm">MENTOR HUB</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            Create proprietary bots, distribute client license keys, and manage your academy students.
          </p>
        </div>
        <Link
          to="/dashboard"
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50"
        >
          <Eye className="h-3.5 w-3.5" /> Client View
        </Link>
      </div>

      {/* Navigation Tabs (Inspired by your EA NEXUS reference) */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
        {(
          [
            { id: "overview", label: "Overview", icon: BarChart3 },
            { id: "bots", label: "Bots", icon: Bot, badge: mentorBots.length },
            { id: "keys", label: "Keys", icon: Key, badge: licenseKeys.length },
            { id: "strategies", label: "Strategies", icon: Layers },
            { id: "marketplace", label: "Marketplace", icon: ShoppingBag },
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
                <span className={`rounded-full px-2 py-0.5 text-xs font-mono ${
                  isActive ? "bg-black/30 text-white" : "bg-border text-muted-foreground"
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: YOUR BOTS (Matches Screenshot 4) */}
      {activeTab === "bots" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold uppercase tracking-wide text-foreground">
              Your Bots
            </h2>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
            >
              <Plus className="h-4 w-4" />
              Create Bot
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {mentorBots.map((bot) => (
              <div
                key={bot.id}
                className="group overflow-hidden rounded-2xl border border-border/80 bg-surface/90 shadow-xl transition-all hover:border-primary/50"
              >
                {/* Bot Cover / Avatar */}
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-black/60">
                  <img
                    src={bot.backgroundUrl || bot.avatarUrl}
                    alt={bot.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />
                </div>

                {/* Bot Details */}
                <div className="p-5">
                  <h3 className="font-display text-lg font-black uppercase text-foreground">
                    {bot.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-primary font-medium">
                    by {bot.mentorName}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                    {bot.description || "Institutional algorithmic trading bot."}
                  </p>

                  <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3 text-xs">
                    <button
                      onClick={() => alert(`Edit ${bot.name}`)}
                      className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <Edit className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => handleDeleteBot(bot.id)}
                      className="flex items-center gap-1.5 text-primary hover:text-primary/80"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: LICENSE KEYS (Matches Screenshot 1) */}
      {activeTab === "keys" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold uppercase tracking-wide text-foreground">
              License Keys
            </h2>
            <button
              onClick={() => setIsGenerateKeyModalOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
            >
              <Plus className="h-4 w-4" />
              Generate Key
            </button>
          </div>

          {/* Keys Table */}
          <div className="overflow-hidden rounded-xl border border-border/80 bg-surface/80">
            <div className="grid grid-cols-12 border-b border-border/60 bg-black/40 px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <span className="col-span-5 sm:col-span-4">Key</span>
              <span className="col-span-4 sm:col-span-4">Client</span>
              <span className="col-span-3 sm:col-span-4 text-right">Bot</span>
            </div>

            <div className="divide-y divide-border/40">
              {licenseKeys.map((item) => (
                <div key={item.id} className="grid grid-cols-12 items-center px-4 py-3 text-xs">
                  <div className="col-span-5 sm:col-span-4 flex items-center gap-2">
                    <span className="font-mono font-bold text-primary">{item.key}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(item.key);
                        setCopiedKey(item.key);
                        setTimeout(() => setCopiedKey(null), 2000);
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {copiedKey === item.key ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>

                  <div className="col-span-4 sm:col-span-4 min-w-0">
                    <p className="font-bold text-foreground truncate">{item.clientName}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{item.clientEmail}</p>
                  </div>

                  <div className="col-span-3 sm:col-span-4 text-right font-display font-bold text-foreground">
                    {item.botName}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-xl border border-border/60 bg-surface/80 p-4">
              <span className="text-xs uppercase text-muted-foreground">Created Bots</span>
              <p className="mt-1 font-mono text-2xl font-bold">{mentorBots.length}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-surface/80 p-4">
              <span className="text-xs uppercase text-muted-foreground">Issued Keys</span>
              <p className="mt-1 font-mono text-2xl font-bold">{licenseKeys.length}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-surface/80 p-4">
              <span className="text-xs uppercase text-muted-foreground">Active Students</span>
              <p className="mt-1 font-mono text-2xl font-bold">{clients.length}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-surface/80 p-4">
              <span className="text-xs uppercase text-muted-foreground">Bridge Engine</span>
              <p className="mt-1 font-mono text-2xl font-bold text-primary">MT5 Ready</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: STRATEGIES */}
      {activeTab === "strategies" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.values(STRATEGIES).map((s) => (
            <div key={s.id} className="rounded-xl border border-border bg-surface/70 p-4">
              <span className="font-bold">{s.name}</span>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{s.rules}</p>
            </div>
          ))}
        </div>
      )}

      {/* TAB 5: MARKETPLACE */}
      {activeTab === "marketplace" && (
        <div className="rounded-2xl border border-border bg-surface/60 p-8 text-center">
          <ShoppingBag className="mx-auto h-10 w-10 text-primary" />
          <h3 className="mt-3 font-display text-lg font-bold uppercase">EA VORTEX Marketplace</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
            List your custom bots for direct sale or subscription to verified EA VORTEX traders.
          </p>
        </div>
      )}

      {/* MODAL: CREATE BOT (Matches Screenshot 3) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border/80 bg-surface p-6 shadow-2xl">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="font-display text-xl font-bold uppercase text-foreground">
              Create Bot
            </h2>

            <form onSubmit={handleSaveBot} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-muted-foreground">Bot Name</label>
                <input
                  type="text"
                  required
                  placeholder=
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-muted-foreground">Mentor Name</label>
                <input
                  type="text"
                  value={mentorName}
                  onChange={(e) => setMentorName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-muted-foreground">Description</label>
                <textarea
                  rows={3}
                  placeholder="Describe your bot logic, recommended timeframes, and pairs..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-muted-foreground">Strategies</label>
                <input
                  type="text"
                  placeholder="Scalping, breakout, hedging, ICT..."
                  value={strategyInput}
                  onChange={(e) => setStrategyInput(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-muted-foreground">Bot Avatar</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, "avatar")}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground file:mr-3 file:rounded file:border-0 file:bg-primary/20 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-primary hover:file:bg-primary/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-muted-foreground">Bot Background</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, "bg")}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground file:mr-3 file:rounded file:border-0 file:bg-primary/20 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-primary hover:file:bg-primary/30"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Shown behind the bot avatar in the client app.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full rounded-lg bg-primary py-2.5 font-display text-xs font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90 transition-all"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: GENERATE LICENSE KEY */}
      {isGenerateKeyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border/80 bg-surface p-6 shadow-2xl">
            <button
              onClick={() => setIsGenerateKeyModalOpen(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="font-display text-xl font-bold uppercase text-foreground">
              Generate License Key
            </h2>

            <form onSubmit={handleGenerateKey} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-muted-foreground">Assign Bot</label>
                <select
                  value={selectedBotForNewKey}
                  onChange={(e) => setSelectedBotForNewKey(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                >
                  {mentorBots.map((b) => (
                    <option key={b.id} value={b.name}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-muted-foreground">Client Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Earl"
                  value={clientNameInput}
                  onChange={(e) => setClientNameInput(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-muted-foreground">Client Email</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. e4rlza@gmail.com"
                  value={clientEmailInput}
                  onChange={(e) => setClientEmailInput(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full rounded-lg bg-primary py-2.5 font-display text-xs font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90 transition-all"
                >
                  Generate & Copy Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
