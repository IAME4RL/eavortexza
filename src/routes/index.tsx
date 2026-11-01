import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Bot, BrainCircuit, Check, ChevronRight, Download, GraduationCap, Layers, Menu, ScanLine, ShieldCheck, Smartphone, UserRound, X, Activity, ChartNoAxesCombined } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteNav";
import { FaqList } from "@/components/Sections";
import circuitImage from "@/assets/home-circuit.jpg";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "EA VORTEX — AI Trading Intelligence | Power Your Trading" },
    { name: "description", content: "Explore EA VORTEX chart analysis, market signals and the MT5 execution bridge. Access your client dashboard, mentor portal or mobile app." },
    { property: "og:title", content: "EA VORTEX — AI Trading Intelligence" },
    { property: "og:description", content: "Chart analysis, market signals and connected MT5 trading. Power Your Trading with EA VORTEX." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Home,
});

const tools = [
  { icon: ScanLine, title: "AI Chart Scanner", label: "CHART ANALYSIS", text: "Upload a chart screenshot and review technical structure, entry zones, stop-loss and take-profit scenarios.", to: "/scanner" },
  { icon: ChartNoAxesCombined, title: "Market Signals", label: "STRATEGY ENGINE", text: "Explore rule-based BUY, SELL or NO TRADE setups using available market candles and supported strategies.", to: "/dashboard/signals" },
  { icon: Bot, title: "MT5 Auto Trade", label: "BRIDGE REQUIRED", text: "Start and stop your execution bot with your connected MT5 terminal. Demo trading and explicitly authorized live mode.", to: "/dashboard/auto-trade" },
  { icon: Activity, title: "Trading Monitor", label: "CONNECTED ACCOUNTS", text: "Review account balance, equity and trading activity reported by your MT5 connection.", to: "/dashboard/analytics" },
  { icon: Layers, title: "Strategy Engine", label: "TECHNICAL STRATEGIES", text: "Inspect supported strategies, setup reasoning and backtests. No qualifying setup means no trade.", to: "/dashboard/signals" },
  { icon: ShieldCheck, title: "EA Management & Bridge", label: "MT5 MANAGEMENT", text: "Manage trading accounts, bridge connections and execution risk limits from your private dashboard.", to: "/dashboard/ea" },
] as const;

