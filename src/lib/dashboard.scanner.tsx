import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { UploadCloud, ScanLine, X, AlertTriangle, RotateCcw, Cpu, Globe } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { runScan, getScanQuota } from "@/lib/scan.functions";
import { INSTRUMENTS, TIMEFRAMES, STYLES, ALLOWED_MIME, MAX_UPLOAD_BYTES, type Instrument } from "@/lib/instruments";
import { formatRemaining, marketSession } from "@/lib/sessions";
import { NeonCard, PortalTitle, PwLabel } from "@/components/portal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/scanner")({ component: Scanner });

const STAGES = ["Uploading chart", "Reading market structure", "Mapping support & resistance", "Evaluating scenarios"];
// Short names for the three trading styles (values and server behaviour are unchanged).
const STYLE_TILE: Record<string, { name: string; hint: string }> = {
  scalping: { name: "Scalp", hint: "Minutes" },
  day: { name: "Day", hint: "Hours" },
  swing: { name: "Swing", hint: "Days" },
};

function Scanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const scanFn = useServerFn(runScan);
  const quotaFn = useServerFn(getScanQuota);
  const quota = useQuery({ queryKey: ["quota"], queryFn: () => quotaFn() });

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [instrument, setInstrument] = useState<Instrument>("GOLD");
  const [timeframe, setTimeframe] = useState("H1");
  const [style, setStyle] = useState("day");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = useCallback((f: File | undefined) => {
    setError(null);
    if (!f) return;
    if (!ALLOWED_MIME.includes(f.type)) return setError("Please upload a PNG, JPG or JPEG image.");
    if (f.size > MAX_UPLOAD_BYTES) return setError("Image must be 8 MB or smaller.");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }, []);

  async function scan() {
    if (!file || !user) return;
    setBusy(true); setError(null); setStage(0);
    const timer = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 4000);
    try {
      const ext = file.type === "image/png" ? "png" : "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("charts").upload(path, file, { contentType: file.type });
      if (up.error) throw new Error("Upload failed: " + up.error.message);
      setStage(1);
      const res = await scanFn({ data: { imagePath: path, mimeType: file.type as "image/png", instrument, timeframe, style } });
      qc.invalidateQueries({ queryKey: ["quota"] });
      qc.invalidateQueries({ queryKey: ["scans"] });
      if (!res.ok) { setError(res.error); return; }
      toast.success("Analysis complete");
      navigate({ to: "/dashboard/scan/$id", params: { id: res.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      clearInterval(timer);
      setBusy(false);
    }
  }

  const q = quota.data;
  const remaining = q ? Math.max(0, q.limit - q.used) : null;
  const blocked = q ? !q.enabled || !q.aiConfigured || remaining === 0 : false;
  const session = marketSession(new Date());

  return (
    <>
      <PortalTitle title="Scan market" sub="Upload a chart screenshot and an AI vision model analyses what is visible. Results are educational, probabilistic and never guaranteed." />

      {q && !q.aiConfigured && <Notice>The AI service is not configured on the server, so scans are unavailable.</Notice>}
      {q && !q.enabled && <Notice>The administrator has temporarily disabled the scanner.</Notice>}

      <div className="grid gap-5 lg:grid-cols-5">
        <NeonCard className="space-y-5 p-4 sm:p-5 lg:col-span-2 lg:self-start">
          <Field label="Trading style">
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Trading style">
              {STYLES.map((s) => (
                <button key={s.value} type="button" role="radio" aria-checked={style === s.value} onClick={() => setStyle(s.value)}
                  className={cn("flex min-h-[3.5rem] flex-col items-center justify-center rounded-xl border px-2 py-2 transition-colors",
                    style === s.value ? "border-primary bg-primary/10 text-primary shadow-[0_0_16px_-6px_var(--primary)]" : "border-border text-muted-foreground hover:text-foreground")}>
                  <span className="font-display text-xs font-bold uppercase tracking-wider">{STYLE_TILE[s.value]?.name ?? s.label}</span>
                  <span className="text-[10px] opacity-70">{STYLE_TILE[s.value]?.hint}</span>
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Symbol">
              <Select value={instrument} onValueChange={(v) => setInstrument(v as Instrument)}>
                <SelectTrigger className="pw-field h-11"><SelectValue /></SelectTrigger>
                <SelectContent>{INSTRUMENTS.map((i) => <SelectItem key={i} value={i}>{i}{i === "GOLD" ? " (XAUUSD)" : ""}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Timeframe">
              <Select value={timeframe} onValueChange={setTimeframe}>
                <SelectTrigger className="pw-field h-11"><SelectValue /></SelectTrigger>
                <SelectContent>{TIMEFRAMES.map((t) => <SelectItem key={t.value} value={t.value}>{t.value} · {t.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>

          <div className="pw-card-quiet flex items-start gap-2.5 p-3 text-xs text-muted-foreground">
            <Globe className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            {session.state === "open"
              ? <span>{session.name} session · {formatRemaining(session.remainingMs)} remaining{session.alsoOpen.length ? ` · overlaps ${session.alsoOpen.join(", ")}` : ""}</span>
              : <span>Market closed · reopens in {formatRemaining(session.opensInMs)}. You can still scan a saved chart.</span>}
          </div>

          <div className="flex items-center justify-between">
            <PwLabel className="text-muted-foreground">Free scans today</PwLabel>
            <span className="font-display text-lg font-bold text-primary">{q ? `${remaining}/${q.limit}` : "—"}</span>
          </div>

          <div>
            <button type="button" className="pw-btn pw-btn-solid w-full" disabled={!file || busy || blocked} onClick={scan}>
              {busy ? <><Cpu className="h-4 w-4 animate-pulse" />Scanning…</> : <><ScanLine className="h-4 w-4" />Scan chart</>}
            </button>
            {!file && !busy && <p className="mt-2 text-center text-xs text-muted-foreground">Add a chart image below to start.</p>}
          </div>

          {busy && (
            <ol className="space-y-2 font-mono text-xs" aria-live="polite">
              {STAGES.map((s, i) => (
                <li key={s} className={cn("flex items-center gap-2", i < stage ? "text-bull" : i === stage ? "text-primary" : "text-muted-foreground")}>
                  <span className={cn("h-1.5 w-1.5 rounded-full bg-current", i === stage && "animate-pulse-dot")} />{s}
                </li>
              ))}
            </ol>
          )}
          {error && (
            <div role="alert" className="rounded-xl border border-primary/50 bg-accent p-3 text-sm">
              <p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{error}</p>
              {file && !busy && <button type="button" className="pw-btn mt-3 min-h-10 px-3" onClick={scan}><RotateCcw className="h-4 w-4" />Retry</button>}
            </div>
          )}
          <p className="text-xs text-muted-foreground">AI analysis may be incorrect. Hypothetical setups are not financial advice.</p>
        </NeonCard>

        <div className="lg:col-span-3">
          <PwLabel className="mb-3">Upload chart</PwLabel>
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
            className={cn("pw-card relative flex min-h-[260px] items-center justify-center overflow-hidden border-dashed p-3 transition-colors lg:min-h-[420px]", drag && "bg-primary/10")}
          >
            {preview ? (
              <>
                <img src={preview} alt="Chart preview" className="max-h-[460px] w-full rounded-lg object-contain" />
                {!busy && <button type="button" aria-label="Remove image" onClick={() => { setFile(null); setPreview(null); }} className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-lg border border-primary/40 bg-black/90"><X className="h-4 w-4" /></button>}
                {busy && <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-primary/30 to-transparent animate-scanline" />}
              </>
            ) : (
              <button type="button" onClick={() => inputRef.current?.click()} className="flex w-full flex-col items-center gap-3 p-8 text-center">
                <UploadCloud className="h-10 w-10 text-primary" />
                <span className="font-display text-base font-bold uppercase tracking-wider">Upload chart image</span>
                <span className="text-sm text-muted-foreground">Tap to choose a file, or drop it here<br />PNG, JPG or JPEG · max 8 MB</span>
                <span className="pw-btn mt-1 px-5">Choose file</span>
              </button>
            )}
            <input ref={inputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><PwLabel className="text-muted-foreground">{label}</PwLabel>{children}</div>;
}
function Notice({ children }: { children: React.ReactNode }) {
  return <div className="pw-card mb-5 flex items-center gap-3 p-4 text-sm"><AlertTriangle className="h-4 w-4 shrink-0 text-primary" />{children}</div>;
}
