import { createFileRoute, Link } from "@tanstack/react-router";
import { ScanLine, CheckCircle2 } from "lucide-react";
import { PublicLayout } from "@/components/SiteNav";
import { HowItWorks } from "@/components/Sections";
import { useAuth } from "@/lib/auth";
import { INSTRUMENTS } from "@/lib/instruments";

export const Route = createFileRoute("/scanner")({
  head: () => ({
    meta: [
      { title: "Free AI Chart Scanner — EA VORTEX" },
      { name: "description", content: "Scan forex, GOLD, index and crypto markets and get rule-based BUY / SELL signals with entry, stop-loss and take-profit. Free for registered users." },
      { property: "og:title", content: "Free AI Chart Scanner — EA VORTEX" },
      { property: "og:description", content: "BUY / SELL signals from real market data, with full GOLD / XAUUSD support." },
    ],
  }),
  component: ScannerLanding,
});

function ScannerLanding() {
  const { user } = useAuth();
  return (
    <PublicLayout>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 radial-red" aria-hidden />
        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
          <p className="pw-label text-primary">Free for registered users</p>
          <h1 className="pw-title mt-4 text-4xl sm:text-6xl">AI Chart Scanner</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Pick an instrument and timeframe. The scanner reads real closed price bars, confirms on the higher timeframe,
            and gives you a BUY or SELL setup with entry, stop-loss and take-profit — or tells you honestly when there is no trade.
          </p>
          {user
            ? <Link to="/dashboard/scanner" className="pw-btn pw-btn-solid mt-8 px-7"><ScanLine className="h-4 w-4" /> Open Scanner</Link>
            : <Link to="/auth" search={{ mode: "signup" }} className="pw-btn pw-btn-solid mt-8 px-7"><ScanLine className="h-4 w-4" /> Create free account to scan</Link>}
          <ul className="mx-auto mt-10 grid max-w-2xl gap-2 text-left text-sm text-muted-foreground sm:grid-cols-2">
            {["Real closed-bar market data", "GOLD & XAUUSD supported", "M1 to D1 timeframes", "Private signal history"].map((t) => (
              <li key={t} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" />{t}</li>
            ))}
          </ul>
          <div className="mt-10 flex flex-wrap justify-center gap-2">
            {INSTRUMENTS.map((i) => (
              <span key={i} className="pw-chip !min-h-0 font-mono !tracking-normal !normal-case">{i}</span>
            ))}
          </div>
        </div>
      </section>
      <HowItWorks />
    </PublicLayout>
  );
}
