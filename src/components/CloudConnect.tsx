import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Cloud, ExternalLink, Loader2, Lock, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { connectCloudAccount, disconnectCloudAccount, getCloudKeyStatus, refreshCloudStatus, removeCloudKey, saveCloudKey } from "@/lib/cloud.functions";
import { FEED_INSTRUMENTS, FEED_TIMEFRAMES } from "@/lib/marketdata";
import { cloudConfigOf } from "@/lib/cloudTrade";

/** Where a client creates and pays for their own API2Trade account. Price and billing are API2Trade's, not ours. */
const API2TRADE_SIGNUP_URL = "https://app.api2trade.com/sign-up";

const lbl = "pw-label text-[0.62rem] text-muted-foreground";
const field = "pw-field";

/** Connect an MT5 account through API2Trade so the bot can trade from the cloud — no PC needed. */
export function CloudConnect({ botId, accountLogin, accountServer, terminalInfo }: { botId: string; accountLogin: string; accountServer: string; terminalInfo: unknown }) {
  const qc = useQueryClient();
  const connectFn = useServerFn(connectCloudAccount);
  const refreshFn = useServerFn(refreshCloudStatus);
  const disconnectFn = useServerFn(disconnectCloudAccount);
  const keyStatusFn = useServerFn(getCloudKeyStatus);
  const saveKeyFn = useServerFn(saveCloudKey);
  const removeKeyFn = useServerFn(removeCloudKey);
  const keyQ = useQuery({ queryKey: ["cloud-key"], queryFn: () => keyStatusFn() });
  const [apiKey, setApiKey] = useState("");
  const cfg = cloudConfigOf(terminalInfo);
  const info = terminalInfo as { balance?: number; currency?: string } | null;

  const [login, setLogin] = useState(accountLogin);
  const [password, setPassword] = useState("");
  const [server, setServer] = useState(accountServer);
  const [accountType, setAccountType] = useState<"demo" | "live">("demo");
  const [instrument, setInstrument] = useState("XAUUSD");
  const [brokerSymbol, setBrokerSymbol] = useState("XAUUSD");
  const [timeframe, setTimeframe] = useState("H1");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState<"connect" | "refresh" | "disconnect" | "key" | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["auto-trade"] }); qc.invalidateQueries({ queryKey: ["cloud-key"] }); };

  async function run(kind: "connect" | "refresh" | "disconnect" | "key", fn: () => Promise<string>) {
    setBusy(kind);
    try { toast.success(await fn()); refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Action failed"); }
    finally { setBusy(null); }
  }

  if (cfg) {
    return (
      <div className="space-y-3 text-sm">
        <p className="flex items-center gap-2 font-semibold text-bull"><Cloud className="h-4 w-4" />Connected in the cloud — no PC needed</p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <dt>Account</dt><dd className="text-foreground">{cfg.accountType === "live" ? "LIVE" : "Demo"}</dd>
          <dt>Market</dt><dd className="text-foreground">{cfg.instrument} · {cfg.timeframe}</dd>
          <dt>Broker symbol</dt><dd className="text-foreground">{cfg.brokerSymbol}</dd>
          {info?.balance != null && (<><dt>Balance</dt><dd className="text-foreground">{info.balance.toFixed(2)} {info.currency ?? ""}</dd></>)}
        </dl>
        <p className="text-xs text-muted-foreground">
          The server checks the market about once a minute while the bot is running, so your phone and PC can be off. Pick a strategy and limits under Risk settings, then press Start.
          Stop never closes open positions.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="pw-btn" disabled={busy !== null}
            onClick={() => run("refresh", async () => { const r = await refreshFn({ data: { botId } }); if (!r.connected) throw new Error("Not connected — try reconnecting."); return "Connection is healthy"; })}>
            {busy === "refresh" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Check connection
          </button>
          <button type="button" className="pw-btn" disabled={busy !== null}
            onClick={() => run("disconnect", async () => { await disconnectFn({ data: { botId } }); return "Disconnected. Open positions were not closed."; })}>
            {busy === "disconnect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}Disconnect
          </button>
        </div>
      </div>
    );
  }

  // Locked until the client has paid API2Trade themselves and pasted their own key.
  if (keyQ.isLoading) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading…</p>;
  if (!keyQ.data?.hasKey) {
    return (
      <div className="space-y-3 text-sm">
        <p className="flex items-center gap-2 font-semibold"><Lock className="h-4 w-4" />Cloud trading is locked</p>
        <p className="text-muted-foreground">
          No Windows PC? The bot can trade from the cloud for you. The connection is provided by API2Trade, and you pay API2Trade directly for your own account
          (currently about €12 a month for one account, no setup fee, cancel anytime). That payment goes to API2Trade, not to EA VORTEX.
        </p>
        <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
          <li>Tap the button below, create your API2Trade account and subscribe for 1 account.</li>
          <li>In API2Trade, open "Your API key" and copy the key.</li>
          <li>Paste it here and tap Save key. This section then unlocks.</li>
        </ol>
        <a href={API2TRADE_SIGNUP_URL} target="_blank" rel="noopener noreferrer" className="pw-btn pw-btn-solid flex w-full items-center justify-center gap-2">
          <ExternalLink className="h-4 w-4" />Get API2Trade (about €12/month)
        </a>
        <form className="space-y-2" autoComplete="off" onSubmit={(e) => {
          e.preventDefault();
          void run("key", async () => {
            const k = apiKey;
            await saveKeyFn({ data: { apiKey: k } });
            setApiKey("");
            return "API key saved. Cloud trading is unlocked.";
          });
        }}>
          <Label className={lbl}>Your API2Trade key</Label>
          <Input className={field} type="password" autoComplete="new-password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Paste your API key" />
          <button type="submit" className="pw-btn w-full" disabled={busy !== null || apiKey.trim().length < 16}>
            {busy === "key" ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : "Save key"}
          </button>
        </form>
        <p className="text-xs text-muted-foreground">Treat your key like a password. It is stored on the server only and is never shown again. No PC? Skip this and use the PC bridge instead, which is free.</p>
      </div>
    );
  }

  return (
    <form className="space-y-3" autoComplete="off" onSubmit={(e) => {
      e.preventDefault();
      void run("connect", async () => {
        const pw = password;
        setPassword(""); // never keep the password in the page longer than the request
        const r = await connectFn({ data: { botId, login, password: pw, server, accountType, instrument, brokerSymbol, timeframe, acknowledged: true } });
        return `Connected${r.balance != null ? ` · balance ${r.balance.toFixed(2)} ${r.currency}` : ""}`;
      });
    }}>
      <p className="text-sm text-muted-foreground">
        No Windows PC? Connect your MT5 account here and the bot trades from the cloud, about once a minute, even when your phone is off.
      </p>
      <p className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>API2Trade key saved (…{keyQ.data?.last4 ?? ""})</span>
        <button type="button" className="underline" disabled={busy !== null}
          onClick={() => run("key", async () => { await removeKeyFn(); return "API key removed."; })}>Replace key</button>
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label className={lbl}>MT5 login</Label><Input className={field} inputMode="numeric" value={login} onChange={(e) => setLogin(e.target.value)} /></div>
        <div className="space-y-1"><Label className={lbl}>MT5 password</Label><Input className={field} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Main trading password" /></div>
        <div className="col-span-2 space-y-1"><Label className={lbl}>Broker server (exact name)</Label><Input className={field} value={server} onChange={(e) => setServer(e.target.value)} placeholder="e.g. ICMarkets-Demo" /></div>
        <div className="space-y-1"><Label className={lbl}>Account type</Label>
          <Select value={accountType} onValueChange={(v) => setAccountType(v as "demo" | "live")}><SelectTrigger className={field}><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="demo">Demo (practice money)</SelectItem><SelectItem value="live">Live (real money)</SelectItem></SelectContent></Select></div>
        <div className="space-y-1"><Label className={lbl}>Timeframe</Label>
          <Select value={timeframe} onValueChange={setTimeframe}><SelectTrigger className={field}><SelectValue /></SelectTrigger>
            <SelectContent>{FEED_TIMEFRAMES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label className={lbl}>Market to trade</Label>
          <Select value={instrument} onValueChange={(v) => { setInstrument(v); setBrokerSymbol(v); }}><SelectTrigger className={field}><SelectValue /></SelectTrigger>
            <SelectContent>{FEED_INSTRUMENTS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label className={lbl}>Your broker's symbol</Label><Input className={field} value={brokerSymbol} onChange={(e) => setBrokerSymbol(e.target.value)} placeholder="e.g. XAUUSDm" maxLength={20} /></div>
      </div>
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input type="checkbox" className="mt-0.5" checked={ack} onChange={(e) => setAck(e.target.checked)} />
        <span>I understand my MT5 login and password are sent securely to API2Trade, our trading-connection provider, so it can place trades for me. EA VORTEX does not store the password. I can disconnect at any time. Trading carries risk of loss; start on a demo account.</span>
      </label>
      <button type="submit" className="pw-btn pw-btn-solid w-full" disabled={busy !== null || !ack || !login || !password || !server}>
        {busy === "connect" ? <><Loader2 className="h-4 w-4 animate-spin" />Connecting…</> : <><Cloud className="h-4 w-4" />Connect without a PC</>}
      </button>
    </form>
  );
}
