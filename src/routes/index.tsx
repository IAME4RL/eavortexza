import { createFileRoute, Link } from "@tanstack/react-router";
import { Cpu, Bot, LayoutDashboard, ArrowRight } from "lucide-react";
import { PublicLayout } from "@/components/SiteNav";
import { TerminalVisual } from "@/components/TerminalVisual";
import { Button } from "@/components/ui/button";
import { HowItWorks, FeatureGrid, FaqList, CtaBand, SectionHead } from "@/components/Sections";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EA VORTEX — Power Your Trading" },
      { name: "description", content: "AI-powered chart analysis and Expert Advisor management in one trading platform. Free AI Chart Scanner with full GOLD support." },
      { property: "og:title", content: "EA VORTEX — Power Your Trading" },
      { property: "og:description", content: "AI-powered chart analysis and Expert Advisor management in one platform." },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <PublicLayout>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="eyebrow flex items-center gap-2"><span className="h-px w-8 bg-primary" />Next-generation trading technology</p>
            <h1 className="mt-6 text-5xl font-bold uppercase leading-[0.95] sm:text-6xl xl:text-7xl">
              Your edge.<br />Your strategy.<br />Your <span className="text-primary [text-shadow:0_0_40px_var(--primary)]">Vortex.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted-foreground">
              Bring AI-powered chart analysis and Expert Advisor management together in one powerful trading platform.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button variant="hero" size="xl" asChild><Link to="/scanner">Open AI Scanner <ArrowRight /></Link></Button>
              <Button variant="frame" size="xl" asChild><Link to="/features">Explore the Platform</Link></Button>
            </div>
            <ul className="mt-10 grid gap-3 text-sm sm:grid-cols-3">
              {[
                { I: Cpu, t: "AI-Powered Chart Analysis" },
                { I: Bot, t: "Intelligent EA Management" },
                { I: LayoutDashboard, t: "One Connected Dashboard" },
              ].map(({ I, t }) => (
                <li key={t} className="flex items-center gap-2 text-muted-foreground"><I className="h-4 w-4 shrink-0 text-primary" />{t}</li>
              ))}
            </ul>
          </div>
          <TerminalVisual />
        </div>
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
