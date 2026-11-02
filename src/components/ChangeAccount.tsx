import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeAccount } from "@/lib/account.functions";
import { ChangeAccountFields, identityChanged } from "@/lib/accountChange";

const lbl = "pw-label text-[0.62rem] text-muted-foreground";

/** Switch the MT5 account a bot uses. Same flow for the cloud and the PC Bridge connection. */
export function ChangeAccount({ botId, login, server, label, isCloud }: {
  botId: string; login: string; server: string; label: string | null; isCloud: boolean;
}) {
  const uid = useId();
  const qc = useQueryClient();
  const changeFn = useServerFn(changeAccount);
  const [open, setOpen] = useState(false);
  const [newLogin, setNewLogin] = useState(login);
  const [newServer, setNewServer] = useState(server);
  const [newLabel, setNewLabel] = useState(label ?? "");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);

  const parsed = ChangeAccountFields.safeParse({ login: newLogin, server: newServer, label: newLabel });
  const switched = parsed.success && identityChanged({ login, server }, parsed.data);
  const labelOnly = parsed.success && !switched && (parsed.data.label ?? "") !== (label ?? "");
  const canSave = parsed.success && !busy && ((switched && ack) || labelOnly);
  const problem = !parsed.success && (newLogin !== login || newServer !== server) ? parsed.error.issues[0]?.message : null;

  function openPanel() {
    setNewLogin(login); setNewServer(server); setNewLabel(label ?? ""); setAck(false); setOpen(true);
  }

  async function save() {
    if (!parsed.success) return;
    setBusy(true);
    try {
      const r = await changeFn({ data: { botId, login: newLogin, server: newServer, label: newLabel } });
      toast.success(!r.switched ? "Label saved" : r.wasCloud
        ? "Account changed. Enter the new account's password under “Trade without a PC” to reconnect."
        : "Account changed. Attach the Bridge to the new account (see Connect MT5).");
      setOpen(false);
      for (const key of ["auto-trade", "trading-accounts", "portal-bot"]) qc.invalidateQueries({ queryKey: [key] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not change the account");
    } finally { setBusy(false); }
  }

  if (!open) {
    return (
      <button type="button" className="pw-btn mt-4 w-full sm:w-auto" onClick={openPanel}>
        <ArrowLeftRight className="h-4 w-4" />Change MT5 account
      </button>
    );
  }

  return (
    <form className="pw-card-quiet mt-4 space-y-3 p-4" autoComplete="off" onSubmit={(e) => { e.preventDefault(); if (canSave) void save(); }}>
      <p className="font-display text-sm font-bold uppercase tracking-wider">Change MT5 account</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label htmlFor={`${uid}-login`} className={lbl}>MT5 login</Label>
          <Input id={`${uid}-login`} className="pw-field" inputMode="numeric" value={newLogin} onChange={(e) => setNewLogin(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor={`${uid}-label`} className={lbl}>Label (optional)</Label>
          <Input id={`${uid}-label`} className="pw-field" value={newLabel} maxLength={60} onChange={(e) => setNewLabel(e.target.value)} /></div>
        <div className="col-span-2 space-y-1"><Label htmlFor={`${uid}-server`} className={lbl}>Broker server (exact name)</Label>
          <Input id={`${uid}-server`} className="pw-field" value={newServer} onChange={(e) => setNewServer(e.target.value)} placeholder="e.g. Exness-MT5Real" /></div>
      </div>
      {problem && <p role="alert" className="text-xs text-primary">{problem}</p>}
      {switched && (
        <div className="space-y-2 rounded-xl border border-primary/40 p-3 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">Switching accounts will:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>stop the bot and cancel orders that have not been sent yet</li>
            <li>go back to <span className="text-foreground">Demo mode</span>, so live trading must be confirmed again</li>
            {isCloud
              ? <li>remove the cloud connection. You then enter the new account's password under “Trade without a PC” to reconnect</li>
              : <li>hold all orders until the Bridge is attached to the new account, with ExpectedLogin and ExpectedServer updated to match</li>}
          </ul>
          <p><span className="font-semibold text-foreground">Open positions on the old account are not closed.</span> Close them in MT5 first if you do not want them left open.</p>
          <label className="flex items-start gap-2 pt-1 text-foreground">
            <input type="checkbox" className="mt-0.5" checked={ack} onChange={(e) => setAck(e.target.checked)} />
            <span>I understand and want to switch to this account.</span>
          </label>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="pw-btn pw-btn-solid" disabled={!canSave}>
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : switched ? "Switch account" : "Save label"}
        </button>
        <button type="button" className="pw-btn" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}
