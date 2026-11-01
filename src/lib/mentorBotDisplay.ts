// Pure helpers for presenting a mentor's bot on the client home screen.
// Kept free of Supabase imports so they can be unit-tested in isolation.

export type AssignedMentorBot = {
  id: string;
  name: string;
  mentor_name: string;
  description: string;
  strategies: string;
  avatar_url: string | null;
  background_url: string | null;
};

const MAX_STRATEGIES = 8;
const MAX_STRATEGY_LENGTH = 32;

/**
 * Mentors type strategies as free text ("Scalping, SMC, Breakout"). Split on the
 * separators they are likely to use, trim, drop blanks and case-insensitive
 * duplicates, and cap the count/length so a long entry can't blow up the card.
 */
export function parseStrategies(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,;|\n\r\u2022]+/)) {
    const value = part.trim().replace(/\s+/g, " ").slice(0, MAX_STRATEGY_LENGTH).trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= MAX_STRATEGIES) break;
  }
  return out;
}

/** PostgREST returns a to-one embed as an object, but guard against an array. */
export function normalizeAssignedBot(raw: unknown): AssignedMentorBot | null {
  const bot = Array.isArray(raw) ? raw[0] : raw;
  if (!bot || typeof bot !== "object") return null;
  const b = bot as Record<string, unknown>;
  if (typeof b["id"] !== "string" || typeof b["name"] !== "string") return null;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const url = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    id: b["id"],
    name: b["name"],
    mentor_name: str(b["mentor_name"]) || "Your mentor",
    description: str(b["description"]),
    strategies: str(b["strategies"]),
    avatar_url: url(b["avatar_url"]),
    background_url: url(b["background_url"]),
  };
}
