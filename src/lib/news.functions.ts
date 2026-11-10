import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchBars } from "./marketdata";
import { describeShape, sampleRecord, forecastBias, isRelevant, newsReaction, parseEulerpool, parseFeed, type NewsBias, type NewsEvent, type NewsReaction } from "./news";

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
      lastShape = `${describeShape(json)} | CPI sample: ${sampleRecord(json, /\bcpi\b|consumer price|inflation/i)}`;
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

// Two sources, each with its own saved copy:
//  - ForexFactory feed: has real forecast/previous numbers, but often blocks (HTTP 429) our server.
//  - Eulerpool: reliable schedule, but forecast figures may be missing.
// Copies live in memory (per server instance) and in the Cloudflare Cache API (shared by all instances).
type Stored = { at: number; events: NewsEvent[]; src?: string; meta?: string };
type Loaded = { events: NewsEvent[]; src: string; meta: string };

const memory: Record<string, Stored | null> = { ff: null, euler: null };
const KEYS: Record<string, string> = {
  ff: "https://eavortexza.internal/news-calendar-ff-v1",
  euler: "https://eavortexza.internal/news-calendar-euler-v1",
};
const FRESH_MS = 60 * 60_000; // re-download after 1 hour
const FF_USABLE_MS = 12 * 60 * 60_000; // an older ForexFactory copy still beats Eulerpool (it has forecasts)
const MAX_STALE_MS = 3 * 24 * 60 * 60_000; // last-resort fallback age
const FF_RETRY_MS = 5 * 60_000; // do not hammer the rate-limited feed more than once per 5 min per instance
let lastFfAttempt = 0;

function sharedCache(): Cache | null {
  try {
    return (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default ?? null;
  } catch {
    return null;
  }
}

async function readStore(name: string): Promise<Stored | null> {
  const mem = memory[name];
  if (mem && mem.events.length > 0) return mem;
  try {
    const c = sharedCache();
    if (!c) return null;
    const hit = await c.match(KEYS[name]!);
    if (!hit) return null;
    const v = (await hit.json()) as Stored;
    if (v && Array.isArray(v.events) && v.events.length > 0) {
      memory[name] = v;
      return v;
    }
  } catch {
    // ignore
  }
  return null;
}

async function writeStore(name: string, v: Stored): Promise<void> {
  memory[name] = v;
  try {
    const c = sharedCache();
    if (!c) return;
    await c.put(
      KEYS[name]!,
      new Response(JSON.stringify(v), {
        headers: { "Content-Type": "application/json", "Cache-Control": `max-age=${MAX_STALE_MS / 1000}` },
      }),
    );
  } catch {
    // caching is best-effort
  }
}

async function fetchForexFactory(failures: string[]): Promise<NewsEvent[] | null> {
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

const ageLabel = (ms: number) => (ms < 90 * 60_000 ? `${Math.round(ms / 60_000)}m` : `${Math.round(ms / 3_600_000)}h`);

/** Returns this week's calendar, or null when it cannot be loaded (never returns made-up events). */
async function loadCalendar(): Promise<Loaded | null> {
  const now = Date.now();
  const failures: string[] = [];
  const ffSaved = await readStore("ff");
  const ffAge = ffSaved ? now - ffSaved.at : Infinity;

  // 1. ForexFactory: real forecasts. Use a fresh copy, else try to download (rate-limit friendly).
  if (ffSaved && ffAge < FRESH_MS) return { events: ffSaved.events, src: "forexfactory", meta: "" };
  if (now - lastFfAttempt > FF_RETRY_MS) {
    lastFfAttempt = now;
    const ff = await fetchForexFactory(failures);
    if (ff) {
      await writeStore("ff", { at: now, events: ff, src: "forexfactory" });
      lastFailure = "";
      return { events: ff, src: "forexfactory", meta: "" };
    }
  } else {
    failures.push("ff: waiting before retry");
  }
  // 1b. Download failed: a ForexFactory copy up to 12h old still beats Eulerpool.
  if (ffSaved && ffAge < FF_USABLE_MS) {
    lastFailure = failures.join("; ");
    return { events: ffSaved.events, src: `forexfactory (saved ${ageLabel(ffAge)} ago)`, meta: "" };
  }

  // 2. Eulerpool (schedule and impact; forecast figures only when it provides them).
  const eulerSaved = await readStore("euler");
  if (eulerSaved && now - eulerSaved.at < FRESH_MS) {
    return { events: eulerSaved.events, src: "eulerpool", meta: eulerSaved.meta ?? "" };
  }
  const euler = await fetchEulerpool(failures);
  if (euler) {
    await writeStore("euler", { at: now, events: euler, src: "eulerpool", meta: lastShape });
    lastFailure = failures.join("; ");
    return { events: euler, src: "eulerpool", meta: lastShape };
  }

  lastFailure = failures.join("; ");
  console.warn("Calendar sources failed:", lastFailure);

  // 3. Last resort: any saved copy that is not too old.
  if (ffSaved && ffAge < MAX_STALE_MS) return { events: ffSaved.events, src: "forexfactory (old copy)", meta: "" };
  if (eulerSaved && now - eulerSaved.at < MAX_STALE_MS) return { events: eulerSaved.events, src: "eulerpool (old copy)", meta: eulerSaved.meta ?? "" };
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
    const debug = items.length > 0
      ? (meta ? `${src} · ${meta}` : "")
      : [
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
