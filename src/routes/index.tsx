import { createFileRoute, Link } from "@tanstack/react-router";
import { Cpu, Bot, LayoutDashboard, ArrowRight, ScanLine, Settings2 } from "lucide-react";
import { PublicLayout } from "@/components/SiteNav";
import { TerminalVisual } from "@/components/TerminalVisual";
import { Button } from "@/components/ui/button";
import { HowItWorks, FeatureGrid, FaqList, CtaBand, SectionHead } from "@/components/Sections";
import { StatusHub, MarketOverview } from "@/components/PortalHub";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EA VORTEX — Power Your Trading" },
      { name: "description", content: "AI chart scanner, MT5 Auto Trade bridge and EA management in one forex and GOLD trading portal." },
      { property: "og:title", content: "EA VORTEX — Power Your Trading" },
      { property: "og:description", content: "AI chart scanner, MT5 Auto Trade bridge and EA management in one trading portal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const ACTIONS = [
  { to: "/dashboard", label: "Dashboard", d: "Your private portal", I: LayoutDashboard },
  { to: "/dashboard/scanner", label: "AI Scanner", d: "BUY / SELL chart analysis", I: ScanLine },
  { to: "/dashboard/auto-trade", label: "Auto Trade", d: "MT5 bot controls", I: Bot },
  { to: "/dashboard/ea", label: "EA Management", d: "Accounts & bridge", I: Settings2 },
] as const;

function Home() {
  return (
    <PublicLayout>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
          <div className="animate-fade-up">
            <p className="eyebrow flex items-center gap-2"><span className="h-px w-8 bg-primary" />Forex & GOLD trading portal</p>
            <h1 className="mt-6 text-5xl font-bold uppercase leading-[0.95] sm:text-6xl xl:text-7xl">
              Your edge.<br />Your strategy.<br />Your <span className="text-primary [text-shadow:0_0_40px_var(--primary)]">Vortex.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted-foreground">
              AI chart analysis, an MT5 Auto Trade bridge and Expert Advisor management — one connected platform.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button variant="hero" size="xl" asChild><Link to="/get-app">ACTIVATE BOT <ArrowRight /></Link></Button>
              <Button variant="frame" size="xl" asChild><Link to="/features">Explore the Platform</Link></Button>
            </div>
            <ul className="mt-10 grid gap-3 text-sm sm:grid-cols-3">
              {[
                { I: Cpu, t: "AI-Powered Chart Analysis" },
                { I: Bot, t: "MT5 Auto Trade Bridge" },
                { I: LayoutDashboard, t: "One Connected Dashboard" },
              ].map(({ I, t }) => (
                <li key={t} className="flex items-center gap-2 text-muted-foreground"><I className="h-4 w-4 shrink-0 text-primary" />{t}</li>
              ))}
            </ul>
          </div>
          <div className="animate-fade-up [animation-delay:150ms]"><TerminalVisual /></div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {ACTIONS.map(({ to, label, d, I }) => (
            <Link key={to} to={to} className="panel group flex items-center gap-3 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:red-glow-soft">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/40 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground"><I className="h-5 w-5" /></span>
              <span className="min-w-0">
                <span className="block font-display text-sm font-bold uppercase">{label}</span>
                <span className="block truncate text-xs text-muted-foreground">{d}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <SectionHead eyebrow="System status" title={<>Your <span className="text-primary">portal</span> at a glance</>}
          sub="Shows your real bridge, bot, scan and account data. Nothing here is simulated." />
        <div className="mt-10"><StatusHub /></div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <SectionHead eyebrow="Markets" title={<>GOLD & <span className="text-primary">forex</span> coverage</>} />
        <div className="mt-10"><MarketOverview /></div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <SectionHead eyebrow="The platform" title={<>Built for <span className="text-primary">serious</span> traders</>}
          sub="Every tool in EA VORTEX works from your own data — no invented results, no fake statistics." />
        <div className="mt-12"><FeatureGrid /></div>
      </section>

      <HowItWorks />

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <SectionHead eyebrow="FAQ" title="Questions, answered" />
        <div className="mt-10"><FaqList /></div>
      </section>

      <CtaBand />
    </PublicLayout>
  );
}