function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [journey, setJourney] = useState<"client" | "mentor">("client");
  const steps = journey === "client" ? [
    { title: "Create your EA VORTEX account", text: "Register for free and open your private trading dashboard." },
    { title: "Analyze your first chart", text: "Choose an instrument and timeframe, upload your chart and review the analysis." },
    { title: "Connect MT5 for Auto Trade", text: "Install the EA VORTEX Bridge on your terminal, link your account and review risk settings before starting." },
  ] : [
    { title: "Request mentor access", text: "Create a free account and select the mentor access request during registration." },
    { title: "Wait for administrator approval", text: "Mentor access is granted by an administrator, not automatically on signup." },
    { title: "Open your Mentor Portal", text: "Once approved, view your assigned clients and the activity available to your mentor account." },
  ];
  return (
    <div className="vortex-home min-h-screen">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground lg:flex" aria-label="Main navigation">
            <Link to="/scanner" className="hover:text-primary">AI Chart Scanner</Link>
            <a href="#platform" className="hover:text-primary">Platform</a>
            <a href="#getting-started" className="hover:text-primary">How It Works</a>
            <Link to="/auth" className="hover:text-primary">Client Login</Link>
          </nav>
          <div className="flex items-center gap-1 sm:gap-3">
            <Button asChild className="home-primary h-10 px-3 text-xs font-bold sm:px-5 sm:text-sm"><Link to="/dashboard/mentor"><GraduationCap className="hidden sm:block" />Mentor Portal</Link></Button>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</Button>
          </div>
        </div>
        {menuOpen && <nav className="grid gap-1 border-t border-border px-4 py-3 lg:hidden" aria-label="Mobile navigation">
          <Link to="/scanner" onClick={() => setMenuOpen(false)} className="p-3">AI Chart Scanner</Link>
          <a href="#platform" onClick={() => setMenuOpen(false)} className="p-3">Platform</a>
          <a href="#getting-started" onClick={() => setMenuOpen(false)} className="p-3">How It Works</a>
          <Link to="/auth" onClick={() => setMenuOpen(false)} className="p-3">Client Login</Link>
          <Link to="/features" onClick={() => setMenuOpen(false)} className="p-3">Explore the Platform</Link>
        </nav>}
      </header>

      <main>
        <section className="relative isolate overflow-hidden border-b border-border">
          <img src={circuitImage} alt="" width={1920} height={1024} fetchPriority="high" className="home-hero-image absolute inset-0 -z-20 h-full w-full object-cover" />
          <div className="home-hero-shade absolute inset-0 -z-10" />
          <div className="mx-auto max-w-5xl px-5 pb-12 pt-12 text-center sm:px-8 sm:pb-16 sm:pt-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-background/60 px-4 py-2 font-mono text-[10px] font-semibold text-primary sm:text-xs"><BrainCircuit className="h-4 w-4" />AI CHART ANALYSIS · MT5 EXECUTION</div>
            <h1 className="mt-7 text-[48px] font-extrabold leading-[1.08] sm:text-7xl lg:text-8xl">EA <span className="text-primary">VORTEX</span></h1>
            <p className="home-gradient-text mt-3 text-[38px] font-extrabold leading-[1.15] sm:text-6xl lg:text-7xl">Power Your Trading.</p>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-xl">Read the chart. Find the setup. Take control.<br className="hidden sm:block" /> AI-powered analysis and strategy-based trading, connected to your MetaTrader 5 terminal.</p>
            <div className="mx-auto mt-8 flex max-w-xl flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="xl" className="home-primary h-14 font-bold"><a href="/downloads/EA-VORTEX.apk" download><Download />Download Android APK</a></Button>
              <Button asChild variant="outline" size="xl" className="h-14 bg-background/50 font-bold"><Link to="/get-app"><Smartphone />iOS Web Version</Link></Button>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm">
              <Link to="/scanner" className="inline-flex items-center gap-2 text-primary hover:underline">Open AI Chart Scanner <ArrowRight className="h-4 w-4" /></Link>
              <Link to="/features" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">Explore the Platform <ChevronRight className="h-4 w-4" /></Link>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">Trading involves risk. Analysis is not a guarantee of future results.</p>
          </div>
        </section>

        <section className="home-core px-5 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-6xl">
            <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.3fr]">
              <div><p className="font-mono text-xs text-primary">THE VORTEX CORE</p><h2 className="mt-4 text-3xl font-bold sm:text-4xl">From chart to<br /><span className="home-gradient-text">informed action.</span></h2><p className="mt-4 max-w-lg leading-relaxed text-muted-foreground">Your analysis, market signals and execution controls stay connected — with clear boundaries between a setup and a real trade.</p></div>
              <div className="grid grid-cols-2 gap-3">
                {[{ I: ScanLine, t: "Chart Analysis", d: "Your screenshot" }, { I: BrainCircuit, t: "Market Signals", d: "Available OHLC data" }, { I: ShieldCheck, t: "Risk Controls", d: "Your execution limits" }, { I: Bot, t: "MT5 Bridge", d: "Your connected terminal" }].map(({ I, t, d }) => <div key={t} className="home-tool p-4 sm:p-6"><I className="h-6 w-6 text-primary" /><h3 className="mt-4 text-sm font-bold sm:text-base">{t}</h3><p className="mt-1 text-xs text-muted-foreground">{d}</p></div>)}
              </div>
            </div>
          </div>
        </section>

        <section id="platform" className="home-grid scroll-mt-24 px-5 py-14 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center"><p className="font-mono text-xs font-semibold text-primary">THE PLATFORM</p><h2 className="mt-4 text-3xl font-extrabold sm:text-5xl">Trading intelligence.<br /><span className="home-gradient-text">One connected platform.</span></h2><p className="mt-5 leading-relaxed text-muted-foreground">Explore the tools behind your EA VORTEX trading workspace.</p></div>
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tools.map(({ icon: Icon, title, label, text, to }) => <Link key={title} to={to} className="home-tool group flex flex-col p-6 transition-all duration-300 hover:-translate-y-1 sm:p-7"><div className="flex items-center justify-between gap-3"><span className="home-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"><Icon className="h-6 w-6" /></span><span className="text-right font-mono text-[9px] text-primary">{label}</span></div><h3 className="mt-6 text-xl font-bold">{title}</h3><p className="mb-6 mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{text}</p><span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">Open tool <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span></Link>)}
            </div>
          </div>
        </section>

        <section className="home-core border-y border-border px-5 py-14 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-4xl text-center"><Smartphone className="mx-auto h-9 w-9 text-primary" /><p className="mt-5 font-mono text-xs text-primary">MOBILE COMMAND CENTER</p><h2 className="mt-4 text-4xl font-extrabold sm:text-5xl">One platform.<br />Your trading. Your control.</h2><p className="mx-auto mt-5 max-w-xl leading-relaxed text-muted-foreground">Access your charts, market signals and account dashboard on Android, iOS or desktop. MT5 execution requires your connected terminal to stay online.</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Button asChild size="xl" className="home-primary font-bold"><Link to="/get-app">ACTIVATE BOT <ArrowRight /></Link></Button><Button asChild variant="outline" size="xl"><Link to="/dashboard">Open Client Portal</Link></Button></div></div>
        </section>

        <section id="getting-started" className="scroll-mt-24 px-5 py-14 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-4xl"><div className="text-center"><p className="font-mono text-xs text-primary">GETTING STARTED</p><h2 className="mt-4 text-3xl font-extrabold sm:text-5xl">How it works, step by step</h2><p className="mt-5 text-muted-foreground">Choose your path into EA VORTEX.</p></div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2" role="group" aria-label="Choose your account type">{([{ id: "mentor", title: "I want to become a Mentor", Icon: GraduationCap }, { id: "client", title: "I am a Client", Icon: UserRound }] as const).map(({ id, title, Icon }) => <Button key={id} variant="outline" onClick={() => setJourney(id)} aria-pressed={journey === id} className={`h-auto min-h-20 justify-start whitespace-normal px-5 py-5 text-left font-bold ${journey === id ? "border-primary bg-primary/10 text-primary" : "bg-card"}`}><Icon className="mr-2" />{title}{journey === id && <Check className="ml-auto" />}</Button>)}</div>
            <div className="mt-6 grid gap-3">{steps.map((step, i) => <div key={step.title} className="home-tool flex items-start gap-4 p-5 sm:p-6"><span className="home-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold">{i + 1}</span><div><h3 className="font-bold sm:text-lg">{step.title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p></div></div>)}</div>
            <div className="mt-7 text-center"><Button asChild className="home-primary" size="xl"><Link to="/auth" search={{ mode: "signup" }}>Create a Free Account <ArrowRight /></Link></Button></div>
          </div>
        </section>
        <section className="border-t border-border px-5 py-14 sm:px-6"><h2 className="mb-8 text-center text-3xl font-bold">Questions, answered</h2><FaqList /></section>
      </main>
      <SiteFooter />
    </div>
  );
}
