import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Bot, Play, Square, Zap } from "lucide-react";
import { type AssignedMentorBot } from "@/lib/mentorBotDisplay";
import { useAppearSound } from "@/hooks/useAppearSound";
import circuit from "@/assets/home-circuit.jpg";

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
  /** Kept for call-site compatibility: controls are rendered by <BotControls/> beside the card. */
  control?: BotControl | undefined;
  /** Bot assigned through a redeemed mentor license; null/undefined keeps the default card. */
  mentorBot: AssignedMentorBot | null | undefined;
  /** True while the assignment is still being fetched, so the default card doesn't flash first. */
  loading?: boolean;
  userBot?: UserBot;
  running?: boolean;
  online?: boolean;
};

/** Jigsaw EA plays its laugh when the card appears on screen. */
const JIGSAW_LAUGH = "/sounds/jigsaw-laugh.mp3";
const isJigsaw = (name: string | null | undefined) => /jigsaw/i.test(name ?? "");

/** Every card variant has exactly this size, measured from the reference app: the picture is about
 *  418 x 305 px on a phone screen (11:8), full content width, with no text or border chrome inside. */
const FRAME = "relative mx-auto aspect-[11/8] w-full max-w-md overflow-hidden rounded-xl bg-black shadow-[0_0_30px_-14px_var(--primary)]";

/** Status pills shown above the card (ACTIVE / STANDBY and the AI badge). */
export function BotPills({ running }: { running: boolean }) {
  return (
    <div className="flex items-center justify-center gap-6 py-1" data-testid="bot-pills">
      <span className="pw-pill" data-tone={running ? "live" : "idle"}>{running ? "Active" : "Standby"}</span>
      <span className="pw-pill" data-tone="live"><Zap className="h-3 w-3" aria-hidden />AI powered</span>
    </div>
  );
}

/** Start / Stop (and the checks that blocked a start). Lives outside the card. */
export function BotControls({ control }: { control: BotControl }) {
  if (!control.hasBot) {
    return (
      <div className="pw-card-quiet p-3" data-testid="bot-controls">
        <p className="text-xs text-muted-foreground">Register your MT5 account and set up your bot to start trading.</p>
        <Link to="/dashboard/auto-trade" className="pw-btn pw-btn-solid mt-2">
          <Zap className="h-3.5 w-3.5" />Set up bot
        </Link>
      </div>
    );
  }
  const running = control.status === "running";
  return (
    <div data-testid="bot-controls">
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={control.onStart} disabled={control.busy || running} className="pw-btn pw-btn-solid">
          <Play className="h-4 w-4" />
          {control.status === "paused" ? "Resume" : "Start bot"}
        </button>
        <button type="button" onClick={control.onStop} disabled={control.busy || control.status === "stopped"} className="pw-btn">
          <Square className="h-4 w-4" />Stop bot
        </button>
      </div>
      {control.blockers.length > 0 && (
        <div role="alert" className="mt-3 rounded-xl border border-destructive/50 p-3 text-xs">
          <p className="font-semibold">Start blocked:</p>
          <ul className="mt-1 list-disc pl-5 text-muted-foreground">
            {control.blockers.map((b) => (<li key={b}>{b}</li>))}
          </ul>
        </div>
      )}
    </div>
  );
}

function LoadingCard() {
  return (
    <div className={FRAME} aria-busy="true" aria-label="Loading featured bot" data-testid="featured-bot-loading">
      <div className="h-full w-full animate-pulse bg-primary/10" />
    </div>
  );
}

function DefaultCard() {
  return (
    <div className={FRAME} data-testid="featured-bot-default" role="img" aria-label="EA VORTEX bot">
      <img src={circuit} alt="" decoding="async" className="h-full w-full object-cover" />
    </div>
  );
}

function MentorCard({ bot }: { bot: AssignedMentorBot }) {
  // Remember URLs that failed to load: a broken upload falls back gracefully, and a
  // re-uploaded image (new URL) is tried again without a reload.
  const [failed, setFailed] = useState<string[]>([]);
  const usable = (url: string | null): url is string => !!url && !failed.includes(url);
  const markFailed = (url: string) => setFailed((prev) => (prev.includes(url) ? prev : [...prev, url]));

  // The bot background is the card; without one the bot's picture is used.
  const heroUrl = usable(bot.background_url) ? bot.background_url : usable(bot.avatar_url) ? bot.avatar_url : null;

  const cardRef = useRef<HTMLDivElement>(null);
  useAppearSound(cardRef, JIGSAW_LAUGH, isJigsaw(bot.name));

  return (
    <div ref={cardRef} className={FRAME} data-testid="featured-bot-mentor" role="img" aria-label={bot.name}>
      <div className="absolute inset-0 bg-black" data-testid="mentor-hero">
        {heroUrl ? (
          <img
            src={heroUrl}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => markFailed(heroUrl)}
            className="h-full w-full object-cover object-center"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-red-950 via-neutral-950 to-black">
            <Bot className="h-16 w-16 text-primary/60" />
          </div>
        )}
      </div>
    </div>
  );
}

export function FeaturedBotCard({ mentorBot, loading }: Props) {
  if (loading) return <LoadingCard />;
  if (mentorBot) return <MentorCard bot={mentorBot} />;
  return <DefaultCard />;
}
