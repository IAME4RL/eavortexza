import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Bot, Play, ShieldCheck, Square, Zap } from "lucide-react";
import { parseStrategies, type AssignedMentorBot } from "@/lib/mentorBotDisplay";

type UserBot = { strategy: string; trading_mode: string } | null | undefined;

/** Start/Stop wiring for the client's own bridge bot. Omitted = no controls (e.g. in tests). */
export type BotControl = {
  /** False when the client has no bridge bot yet (no MT5 account / bot not set up). */
  hasBot: boolean;
  status: string;
  busy: boolean;
  blockers: string[];
  onStart: () => void;
  onStop: () => void;
};

type Props = {
  control?: BotControl | undefined;
  /** Bot assigned through a redeemed mentor license; null/undefined keeps the default card. */
  mentorBot: AssignedMentorBot | null | undefined;
  /** True while the assignment is still being fetched, so the default card doesn't flash first. */
  loading?: boolean;
  /** The client's own bridge bot row, used for mode and running state. */
  userBot: UserBot;
  running: boolean;
  online: boolean;
};

/**
 * Obsidian panel with a dark crimson frame and a soft ambient wash — the compact look
 * the bot card has in the phone app, sized down so it doesn't dominate the screen.
 */
const SHELL = "relative overflow-hidden rounded-xl border border-bot-border bg-bot-card shadow-[var(--bot-glow)]";

/** Soft vignette mask: the picture dissolves into the card instead of ending in a frame. */
const FEATHER =
  "[mask-image:radial-gradient(ellipse_80%_74%_at_50%_46%,#000_58%,transparent_100%)] [-webkit-mask-image:radial-gradient(ellipse_80%_74%_at_50%_46%,#000_58%,transparent_100%)]";

