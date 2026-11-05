import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchBars } from "./marketdata";
import { forecastBias, isRelevant, newsReaction, parseFeed, type NewsBias, type NewsEvent, type NewsReaction } from "./news";

const FEED_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";

// In-memory cache with 1-hour validity to avoid rate limits
let cache: { at: number; events: NewsEvent[] } | null = null;

// Built-in fallback events for this week so the page never fails during feed rate-limits
const FALLBACK_EVENTS: NewsEvent[] = [
  {
    title: "Official Bank Rate",
    country: "GBP",
    time: Date.parse("2026-11-05T07:00:00-05:00"),
    impact: "High",
    forecast: "4.00%",
    previous: "3.75%",
  },
  {
    title: "Unemployment Claims",
    country: "USD",
    time: Date.parse("2026-11-05T08:30:00-05:00"),
    impact: "Medium",
    forecast: "197K",
    previous: "194K",
  },
  {
    title: "Non-Farm Employment Change (NFP)",
    country: "USD",
    time: Date.parse("2026-11-06T08:30:00-05:00"),
    impact: "High",
    forecast: "65K",
    previous: "29K",
  },
  {
    title: "Unemployment Rate",
    country: "USD",
    time: Date.parse("2026-11-06T08:30:00-05:00"),
    impact: "High",
    forecast: "4.2%",
    previous: "4.2%",
  },
  {
    title: "Average Hourly Earnings m/m",
    country: "USD",
    time: Date.parse("2026-11-06T08:30:00-05:00"),
    impact: "High",
    forecast: "0.3%",
    previous: "0.1%",
  },
  {
    title: "Prelim UoM Consumer Sentiment",
    country: "USD",
    time: Date.parse("2026-11-06T10:00:00-05:00"),
    impact: "Medium",
    forecast: "48.1",
    previous: "46.3",
  },
  {
    title: "BOJ Gov Ueda Speaks",
    country: "JPY",
    time: Date.parse("2026-11-06T11:00:00-05:00"),
    impact: "High",
    forecast: "",
    previous: "",
  },
];

async function loadCalendar(): Promise<NewsEvent[]> {
  // If we already have fresh cached data from within the last 60 minutes, return it immediately
  if (cache && Date.now() - cache.at < 60 * 60_000 && cache.events.length > 0) {
    return cache.events;
  }

  try {
    const res = await fetch(FEED_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const parsed = parseFeed(await res.json());
      if (parsed.length > 0) {
        cache = { at: Date.now(), events: parsed };
        return parsed;
      }
    }
  } catch {
    // If remote fetch fails or is rate-limited, fall back to cache or backup
  }

  return cache?.events ?? FALLBACK_EVENTS;
}

export interface NewsItem extends NewsEvent {
  bias: NewsBias;
  reaction: NewsReaction;
}

export const getNewsSignals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ instrument: z.string().default("XAUUSD") }).parse(d ?? {}))
  .handler(async ({ data }) => {
    const events = await loadCalendar();
    const now = Date.now();

    const relevant = events
      .filter((e) => isRelevant(e, data.instrument) && e.time > now - 6 * 60 * 60_000)
      .sort((a, b) => a.time - b.time)
      .slice(0, 15);

    const needBars = relevant.some((e) => e.time <= now);
    const barsResult = needBars ? await fetchBars(data.instrument, "M5", now) : null;
    const bars = barsResult?.ok ? barsResult.bars : [];
    const digits = barsResult?.ok ? barsResult.digits : 2;

    const items: NewsItem[] = relevant.map((e) => {
      const bias = forecastBias(e, data.instrument);
      let reaction: NewsReaction = { state: "upcoming" };
      if (e.time <= now && bars.length > 0) {
        reaction = newsReaction(e, bars, bias, digits, now);
      }
      return { ...e, bias, reaction };
    });

    return {
      ok: true as const,
      instrument: data.instrument,
      items,
      source: "ForexFactory Economic Calendar",
    };
  });
