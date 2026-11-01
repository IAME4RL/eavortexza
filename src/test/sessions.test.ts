import { describe, expect, it } from "vitest";
import { formatRemaining, marketSession } from "@/lib/sessions";

describe("marketSession", () => {
  it("headlines the most recently opened session and lists the overlap", () => {
    const s = marketSession(new Date("2026-11-04T14:00:00Z")); // Wednesday
    expect(s.state).toBe("open");
    if (s.state !== "open") return;
    expect(s.name).toBe("New York");
    expect(s.alsoOpen).toEqual(["London"]);
    expect(s.remainingMs).toBe(8 * 3_600_000);
  });

  it("handles sessions that cross midnight", () => {
    const s = marketSession(new Date("2026-11-04T23:00:00Z"));
    expect(s.state === "open" && s.name).toBe("Sydney");
  });

  it("reports the market closed over the weekend with time to the Sunday open", () => {
    const sat = marketSession(new Date("2026-11-07T10:00:00Z"));
    expect(sat.state).toBe("closed");
    const sun = marketSession(new Date("2026-11-08T21:00:00Z"));
    expect(sun.state === "closed" && sun.opensInMs).toBe(3_600_000);
    const fri = marketSession(new Date("2026-11-06T22:30:00Z"));
    expect(fri.state).toBe("closed");
  });

  it("formats remaining time compactly", () => {
    expect(formatRemaining(3 * 3_600_000 + 26 * 60_000)).toBe("3h 26m");
    expect(formatRemaining(40 * 60_000)).toBe("40m");
    expect(formatRemaining(50 * 3_600_000)).toBe("2d 2h");
  });
});
