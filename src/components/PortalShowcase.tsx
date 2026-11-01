import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Activity, ArrowRight, Bot, GraduationCap, LayoutDashboard, ScanLine, Zap } from "lucide-react";

const PORTALS = {
  client: {
    Icon: LayoutDashboard,
    label: "Client Portal",
    to: "/dashboard",
    cta: "Open Client Portal",
    blurb: "Your private trading workspace: scan markets for signals and run your bot from one place.",
    points: [
      "AI Chart Scanner that gives BUY / SELL signals",
      "Rule-based setups, or an honest NO TRADE",
      "START / STOP for your bot through your own MT5 terminal",
      "Risk limits you set: max lot, open trades and daily loss",
    ],
  },
  mentor: {
    Icon: GraduationCap,
    label: "Mentor Portal",
    to: "/dashboard/mentor",
    cta: "Open Mentor Portal",
    blurb: "For approved mentors: follow your assigned clients and share your strategies and referral code.",
    points: [
      "Assigned clients in one overview",
      "Your personal mentor referral code",
      "Bots and strategies at a glance",
      "Access is approved by an administrator, never automatic",
    ],
  },
} as const;

type Key = keyof typeof PORTALS;

function ClientMock() {
  return (
    <div className="rounded-[1.5rem] bg-black/70 p-4">
      <div className="flex items-center justify-between">
        <p className="pw-title text-base">EA VORTEX</p>
        <span className="pw-pill" data-tone="warn">Demo mode</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {[{ t: "Scanner", I: ScanLine }, { t: "Signals", I: Activity }, { t: "Auto Trade", I: Zap }, { t: "EA Setup", I: Bot }].map(({ t, I }) => (
          <div key={t} className="pw-card-quiet flex items-center gap-2 p-3"><I className="h-4 w-4 text-primary" /><span className="pw-label">{t}</span></div>
        ))}
      </div>
      <div className="pw-card-quiet mt-3 p-3">
        <p className="pw-label text-muted-foreground">MT5 bridge</p>
        <p className="mt-1 text-sm">Pair your terminal, then press START.</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2"><span className="pw-btn pw-btn-solid">Start</span><span className="pw-btn pw-btn-danger">Stop</span></div>
    </div>
  );
}

function MentorMock() {
  return (
    <div className="rounded-[1.5rem] bg-black/70 p-4">
      <div className="flex items-center justify-between">
        <p className="pw-title text-base">Mentor</p>
        <span className="pw-pill" data-tone="ok">Approved</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {["Overview", "Clients", "Strategies", "Keys"].map((t, i) => <span key={t} className="pw-chip !min-h-8" data-active={i === 0}>{t}</span>)}
      </div>
      <div className="pw-card-quiet mt-3 p-3">
        <p className="pw-label text-muted-foreground">Referral code</p>
        <p className="mt-1 font-mono text-sm text-primary">EVX-MTR-XXXX-XXXX</p>
      </div>
      <div className="mt-3 space-y-2">
        {[0, 1, 2].map((n) => (
          <div key={n} className="pw-card-quiet flex items-center gap-3 p-3">
            <span className="h-8 w-8 rounded-full border border-primary/40" />
            <span className="h-2 w-24 rounded bg-foreground/15" />
            <span className="pw-pill ml-auto" data-tone="idle">Client</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Home-page preview of both portals. Decorative layout only: no live data is shown. */
export function PortalShowcase() {
  const [tab, setTab] = useState<Key>("client");
  const p = PORTALS[tab];
  return (
    <div>
      <div className="flex justify-center gap-2" role="group" aria-label="Choose a portal">
        {(Object.keys(PORTALS) as Key[]).map((k) => (
          <button key={k} type="button" className="pw-chip" data-active={tab === k} aria-pressed={tab === k} onClick={() => setTab(k)}>
            {PORTALS[k].label}
          </button>
        ))}
      </div>
      <div className="mt-8 grid items-center gap-8 lg:grid-cols-2">
        <div>
          <p.Icon className="h-9 w-9 text-primary" />
          <h3 className="pw-title mt-4 text-2xl sm:text-3xl">{p.label}</h3>
          <p className="mt-3 max-w-lg leading-relaxed text-muted-foreground">{p.blurb}</p>
          <ul className="mt-5 space-y-2 text-sm">
            {p.points.map((t) => <li key={t} className="flex gap-3"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />{t}</li>)}
          </ul>
          <Link to={p.to} className="pw-btn pw-btn-solid mt-7 px-7">{p.cta} <ArrowRight className="h-4 w-4" /></Link>
          <p className="mt-3 text-xs text-muted-foreground">You will be asked to sign in first.</p>
        </div>
        <div>
          <div className="pw-card mx-auto w-full max-w-sm rounded-[2rem] p-3" aria-hidden>
            {tab === "client" ? <ClientMock /> : <MentorMock />}
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">Layout preview only. No live data.</p>
        </div>
      </div>
    </div>
  );
}
