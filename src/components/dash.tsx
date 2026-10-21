import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({ eyebrow, title, sub, actions }: { eyebrow?: string; title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-1 text-2xl font-bold uppercase sm:text-3xl">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon: I, title, children, action }: { icon: LucideIcon; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="panel flex flex-col items-center px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-md border border-primary/40 text-primary"><I className="h-5 w-5" /></div>
      <h3 className="mt-5 text-lg font-bold uppercase">{title}</h3>
      <div className="mt-2 max-w-md text-sm text-muted-foreground">{children}</div>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

const STATUS: Record<string, { label: string; cls: string }> = {
  connected: { label: "Connected", cls: "border-bull/40 text-bull" },
  active: { label: "Active", cls: "border-bull/40 text-bull" },
  disconnected: { label: "Disconnected", cls: "border-border text-muted-foreground" },
  inactive: { label: "Inactive", cls: "border-border text-muted-foreground" },
  error: { label: "Connection error", cls: "border-primary/50 text-primary" },
  pending_integration: { label: "Awaiting integration", cls: "border-neutral/40 text-neutral" },
  completed: { label: "Completed", cls: "border-bull/40 text-bull" },
  failed: { label: "Failed", cls: "border-primary/50 text-primary" },
  running: { label: "Running", cls: "border-bull/40 text-bull" },
  paused: { label: "Paused", cls: "border-neutral/40 text-neutral" },
  stopped: { label: "Stopped", cls: "border-border text-muted-foreground" },
  terminal_online: { label: "MT5 online", cls: "border-bull/40 text-bull" },
  terminal_offline: { label: "MT5 offline", cls: "border-primary/50 text-primary" },
  terminal_never: { label: "MT5 not linked", cls: "border-border text-muted-foreground" },
  demo: { label: "Demo account", cls: "border-neutral/40 text-neutral" },
  live: { label: "Live account", cls: "border-primary/50 text-primary" },
  sig_queued: { label: "Queued", cls: "border-neutral/40 text-neutral" },
  sig_sent: { label: "Sent", cls: "border-neutral/40 text-neutral" },
  sig_filled: { label: "Filled", cls: "border-bull/40 text-bull" },
  sig_closed: { label: "Closed", cls: "border-border text-foreground" },
  sig_rejected: { label: "Rejected", cls: "border-primary/50 text-primary" },
  sig_cancelled: { label: "Cancelled", cls: "border-border text-muted-foreground" },
};
export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, cls: "border-border text-muted-foreground" };
  return <span className={cn("inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[11px] uppercase", s.cls)}><span className="h-1.5 w-1.5 rounded-full bg-current" />{s.label}</span>;
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="panel p-5">
      <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
