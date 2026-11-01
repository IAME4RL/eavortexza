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
      { name: "description", content: "Upload a forex, GOLD, index or crypto chart and get structured AI technical analysis. Free for registered users." },
      { property: "og:title", content: "Free AI Chart Scanner — EA VORTEX" },
      { property: "og:description", content: "AI technical analysis of your chart screenshots, with full GOLD / XAUUSD support." },
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
            Upload a chart screenshot. A real AI vision model reviews market structure, support and resistance, patterns,
            and bullish and bearish scenarios — and tells you honestly when the image isn't clear enough.
          </p>
          {user
            ? <Link to="/dashboard/scanner" className="pw-btn pw-btn-solid mt-8 px-7"><ScanLine className="h-4 w-4" /> Open Scanner</Link>
            : <Link to="/auth" search={{ mode: "signup" }} className="pw-btn pw-btn-solid mt-8 px-7"><ScanLine className="h-4 w-4" /> Create free account to scan</Link>}
          <ul className="mx-auto mt-10 grid max-w-2xl gap-2 text-left text-sm text-muted-foreground sm:grid-cols-2">
            {["PNG, JPG and JPEG uploads", "GOLD & XAUUSD variations recognised", "Scalping, day and swing perspectives", "Private, deletable scan history"].map((t) => (
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