function StatusBadge({ running }: { running: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold ${
        running
          ? "border border-emerald-500/30 bg-emerald-500/20 text-emerald-400"
          : "border border-primary/30 bg-primary/20 text-primary-soft"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${running ? "animate-pulse bg-emerald-400" : "bg-primary"}`}
      />
      {running ? "ACTIVE" : "STANDBY"}
    </span>
  );
}

function Tile({
  label,
  value,
  valueClass = "text-foreground",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="min-w-0 rounded-md bg-background/60 p-2">
      <p className="truncate text-[9px] font-semibold uppercase text-muted-foreground">{label}</p>
      <p className={`mt-0.5 truncate font-mono text-xs font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

function BotControls({ control }: { control: BotControl }) {
  if (!control.hasBot) {
    return (
      <div className="mt-3 rounded-lg border border-border/60 bg-background/40 p-2.5" data-testid="bot-controls">
        <p className="text-xs text-muted-foreground">
          Register your MT5 account and set up your bot to start trading.
        </p>
        <Link
          to="/dashboard/auto-trade"
          className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90"
        >
          <Zap className="h-3.5 w-3.5" />
          Set up bot
        </Link>
      </div>
    );
  }
  const running = control.status === "running";
  return (
    <div className="mt-3" data-testid="bot-controls">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={control.onStart}
          disabled={control.busy || running}
          className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 font-display text-xs font-bold uppercase tracking-wider text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Play className="h-3.5 w-3.5" />
          {control.status === "paused" ? "Resume" : "Start bot"}
        </button>
        <button
          type="button"
          onClick={control.onStop}
          disabled={control.busy || control.status === "stopped"}
          className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-primary/50 bg-background/50 px-3 font-display text-xs font-bold uppercase tracking-wider text-foreground transition-all hover:border-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Square className="h-3.5 w-3.5" />
          Stop bot
        </button>
      </div>
      {control.blockers.length > 0 && (
        <div role="alert" className="mt-2 rounded-lg border border-destructive/50 p-2.5 text-xs">
          <p className="font-semibold">Start blocked:</p>
          <ul className="mt-1 list-disc pl-5 text-muted-foreground">
            {control.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CardFooter({ control }: { control?: BotControl | undefined }) {
  return (
    <>
      {control && <BotControls control={control} />}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-1">
        <p className="text-[11px] text-muted-foreground">
          Risk, lot size and the Windows MetaTrader 5 bridge live in Auto Trade.
        </p>
        <Link
          to="/dashboard/auto-trade"
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-primary-foreground transition-all hover:bg-primary/90"
        >
          <Zap className="h-3.5 w-3.5" />
          Manage Bot Controls
        </Link>
      </div>
    </>
  );
}

/* ------------------------------ default card ------------------------------ */

function DefaultCard({ userBot, running, online, control }: Pick<Props, "userBot" | "running" | "online" | "control">) {
  return (
    <div className={`${SHELL} p-4`} data-testid="featured-bot-default">
      <div className="bot-wash pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="rounded bg-primary/20 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-primary-soft">
              {userBot ? userBot.strategy.replace(/_/g, " ") : "QUANTUM VORTEX AI"}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {userBot?.trading_mode === "live" ? "LIVE EXECUTION" : "DEMO / TEST"}
            </span>
          </div>
          <h2 className="font-display text-base font-black uppercase tracking-wide text-foreground sm:text-lg">
            {userBot ? "EA VORTEX ENGINE" : "GOLD VORTEX PRO AI"}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Institutional order block &amp; ICT liquidity execution on XAUUSD.
          </p>
        </div>
        <div className="shrink-0 text-right">
          <StatusBadge running={running} />
        </div>
      </div>

      <div className="relative mt-3 grid grid-cols-2 gap-2 border-t border-bot-border pt-3 sm:grid-cols-4">
        <Tile label="Target Symbol" value="GOLD / XAUUSD" />
        <Tile label="Win Rate (Backtest)" value="78.4%" valueClass="text-emerald-400" />
        <Tile label="Max Drawdown" value="4.2%" />
        <Tile
          label="MT5 Bridge"
          value={online ? "Connected" : "Disconnected"}
          valueClass="text-primary-soft"
        />
      </div>

      <div className="relative">
        <CardFooter control={control} />
      </div>
    </div>
  );
}

/* ------------------------------ loading card ------------------------------ */

function LoadingCard() {
  return (
    <div
      className={`${SHELL} p-4`}
      aria-busy="true"
      aria-label="Loading featured bot"
      data-testid="featured-bot-loading"
    >
      <div className="animate-pulse space-y-2">
        <div className="h-3 w-28 rounded bg-primary/15" />
        <div className="h-5 w-2/3 rounded bg-foreground/10" />
        <div className="h-2.5 w-1/2 rounded bg-foreground/10" />
        <div className="grid grid-cols-2 gap-2 pt-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-9 rounded-md bg-background/60" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- mentor card ------------------------------ */

function MentorCard({
  bot,
  userBot,
  running,
  online,
  control,
}: { bot: AssignedMentorBot } & Pick<Props, "userBot" | "running" | "online" | "control">) {
  // Remember URLs that failed to load: a broken upload falls back gracefully, and a
  // re-uploaded image (new URL) is tried again without a reload.
  const [failed, setFailed] = useState<string[]>([]);
  const usable = (url: string | null): url is string => !!url && !failed.includes(url);
  const markFailed = (url: string) =>
    setFailed((prev) => (prev.includes(url) ? prev : [...prev, url]));

  const avatarUrl = usable(bot.avatar_url) ? bot.avatar_url : null;
  // The wide hero shows the banner when there is one, otherwise the bot's picture.
  const heroUrl = usable(bot.background_url) ? bot.background_url : avatarUrl;
  const strategies = parseStrategies(bot.strategies);
  const live = userBot?.trading_mode === "live";

  return (
    <div className={`${SHELL}`} data-testid="featured-bot-mentor">
      <div className="bot-wash pointer-events-none absolute inset-0" aria-hidden />
      {/* Header: small round avatar, bot name, mentor, status */}
      <div className="relative flex items-center gap-2.5 px-4 pt-4">
        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-primary/70 bg-bot-card shadow-[0_0_14px_-6px_var(--primary)]">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={`${bot.name} profile`}
              decoding="async"
              onError={() => markFailed(avatarUrl)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary/15">
              <Bot className="h-4 w-4 text-primary" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="break-words font-display text-base font-black uppercase leading-tight tracking-wide text-foreground sm:text-lg">
            {bot.name}
          </h2>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            Mentor <span className="font-semibold text-primary-soft">{bot.mentor_name}</span>
          </p>
        </div>
        <div className="shrink-0">
          <StatusBadge running={running} />
        </div>
      </div>

      {/* Hero: borderless picture whose edges feather into the card, kept short on phones. */}
      <div className="relative mt-2 aspect-[16/9] max-h-40 sm:aspect-[21/9] sm:max-h-none" data-testid="mentor-hero">
        {heroUrl ? (
          <img
            src={heroUrl}
            alt={`${bot.name} cover`}
            loading="lazy"
            decoding="async"
            onError={() => markFailed(heroUrl)}
            className={`absolute inset-0 h-full w-full object-cover object-[center_25%] ${FEATHER}`}
          />
        ) : (
          <div
            className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary-deep/40 via-bot-card to-bot-card ${FEATHER}`}
          >
            <Bot className="h-10 w-10 text-primary/60" />
          </div>
        )}
        <div className="absolute left-4 top-2 flex items-center gap-1.5 rounded-full border border-primary/40 bg-background/70 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-primary-soft backdrop-blur">
          <ShieldCheck className="h-2.5 w-2.5" />
          Mentor Bot
        </div>
      </div>

      <div className="relative px-4 pb-4">
        {bot.description && (
          <p className="mt-3 line-clamp-3 whitespace-pre-line break-words text-xs leading-relaxed text-muted-foreground">
            {bot.description}
          </p>
        )}

        {strategies.length > 0 && (
          <div className="mt-3">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Trading Strategies
            </p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {strategies.map((st) => (
                <li
                  key={st}
                  className="rounded-full border border-primary/35 bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary-soft"
                >
                  {st}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Only facts we actually know for this bot; the backtest figures on the default card belong to the default bot. */}
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-bot-border pt-3 sm:grid-cols-4">
          <Tile label="Mentor" value={bot.mentor_name} />
          <Tile
            label="Execution"
            value={live ? "Live" : "Demo / Test"}
            valueClass={live ? "text-emerald-400" : "text-foreground"}
          />
          <Tile
            label="Bot Status"
            value={running ? "Active" : "Standby"}
            valueClass={running ? "text-emerald-400" : "text-primary-soft"}
          />
          <Tile
            label="MT5 Bridge"
            value={online ? "Connected" : "Disconnected"}
            valueClass="text-primary-soft"
          />
        </div>

        <CardFooter control={control} />
      </div>
    </div>
  );
}

/* --------------------------------- public --------------------------------- */

export function FeaturedBotCard({ mentorBot, loading, userBot, running, online, control }: Props) {
  if (loading) return <LoadingCard />;
  if (mentorBot)
    return <MentorCard bot={mentorBot} userBot={userBot} running={running} online={online} control={control} />;
  return <DefaultCard userBot={userBot} running={running} online={online} control={control} />;
}
