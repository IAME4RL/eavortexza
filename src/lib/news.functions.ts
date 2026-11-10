import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchBars } from "./marketdata";
import { forecastBias, isRelevant, newsReaction, parseFeed, type NewsBias, type NewsEvent, type NewsReaction } from "./news";

const FEED_URLS = ["https://nfs.faireconomy.media/ff_calendar_thisweek.json"];

// Why the last download attempt failed (shown on screen to help debugging).
let lastFailure = "";

// In-memory copy (per server instance)
let cache: Stored | null = null;

// Shared cache (Cloudflare Cache API) so one successful download serves every server instance.
// Falls back to a per-instance memory copy when the Cache API is not available (e.g. local dev).
const CACHE_KEY = "https://eavortexza.internal/news-calendar-v1";
const FRESH_MS = 60 * 60_000; // refresh after 1 hour
const MAX_STALE_MS = 3 * 24 * 60 * 60_000; // still usable (as a fallback) for 3 days

type Stored = { at: number; events: NewsEvent[] };

function sharedCache(): Cache | null {
  try {
    return (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default ?? null;
  } catch {
    return null;
  }
}

async function readShared(): Promise<Stored | null> {
  try {
    const c = sharedCache();
    if (!c) return null;
    const hit = await c.match(CACHE_KEY);
    if (!hit) return null;
    const v = (await hit.json()) as Stored;
    return v && Array.isArray(v.events) && v.events.length > 0 ? v : null;
  } catch {
    return null;
  }
}

async function writeShared(v: Stored): Promise<void> {
  try {
    const c = sharedCache();
    if (!c) return;
    await c.put(
      CACHE_KEY,
      new Response(JSON.stringify(v), {
        headers: { "Content-Type": "application/json", "Cache-Control": `max-age=${MAX_STALE_MS / 1000}` },
      }),
    );
  } catch {
    // caching is best-effort
  }
}

/** Returns this week's calendar, or null when it cannot be loaded (never returns made-up events). */
async function loadCalendar(): Promise<NewsEvent[] | null> {
  const now = Date.now();
  const saved = (cache && cache.events.length > 0 ? cache : null) ?? (await readShared());
  if (saved && now - saved.at < FRESH_MS) {
    cache = saved;
    return saved.events;
  }

  const failures: string[] = [];
  for (const url of FEED_URLS) {
    const host = new URL(url).hostname.split(".")[0];
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          Accept: "application/json,text/plain,*/*",
        },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) {
        failures.push(`${host}: HTTP ${res.status}`);
        continue;
      }
      let json: unknown;
      try {
        json = await res.json();
      } catch {
        failures.push(`${host}: not JSON`);
        continue;
      }
      const parsed = parseFeed(json);
      if (parsed.length === 0) {
        failures.push(`${host}: empty feed`);
        continue;
      }
      cache = { at: now, events: parsed };
      lastFailure = "";
      await writeShared(cache);
      return parsed;
    } catch (err) {
      failures.push(`${host}: ${err instanceof Error ? err.name : "error"}`);
    }
  }
  lastFailure = failures.join("; ");
  console.warn("Calendar feed failed:", lastFailure);

  // Feed failed: use the last good copy if it is not too old, otherwise report unavailable.
  if (saved && now - saved.at < MAX_STALE_MS) return saved.events;
  return null;
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
    if (!events) {
      return { ok: false as const, instrument: data.instrument, items: [] as NewsItem[], error: "calendar_unavailable", detail: lastFailure };
    }
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
