import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchBars } from "./marketdata";
import { forecastBias, isRelevant, newsReaction, parseFeed, type NewsBias, type NewsEvent, type NewsReaction } from "./news";

// ForexFactory weekly calendar (real forecast + previous figures). It rate-limits (HTTP 429), so we download
// it rarely and keep the copy: the file covers the whole week, so one good download lasts a long time.
const FEED_URLS = ["https://nfs.faireconomy.media/ff_calendar_thisweek.json"];

// Why the last download attempt failed (shown on screen when no calendar is available).
let lastFailure = "";

type Stored = { at: number; events: NewsEvent[] };

const KEY = "https://eavortexza.internal/news-calendar-ff-v2";
const FRESH_MS = 60 * 60_000; // try to refresh after 1 hour
const MAX_STALE_MS = 6 * 24 * 60 * 60_000; // keep using a saved copy for up to 6 days if refreshing is blocked
const RETRY_MS = 5 * 60_000; // never retry the rate-limited feed more than once per 5 min per server instance
let lastAttempt = 0;
let memory: Stored | null = null; // per server instance

function sharedCache(): Cache | null {
  try {
    return (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default ?? null;
  } catch {
    return null;
  }
}

async function readSaved(): Promise<Stored | null> {
  if (memory && memory.events.length > 0) return memory;
  try {
    const c = sharedCache();
    const hit = c ? await c.match(KEY) : null;
    if (!hit) return null;
    const v = (await hit.json()) as Stored;
    if (v && Array.isArray(v.events) && v.events.length > 0) {
      memory = v;
      return v;
    }
  } catch {
    // ignore
  }
  return null;
}

async function writeSaved(v: Stored): Promise<void> {
  memory = v;
  try {
    const c = sharedCache();
    if (!c) return;
    await c.put(
      KEY,
      new Response(JSON.stringify(v), {
        headers: { "Content-Type": "application/json", "Cache-Control": `max-age=${MAX_STALE_MS / 1000}` },
      }),
    );
  } catch {
    // caching is best-effort
  }
}

async function downloadFeed(failures: string[]): Promise<NewsEvent[] | null> {
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
      const json: unknown = await res.json().catch(() => null);
      const parsed = parseFeed(json);
      if (parsed.length === 0) {
        failures.push(`${host}: empty or invalid feed`);
        continue;
      }
      return parsed;
    } catch (err) {
      failures.push(`${host}: ${err instanceof Error ? err.name : "error"}`);
    }
  }
  return null;
}

/** Returns this week's calendar, or null when none can be loaded (never returns made-up events). */
async function loadCalendar(): Promise<NewsEvent[] | null> {
  const now = Date.now();
  const saved = await readSaved();
  if (saved && now - saved.at < FRESH_MS) return saved.events;

  if (now - lastAttempt > RETRY_MS) {
    lastAttempt = now;
    const failures: string[] = [];
    const events = await downloadFeed(failures);
    if (events) {
      await writeSaved({ at: now, events });
      lastFailure = "";
      return events;
    }
    lastFailure = failures.join("; ");
    console.warn("Calendar download failed:", lastFailure);
  }

  // Refresh blocked or too soon: a saved copy (up to 6 days old) is still right for this week.
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
