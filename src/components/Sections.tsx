import { Link } from "@tanstack/react-router";
import { Upload, Cpu, FolderLock, ScanLine, Bot, LayoutDashboard, Shield, Users, BarChart3, LineChart } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { Button } from "./ui/button";

export function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: React.ReactNode; sub?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold uppercase sm:text-4xl">{title}</h2>
      {sub && <p className="mt-4 text-muted-foreground">{sub}</p>}
    </div>
  );
}

const STEPS = [
  { n: "01", t: "Upload", d: "Upload a chart and choose your instrument and timeframe.", I: Upload },
  { n: "02", t: "Analyse", d: "Let the connected AI service examine your chart and identify relevant technical patterns.", I: Cpu },
  { n: "03", t: "Review", d: "Explore your results and save your analysis to your private dashboard.", I: FolderLock },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <SectionHead eyebrow="How it works" title={<>Three steps to <span className="text-primary">clarity</span></>} />
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {STEPS.map(({ n, t, d, I }) => (
          <div key={n} className="panel group relative overflow-hidden p-7 transition-colors hover:border-primary/60">
            <span className="absolute right-5 top-4 font-display text-5xl font-bold text-foreground/5">{n}</span>
            <div className="flex h-11 w-11 items-center justify-center rounded-md border border-primary/40 text-primary"><I className="h-5 w-5" /></div>
            <p className="mt-6 font-mono text-xs text-primary">STEP {n}</p>
            <h3 className="mt-1 text-xl font-bold uppercase">{t}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const FEATURES = [
  { I: ScanLine, t: "AI Chart Scanner", d: "Upload any chart screenshot and get structured technical analysis: structure, zones, patterns and scenarios." },
  { I: Bot, t: "EA Management", d: "A dedicated area for your Expert Advisors, built for MetaTrader integrations as they come online." },
  { I: LayoutDashboard, t: "One Dashboard", d: "Scans, accounts, analytics and notifications in a single private workspace." },
  { I: Users, t: "Mentor Portal", d: "Approved mentors can review the activity their assigned clients choose to share." },
  { I: BarChart3, t: "Trading Analytics", d: "Balance, equity and drawdown views that only populate from genuinely connected accounts." },
  { I: Shield, t: "Private by Design", d: "Your charts and history are stored privately. Only you can open your records." },
];

export function FeatureGrid() {
  return (
    <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map(({ I, t, d }) => (
        <div key={t} className="bg-card p-7 transition-colors hover:bg-surface">
          <I className="h-6 w-6 text-primary" />
          <h3 className="mt-5 text-lg font-bold uppercase">{t}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{d}</p>
        </div>
      ))}
    </div>
  );
}

export const FAQS = [
  { q: "Is the AI Chart Scanner free?", a: "Yes. Access is free for registered users. To keep AI processing costs sustainable, each account has a daily scan allowance set by the administrator — your remaining scans are always shown on the scanner page." },
  { q: "Can I scan GOLD charts?", a: "Yes. GOLD is fully supported, along with common symbol variations such as XAUUSD, XAU/USD, GOLDUSD and broker suffixes like XAUUSD.m. Select GOLD directly even if your broker labels it differently." },
  { q: "Does the scanner guarantee profitable trades?", a: "No. AI analysis is probabilistic and may be incorrect. Any setup shown is a hypothetical scenario for educational purposes, not financial advice." },
  { q: "Can I connect my Expert Advisors?", a: "Supported integrations depend on your trading platform and the connections configured. You can register MetaTrader account details today; live connection, statistics and EA control become available only once the relevant integration is enabled." },
  { q: "Do I need a paid subscription?", a: "No. Creating an account and using the free chart scanner does not require a subscription or payment." },
  { q: "Is my scan history private?", a: "Yes. Your scans and uploaded charts are stored privately and can only be opened by you. If you have an assigned mentor, they can see only the analyses you explicitly save." },
];

export function FaqList() {
  return (
    <Accordion type="single" collapsible className="mx-auto max-w-3xl">
      {FAQS.map((f, i) => (
        <AccordionItem key={i} value={`f${i}`} className="border-border">
          <AccordionTrigger className="text-left font-display text-base font-semibold hover:text-primary hover:no-underline">{f.q}</AccordionTrigger>
          <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export function CtaBand() {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
      <div className="panel relative overflow-hidden p-10 text-center sm:p-14">
        <div className="absolute inset-0 radial-red" aria-hidden />
        <div className="relative">
          <LineChart className="mx-auto h-8 w-8 text-primary" />
          <h2 className="mt-4 text-3xl font-bold uppercase sm:text-4xl">Power your <span className="text-primary">trading</span></h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">Create a free account and run your first AI chart scan in under a minute.</p>
          <Button variant="hero" size="xl" className="mt-8" asChild><Link to="/auth" search={{ mode: "signup" }}>Get Started Free</Link></Button>
        </div>
      </div>
    </section>
  );
}
