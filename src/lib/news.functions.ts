import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchBars } from "./marketdata";
import { forecastBias, isRelevant, newsReaction, parseFeed, type NewsBias, type NewsEvent, type NewsReaction } from "./news";

const FEED_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
let cache: { at: number; events: NewsEvent[] } | null = null;

async function loadCalendar(): Promise<NewsEvent[] | null> {
  if (cache && Date.now() - cache.at < 15 * 60_000) return cache.events;
  try {
    const res = await fetch(FEED_URL, { headers: { "User-Agent": "Mozilla/5.0 (EA VORTEX news)" } });
    if (!res.ok) return cache?.events ?? null;
    const events = parseFeed(await res.json());
    cache = { at: Date.now(), events };
    return events;
  } catch {
    return cache?.events ?? null;
  }
}

export interface NewsItem extends NewsEvent { bias: NewsBias; reaction: NewsReaction }

export const getNewsSignals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ instrument: z.string().default("XAUUSD") }).parse(d ?? {}))
  .handler(async ({ data }) => {
    const events = await loadCalendar();
    if (!events) return { ok: false as const, error: "The economic calendar is unavailable right now. Try again shortly." };
    const now = Date.now();
    const relevant = events
      .filter((e) => isRelevant(e, data.instrument) && e.time > now - 3 * 60 * 60_000)
      .sort((a, b) => a.time - b.time)
      .slice(0, 12);

    const needBars = relevant.some((e) => e.time <= now);
    const bars = needBars ? await fetchBars(data.instrument, "M5", now) : null;

    const items: NewsItem[] = relevant.map((e) => {
      const bias = forecastBias(e, data.instrument);
      let reaction: NewsReaction = { state: "upcoming" };
      if (e.time <= now) {
        reaction = bars?.ok
          ? newsReaction(e, bars.bars, bias, bars.digits, now)
          : { state: "expired", reason: bars && !bars.ok ? bars.error : "No market data." };
      }
      return { ...e, bias, reaction };
    });
    return { ok: true as const, instrument: data.instrument, items, source: "ForexFactory calendar · Yahoo Finance M5" };
  });
