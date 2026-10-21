import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useRef, useState } from "react";
import { UploadCloud, ScanLine, X, AlertTriangle, RotateCcw, Cpu } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { runScan, getScanQuota } from "@/lib/scan.functions";
import { INSTRUMENTS, TIMEFRAMES, STYLES, ALLOWED_MIME, MAX_UPLOAD_BYTES, type Instrument } from "@/lib/instruments";
import { PageHeader } from "@/components/dash";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/scanner")({ component: Scanner });

const STAGES = ["Uploading chart", "Reading market structure", "Mapping support & resistance", "Evaluating scenarios"];

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

  return (
    <>
      <PageHeader eyebrow="Free for registered users" title="AI Chart Scanner"
        sub="Upload a chart screenshot and a real AI vision model will analyse what's visible. Results are educational, probabilistic and never guaranteed."
        actions={q && <span className="rounded-md border border-border bg-card px-3 py-2 font-mono text-xs">FREE SCANS TODAY: <span className="text-primary">{remaining}/{q.limit}</span></span>} />

      {q && !q.aiConfigured && <Notice>The AI service is not configured on the server, so scans are unavailable.</Notice>}
      {q && !q.enabled && <Notice>The administrator has temporarily disabled the scanner.</Notice>}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
            className={cn("panel relative flex min-h-[320px] items-center justify-center overflow-hidden border-dashed p-4 transition-colors", drag && "border-primary bg-accent")}
          >
            {preview ? (
              <>
                <img src={preview} alt="Chart preview" className="max-h-[460px] w-full rounded object-contain" />
                {!busy && <button aria-label="Remove image" onClick={() => { setFile(null); setPreview(null); }} className="absolute right-3 top-3 rounded-md border border-border bg-background/90 p-1.5"><X className="h-4 w-4" /></button>}
                {busy && <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-primary/30 to-transparent animate-scanline" />}
              </>
            ) : (
              <button onClick={() => inputRef.current?.click()} className="flex flex-col items-center gap-3 p-8 text-center">
                <UploadCloud className="h-10 w-10 text-primary" />
                <span className="font-display text-lg font-semibold uppercase">Drop your chart here</span>
                <span className="text-sm text-muted-foreground">or tap to browse · PNG, JPG, JPEG · max 8 MB</span>
              </button>
            )}
            <input ref={inputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          </div>
        </div>

        <div className="panel space-y-5 p-5 lg:col-span-2">
          <Field label="Instrument">
            <Select value={instrument} onValueChange={(v) => setInstrument(v as Instrument)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{INSTRUMENTS.map((i) => <SelectItem key={i} value={i}>{i}{i === "GOLD" ? " (XAUUSD)" : ""}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Timeframe">
            <div className="grid grid-cols-4 gap-1.5">
              {TIMEFRAMES.map((t) => (
                <button key={t.value} onClick={() => setTimeframe(t.value)} title={t.label}
                  className={cn("rounded border px-2 py-2 font-mono text-xs", timeframe === t.value ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground")}>{t.value}</button>
              ))}
            </div>
          </Field>
          <Field label="Trading style">
            <div className="grid grid-cols-3 gap-1.5">
              {STYLES.map((s) => (
                <button key={s.value} onClick={() => setStyle(s.value)}
                  className={cn("rounded border px-2 py-2 text-xs", style === s.value ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground")}>{s.label}</button>
              ))}
            </div>
          </Field>

          <Button variant="hero" size="xl" className="w-full" disabled={!file || busy || blocked} onClick={scan}>
            {busy ? <><Cpu className="animate-pulse" />Scanning…</> : <><ScanLine />Scan Chart</>}
          </Button>

          {busy && (
            <ol className="space-y-2 font-mono text-xs">
              {STAGES.map((s, i) => (
                <li key={s} className={cn("flex items-center gap-2", i < stage ? "text-bull" : i === stage ? "text-primary" : "text-muted-foreground")}>
                  <span className={cn("h-1.5 w-1.5 rounded-full bg-current", i === stage && "animate-pulse-dot")} />{s}
                </li>
              ))}
            </ol>
          )}
          {error && (
            <div className="rounded-md border border-primary/50 bg-accent p-3 text-sm">
              <p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{error}</p>
              {file && !busy && <Button size="sm" variant="frame" className="mt-3" onClick={scan}><RotateCcw />Retry</Button>}
            </div>
          )}
          <p className="text-xs text-muted-foreground">AI analysis may be incorrect. Hypothetical setups are not financial advice.</p>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{label}</Label>{children}</div>;
}
function Notice({ children }: { children: React.ReactNode }) {
  return <div className="mb-6 flex items-center gap-3 rounded-md border border-primary/50 bg-card p-4 text-sm"><AlertTriangle className="h-4 w-4 text-primary" />{children}</div>;
}
