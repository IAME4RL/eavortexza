// Approximate forex trading sessions in UTC (standard-time hours; they shift by an hour with daylight saving).
// Display-only: nothing in scanning, signals or order delivery depends on this.

export type SessionName = "Sydney" | "Tokyo" | "London" | "New York";

const SESSIONS: { name: SessionName; start: number; end: number }[] = [
  { name: "Sydney", start: 22, end: 7 },
  { name: "Tokyo", start: 0, end: 9 },
  { name: "London", start: 8, end: 17 },
  { name: "New York", start: 13, end: 22 },
];

export type MarketSession =
  | { state: "open"; name: SessionName; remainingMs: number; progress: number; alsoOpen: SessionName[]; hoursUtc: string }
  | { state: "closed"; opensInMs: number };

const HOUR = 3_600_000;
const pad = (n: number) => String(n).padStart(2, "0");

/** Forex is closed from Friday 22:00 UTC until Sunday 22:00 UTC. */
export function marketSession(now: Date): MarketSession {
  const day = now.getUTCDay();
  const h = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
  const closed = day === 6 || (day === 5 && h >= 22) || (day === 0 && h < 22);
  if (closed) {
    const next = new Date(now);
    next.setUTCHours(22, 0, 0, 0);
    while (next.getUTCDay() !== 0 || next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
    return { state: "closed", opensInMs: next.getTime() - now.getTime() };
  }
  const active = SESSIONS.map((s) => {
    const length = (s.end - s.start + 24) % 24;
    const elapsed = (h - s.start + 24) % 24;
    return { ...s, length, elapsed, on: elapsed < length };
  }).filter((s) => s.on);
  // Headline the session that opened most recently; list the others as overlapping.
  active.sort((a, b) => a.elapsed - b.elapsed);
  const head = active[0]!;
  return {
    state: "open",
    name: head.name,
    remainingMs: Math.max(0, (head.length - head.elapsed) * HOUR),
    progress: Math.min(1, head.elapsed / head.length),
    alsoOpen: active.slice(1).map((s) => s.name),
    hoursUtc: `${pad(head.start)}:00–${pad(head.end)}:00 UTC`,
  };
}

export function formatRemaining(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}d ${h}h`;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
