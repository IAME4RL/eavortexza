import { describe, expect, it } from "vitest";
import { normalizeAssignedBot, parseStrategies } from "@/lib/mentorBotDisplay";

describe("parseStrategies", () => {
  it("splits comma separated strategies and trims them", () => {
    expect(parseStrategies("Scalping, SMC ,  Breakout")).toEqual(["Scalping", "SMC", "Breakout"]);
  });
  it("accepts other separators and drops blanks and case-insensitive duplicates", () => {
    expect(parseStrategies("ICT; smc\nSMC | | hedging,,")).toEqual(["ICT", "smc", "hedging"]);
  });
  it("handles empty input", () => {
    expect(parseStrategies("")).toEqual([]);
    expect(parseStrategies(null)).toEqual([]);
    expect(parseStrategies(undefined)).toEqual([]);
  });
  it("caps count and length", () => {
    const many = Array.from({ length: 20 }, (_, i) => `s${i}`).join(",");
    expect(parseStrategies(many)).toHaveLength(8);
    expect(parseStrategies("x".repeat(100))[0]).toHaveLength(32);
  });
});

describe("normalizeAssignedBot", () => {
  const row = {
    id: "b1",
    name: "Gold Sniper",
    mentor_name: "Earl",
    description: "d",
    strategies: "SMC",
    avatar_url: "a.png",
    background_url: "  ",
  };
  it("maps a full row and nulls blank image urls", () => {
    expect(normalizeAssignedBot(row)).toEqual({ ...row, background_url: null });
  });
  it("unwraps an array embed", () => {
    expect(normalizeAssignedBot([row])?.id).toBe("b1");
  });
  it("returns null when there is no bot", () => {
    expect(normalizeAssignedBot(null)).toBeNull();
    expect(normalizeAssignedBot(undefined)).toBeNull();
    expect(normalizeAssignedBot({ id: 5 })).toBeNull();
  });
  it("falls back when mentor name is blank", () => {
    expect(normalizeAssignedBot({ ...row, mentor_name: "" })?.mentor_name).toBe("Your mentor");
  });
});
