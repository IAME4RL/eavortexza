import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PortalTitle, Chip } from "@/components/portal";
import { NewsSignals } from "@/components/NewsSignals";

const MARKETS = [["XAUUSD", "GOLD"], ["EURUSD", "EURUSD"], ["GBPUSD", "GBPUSD"], ["USDJPY", "USDJPY"]] as const;

export const Route = createFileRoute("/_authenticated/dashboard/news")({
  head: () => ({
    meta: [
      { title: "News Signals — EA VORTEX" },
      { name: "description", content: "Upcoming economic news with expected direction and post-release BUY/SELL breakout signals." },
      { property: "og:title", content: "News Signals — EA VORTEX" },
      { property: "og:description", content: "Economic news bias and news-breakout trade signals for GOLD and forex." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewsPage,
});

function NewsPage() {
  const [m, setM] = useState<string>("XAUUSD");
  return (
    <div className="space-y-4">
      <PortalTitle title="News Signals" sub="Upcoming news, expected direction and real post-release breakout trades." />
      <div className="flex flex-wrap gap-2">
        {MARKETS.map(([v, l]) => <Chip key={v} active={m === v} onClick={() => setM(v)}>{l}</Chip>)}
      </div>
      <NewsSignals instrument={m} full />
    </div>
  );
}
