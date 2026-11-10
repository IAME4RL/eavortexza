import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchBars } from "./marketdata";
import { describeShape, forecastBias, isRelevant, newsReaction, parseEulerpool, parseFeed, type NewsBias, type NewsEvent, type NewsReaction } from "./news";

const FEED_URLS = ["https://nfs.faireconomy.media/ff_calendar_thisweek.json"];

// Primary source (needs the EULERPOOL_API_KEY secret). ForexFactory feed above is the backup.
const EULER_URLS = [
  "https://api.eulerpool.com/api/1/calendar/economic",
  "https://api.eulerpool.com/api/1/macro/calendar",
  "https://api.eulerpool.com/api/1/calendar/economic-calendar",
];

async function fetchEulerpool(failures: string[]): Promise<NewsEvent[] | null> {
  const key = process.env.EULERPOOL_API_KEY;
  if (!key) {
    failures.push("eulerpool: no API key set");
    return null;
  }
  for (const url of EULER_URLS) {
    const tag = new URL(url).pathname.split("/").slice(-2).join("/");
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        // Short snippet of the provider's error text (temporary debugging aid).
        const snippet = (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 70);
        failures.push(`eulerpool ${tag}: HTTP ${res.status}${snippet ? ` ${snippet}` : ""}`);
        continue;
      }
      const json: unknown = await res.json().catch(() => null);
      const events = parseEulerpool(json);
      lastShape = describeShape(json);
      if (events.length === 0) {
        failures.push(`eulerpool ${tag}: no usable events (${describeShape(json)})`);
        continue;
      }
      return events;
    } catch (err) {
      failures.push(`eulerpool ${tag}: ${err instanceof Error ? err.name : "error"}`);
    }
  }
  return null;
}

// Why the last download attempt failed (shown on screen to help debugging).
let lastFailure = "";
// Short description of the last Eulerpool response (for on-screen diagnostics).
let lastShape = "";

// In-memory copy (per server instance)
let cache: Stored | null = null;

// Shared cache (Cloudflare Cache API) so one successful download serves every server instance.
// Falls back to a per-instance memory copy when the Cache API is not available (e.g. local dev).
const CACHE_KEY = "https://eavortexza.internal/news-calendar-v3";
const FRESH_MS = 60 * 60_000; // refresh after 1 hour
const MAX_STALE_MS = 3 * 24 * 60 * 60_000; // still usable (as a fallback) for 3 days

type Stored = { at: number; events: NewsEvent[]; src?: string; meta?: string };

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
async function loadCalendar(): Promise<{ events: NewsEvent[]; src: string; meta: string } | null> {
  const now = Date.now();
  const saved = (cache && cache.events.length > 0 ? cache : null) ?? (await readShared());
  if (saved && now - saved.at < FRESH_MS) {
    cache = saved;
    return { events: saved.events, src: saved.src ?? "cache", meta: saved.meta ?? "" };
  }

  const failures: string[] = [];
  const fromEuler = await fetchEulerpool(failures);
  if (fromEuler) {
    cache = { at: now, events: fromEuler, src: "eulerpool", meta: lastShape };
    lastFailure = "";
    await writeShared(cache);
    return { events: fromEuler, src: "eulerpool", meta: lastShape };
  }
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
      cache = { at: now, events: parsed, src: "forexfactory" };
      lastFailure = "";
      await writeShared(cache);
      return { events: parsed, src: "forexfactory", meta: "" };
    } catch (err) {
      failures.push(`${host}: ${err instanceof Error ? err.name : "error"}`);
    }
  }
  lastFailure = failures.join("; ");
  console.warn("Calendar feed failed:", lastFailure);

  // Feed failed: use the last good copy if it is not too old, otherwise report unavailable.
  if (saved && now - saved.at < MAX_STALE_MS) return { events: saved.events, src: `${saved.src ?? "cache"} (stale)`, meta: saved.meta ?? "" };
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
    const loaded = await loadCalendar();
    if (!loaded) {
      return { ok: false as const, instrument: data.instrument, items: [] as NewsItem[], error: "calendar_unavailable", detail: lastFailure };
    }
    const { events, src, meta } = loaded;
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

    // Short summary shown on screen when nothing matches (helps diagnose data problems).
    const impacts: Record<string, number> = {};
    for (const e of events) impacts[e.impact] = (impacts[e.impact] ?? 0) + 1;
    const times = events.map((e) => e.time).filter(Number.isFinite);
    const day = (t: number) => new Date(t).toISOString().slice(0, 10);
    const debug = items.length > 0 ? "" : [
      `${src}: ${events.length} events`,
      `USD ${events.filter((e) => e.country === "USD").length}`,
      `impact ${Object.entries(impacts).map(([k, v]) => `${k} ${v}`).join(", ") || "none"}`,
      times.length ? `dates ${day(Math.min(...times))} to ${day(Math.max(...times))}` : "no dates",
      ...(events.some((e) => e.impact === "High" || e.impact === "Medium") || !meta ? [] : [meta]),
    ].join(" · ");

    return {
      ok: true as const,
      instrument: data.instrument,
      items,
      source: "Economic Calendar",
      debug,
    };
  });
