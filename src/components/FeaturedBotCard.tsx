import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Bot, ShieldCheck, Zap } from "lucide-react";
import { parseStrategies, type AssignedMentorBot } from "@/lib/mentorBotDisplay";

type UserBot = { strategy: string; trading_mode: string } | null | undefined;

type Props = {
  /** Bot assigned through a redeemed mentor license; null/undefined keeps the default card. */
  mentorBot: AssignedMentorBot | null | undefined;
  /** True while the assignment is still being fetched, so the default card doesn't flash first. */
  loading?: boolean;
  /** The client's own bridge bot row, used for mode and running state. */
  userBot: UserBot;
  running: boolean;
  online: boolean;
};

const SHELL =
  "relative overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-surface via-surface/90 to-primary/10 shadow-2xl";

function StatusBadge({ running }: { running: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs font-bold ${
        running
          ? "border border-emerald-500/30 bg-emerald-500/20 text-emerald-400"
          : "border border-primary/30 bg-primary/20 text-primary"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${running ? "animate-pulse bg-emerald-400" : "bg-primary"}`}
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
    <div className="min-w-0 rounded-lg bg-black/40 p-2.5">
      <p className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</p>
      <p className={`mt-0.5 truncate font-mono text-sm font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

function CardFooter() {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-2">
      <p className="text-xs text-muted-foreground">
        Configure risk, lot size, and Windows MetaTrader 5 bridge in Auto Trade.
      </p>
      <Link
        to="/dashboard/auto-trade"
        className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-primary-foreground transition-all hover:bg-primary/90"
      >
        <Zap className="h-3.5 w-3.5" />
        Manage Bot Controls
      </Link>
    </div>
  );
}

/* ------------------------------ default card ------------------------------ */

function DefaultCard({ userBot, running, online }: Pick<Props, "userBot" | "running" | "online">) {
  return (
    <div className={`${SHELL} p-5`} data-testid="featured-bot-default">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="rounded bg-primary/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
              {userBot ? userBot.strategy.replace(/_/g, " ") : "QUANTUM VORTEX AI"}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {userBot?.trading_mode === "live" ? "LIVE EXECUTION" : "DEMO / TEST"}
            </span>
          </div>
          <h2 className="font-display text-xl font-black uppercase tracking-wide text-foreground sm:text-2xl">
            {userBot ? "EA VORTEX ENGINE" : "GOLD VORTEX PRO AI"}
          </h2>
          <p className="text-xs text-muted-foreground">
            Institutional order block &amp; ICT liquidity execution on XAUUSD.
          </p>
        </div>
        <div className="text-right">
          <StatusBadge running={running} />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border/60 pt-4 sm:grid-cols-4">
        <Tile label="Target Symbol" value="GOLD / XAUUSD" />
        <Tile label="Win Rate (Backtest)" value="78.4%" valueClass="text-emerald-400" />
        <Tile label="Max Drawdown" value="4.2%" />
        <Tile
          label="MT5 Bridge"
          value={online ? "Connected" : "Disconnected"}
          valueClass="text-primary"
        />
      </div>

      <CardFooter />
    </div>
  );
}

/* ------------------------------ loading card ------------------------------ */

function LoadingCard() {
  return (
    <div
      className={`${SHELL} p-5`}
      aria-busy="true"
      aria-label="Loading featured bot"
      data-testid="featured-bot-loading"
    >
      <div className="animate-pulse space-y-3">
        <div className="h-4 w-32 rounded bg-primary/15" />
        <div className="h-7 w-2/3 rounded bg-foreground/10" />
        <div className="h-3 w-1/2 rounded bg-foreground/10" />
        <div className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-black/40" />
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
}: { bot: AssignedMentorBot } & Pick<Props, "userBot" | "running" | "online">) {
  // Track the exact URL that failed so a mentor re-uploading an image recovers without a reload.
  const [badBanner, setBadBanner] = useState<string | null>(null);
  const [badAvatar, setBadAvatar] = useState<string | null>(null);
  const showBanner = !!bot.background_url && badBanner !== bot.background_url;
  const showAvatar = !!bot.avatar_url && badAvatar !== bot.avatar_url;
  const strategies = parseStrategies(bot.strategies);
  const live = userBot?.trading_mode === "live";

  return (
    <div className={`${SHELL} shadow-[var(--glow-red-soft)]`} data-testid="featured-bot-mentor">
      {/* Banner */}
      <div className="relative h-32 w-full overflow-hidden bg-gradient-to-br from-red-950 via-neutral-950 to-black sm:h-44">
        {showBanner && (
          <img
            src={bot.background_url!}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setBadBanner(bot.background_url)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {/* Legibility + neon wash, so any uploaded image sits comfortably in the dark theme */}
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-black/40 to-black/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-transparent mix-blend-screen" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />

        <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full border border-primary/40 bg-black/60 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-primary backdrop-blur">
          <ShieldCheck className="h-3 w-3" />
          Mentor Bot
        </div>
        <div className="absolute right-4 top-4 backdrop-blur-sm">
          <StatusBadge running={running} />
        </div>
      </div>

      {/* Identity */}
      <div className="px-5 pb-5">
        <div className="-mt-10 flex items-end gap-4 sm:-mt-12">
          <div className="relative z-10 h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 border-primary/70 bg-surface shadow-[var(--glow-red)] sm:h-24 sm:w-24">
            {showAvatar ? (
              <img
                src={bot.avatar_url!}
                alt={`${bot.name} profile`}
                decoding="async"
                onError={() => setBadAvatar(bot.avatar_url)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-primary/15">
                <Bot className="h-9 w-9 text-primary" />
              </div>
            )}
          </div>
          <div className="min-w-0 pb-1">
            <h2 className="break-words font-display text-xl font-black uppercase leading-tight tracking-wide text-foreground sm:text-2xl">
              {bot.name}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Mentor <span className="font-semibold text-primary">{bot.mentor_name}</span>
            </p>
          </div>
        </div>

        {bot.description && (
          <p className="mt-4 whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground">
            {bot.description}
          </p>
        )}

        {strategies.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Trading Strategies
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {strategies.map((s) => (
                <li
                  key={s}
                  className="rounded-full border border-primary/35 bg-primary/10 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-primary shadow-[0_0_14px_-6px_var(--primary)]"
                >
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Only facts we actually know for this bot; the backtest figures on the default card belong to the default bot. */}
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border/60 pt-4 sm:grid-cols-4">
          <Tile label="Mentor" value={bot.mentor_name} />
          <Tile
            label="Execution"
            value={live ? "Live" : "Demo / Test"}
            valueClass={live ? "text-emerald-400" : "text-foreground"}
          />
          <Tile
            label="Bot Status"
            value={running ? "Active" : "Standby"}
            valueClass={running ? "text-emerald-400" : "text-primary"}
          />
          <Tile
            label="MT5 Bridge"
            value={online ? "Connected" : "Disconnected"}
            valueClass="text-primary"
          />
        </div>

        <CardFooter />
      </div>
    </div>
  );
}

/* --------------------------------- public --------------------------------- */

export function FeaturedBotCard({ mentorBot, loading, userBot, running, online }: Props) {
  if (loading) return <LoadingCard />;
  if (mentorBot)
    return <MentorCard bot={mentorBot} userBot={userBot} running={running} online={online} />;
  return <DefaultCard userBot={userBot} running={running} online={online} />;
}
