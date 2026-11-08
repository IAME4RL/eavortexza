import { useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Users, Key, Bot, ShieldCheck, Copy, Check, BarChart3, 
  Sparkles, Layers, Plus, X, Edit, Trash2, Upload, ShoppingBag, Eye
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/dash";
import { useAuth } from "@/lib/auth";
import { timeframeLabel } from "@/lib/instruments";
import { STRATEGIES } from "@/lib/strategy";
import { deleteMentorBot, issueMentorLicense, listMentorBots, listMentorLicenses, saveMentorBot, updateMentorBot, type MentorBotRecord } from "@/lib/mentorBots";

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
  status: "active" | "redeemed" | "revoked";
}

export function MentorPortalPage() {
  const { user, hasRole, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>("bots");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingBot, setEditingBot] = useState<MentorBotRecord | null>(null);
  const [isGenerateKeyModalOpen, setIsGenerateKeyModalOpen] = useState(false);

  // Bot Form State
  const [botName, setBotName] = useState("");
  const [mentorName, setMentorName] = useState(user?.email?.split("@")[0] || "Mentor");
  const [description, setDescription] = useState("");
  const [strategyInput, setStrategyInput] = useState("Scalping, SMC, Breakout");
  const [avatarPreview, setAvatarPreview] = useState<string>("/placeholder.svg");
  const [bgPreview, setBgPreview] = useState<string>("");

  const botsQuery = useQuery({
    queryKey: ["mentor-bots", user?.id], enabled: !!user,
    queryFn: () => listMentorBots(user!.id),
  });
  const licensesQuery = useQuery({
    queryKey: ["mentor-bot-licenses", user?.id], enabled: !!user,
    queryFn: () => listMentorLicenses(user!.id),
  });
  const mentorBots = (botsQuery.data ?? []).map((b) => ({
    id: b.id, name: b.name, mentorName: b.mentor_name, description: b.description,
    strategies: b.strategies, avatarUrl: b.avatar_url || "", backgroundUrl: b.background_url || "",
    createdAt: b.created_at,
  }));
  const licenseKeys = (licensesQuery.data ?? []).map((k) => ({
    id: k.id, key: k.license_key, clientName: k.client_name, clientEmail: k.client_email,
    botName: k.bot?.name || "Trading Bot", status: k.status,
  }));
  const [selectedBotForNewKey, setSelectedBotForNewKey] = useState("");
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
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (type === "avatar") { setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file)); }
    else { setBannerFile(file); setBgPreview(URL.createObjectURL(file)); }
  };

  const profileQuery = useQuery({
    queryKey: ["profile"], enabled: !!user,
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).single()).data,
  });
  const defaultMentorName = profileQuery.data?.display_name?.trim() || user?.email?.split("@")[0] || "Mentor";
  const resetBotForm = () => {
    setEditingBot(null);
    setBotName("");
    setMentorName(defaultMentorName);
    setDescription("");
    setStrategyInput("Scalping, SMC, Breakout");
    setAvatarFile(null);
    setBannerFile(null);
    setAvatarPreview("/placeholder.svg");
    setBgPreview("");
  };
  const closeBotModal = () => { setIsCreateModalOpen(false); resetBotForm(); };
  const openCreateBot = () => { resetBotForm(); setIsCreateModalOpen(true); };
  const openEditBot = (id: string) => {
    const bot = (botsQuery.data ?? []).find((b) => b.id === id);
    if (!bot) return;
    setEditingBot(bot);
    setBotName(bot.name);
    setMentorName(bot.mentor_name);
    setDescription(bot.description ?? "");
    setStrategyInput(bot.strategies ?? "");
    setAvatarFile(null);
    setBannerFile(null);
    setAvatarPreview(bot.avatar_url || "/placeholder.svg");
    setBgPreview(bot.background_url || "");
    setIsCreateModalOpen(true);
  };

  const handleSaveBot = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!user || !botName.trim() || saving) return;
  setSaving(true);

  try {
    const input = {
      mentorId: user.id,
      name: botName,
      mentorName,
      description,
      strategies: strategyInput,
      avatarFile,
      bannerFile,
    };

    if (editingBot) {
      await updateMentorBot({ ...input, botId: editingBot.id });
    } else {
      await saveMentorBot(input);
    }

    await queryClient.invalidateQueries({
      queryKey: ["mentor-bots", user.id],
    });

    closeBotModal();
  } catch (error) {
    alert(error instanceof Error ? error.message : "Could not save bot.");
  } finally {
    setSaving(false);
  }
};

  const handleDeleteBot = async (id: string) => {
    if (!confirm("Delete this bot? Any active license assigned to it will also be removed.")) return;
    try { await deleteMentorBot(id); await queryClient.invalidateQueries({ queryKey: ["mentor-bots", user?.id] }); }
    catch (error) { alert(error instanceof Error ? error.message : "Could not delete bot."); }
  };

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const botId = selectedBotForNewKey || mentorBots[0]?.id;
    if (!botId || !clientEmailInput.trim() || !clientNameInput.trim()) return;
    try {
      const generated = await issueMentorLicense({ botId, clientName: clientNameInput, clientEmail: clientEmailInput });

try {
  await sendLicenseEmail({
    data: {
      clientEmail: clientEmailInput,
      clientName: clientNameInput,
      botName: "EA VORTEX Bot",
      licenseKey: generated,
      mentorName: "Your mentor",
    },
  });
} catch (e) {
  console.error("Email failed", e);
}

await queryClient.invalidateQueries({ queryKey: ["mentor-bot-licenses", user?.id] });
      import { sendLicenseEmail } from "@/lib/email.functions";

// Inside your key generation function right after: const key = await issueMentorLicense(...);
   try {
  await sendLicenseEmail({
    data: {
      clientEmail: clientEmailInput,
      clientName: clientNameInput,
      botName: "EA VORTEX Bot",
      licenseKey: generated,
      mentorName: "Your mentor",
    },
  });
} catch (e) {
  console.error("Email failed", e);
   }                                  

  if (!loading && !hasRole("mentor") && !hasRole("admin")) {
    return <Navigate to="/dashboard" />;
  }

  const clients = clientsQuery.data ?? [];

  return (
    <div className="space-y-6 pb-12">
      {/* Brand Header */}
      <div className="flex items-center justify-between border-b border-primary/20 pb-4">
        <div>
          <h1 className="pw-title text-2xl">
            EA VORTEX <span className="pw-label text-foreground">MENTOR HUB</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            Create proprietary bots, distribute client license keys, and manage your academy students.
          </p>
        </div>
        <Link
          to="/dashboard"
          className="pw-btn"
        >
          <Eye className="h-3.5 w-3.5" /> Client View
        </Link>
      </div>

      {/* Navigation Tabs (Inspired by your EA NEXUS reference) */}
      <div className="flex flex-wrap items-center gap-2 border-b border-primary/20 pb-3">
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
              className="pw-chip gap-2" data-active={isActive}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              {"badge" in tab && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-mono ${
                  isActive ? "bg-background/40 text-foreground" : "bg-border text-muted-foreground"
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
            <h2 className="pw-title text-xl">
              Your Bots
            </h2>
            <button
              onClick={openCreateBot}
              className="pw-btn pw-btn-solid"
            >
              <Plus className="h-4 w-4" />
              Create Bot
            </button>
          </div>
          {mentorBots.length === 0 ? (
            <div className="pw-card-quiet border-dashed p-12 text-center">
              <Bot className="mx-auto h-12 w-12 text-muted-foreground/40" />
              <h3 className="mt-4 font-display text-base font-bold uppercase text-foreground">
                No Bots Created Yet
              </h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                You haven't created any trading bots yet. Click "+ Create Bot" above to build your first bot for your students.
              </p>
              <button
                onClick={openCreateBot}
                className="pw-btn pw-btn-solid mt-5"
              >
                <Plus className="h-4 w-4" /> Create Your First Bot
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {mentorBots.map((bot) => (
                <div
                  key={bot.id}
                  className="pw-card group relative isolate flex min-h-[20rem] flex-col overflow-hidden"
                >
                  <div className="absolute inset-0 -z-10 bg-black">
                    {(bot.backgroundUrl || bot.avatarUrl) ? <img src={bot.backgroundUrl || bot.avatarUrl} alt={bot.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center bg-gradient-to-br from-red-950 via-neutral-950 to-black"><Bot className="h-12 w-12 text-primary/70" /></div>}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-transparent via-35% to-black/95" />
                  </div>

                  <div className="flex items-center gap-3 px-4 pt-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-primary/80 bg-black shadow-[0_0_18px_-4px_var(--primary)]">
                      {bot.avatarUrl ? <img src={bot.avatarUrl} alt={`${bot.name} avatar`} className="h-full w-full object-cover" /> : <Bot className="h-6 w-6 text-primary" />}
                    </div>
                    <div className="min-w-0">
                      <h3 className="pw-title break-words text-lg leading-tight">{bot.name}</h3>
                      <p className="pw-label mt-0.5 truncate text-[0.6rem] text-muted-foreground">by <span className="text-primary">{bot.mentorName}</span></p>
                    </div>
                  </div>

                  <div className="mt-auto px-4 pb-4 pt-16">
                    <div className="mt-4 flex items-center justify-between border-t border-primary/20 pt-3 text-xs">
                      <button
                        onClick={() => openEditBot(bot.id)}
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
          )}
        </div>
      )}

      {/* TAB 2: LICENSE KEYS (Matches Screenshot 1) */}
      {activeTab === "keys" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="pw-title text-xl">
              License Keys
            </h2>
            <button
              onClick={() => setIsGenerateKeyModalOpen(true)}
              className="pw-btn pw-btn-solid"
            >
              <Plus className="h-4 w-4" />
              Generate Key
            </button>
          </div>

          {/* Keys Table */}
          <div className="pw-card-quiet overflow-hidden">
            <div className="grid grid-cols-12 border-b border-border/60 bg-black/40 px-4 py-3 pw-label text-muted-foreground">
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
            <div className="pw-card-quiet p-4">
              <span className="text-xs uppercase text-muted-foreground">Created Bots</span>
              <p className="mt-1 font-mono text-2xl font-bold">{mentorBots.length}</p>
            </div>
            <div className="pw-card-quiet p-4">
              <span className="text-xs uppercase text-muted-foreground">Issued Keys</span>
              <p className="mt-1 font-mono text-2xl font-bold">{licenseKeys.length}</p>
            </div>
            <div className="pw-card-quiet p-4">
              <span className="text-xs uppercase text-muted-foreground">Active Students</span>
              <p className="mt-1 font-mono text-2xl font-bold">{clients.length}</p>
            </div>
            <div className="pw-card-quiet p-4">
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
            <div key={s.id} className="pw-card-quiet p-4">
              <span className="font-bold">{s.name}</span>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{s.rules}</p>
            </div>
          ))}
        </div>
      )}

      {/* TAB 5: MARKETPLACE */}
      {activeTab === "marketplace" && (
        <div className="pw-card p-8 text-center">
          <ShoppingBag className="mx-auto h-10 w-10 text-primary" />
          <h3 className="mt-3 font-display text-lg font-bold uppercase">EA VORTEX Marketplace</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
            List your custom bots for direct sale or subscription to verified EA VORTEX traders.
          </p>
        </div>
      )}

      {/* MODAL: CREATE BOT (Matches Screenshot 3) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
          <div className="pw-card relative w-full max-w-lg bg-black p-6">
            <button
              onClick={closeBotModal}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="pw-title text-xl">
              {editingBot ? "Edit Bot" : "Create Bot"}
            </h2>

            <form onSubmit={handleSaveBot} className="mt-5 space-y-4">
              <div>
                <label className="pw-label block text-muted-foreground">Bot Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g GOLD SCALPER PRO"
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  className="pw-field mt-1"
                />
              </div>

              <div>
                <label className="pw-label block text-muted-foreground">Mentor Name</label>
                <input
                  type="text"
                  value={mentorName}
                  onChange={(e) => setMentorName(e.target.value)}
                  className="pw-field mt-1"
                />
              </div>

              <div>
                <label className="pw-label block text-muted-foreground">Description</label>
                <textarea
                  rows={3}
                  placeholder="Describe your bot logic, recommended timeframes, and pairs..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="pw-field mt-1"
                />
              </div>

              <div>
                <label className="pw-label block text-muted-foreground">Strategies</label>
                <input
                  type="text"
                  placeholder="Scalping, breakout, hedging, ICT..."
                  value={strategyInput}
                  onChange={(e) => setStrategyInput(e.target.value)}
                  className="pw-field mt-1"
                />
              </div>
                            {/* Bot Avatar with Live Thumbnail Preview */}
              <div>
                <label className="pw-label block text-muted-foreground">Bot Avatar</label>
                <div className="mt-1.5 flex items-center gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-primary/40 bg-surface flex items-center justify-center">
                    {avatarPreview && avatarPreview !== "/placeholder.svg" ? (
                      <img src={avatarPreview} alt="Avatar preview" className="h-full w-full object-cover" />
                    ) : (
                      <Bot className="h-6 w-6 text-muted-foreground/40" />
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, "avatar")}
                    className="w-full text-xs text-muted-foreground file:mr-2 file:rounded-md file:border-0 file:bg-primary/20 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary hover:file:bg-primary/30"
                  />
                </div>
              </div>

              {/* Bot Background with Live Banner Preview */}
              <div>
                <label className="pw-label block text-muted-foreground">Bot Background Banner</label>
                {bgPreview && (
                  <div className="mt-1.5 h-20 w-full overflow-hidden rounded-lg border border-border">
                    <img src={bgPreview} alt="Background preview" className="h-full w-full object-cover" />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, "bg")}
                  className="mt-1.5 w-full text-xs text-muted-foreground file:mr-2 file:rounded-md file:border-0 file:bg-primary/20 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary hover:file:bg-primary/30"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Shown as the picture on the client's bot card.{editingBot ? " Leave empty to keep the current one." : ""}
                </p>
              </div>


              <div className="pt-2">
                <button
                  type="submit" disabled={saving}
                  className="pw-btn pw-btn-solid w-full"
                >
                  {saving ? "Saving..." : editingBot ? "Save Changes" : "Save Bot"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: GENERATE LICENSE KEY */}
      {isGenerateKeyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
          <div className="pw-card relative w-full max-w-md bg-black p-6">
            <button
              onClick={() => setIsGenerateKeyModalOpen(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="pw-title text-xl">
              Generate License Key
            </h2>

            <form onSubmit={handleGenerateKey} className="mt-5 space-y-4">
              <div>
                <label className="pw-label block text-muted-foreground">Assign Bot</label>
                <select
                  value={selectedBotForNewKey || mentorBots[0]?.id || ""}
                  onChange={(e) => setSelectedBotForNewKey(e.target.value)}
                  className="pw-field mt-1"
                >
                  {mentorBots.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="pw-label block text-muted-foreground">Client Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Earl"
                  value={clientNameInput}
                  onChange={(e) => setClientNameInput(e.target.value)}
                  className="pw-field mt-1"
                />
              </div>

              <div>
                <label className="pw-label block text-muted-foreground">Client Email</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. e4rlza@gmail.com"
                  value={clientEmailInput}
                  onChange={(e) => setClientEmailInput(e.target.value)}
                  className="pw-field mt-1"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit" disabled={saving}
                  className="pw-btn pw-btn-solid w-full"
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
