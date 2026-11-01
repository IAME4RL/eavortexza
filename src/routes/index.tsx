import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Activity, ArrowRight, Bot, Download, GraduationCap, Menu, ScanLine, ShieldCheck, Smartphone, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { VortexBackground } from "@/components/VortexBackground";
import { SiteFooter } from "@/components/SiteNav";
import { PortalShowcase } from "@/components/PortalShowcase";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "EA VORTEX — AI Trading Intelligence | Power Your Trading" },
    { name: "description", content: "Explore EA VORTEX chart analysis, market signals and the MT5 execution bridge. Access your client portal, mentor portal or mobile app." },
    { property: "og:title", content: "EA VORTEX — AI Trading Intelligence" },
    { property: "og:description", content: "Chart analysis, market signals and connected MT5 trading. Power Your Trading with EA VORTEX." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Home,
});

const FLOW = [
  { I: ScanLine, t: "Read the chart", d: "Upload a screenshot, or use real market bars." },
  { I: Activity, t: "Find the setup", d: "A rule-based engine answers BUY, SELL or NO TRADE." },
  { I: ShieldCheck, t: "Pass the risk gate", d: "Account, mode, lot size and loss limits are checked." },
  { I: Bot, t: "Execute on MT5", d: "Your own terminal places the order and reports back." },
] as const;

const SAFEGUARDS = [
  { t: "Account match", d: "The MT5 terminal must be logged into the account you registered, on the same broker server." },
  { t: "Demo and live kept apart", d: "A demo account never trades in live mode, and a live account never trades in demo mode." },
  { t: "Typed live confirmation", d: "Live trading stays off until you type a confirmation phrase yourself." },
  { t: "Daily loss limit", d: "Once your limit is reached, no new orders are sent for the day." },
  { t: "Stop loss required", d: "Signals without a stop loss are rejected before they reach your terminal." },
  { t: "Emergency close", d: "A separately confirmed command stops the bot and asks MT5 to close open positions." },
] as const;

const NAV = [
  { href: "#portals", label: "Portals" },
  { href: "#safeguards", label: "Safeguards" },
  { href: "#get-app", label: "Get the app" },
] as const;

