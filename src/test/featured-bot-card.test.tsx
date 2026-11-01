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

import { FeaturedBotCard } from "@/components/FeaturedBotCard";

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
  it("keeps the default EAVORTEX card when no mentor license is redeemed", () => {
    const el = mount(<FeaturedBotCard mentorBot={null} {...base} />);
    expect(q(el, '[data-testid="featured-bot-default"]')).not.toBeNull();
    expect(text(el)).toContain("GOLD VORTEX PRO AI");
    expect(q(el, '[data-testid="featured-bot-mentor"]')).toBeNull();
  });

  it("shows a loading shell instead of flashing the default card", () => {
    const el = mount(<FeaturedBotCard mentorBot={undefined} loading {...base} />);
    expect(q(el, '[data-testid="featured-bot-loading"]')).not.toBeNull();
    expect(text(el)).not.toContain("GOLD VORTEX PRO AI");
  });

  it("shows every mentor bot field once a license is redeemed", () => {
    const el = mount(<FeaturedBotCard mentorBot={bot} {...base} running online />);
    expect(q(el, '[data-testid="featured-bot-default"]')).toBeNull();
    const t = text(el);
    expect(t).toContain("Gold Sniper Pro");
    expect(t).toContain("Earl Mentor");
    expect(t).toContain("Trades London open sweeps on XAUUSD.");
    for (const s of ["Scalping", "SMC", "Breakout"])
      expect(t.toUpperCase()).toContain(s.toUpperCase());
    expect(q(el, `img[src="${bot.avatar_url}"]`)).not.toBeNull();
    expect(q(el, `img[src="${bot.background_url}"]`)).not.toBeNull();
    expect(t).toContain("ACTIVE");
    expect(t).toContain("Connected");
  });

  it("does not show the default bot's hardcoded backtest figures for a mentor bot", () => {
    const el = mount(<FeaturedBotCard mentorBot={bot} {...base} />);
    expect(text(el)).not.toContain("78.4%");
    expect(text(el)).not.toContain("GOLD / XAUUSD");
    expect(text(el)).toContain("STANDBY");
  });

  it("falls back to the bot icon when images are missing", () => {
    const el = mount(
      <FeaturedBotCard mentorBot={{ ...bot, avatar_url: null, background_url: null }} {...base} />,
    );
    expect(el.querySelectorAll("img")).toHaveLength(0);
    expect(text(el)).toContain("Gold Sniper Pro");
  });

  it("drops a broken image instead of showing a broken icon, then recovers on a new URL", () => {
    const el = mount(<FeaturedBotCard mentorBot={bot} {...base} />);
    const avatar = q(el, `img[alt="${bot.name} profile"]`)!;
    act(() => {
      avatar.dispatchEvent(new Event("error"));
    });
    expect(q(el, `img[src="${bot.avatar_url}"]`)).toBeNull();

    mount(
      <FeaturedBotCard
        mentorBot={{ ...bot, avatar_url: "https://cdn.example/new.png" }}
        {...base}
      />,
    );
    expect(q(el, 'img[src="https://cdn.example/new.png"]')).not.toBeNull();
  });

  it("uses the bot picture as the wide hero when there is no banner", () => {
    const el = mount(<FeaturedBotCard mentorBot={{ ...bot, background_url: null }} {...base} />);
    const hero = q(el, '[data-testid="mentor-hero"]')!;
    expect(q(hero as HTMLElement, `img[src="${bot.avatar_url}"]`)).not.toBeNull();
  });

  it("uses the banner for the hero and the picture for the small round avatar", () => {
    const el = mount(<FeaturedBotCard mentorBot={bot} {...base} />);
    const hero = q(el, '[data-testid="mentor-hero"]') as HTMLElement;
    expect(q(hero, `img[src="${bot.background_url}"]`)).not.toBeNull();
    expect(q(hero, `img[src="${bot.avatar_url}"]`)).toBeNull();
    expect(q(el, `img[alt="${bot.name} profile"]`)).not.toBeNull();
  });

  it("falls back from a broken banner to the bot picture in the hero", () => {
    const el = mount(<FeaturedBotCard mentorBot={bot} {...base} />);
    const banner = q(el, `img[src="${bot.background_url}"]`)!;
    act(() => {
      banner.dispatchEvent(new Event("error"));
    });
    const hero = q(el, '[data-testid="mentor-hero"]') as HTMLElement;
    expect(q(hero, `img[src="${bot.avatar_url}"]`)).not.toBeNull();
  });

  it("omits empty description and strategies sections cleanly", () => {
    const el = mount(
      <FeaturedBotCard mentorBot={{ ...bot, description: "", strategies: "" }} {...base} />,
    );
    expect(text(el)).not.toContain("Trading Strategies");
    expect(text(el)).toContain("Gold Sniper Pro");
  });
});
