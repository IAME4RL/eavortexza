import { createFileRoute } from "@tanstack/react-router";
import circuit from "@/assets/home-circuit.jpg";
import { FeaturedBotCard } from "@/components/FeaturedBotCard";

const bot = {
  id: "b1",
  name: "Jigsaw EA",
  mentor_name: "sadd0ii",
  description:
    "Scalping, SMC and Breakout execution on GOLD. Sessions filtered to London and New York opens.",
  strategies: "Scalping, SMC, Breakout",
  avatar_url: circuit,
  background_url: circuit,
};

export const Route = createFileRoute("/botcard-preview")({
  component: () => (
    <main className="mx-auto max-w-sm space-y-4 bg-background p-3">
      <FeaturedBotCard
        mentorBot={bot}
        userBot={{ strategy: "smc_liquidity_sweep", trading_mode: "demo" }}
        running={false}
        online={false}
        control={{
          hasBot: true,
          status: "stopped",
          busy: false,
          blockers: [],
          onStart: () => {},
          onStop: () => {},
        }}
      />
      <FeaturedBotCard
        mentorBot={null}
        userBot={null}
        running={false}
        online={false}
        control={{
          hasBot: false,
          status: "stopped",
          busy: false,
          blockers: [],
          onStart: () => {},
          onStop: () => {},
        }}
      />
    </main>
  ),
});