function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="relative min-h-dvh">
      <VortexBackground />
      <div className="pw-vignette" aria-hidden />
      <header className="sticky top-0 z-50 border-b border-primary/20 bg-black/85 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-6 lg:flex" aria-label="Main navigation">
            <Link to="/scanner" className="pw-label text-muted-foreground hover:text-primary">AI Chart Scanner</Link>
            {NAV.map((n) => <a key={n.href} href={n.href} className="pw-label text-muted-foreground hover:text-primary">{n.label}</a>)}
            <Link to="/auth" className="pw-label text-muted-foreground hover:text-primary">Client Login</Link>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/dashboard/mentor" className="pw-btn pw-btn-solid !min-h-10 !px-3 sm:!px-5"><GraduationCap className="hidden h-4 w-4 sm:block" />Mentor Portal</Link>
            <button type="button" className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/30 text-primary lg:hidden" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
          </div>
        </div>
        {menuOpen && (
          <nav className="grid gap-1 border-t border-primary/20 bg-sidebar px-4 py-3 lg:hidden" aria-label="Mobile navigation">
            <Link to="/scanner" onClick={() => setMenuOpen(false)} className="pw-label p-3 text-muted-foreground">AI Chart Scanner</Link>
            {NAV.map((n) => <a key={n.href} href={n.href} onClick={() => setMenuOpen(false)} className="pw-label p-3 text-muted-foreground">{n.label}</a>)}
            <Link to="/auth" onClick={() => setMenuOpen(false)} className="pw-label p-3 text-muted-foreground">Client Login</Link>
            <Link to="/features" onClick={() => setMenuOpen(false)} className="pw-label p-3 text-muted-foreground">Explore the Platform</Link>
          </nav>
        )}
      </header>

      <main className="relative z-10">
        <section className="px-5 pb-14 pt-12 sm:px-6 sm:pb-20 sm:pt-16">
          <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="pw-pill text-primary" data-tone="live">AI chart analysis · MT5 execution</p>
              <h1 className="pw-title mt-6 text-5xl leading-[1.05] sm:text-7xl">EA VORTEX</h1>
              <p className="mt-3 font-display text-3xl font-bold uppercase tracking-wide sm:text-5xl">Power Your Trading.</p>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">Read the chart. Find the setup. Take control. Two portals, one platform: a client workspace for trading and a mentor portal for guiding clients, connected to your MetaTrader 5 terminal.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/dashboard" className="pw-btn pw-btn-solid !min-h-12 px-7">Open Client Portal <ArrowRight className="h-4 w-4" /></Link>
                <Link to="/dashboard/mentor" className="pw-btn !min-h-12 px-7"><GraduationCap className="h-4 w-4" />Mentor Portal</Link>
              </div>
              <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
                <Link to="/scanner" className="pw-label inline-flex items-center gap-2 text-primary hover:underline">Try the AI Chart Scanner <ArrowRight className="h-4 w-4" /></Link>
                <a href="/downloads/EA-VORTEX.apk" download className="pw-label inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"><Download className="h-4 w-4" />Android APK</a>
              </div>
              <p className="mt-6 text-xs text-muted-foreground">Trading involves risk. Analysis is not a guarantee of future results.</p>
            </div>
            <div className="pw-card p-5 sm:p-6">
              <p className="pw-label text-primary">The Vortex path</p>
              <ol className="relative mt-5 space-y-3">
                <span className="absolute bottom-6 left-[1.35rem] top-6 w-px bg-primary/30" aria-hidden />
                {FLOW.map(({ I, t, d }, i) => (
                  <li key={t} className="pw-card-quiet relative flex items-start gap-4 p-4">
                    <span className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-primary/60 bg-black text-primary shadow-[0_0_14px_-4px_var(--primary)]"><I className="h-5 w-5" /></span>
                    <div><p className="pw-label text-muted-foreground">Step {i + 1}</p><h3 className="font-bold uppercase">{t}</h3><p className="mt-1 text-sm text-muted-foreground">{d}</p></div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section id="portals" className="scroll-mt-24 border-y border-primary/20 bg-black/40 px-5 py-14 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <p className="pw-label text-primary">Two portals</p>
              <h2 className="pw-title mt-4 text-3xl sm:text-5xl">One platform. Your role.</h2>
            </div>
            <PortalShowcase />
          </div>
        </section>

        <section id="safeguards" className="scroll-mt-24 px-5 py-14 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="pw-label text-primary">Built-in safeguards</p>
              <h2 className="pw-title mt-4 text-3xl sm:text-5xl">A setup is not a trade.</h2>
              <p className="mt-5 leading-relaxed text-muted-foreground">Every order has to clear these checks before your terminal sees it.</p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {SAFEGUARDS.map(({ t, d }) => <div key={t} className="pw-card p-6"><ShieldCheck className="h-6 w-6 text-primary" /><h3 className="mt-4 text-lg font-bold uppercase">{t}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{d}</p></div>)}
            </div>
          </div>
        </section>

        <section id="get-app" className="scroll-mt-24 border-t border-primary/20 px-5 py-14 sm:px-6 sm:py-20">
          <div className="pw-card mx-auto max-w-4xl p-8 text-center sm:p-12">
            <Smartphone className="mx-auto h-9 w-9 text-primary" />
            <h2 className="pw-title mt-4 text-3xl sm:text-4xl">Take it with you</h2>
            <p className="mx-auto mt-4 max-w-xl leading-relaxed text-muted-foreground">Use both portals on Android, iOS or desktop. MT5 execution needs your connected terminal to stay online.</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <a href="/downloads/EA-VORTEX.apk" download className="pw-btn pw-btn-solid !min-h-12 px-7"><Download className="h-4 w-4" />Download Android APK</a>
              <Link to="/get-app" className="pw-btn !min-h-12 px-7"><Smartphone className="h-4 w-4" />iOS Web Version</Link>
            </div>
            <p className="mt-6 text-sm text-muted-foreground"><Link to="/how-it-works" className="hover:text-primary">How it works</Link> · <Link to="/faq" className="hover:text-primary">FAQ</Link> · <Link to="/auth" search={{ mode: "signup" }} className="hover:text-primary">Create a free account</Link></p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
