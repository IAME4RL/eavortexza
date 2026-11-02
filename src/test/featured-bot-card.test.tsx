import { act } from "react";
import type { ReactElement, ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...rest }: { children: ReactNode; to: string }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

import { BotControls, BotPills, FeaturedBotCard } from "@/components/FeaturedBotCard";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const bot = {
  id: "b1",
  name: "Gold Sniper Pro",
  mentor_name: "Earl Mentor",
  description: "Trades London open sweeps on XAUUSD.",
  strategies: "Scalping, SMC, Breakout",
  avatar_url: "https://cdn.example/avatar.png",
  background_url: "https://cdn.example/banner.png",
};
const base = { userBot: null, running: false, online: false };

let root: Root | null = null;
let host: HTMLElement | null = null;

function mount(ui: ReactElement) {
  if (!host) {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  }
  act(() => root!.render(ui));
  return host;
}
const q = (el: HTMLElement, sel: string) => el.querySelector(sel);
const text = (el: HTMLElement) => el.textContent ?? "";

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

describe("FeaturedBotCard", () => {
  it("shows the default picture card when no mentor license is redeemed", () => {
    const el = mount(<FeaturedBotCard mentorBot={null} {...base} />);
    expect(q(el, '[data-testid="featured-bot-default"]')).not.toBeNull();
    expect(q(el, '[data-testid="featured-bot-mentor"]')).toBeNull();
    expect(text(el)).toBe("");
  });

  it("shows a loading shell instead of flashing the default card", () => {
    const el = mount(<FeaturedBotCard mentorBot={undefined} loading {...base} />);
    expect(q(el, '[data-testid="featured-bot-loading"]')).not.toBeNull();
    expect(q(el, '[data-testid="featured-bot-default"]')).toBeNull();
  });

  it("is only the picture: no text, buttons or description inside the mentor card", () => {
    const el = mount(<FeaturedBotCard mentorBot={bot} {...base} running online />);
    expect(text(el)).toBe("");
    expect(el.querySelectorAll("button, a")).toHaveLength(0);
    expect(q(el, `img[src="${bot.background_url}"]`)).not.toBeNull();
    expect(q(el, '[data-testid="featured-bot-mentor"]')?.getAttribute("aria-label")).toBe(bot.name);
  });

  it("uses the bot picture as the card when there is no banner", () => {
    const el = mount(<FeaturedBotCard mentorBot={{ ...bot, background_url: null }} {...base} />);
    const hero = q(el, '[data-testid="mentor-hero"]') as HTMLElement;
    expect(q(hero, `img[src="${bot.avatar_url}"]`)).not.toBeNull();
  });

  it("falls back from a broken banner to the bot picture", () => {
    const el = mount(<FeaturedBotCard mentorBot={bot} {...base} />);
    const banner = q(el, `img[src="${bot.background_url}"]`)!;
    act(() => {
      banner.dispatchEvent(new Event("error"));
    });
    const hero = q(el, '[data-testid="mentor-hero"]') as HTMLElement;
    expect(q(hero, `img[src="${bot.avatar_url}"]`)).not.toBeNull();
  });

  it("falls back to the bot icon when images are missing", () => {
    const el = mount(<FeaturedBotCard mentorBot={{ ...bot, avatar_url: null, background_url: null }} {...base} />);
    expect(el.querySelectorAll("img")).toHaveLength(0);
    expect(q(el, '[data-testid="featured-bot-mentor"]')).not.toBeNull();
  });
});

describe("BotPills / BotControls", () => {
  it("shows ACTIVE or STANDBY above the card", () => {
    expect(text(mount(<BotPills running />))).toContain("Active");
    expect(text(mount(<BotPills running={false} />))).toContain("Standby");
  });

  it("offers Start and Stop and lists start blockers", () => {
    const control = { hasBot: true, status: "stopped", busy: false, blockers: ["MT5 bridge is not online"], onStart: () => {}, onStop: () => {} };
    const el = mount(<BotControls control={control} />);
    expect(text(el)).toContain("Start bot");
    expect(text(el)).toContain("Stop bot");
    expect(text(el)).toContain("MT5 bridge is not online");
  });
});
